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
sudo mkdir -p /opt/chorus && sudo chown $USER /opt/chorus
git clone -b claude/chorus-inner-voices-e80k62 <твой-git-url> /opt/chorus
cd /opt/chorus

npm install
npm --prefix worker install
```

## 3. Сборка фронта

```bash
npm run build          # → /opt/chorus/dist
```

Фронт обращается к `/respond` относительно своего домена, так что веб-сервер должен
проксировать `/respond` на бэкенд (см. ниже). Отдельный `VITE_API_BASE` не нужен.

> На 1 ГБ без swap сборка может убиться по OOM. Тогда собери локально
> (`npm ci && npm run build`) и залей: `rsync -av dist/ user@vps:/opt/chorus/dist/`.

## 4. Бэкенд как сервис (systemd)

Ключ кладём в отдельный файл (не в git):

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-ЗАМЕНИ' | sudo tee /etc/chorus.env
sudo chmod 600 /etc/chorus.env
```

`/etc/systemd/system/chorus.service`:

```ini
[Unit]
Description=Chorus backend
After=network.target

[Service]
WorkingDirectory=/opt/chorus/worker
EnvironmentFile=/etc/chorus.env
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
sudo chown -R www-data:www-data /opt/chorus
sudo systemctl daemon-reload
sudo systemctl enable --now chorus
sudo systemctl status chorus            # active (running)
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
chorus.твой-домен.рф {
    root * /opt/chorus/dist
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

Caddy сам выпустит и продлит сертификат. Открой `https://chorus.твой-домен.рф`.

### Вариант Б — nginx + certbot

`/etc/nginx/sites-available/chorus`:

```nginx
server {
    listen 80;
    server_name chorus.твой-домен.рф;
    root /opt/chorus/dist;
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
sudo ln -s /etc/nginx/sites-available/chorus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chorus.твой-домен.рф
```

> Если на VPS уже занят 80/443 (другой сайт/VPN-панель) — повесь Chorus на отдельный
> поддомен и убедись, что веб-сервер только один слушает эти порты.

---

## Обновление

```bash
cd /opt/chorus && git pull
npm install && npm --prefix worker install
npm run build
sudo systemctl restart chorus
```

## Диагностика

```bash
sudo journalctl -u chorus -f          # логи бэкенда
sudo systemctl status chorus caddy    # (или nginx)
```

- Сцены не приходят, в логах `Anthropic 401` → неверный/пустой `ANTHROPIC_API_KEY`.
- `502` на `/respond` → бэкенд не запущен (`systemctl status chorus`).
- Белый экран → не собралась статика или неверный `root` в конфиге веб-сервера.

## Локальная разработка (для сравнения)

```bash
cp worker/.dev.vars.example worker/.dev.vars   # впиши ключ
npm run worker:dev    # wrangler dev на :8787
npm run dev           # Vite проксирует /respond на воркер
```
