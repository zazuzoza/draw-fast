# Деплой «Хора» на свой VPS (Ubuntu)

Архитектура простая:

- **Фронт** — статика (Vite build, папка `dist/`), её отдаёт веб-сервер.
- **Бэкенд** — тонкий Node-процесс (`worker/`, через `tsx`), слушает `127.0.0.1:8787`,
  принимает `POST /respond` и ходит в Anthropic API. Своего «ИИ» он не крутит — вся
  генерация на стороне Anthropic.

Хватит ли 1 ГБ / 1 ядра / 10 ГБ: **да.** Node в простое ~70 МБ, под нагрузкой ~150 МБ.
Нагрузка — ожидание сети, не CPU. Единственное — сборка `vite build` может упереться в
память: добавь swap (ниже) **или** собери `dist` локально и залей по `scp`/`rsync`.

Нужен ключ Anthropic API (`sk-ant-...`) и желательно домен (для HTTPS).

---

## 0. (если 1 ГБ) swap для сборки

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 1. Node 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # >= 18
```

## 2. Код и зависимости

```bash
sudo mkdir -p /opt/khor && sudo chown $USER /opt/khor
git clone https://github.com/zazuzoza/khor /opt/khor
cd /opt/khor

npm install
npm --prefix worker install
```

## 3. Сборка фронта

```bash
npm run build          # → /opt/khor/dist
```

Фронт обращается к `/respond` относительно своего домена, так что веб-сервер должен
проксировать `/respond` на бэкенд (см. ниже). Отдельный `VITE_API_BASE` не нужен.

> На 1 ГБ без swap сборка может убиться по OOM. Тогда собери локально
> (`npm ci && npm run build`) и залей: `rsync -av dist/ user@vps:/opt/khor/dist/`.

## 4. Бэкенд как сервис (systemd)

Ключ кладём в отдельный файл (не в git):

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-ЗАМЕНИ' | sudo tee /etc/khor.env
sudo chmod 600 /etc/khor.env
```

`/etc/systemd/system/khor.service`:

```ini
[Unit]
Description=Khor backend
After=network.target

[Service]
WorkingDirectory=/opt/khor/worker
EnvironmentFile=/etc/khor.env
Environment=PORT=8787
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=2
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /opt/khor
sudo systemctl daemon-reload
sudo systemctl enable --now khor
sudo systemctl status khor            # active (running)
curl -s -X OPTIONS localhost:8787/respond -o /dev/null -w '%{http_code}\n'  # 200
```

## 5. Веб-сервер + HTTPS

### Вариант А — Caddy (проще, авто-TLS)

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/caddy.list
sudo apt-get update && sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```
khor.твой-домен.рф {
    root * /opt/khor/dist
    encode gzip
    handle /respond* {
        reverse_proxy 127.0.0.1:8787
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

```bash
sudo systemctl reload caddy
```

Caddy сам выпустит и продлит сертификат. Открой `https://khor.твой-домен.рф`.

### Вариант Б — nginx + certbot

`/etc/nginx/sites-available/khor`:

```nginx
server {
    listen 80;
    server_name khor.твой-домен.рф;
    root /opt/khor/dist;
    index index.html;

    location /respond {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
    }
    location / {
        try_files $uri /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/khor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d khor.твой-домен.рф
```

> Если на VPS уже занят 80/443 (другой сайт/VPN-панель) — повесь Хор на отдельный
> поддомен и убедись, что веб-сервер только один слушает эти порты.

---

## Обновление

```bash
cd /opt/khor && git pull
npm install && npm --prefix worker install
npm run build
sudo systemctl restart khor
```

## Диагностика

```bash
sudo journalctl -u khor -f          # логи бэкенда
sudo systemctl status khor caddy    # (или nginx)
```

- Сцены не приходят, в логах `Anthropic 401` → неверный/пустой `ANTHROPIC_API_KEY`.
- `502` на `/respond` → бэкенд не запущен (`systemctl status khor`).
- Белый экран → не собралась статика или неверный `root` в конфиге веб-сервера.

## Локальная разработка (для сравнения)

```bash
cp worker/.dev.vars.example worker/.dev.vars   # впиши ключ
npm run worker:dev    # wrangler dev на :8787
npm run dev           # Vite проксирует /respond на воркер
```
