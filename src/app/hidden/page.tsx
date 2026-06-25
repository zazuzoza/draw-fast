'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRACTICES, Practice, SEED_CARDS } from './practices'

/* ────────────────────────────────────────────────────────────────────────
   Hidden — демо Фазы 0 скрытой микро-осознанности.
   Браузер не может реально читать акселерометр/гео без устройства, поэтому
   контекстный движок ниже честно смоделирован как конечный автомат:
        движение + место + длительность остановки → оценка «уместности»
   При уместном моменте уходит сверх-минималистичный сигнал на часах:
   чёрный экран, один белый кружок, короткая лёгкая вибрация.
   ──────────────────────────────────────────────────────────────────────── */

type Motion = 'moving' | 'still'
type Place = 'metro' | 'street' | 'home' | 'meeting' | 'driving'

const PLACES: Record<
	Place,
	{ label: string; emoji: string; calm: number; private: number; note: string }
> = {
	// calm   — насколько уместна тихая пауза (0..1)
	// private— насколько момент «свой», без социального давления (0..1)
	metro: { label: 'Метро, плат­форма', emoji: '🚇', calm: 0.9, private: 0.7, note: 'ждёшь поезд — пауза органична' },
	street: { label: 'Улица, иду', emoji: '🚶', calm: 0.4, private: 0.6, note: 'на ходу практику не навязываем' },
	home: { label: 'Дома, на диване', emoji: '🛋️', calm: 0.8, private: 1, note: 'спокойно, но дома и так есть время' },
	meeting: { label: 'Офис, встреча', emoji: '👥', calm: 0.1, private: 0.1, note: 'не дёргаем — соц. давление' },
	driving: { label: 'За рулём, еду', emoji: '🚗', calm: 0, private: 0.5, note: 'движение — сигнал заблокирован' },
}

const DWELL_MS = 10_000 // «остановился дольше, чем на 10 секунд»

export default function HiddenDemo() {
	return (
		<main className="wrap">
			<Hero />
			<ContextEngine />
			<Library />
			<Ambush />
			<Unlock />
			<Footer />
			<Styles />
		</main>
	)
}

/* ─────────────────────────────  HERO  ───────────────────────────── */

function Hero() {
	return (
		<header className="hero">
			<div className="kicker">HIDDEN · демо</div>
			<h1>
				Присутствие,
				<br />
				которое никто не заметит.
			</h1>
			<p className="lede">
				Не таймер на 10 минут. Микро-остановка на 20 секунд в момент, который и так
				происходит: лифт, очередь, метро. Глаза открыты, позы нет. Со стороны ты
				просто стоишь — внутри собран, как никогда.
			</p>
			<a className="cta" href="#engine">
				Посмотреть, как это работает ↓
			</a>
		</header>
	)
}

/* ──────────────────────  КОНТЕКСТНЫЙ ДВИЖОК + ЧАСЫ  ────────────────────── */

type Signal =
	| { kind: 'idle' }
	| { kind: 'armed'; remaining: number } // остановился, идёт отсчёт уместности
	| { kind: 'fired'; practice: Practice } // тихий сигнал на часах
	| { kind: 'blocked'; reason: string } // момент неуместен

function ContextEngine() {
	const [place, setPlace] = useState<Place>('metro')
	const [motion, setMotion] = useState<Motion>('moving')
	const [signal, setSignal] = useState<Signal>({ kind: 'idle' })
	const [log, setLog] = useState<string[]>([])
	const [trainer, setTrainer] = useState<Practice | null>(null)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)
	const stoppedAt = useRef<number>(0)

	const addLog = useCallback((line: string) => {
		const t = new Date().toLocaleTimeString('ru-RU', { hour12: false })
		setLog((l) => [`${t}  ${line}`, ...l].slice(0, 6))
	}, [])

	const clear = () => {
		if (timer.current) clearInterval(timer.current)
		timer.current = null
	}

	// Реакция на изменение движения/места — ядро «уместности».
	useEffect(() => {
		clear()
		const p = PLACES[place]

		if (motion === 'moving') {
			setSignal({ kind: 'idle' })
			return
		}

		// motion === 'still'. Проверяем уместность момента.
		if (p.calm < 0.3) {
			setSignal({ kind: 'blocked', reason: `${p.label}: ${p.note}` })
			addLog(`остановка, но момент неуместен → молчим (${p.label})`)
			return
		}

		// Уместно: ждём, пока остановка продлится дольше порога.
		stoppedAt.current = Date.now()
		addLog(`остановился в «${p.label}» — слежу за длительностью…`)
		setSignal({ kind: 'armed', remaining: DWELL_MS })
		timer.current = setInterval(() => {
			const left = DWELL_MS - (Date.now() - stoppedAt.current)
			if (left <= 0) {
				clear()
				const practice = pickPractice(place)
				setSignal({ kind: 'fired', practice })
				addLog(`остановка > 10с → тихий сигнал на часах (${practice.title})`)
				vibrate([0, 45]) // одна короткая лёгкая вибрация
			} else {
				setSignal({ kind: 'armed', remaining: left })
			}
		}, 200)

		return clear
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [motion, place])

	const openFromWatch = (practice: Practice) => {
		addLog(`сигнал принят с часов → практика «${practice.title}»`)
		setTrainer(practice)
	}

	const dismissFromWatch = () => {
		addLog('сигнал на часах проигнорирован — это ок, без чувства вины')
		setSignal({ kind: 'idle' })
		setMotion('moving')
	}

	return (
		<section id="engine" className="engine">
			<h2>Как сигнал приходит незаметно</h2>
			<p className="sub">
				Часы пассивно читают движение и место. Когда ты остановился дольше 10 секунд
				там, где пауза уместна, приходит почти невидимый сигнал: один белый кружок и
				короткая лёгкая вибрация. Ничего доставать не нужно.
			</p>

			<div className="engineGrid">
				{/* Левая колонка — управление «датчиками» (симуляция) */}
				<div className="panel">
					<div className="panelTitle">Контекст (симуляция датчиков)</div>

					<label className="fieldLabel">Где ты</label>
					<div className="places">
						{(Object.keys(PLACES) as Place[]).map((p) => (
							<button
								key={p}
								className={`place ${place === p ? 'active' : ''}`}
								onClick={() => setPlace(p)}
							>
								<span className="placeEmoji">{PLACES[p].emoji}</span>
								{PLACES[p].label}
							</button>
						))}
					</div>

					<label className="fieldLabel">Движение</label>
					<div className="motionToggle">
						<button
							className={motion === 'moving' ? 'active' : ''}
							onClick={() => setMotion('moving')}
						>
							🚶 Еду / иду
						</button>
						<button
							className={motion === 'still' ? 'active' : ''}
							onClick={() => setMotion('still')}
						>
							🧍 Остановился
						</button>
					</div>

					<div className="reasoning">
						<EngineState signal={signal} place={place} />
					</div>

					<div className="log">
						{log.length === 0 ? (
							<span className="logEmpty">Журнал движка появится здесь…</span>
						) : (
							log.map((l, i) => (
								<div key={i} className="logLine">
									{l}
								</div>
							))
						)}
					</div>
				</div>

				{/* Правая колонка — часы */}
				<div className="watchWrap">
					<Watch signal={signal} onOpen={openFromWatch} onDismiss={dismissFromWatch} />
					<div className="watchHint">
						{signal.kind === 'fired'
							? 'Коснись кружка, чтобы открыть практику — или просто проигнорируй.'
							: 'Поставь «Метро» + «Остановился» и подожди 10 секунд.'}
					</div>
				</div>
			</div>

			{trainer && <Trainer practice={trainer} onClose={() => setTrainer(null)} />}
		</section>
	)
}

function EngineState({ signal, place }: { signal: Signal; place: Place }) {
	if (signal.kind === 'idle')
		return <span className="stIdle">● в движении — движок спит</span>
	if (signal.kind === 'blocked')
		return <span className="stBlocked">✕ молчим — {signal.reason}</span>
	if (signal.kind === 'armed') {
		const sec = Math.ceil(signal.remaining / 1000)
		return (
			<span className="stArmed">
				◴ уместный момент ({PLACES[place].label}). Сигнал через {sec}с, если не
				двинешься…
			</span>
		)
	}
	return <span className="stFired">◉ тихий сигнал отправлен на часы</span>
}

/* ─────────────────────────────  ЧАСЫ  ───────────────────────────── */

function Watch({
	signal,
	onOpen,
	onDismiss,
}: {
	signal: Signal
	onOpen: (p: Practice) => void
	onDismiss: () => void
}) {
	const fired = signal.kind === 'fired'
	const [expanded, setExpanded] = useState(false)

	useEffect(() => {
		if (!fired) setExpanded(false)
	}, [fired])

	return (
		<div className="watch">
			<div className="watchBezel">
				<div className="watchScreen">
					{!fired && (
						<div className="watchFace">
							<div className="watchTime">9:41</div>
							<div className="watchSub">Hidden следит за моментом</div>
						</div>
					)}

					{fired && !expanded && (
						<button
							className="watchDot"
							onClick={() => setExpanded(true)}
							aria-label="Тихий сигнал"
						>
							<span className="dot" />
						</button>
					)}

					{fired && expanded && signal.kind === 'fired' && (
						<div className="watchCard">
							<div className="watchSeed">{signal.practice.seed}</div>
							<div className="watchBtns">
								<button className="wOpen" onClick={() => onOpen(signal.practice)}>
									Начать · {signal.practice.seconds}с
								</button>
								<button className="wSkip" onClick={onDismiss}>
									Не сейчас
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
			<div className="watchCrown" />
		</div>
	)
}

/* ───────────────────────  ТРЕНАЖЁР ПРАКТИКИ  ─────────────────────── */

function Trainer({ practice, onClose }: { practice: Practice; onClose: () => void }) {
	const [step, setStep] = useState(0)
	const [done, setDone] = useState(false)
	const current = practice.steps[step]

	useEffect(() => {
		if (done) return
		const t = setTimeout(() => {
			if (step < practice.steps.length - 1) setStep((s) => s + 1)
			else finish()
		}, current.hold)
		return () => clearTimeout(t)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step, done])

	const finish = () => {
		setDone(true)
		vibrate([0, 30, 60, 30])
		bumpStops()
	}

	return (
		<div className="overlay" onClick={onClose}>
			<div className="trainer" onClick={(e) => e.stopPropagation()}>
				<button className="close" onClick={onClose} aria-label="Закрыть">
					✕
				</button>

				{!done ? (
					<>
						<div className="breath" />
						<div className="stepLabel">{current.label}</div>
						<div className="stepText">{current.text}</div>
						<div className="dots">
							{practice.steps.map((_, i) => (
								<span key={i} className={`pdot ${i <= step ? 'on' : ''}`} />
							))}
						</div>
						<button className="skip" onClick={finish}>
							Завершить раньше
						</button>
					</>
				) : (
					<div className="doneScreen">
						<div className="doneMark">✓</div>
						<div className="doneTitle">Это заняло {practice.seconds} секунд.</div>
						<div className="doneSub">Никто не заметил. Ты — заметил.</div>
						<button className="cta" onClick={onClose}>
							Вернуться в день
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

/* ────────────────────────  БИБЛИОТЕКА ПРАКТИК  ──────────────────────── */

function Library() {
	const [open, setOpen] = useState<Practice | null>(null)
	const [stops, setStops] = useState(0)

	useEffect(() => setStops(getStops()), [open])

	return (
		<section className="library">
			<div className="libHead">
				<h2>Библиотека моментов</h2>
				<div className="stopsBadge" title="Метрика успеха — не время в приложении, а число остановок">
					Остановок сегодня: <b>{stops}</b>
				</div>
			</div>
			<div className="cards">
				{PRACTICES.map((p) => (
					<button key={p.id} className="card" onClick={() => setOpen(p)}>
						<div className="cardTop">
							<span className="cardTitle">{p.title}</span>
							<span className="cardSec">{p.seconds}с</span>
						</div>
						<div className="cardCtx">{p.context}</div>
						<div className="cardSeed">«{p.seed}»</div>
					</button>
				))}
			</div>
			{open && <Trainer practice={open} onClose={() => setOpen(null)} />}
		</section>
	)
}

/* ───────────────────  РАНДОМНЫЕ «ЗАСАДЫ»  ─────────────────── */

function Ambush() {
	const [armed, setArmed] = useState(false)
	const [toast, setToast] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const schedule = useCallback(() => {
		const delay = 6000 + Math.random() * 9000 // 6–15с (в проде — окна в течение дня)
		timer.current = setTimeout(() => {
			const seed = SEED_CARDS[Math.floor(Math.random() * SEED_CARDS.length)]
			setToast(seed)
			vibrate([0, 35])
			setTimeout(() => setToast(null), 6000)
			schedule()
		}, delay)
	}, [])

	useEffect(() => {
		if (armed) schedule()
		return () => {
			if (timer.current) clearTimeout(timer.current)
		}
	}, [armed, schedule])

	return (
		<section className="ambush">
			<h2>Рандомные «засады»</h2>
			<p className="sub">
				Помимо контекстных сигналов — редкие случайные напоминания в течение дня.
				Предсказуемый пуш становится фоном, поэтому момент выбирается рандомно.
				Включи и поймай одно за 6–15 секунд.
			</p>
			<button className={`toggle ${armed ? 'on' : ''}`} onClick={() => setArmed((a) => !a)}>
				{armed ? 'Засады включены — выключить' : 'Включить засады (демо)'}
			</button>
			{toast && (
				<div className="toast">
					<span className="toastDot" />
					{toast}
				</div>
			)}
		</section>
	)
}

/* ───────────────────────  ПОКУПКА (без подписки)  ─────────────────────── */

type Pack = { id: string; title: string; sub: string; price: string }

const PACKS: Pack[] = [
	{ id: 'commute', title: 'Дорога', sub: '8 практик для метро, пробок и пересадок', price: '₽190' },
	{ id: 'sleep', title: 'Перед сном', sub: 'Тихие остановки, чтобы день отпустил тебя', price: '₽190' },
	{ id: 'sound', title: 'Тихие саундскейпы', sub: 'Фон и тактильные паттерны для часов', price: '₽250' },
]

const OWN_KEY = 'hidden_owned'

function Unlock() {
	const [owned, setOwned] = useState(false)
	const [packs, setPacks] = useState<string[]>([])

	useEffect(() => {
		setOwned(localStorage.getItem(OWN_KEY) === '1')
		try {
			setPacks(JSON.parse(localStorage.getItem('hidden_packs') || '[]'))
		} catch {
			setPacks([])
		}
	}, [])

	const buy = () => {
		localStorage.setItem(OWN_KEY, '1')
		setOwned(true)
		vibrate([0, 30, 50, 30])
	}
	const reset = () => {
		localStorage.removeItem(OWN_KEY)
		localStorage.removeItem('hidden_packs')
		setOwned(false)
		setPacks([])
	}
	const togglePack = (id: string) => {
		const next = packs.includes(id) ? packs.filter((p) => p !== id) : [...packs, id]
		setPacks(next)
		localStorage.setItem('hidden_packs', JSON.stringify(next))
		vibrate([0, 25])
	}

	return (
		<section className="unlock">
			<h2>Заплати один раз. Потом можешь уйти.</h2>
			<p className="sub">
				Мы правда хотим, чтобы со временем ты перестал нуждаться в приложении. Поэтому —
				никаких подписок: они заставили бы нас держать тебя подольше. Купил один раз —
				и оно твоё навсегда, даже когда ты «преисполнился» и закрыл его.
			</p>

			<div className="priceCard">
				<div className="priceHead">
					<div>
						<div className="priceName">Hidden целиком</div>
						<div className="priceMeta">Разовая покупка · навсегда · без подписки</div>
					</div>
					<div className="priceTag">₽990</div>
				</div>
				<ul className="priceList">
					<li>Полная библиотека практик</li>
					<li>Тихий сигнал на часах по движению и месту</li>
					<li>Тактильные практики без телефона (Watch / Wear)</li>
					<li>Личные триггеры-намерения без ограничений</li>
					<li>Переносится на новые устройства</li>
				</ul>
				{!owned ? (
					<button className="buyBtn" onClick={buy}>
						Купить навсегда · ₽990
					</button>
				) : (
					<div className="ownedRow">
						<span className="ownedBadge">✓ Куплено навсегда</span>
						<button className="resetBtn" onClick={reset}>
							сбросить (демо)
						</button>
					</div>
				)}
				<div className="noSub">Без подписки. Без автосписаний. Без «отмените за 3 дня до».</div>
			</div>

			<div className="packsWrap">
				<div className="packsTitle">
					Необязательные докупки потом — если захочется ещё. Сути не меняют.
				</div>
				<div className="packs">
					{PACKS.map((p) => {
						const have = packs.includes(p.id)
						return (
							<div key={p.id} className={`pack ${have ? 'have' : ''}`}>
								<div className="packTop">
									<span className="packTitle">{p.title}</span>
									<span className="packPrice">{p.price}</span>
								</div>
								<div className="packSub">{p.sub}</div>
								<button className="packBtn" onClick={() => togglePack(p.id)}>
									{have ? '✓ Добавлено · убрать' : 'Докупить'}
								</button>
							</div>
						)
					})}
				</div>
			</div>
		</section>
	)
}

/* ─────────────────────────────  FOOTER  ───────────────────────────── */

function Footer() {
	return (
		<footer className="foot">
			<p>
				Это демо Фазы 0. Цель продукта — со временем <i>перестать</i> быть нужным:
				научить останавливаться самому, без телефона. Поэтому метрика успеха —
				число остановок, а не время в приложении.
			</p>
			<p className="footNote">
				Движение и место в реальном приложении читаются на устройстве и никуда не
				отправляются. Здесь они симулированы кнопками.
			</p>
		</footer>
	)
}

/* ─────────────────────────────  УТИЛИТЫ  ───────────────────────────── */

function pickPractice(place: Place): Practice {
	const byId = (id: string) => PRACTICES.find((p) => p.id === id)!
	if (place === 'metro') return byId('metro')
	if (place === 'home') return byId('stop-frame')
	return byId('stop-frame')
}

function vibrate(pattern: number[]) {
	if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		try {
			navigator.vibrate(pattern)
		} catch {
			/* iOS Safari игнорирует — это ок */
		}
	}
}

const STOPS_KEY = 'hidden_stops'
function getStops(): number {
	if (typeof localStorage === 'undefined') return 0
	const raw = localStorage.getItem(STOPS_KEY)
	if (!raw) return 0
	try {
		const { date, count } = JSON.parse(raw)
		return date === today() ? count : 0
	} catch {
		return 0
	}
}
function bumpStops() {
	if (typeof localStorage === 'undefined') return
	const count = getStops() + 1
	localStorage.setItem(STOPS_KEY, JSON.stringify({ date: today(), count }))
}
function today() {
	return new Date().toISOString().slice(0, 10)
}

/* ─────────────────────────────  СТИЛИ  ───────────────────────────── */

function Styles() {
	return (
		<style jsx global>{`
			:root {
				--bg: #0c0e12;
				--bg2: #14171e;
				--panel: #171b23;
				--line: #262c38;
				--ink: #eef1f6;
				--mut: #8b93a3;
				--accent: #8fd6c4;
			}
			.wrap {
				background: radial-gradient(1200px 600px at 50% -10%, #1a1f2b, var(--bg));
				color: var(--ink);
				min-height: 100vh;
				max-width: 1040px;
				margin: 0 auto;
				padding: 0 20px 80px;
			}
			h1,
			h2 {
				letter-spacing: -0.02em;
			}
			.hero {
				padding: 90px 0 50px;
				text-align: center;
			}
			.kicker {
				color: var(--accent);
				font-size: 13px;
				letter-spacing: 0.18em;
				margin-bottom: 18px;
			}
			.hero h1 {
				font-size: clamp(32px, 6vw, 58px);
				line-height: 1.05;
				margin: 0 0 22px;
			}
			.lede {
				color: var(--mut);
				font-size: clamp(15px, 2.4vw, 19px);
				line-height: 1.6;
				max-width: 620px;
				margin: 0 auto 30px;
			}
			.cta {
				display: inline-block;
				background: var(--accent);
				color: #07130f;
				font-weight: 600;
				padding: 13px 22px;
				border-radius: 999px;
				border: none;
				cursor: pointer;
				text-decoration: none;
				font-size: 15px;
			}
			section {
				padding: 44px 0;
				border-top: 1px solid var(--line);
			}
			section h2 {
				font-size: clamp(22px, 4vw, 32px);
				margin: 0 0 10px;
			}
			.sub {
				color: var(--mut);
				line-height: 1.6;
				max-width: 640px;
				margin: 0 0 26px;
			}
			/* engine */
			.engineGrid {
				display: grid;
				grid-template-columns: 1.1fr 0.9fr;
				gap: 26px;
			}
			@media (max-width: 760px) {
				.engineGrid {
					grid-template-columns: 1fr;
				}
			}
			.panel {
				background: var(--panel);
				border: 1px solid var(--line);
				border-radius: 16px;
				padding: 20px;
			}
			.panelTitle {
				font-size: 12px;
				letter-spacing: 0.1em;
				color: var(--mut);
				text-transform: uppercase;
				margin-bottom: 16px;
			}
			.fieldLabel {
				display: block;
				font-size: 13px;
				color: var(--mut);
				margin: 14px 0 8px;
			}
			.places {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
			}
			.place {
				display: flex;
				align-items: center;
				gap: 8px;
				background: var(--bg2);
				border: 1px solid var(--line);
				color: var(--ink);
				padding: 10px 12px;
				border-radius: 10px;
				cursor: pointer;
				font-size: 13px;
				text-align: left;
			}
			.place.active {
				border-color: var(--accent);
				box-shadow: inset 0 0 0 1px var(--accent);
			}
			.placeEmoji {
				font-size: 16px;
			}
			.motionToggle {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
			}
			.motionToggle button {
				background: var(--bg2);
				border: 1px solid var(--line);
				color: var(--ink);
				padding: 12px;
				border-radius: 10px;
				cursor: pointer;
				font-size: 14px;
			}
			.motionToggle button.active {
				border-color: var(--accent);
				color: var(--accent);
			}
			.reasoning {
				margin: 18px 0 10px;
				min-height: 44px;
				font-size: 14px;
				line-height: 1.5;
			}
			.stIdle {
				color: var(--mut);
			}
			.stBlocked {
				color: #e0907f;
			}
			.stArmed {
				color: #e8c879;
			}
			.stFired {
				color: var(--accent);
			}
			.log {
				background: #0a0c10;
				border: 1px solid var(--line);
				border-radius: 10px;
				padding: 12px;
				font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
				font-size: 11.5px;
				color: #9aa3b2;
				min-height: 92px;
			}
			.logEmpty {
				color: #4d5566;
			}
			.logLine {
				padding: 2px 0;
			}
			/* watch */
			.watchWrap {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 16px;
			}
			.watch {
				position: relative;
				display: flex;
				align-items: center;
			}
			.watchBezel {
				width: 190px;
				height: 226px;
				background: linear-gradient(160deg, #2a2e36, #0c0d10);
				border-radius: 46px;
				padding: 14px;
				box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
			}
			.watchScreen {
				width: 100%;
				height: 100%;
				background: #000;
				border-radius: 34px;
				display: flex;
				align-items: center;
				justify-content: center;
				overflow: hidden;
				position: relative;
			}
			.watchCrown {
				width: 7px;
				height: 46px;
				background: linear-gradient(#3a3f48, #15171c);
				border-radius: 4px;
				margin-left: -2px;
				align-self: center;
			}
			.watchFace {
				text-align: center;
			}
			.watchTime {
				font-size: 40px;
				font-weight: 300;
				color: #d7f4ea;
				letter-spacing: 0.02em;
			}
			.watchSub {
				color: #4a5160;
				font-size: 10px;
				margin-top: 6px;
			}
			.watchDot {
				background: none;
				border: none;
				cursor: pointer;
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			.dot {
				width: 14px;
				height: 14px;
				border-radius: 50%;
				background: #fff;
				box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.5);
				animation: pulse 2.4s ease-out infinite;
			}
			@keyframes pulse {
				0% {
					box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.45);
				}
				70% {
					box-shadow: 0 0 0 18px rgba(255, 255, 255, 0);
				}
				100% {
					box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
				}
			}
			.watchCard {
				padding: 16px;
				text-align: center;
			}
			.watchSeed {
				color: #eaf6f2;
				font-size: 13px;
				line-height: 1.4;
				margin-bottom: 14px;
			}
			.watchBtns {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.wOpen {
				background: var(--accent);
				color: #07130f;
				border: none;
				border-radius: 999px;
				padding: 9px;
				font-weight: 600;
				cursor: pointer;
				font-size: 13px;
			}
			.wSkip {
				background: transparent;
				color: #6c7484;
				border: none;
				cursor: pointer;
				font-size: 12px;
			}
			.watchHint {
				color: var(--mut);
				font-size: 13px;
				text-align: center;
				max-width: 230px;
				line-height: 1.5;
			}
			/* library */
			.libHead {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: 12px;
				flex-wrap: wrap;
			}
			.stopsBadge {
				color: var(--mut);
				font-size: 13px;
				background: var(--panel);
				border: 1px solid var(--line);
				padding: 7px 12px;
				border-radius: 999px;
			}
			.stopsBadge b {
				color: var(--accent);
			}
			.cards {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: 12px;
				margin-top: 22px;
			}
			@media (max-width: 760px) {
				.cards {
					grid-template-columns: 1fr;
				}
			}
			.card {
				background: var(--panel);
				border: 1px solid var(--line);
				border-radius: 14px;
				padding: 16px;
				text-align: left;
				cursor: pointer;
				color: var(--ink);
				transition: border-color 0.15s;
			}
			.card:hover {
				border-color: var(--accent);
			}
			.cardTop {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 8px;
			}
			.cardTitle {
				font-size: 17px;
				font-weight: 600;
			}
			.cardSec {
				color: var(--accent);
				font-size: 13px;
			}
			.cardCtx {
				color: var(--mut);
				font-size: 13px;
				margin-bottom: 12px;
			}
			.cardSeed {
				color: #b9c0cd;
				font-size: 13px;
				font-style: italic;
				line-height: 1.4;
			}
			/* ambush */
			.toggle {
				background: var(--panel);
				border: 1px solid var(--line);
				color: var(--ink);
				padding: 13px 20px;
				border-radius: 999px;
				cursor: pointer;
				font-size: 14px;
			}
			.toggle.on {
				border-color: var(--accent);
				color: var(--accent);
			}
			.toast {
				margin-top: 18px;
				display: inline-flex;
				align-items: center;
				gap: 10px;
				background: #0a0c10;
				border: 1px solid var(--line);
				border-radius: 12px;
				padding: 14px 18px;
				font-size: 14px;
				animation: rise 0.3s ease;
			}
			.toastDot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: #fff;
			}
			@keyframes rise {
				from {
					opacity: 0;
					transform: translateY(6px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}
			/* trainer overlay */
			.overlay {
				position: fixed;
				inset: 0;
				background: rgba(4, 6, 9, 0.82);
				backdrop-filter: blur(8px);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 50;
				padding: 20px;
			}
			.trainer {
				position: relative;
				width: min(440px, 100%);
				background: var(--bg2);
				border: 1px solid var(--line);
				border-radius: 24px;
				padding: 40px 30px;
				text-align: center;
			}
			.close {
				position: absolute;
				top: 14px;
				right: 16px;
				background: none;
				border: none;
				color: var(--mut);
				font-size: 18px;
				cursor: pointer;
			}
			.breath {
				width: 120px;
				height: 120px;
				border-radius: 50%;
				margin: 6px auto 26px;
				background: radial-gradient(circle, var(--accent), transparent 70%);
				animation: breathe 8s ease-in-out infinite;
			}
			@keyframes breathe {
				0%,
				100% {
					transform: scale(0.7);
					opacity: 0.6;
				}
				50% {
					transform: scale(1.1);
					opacity: 1;
				}
			}
			.stepLabel {
				color: var(--accent);
				font-size: 13px;
				letter-spacing: 0.16em;
				text-transform: uppercase;
				margin-bottom: 12px;
			}
			.stepText {
				font-size: 19px;
				line-height: 1.5;
				min-height: 84px;
			}
			.dots {
				display: flex;
				gap: 7px;
				justify-content: center;
				margin: 20px 0 18px;
			}
			.pdot {
				width: 7px;
				height: 7px;
				border-radius: 50%;
				background: var(--line);
			}
			.pdot.on {
				background: var(--accent);
			}
			.skip {
				background: none;
				border: none;
				color: var(--mut);
				cursor: pointer;
				font-size: 13px;
			}
			.doneScreen .doneMark {
				font-size: 44px;
				color: var(--accent);
			}
			.doneTitle {
				font-size: 20px;
				margin: 14px 0 6px;
			}
			.doneSub {
				color: var(--mut);
				margin-bottom: 26px;
			}
			/* unlock */
			.priceCard {
				background: linear-gradient(180deg, #1a2129, var(--panel));
				border: 1px solid var(--accent);
				border-radius: 18px;
				padding: 24px;
				max-width: 460px;
			}
			.priceHead {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 18px;
			}
			.priceName {
				font-size: 20px;
				font-weight: 600;
			}
			.priceMeta {
				color: var(--mut);
				font-size: 12.5px;
				margin-top: 4px;
			}
			.priceTag {
				font-size: 30px;
				font-weight: 700;
				color: var(--accent);
			}
			.priceList {
				list-style: none;
				padding: 0;
				margin: 0 0 20px;
			}
			.priceList li {
				color: #c4cbd7;
				font-size: 14px;
				padding: 6px 0 6px 24px;
				position: relative;
			}
			.priceList li::before {
				content: '✓';
				position: absolute;
				left: 0;
				color: var(--accent);
			}
			.buyBtn {
				width: 100%;
				background: var(--accent);
				color: #07130f;
				border: none;
				border-radius: 999px;
				padding: 14px;
				font-size: 16px;
				font-weight: 600;
				cursor: pointer;
			}
			.ownedRow {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
			}
			.ownedBadge {
				color: var(--accent);
				font-weight: 600;
				font-size: 15px;
			}
			.resetBtn {
				background: none;
				border: none;
				color: var(--mut);
				font-size: 12px;
				cursor: pointer;
				text-decoration: underline;
			}
			.noSub {
				color: #6c7484;
				font-size: 12px;
				text-align: center;
				margin-top: 12px;
			}
			.packsWrap {
				margin-top: 30px;
			}
			.packsTitle {
				color: var(--mut);
				font-size: 14px;
				margin-bottom: 14px;
			}
			.packs {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: 12px;
			}
			@media (max-width: 760px) {
				.packs {
					grid-template-columns: 1fr;
				}
			}
			.pack {
				background: var(--panel);
				border: 1px solid var(--line);
				border-radius: 14px;
				padding: 16px;
			}
			.pack.have {
				border-color: var(--accent);
			}
			.packTop {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 6px;
			}
			.packTitle {
				font-weight: 600;
			}
			.packPrice {
				color: var(--accent);
				font-size: 14px;
			}
			.packSub {
				color: var(--mut);
				font-size: 13px;
				line-height: 1.45;
				margin-bottom: 14px;
				min-height: 38px;
			}
			.packBtn {
				width: 100%;
				background: var(--bg2);
				border: 1px solid var(--line);
				color: var(--ink);
				border-radius: 999px;
				padding: 9px;
				font-size: 13px;
				cursor: pointer;
			}
			.pack.have .packBtn {
				border-color: var(--accent);
				color: var(--accent);
			}
			.foot {
				padding-top: 40px;
				border-top: 1px solid var(--line);
				color: var(--mut);
				font-size: 14px;
				line-height: 1.6;
			}
			.footNote {
				font-size: 12.5px;
				color: #5b6373;
			}
		`}</style>
	)
}
