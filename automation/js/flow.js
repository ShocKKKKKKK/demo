/* ==========================================================================
   Основа «Автоматизация заявок»: секция «Жодне звернення не губиться» и калькулятор.

   Симулятор на общем движке ../shared/chat-sim.js: телефон клиента (Telegram-бот), журнал бота,
   экран администратора и владельца. Сцена ~50 с: сообщение → ответ бота → карточка с таймером →
   администратор отмечает пропущенный звонок → время идёт → просрочка → напоминание владельцу →
   вечерний итог. Автопоказ как в ai-sekretar/: любой клик по кнопке сцены — ручной режим,
   «Почати знову» и «Автопоказ» включают его обратно, «Пропустити» — сразу к итогу.

   Тексты, где есть слова ниши, лежат в разметке (.flow__script, data-demo) — их заполняет
   ../shared/demo.js, скрипт берёт готовый текст. Время на экране — время сцены, не настоящее.

   Калькулятор: поля с data-calc-input, границы и значение по умолчанию — data-calc-min / max /
   step / default; data-calc-from — поле JSON демо, из которого берётся начальное значение.
   Потеря за месяц = без відповіді × чек × 30, вторая строка — с учётом доли «стали б замовленням».
   ========================================================================== */

(function () {
	'use strict';

	// Темп сцены, мс
	const TEMPO = {
		userStep: 3000, // полоса на кнопке клиента
		choice: 3000,   // решение администратора или владельца
		botTyping: 1200, // «друкує…»
		read: 2200,     // пауза, чтобы прочитать ответ
		clock: 3500,    // «минає час» на экране
		next: 6000,     // пауза после итога перед повтором
	};
	const DEADLINE = 15; // мин до просрочки
	const ESCALATE = 20; // мин до напоминания владельцу
	const START = 14 * 60 + 5;
	const EVENING = 19 * 60;

	const pad = (n) => String(n).padStart(2, '0');
	const hm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
	const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

	function initFlow() {
		const root = document.querySelector('[data-flow]');
		if (!root || !window.ChatSim) return;
		const q = (sel) => root.querySelector(sel);
		const line = (k) => {
			const el = root.querySelector(`[data-line="${k}"]`);
			return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
		};
		const esc = window.ChatSim.esc;

		const client = q('[data-flow-client]');
		const keys = q('[data-flow-keys]');
		const status = q('[data-flow-status]');
		const logEl = q('[data-flow-log]');
		const cardsEl = q('[data-flow-cards]');
		const clockEl = q('[data-flow-clock]');
		const alertEl = q('[data-flow-alert]');
		const alertText = q('[data-flow-alert-text]');
		const callback = q('[data-flow-callback]');
		const summary = q('[data-flow-summary]');
		const summaryList = q('[data-flow-summary-list]');
		const missed = q('[data-flow-missed]');
		const hint = q('[data-flow-hint]');
		const autoBtn = q('[data-flow-auto]');
		const autoLabel = q('[data-flow-auto-label]');

		let runId = 0;
		let started = false; // сцена уже запускалась (автостарт при прокрутке больше не нужен)
		const sim = window.ChatSim.create({
			root,
			manual: 'button',
			getRun: () => runId,
			tempo: TEMPO,
			onAuto(on) {
				autoBtn.classList.toggle('flow__control--on', on);
				autoBtn.setAttribute('aria-pressed', String(on));
				autoLabel.textContent = on ? 'Автопоказ ⏸' : 'Автопоказ ▶';
				hint.textContent = on
					? 'Сцена йде сама. Натисніть будь-яку кнопку, і далі керуєте ви.'
					: 'Натискайте кнопки з рамкою: за клієнта, адміністратора і власника.';
			},
		});

		const unit = cap(line('unit'));

		/* --- Состояние ----------------------------------------------------- */

		let S = null;
		const cardEls = new Map();

		function fresh() {
			return {
				now: START,
				cards: [
					{ id: 1, title: `${unit} · Олег`, src: 'Telegram', created: 9 * 60 + 12, answered: 9 * 60 + 14 },
					{ id: 2, title: `${unit} · Ірина`, src: 'заявка з сайту', created: 11 * 60, answered: 11 * 60 + 6 },
				],
				nextId: 3,
				overdueLogged: new Set(),
				alertCard: null,
				evening: false,
			};
		}

		const isOverdue = (c) => (c.answered === null ? S.now : c.answered) - c.created >= DEADLINE;

		function addCard(props) {
			const c = Object.assign({ id: S.nextId++, created: S.now, answered: null }, props);
			S.cards.push(c);
			render();
			const el = cardEls.get(c.id);
			if (el && !sim.reduceMotion.matches) el.classList.add('desk__card--new');
			return c;
		}

		function answer(c) {
			if (!c || c.answered !== null) return;
			c.answered = S.now;
			render();
		}

		function addLog(text) {
			const li = document.createElement('li');
			li.className = 'bot-log__item';
			li.innerHTML = `<span class="bot-log__time">${hm(S.now)}</span><span class="bot-log__text">${esc(text)}</span>`;
			logEl.appendChild(li);
			logEl.scrollTop = logEl.scrollHeight;
		}

		function cardEl(c) {
			let li = cardEls.get(c.id);
			if (li) return li;
			li = document.createElement('li');
			li.className = 'desk__card';
			li.innerHTML = '<span class="desk__card-title"></span><span class="desk__card-meta"></span>'
				+ '<span class="desk__card-timer"></span>'
				+ `<button type="button" class="desk__card-button" data-card="${c.id}">Відповів</button>`;
			li.querySelector('.desk__card-title').textContent = c.title;
			li.querySelector('.desk__card-meta').textContent = `${c.src} · ${hm(c.created)}`;
			cardEls.set(c.id, li);
			cardsEl.prepend(li);
			return li;
		}

		function timerText(c) {
			if (c.answered !== null) return `Відповіли о ${hm(c.answered)}`;
			const left = c.created + DEADLINE - S.now;
			return left > 0 ? `Лишилось ${left} хв` : `Прострочено на ${-left} хв`;
		}

		function render() {
			clockEl.textContent = hm(S.now);
			S.cards.forEach((c) => {
				const li = cardEl(c);
				const done = c.answered !== null;
				li.classList.toggle('desk__card--done', done);
				li.classList.toggle('desk__card--overdue', !done && isOverdue(c));
				li.classList.toggle('desk__card--late', done && isOverdue(c));
				li.querySelector('.desk__card-timer').textContent = timerText(c);
				const b = li.querySelector('.desk__card-button');
				b.disabled = done;
				b.hidden = done;
			});
			const stat = (k, v) => { q(`[data-flow-stat="${k}"]`).textContent = String(v); };
			stat('total', S.cards.length);
			stat('answered', S.cards.filter((c) => c.answered !== null).length);
			stat('overdue', S.cards.filter(isOverdue).length);
			const a = S.alertCard;
			alertEl.hidden = !a || S.evening;
			if (a) {
				alertText.textContent = `${line('alert')} · ${a.title}`;
				callback.disabled = a.answered !== null;
				callback.textContent = a.answered !== null ? `Передзвонив о ${hm(a.answered)}` : 'Передзвонив';
			}
		}

		// Просрочка и напоминание владельцу — по часам сцены
		function checkEvents() {
			S.cards.forEach((c) => {
				if (c.answered === null && S.now - c.created >= DEADLINE && !S.overdueLogged.has(c.id)) {
					S.overdueLogged.add(c.id);
					addLog(line('log-overdue'));
				}
				if (c.answered === null && !S.alertCard && S.now - c.created >= ESCALATE) {
					S.alertCard = c;
					addLog(line('log-owner'));
				}
			});
		}

		// Время сцены идёт от S.now до to за ms видимого времени; false — прогон сменился
		async function advance(run, to, ms) {
			const from = S.now;
			if (to <= from) return true;
			const steps = sim.reduceMotion.matches ? 1 : Math.min(to - from, 24);
			for (let i = 1; i <= steps; i++) {
				if (!(await sim.delay(ms / steps, run))) return false;
				S.now = from + Math.round(((to - from) * i) / steps);
				checkEvents();
				render();
			}
			return true;
		}

		/* --- Чат клиента ---------------------------------------------------- */

		const stamp = () => `<span class="msg__time">${hm(S.now)}</span>`;
		const idleKeys = () => { keys.innerHTML = '<span class="sim-chat__input">Повідомлення</span>'; };
		const bubbleIn = (text) => sim.addMsg(client, 'msg--in', esc(text) + stamp());
		const bubbleOut = (text) => sim.addMsg(client, 'msg--out', esc(text) + stamp());
		const voiceOut = () => sim.addMsg(client, 'msg--out',
			'<span class="msg__voice"><span class="msg__play" aria-hidden="true"></span><span class="msg__wave" aria-hidden="true"></span>'
			+ `<span>0:09</span><span class="msg__sr">${esc(line('client-voice'))}</span></span>${stamp()}`);

		// Кнопка ответа клиента; в автопоказе нажимается сама. true — нажата, false — прогон сменился
		function clientKey(run, label, onPress) {
			let pressed = false;
			keys.innerHTML = '';
			const kb = document.createElement('div');
			kb.className = 'reply-kb';
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'reply-kb__key reply-kb__key--accent';
			b.textContent = label;
			b.addEventListener('click', () => {
				if (pressed || run !== runId) return;
				pressed = true;
				idleKeys();
				onPress();
			});
			kb.appendChild(b);
			keys.appendChild(kb);
			sim.press(b, TEMPO.userStep);
			return sim.waitFor(() => pressed, run);
		}

		// Подсветка кнопки, которую сцена ждёт в ручном режиме
		function expect(el) {
			root.querySelectorAll('.flow__target').forEach((x) => x.classList.remove('flow__target'));
			if (el) el.classList.add('flow__target');
		}

		/* --- Сцена ---------------------------------------------------------- */

		function reset() {
			S = fresh();
			cardEls.clear();
			client.innerHTML = '';
			logEl.innerHTML = '';
			cardsEl.innerHTML = '';
			summary.hidden = true;
			summaryList.innerHTML = '';
			expect(null);
			idleKeys();
			render();
		}

		function showSummary() {
			const total = S.cards.length;
			const done = S.cards.filter((c) => c.answered !== null).length;
			const late = S.cards.filter(isOverdue);
			const bot = S.cards.filter((c) => c.src === 'Telegram').length;
			const items = [
				`Звернень: ${total}, відповіли: ${done}, прострочено: ${late.length}`,
				`Повідомлень у Telegram, на які бот відповів одразу: ${bot}`,
			];
			const longest = late.slice().sort((a, b) => ((b.answered ?? S.now) - b.created) - ((a.answered ?? S.now) - a.created))[0];
			if (longest) items.push(`Найдовше чекав: ${longest.title} — ${(longest.answered ?? S.now) - longest.created} хв`);
			const open = total - done;
			items.push(open ? `Без відповіді лишилось: ${open}` : 'Без відповіді не лишилось жодного звернення');
			summaryList.innerHTML = items.map((t) => `<li class="desk__summary-item">${esc(t)}</li>`).join('');
			summary.hidden = false;
			S.evening = true;
			render();
		}

		async function play() {
			started = true;
			const run = ++runId;
			sim.reset();
			reset();
			sim.addMsg(client, 'msg--system', 'Клієнт пише боту в Telegram');

			// 1. Клиент пишет, бот сразу отвечает и спрашивает своё
			if (!(await clientKey(run, `Надіслати: «${line('client-first')}»`, () => bubbleOut(line('client-first'))))) return;
			await sim.typing(client, TEMPO.botTyping, status, 'бот');
			if (run !== runId) return;
			bubbleIn(line('bot-greet'));
			addLog(line('log-answer'));
			if (!(await sim.delay(TEMPO.read, run))) return;

			// 2. Голосовое — бот передаёт администратору, появляется карточка с таймером
			if (!(await clientKey(run, '🎤 Надіслати голосове', voiceOut))) return;
			S.now += 1;
			await sim.typing(client, TEMPO.botTyping, status, 'бот');
			if (run !== runId) return;
			bubbleIn(line('bot-handoff'));
			const main = addCard({ title: `${unit} · ${line('client-name')}`, src: 'Telegram' });
			addLog(line('log-card'));
			if (!(await advance(run, S.now + 2, TEMPO.read))) return;

			// 3. Администратор отмечает пропущенный звонок
			const calls = () => S.cards.filter((c) => c.call);
			if (!calls().length) {
				expect(missed);
				sim.press(missed, TEMPO.choice);
				if (!(await sim.waitFor(() => calls().length > 0, run))) return;
			}
			expect(null);
			if (!(await advance(run, S.now + 8, TEMPO.clock))) return;

			// 4. Администратор ответил клиенту из Telegram
			if (main.answered === null) {
				const btn = () => (cardEls.get(main.id) || cardsEl).querySelector('.desk__card-button:not([disabled])');
				expect(btn());
				sim.press(btn, TEMPO.choice);
				if (!(await sim.waitFor(() => main.answered !== null, run))) return;
			}
			expect(null);

			// 5. По звонку никто не ответил: просрочка, потом напоминание владельцу
			const call = calls()[0];
			if (!(await advance(run, Math.max(S.now, call.created + ESCALATE), TEMPO.clock * 1.4))) return;
			if (S.alertCard && S.alertCard.answered === null) {
				expect(callback);
				sim.press(() => (alertEl.hidden ? null : callback), TEMPO.choice);
				if (!(await sim.waitFor(() => !S.alertCard || S.alertCard.answered !== null, run))) return;
			}
			expect(null);

			// 6. Вечер: итог дня
			if (!(await sim.delay(TEMPO.read, run))) return;
			if (!(await advance(run, EVENING, TEMPO.clock))) return;
			addLog(line('log-summary'));
			showSummary();

			await sim.pause(TEMPO.next);
			if (run !== runId) return;
			play();
		}

		// «Пропустити»: сразу итог дня, без анимации
		function skip() {
			started = true;
			runId++;
			sim.reset();
			reset();
			sim.addMsg(client, 'msg--system', 'Клієнт пише боту в Telegram');
			bubbleOut(line('client-first'));
			bubbleIn(line('bot-greet'));
			addLog(line('log-answer'));
			S.now += 1;
			voiceOut();
			bubbleIn(line('bot-handoff'));
			const main = addCard({ title: `${unit} · ${line('client-name')}`, src: 'Telegram' });
			addLog(line('log-card'));
			S.now += 2;
			addCard({ title: line('call-title'), src: 'дзвінок', call: true });
			addLog(line('log-missed'));
			S.now += 8;
			checkEvents();
			answer(main);
			S.now = START + 3 + ESCALATE;
			checkEvents();
			answer(S.alertCard);
			S.now = EVENING;
			addLog(line('log-summary'));
			render();
			showSummary();
			root.querySelectorAll('.desk__card--new').forEach((el) => el.classList.remove('desk__card--new'));
		}

		/* --- События --------------------------------------------------------- */

		missed.addEventListener('click', () => {
			if (!S) return;
			addCard({ title: line('call-title'), src: 'дзвінок', call: true });
			addLog(line('log-missed'));
		});
		cardsEl.addEventListener('click', (e) => {
			const b = e.target.closest('[data-card]');
			if (!b || !S) return;
			answer(S.cards.find((c) => c.id === Number(b.dataset.card)));
		});
		callback.addEventListener('click', () => { if (S) answer(S.alertCard); });
		q('[data-flow-restart]').addEventListener('click', () => { sim.setAuto(true); play(); });
		autoBtn.addEventListener('click', () => sim.setAuto(!sim.auto));
		q('[data-flow-skip]').addEventListener('click', skip);

		// Запуск, когда сцена попала в экран (до этого человек читает первый экран)
		reset();
		const start = () => { if (!started) { started = true; play(); } };
		if ('IntersectionObserver' in window) {
			const io = new IntersectionObserver((entries) => {
				if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
			}, { threshold: 0.2 });
			io.observe(q('.flow__stage'));
		} else {
			start();
		}
	}

	/* --- Калькулятор ---------------------------------------------------------- */

	function initCalc(data) {
		const form = document.querySelector('[data-calc]');
		if (!form) return;
		const inputs = {};
		form.querySelectorAll('[data-calc-input]').forEach((el) => {
			const num = (a, d) => { const v = Number(el.getAttribute(a)); return Number.isFinite(v) ? v : d; };
			const cfg = {
				el,
				min: num('data-calc-min', 0),
				max: num('data-calc-max', 1e9),
				step: num('data-calc-step', 1),
				def: num('data-calc-default', 0),
			};
			const from = el.getAttribute('data-calc-from');
			const v = from && data ? Number(data[from]) : NaN;
			if (Number.isFinite(v) && v > 0) cfg.def = Math.min(Math.max(Math.round(v), cfg.min), cfg.max);
			el.min = String(cfg.min);
			el.max = String(cfg.max);
			el.step = String(cfg.step);
			el.value = String(cfg.def);
			inputs[el.getAttribute('data-calc-input')] = cfg;
		});

		const fmt = (n) => Math.round(n).toLocaleString('uk-UA');
		const read = (k) => {
			const c = inputs[k];
			if (!c) return 0;
			const v = Number(String(c.el.value).replace(',', '.'));
			return Number.isFinite(v) ? Math.min(Math.max(v, c.min), c.max) : c.def;
		};
		const out = (k, v) => form.querySelectorAll(`[data-calc-out="${k}"]`).forEach((el) => { el.textContent = v; });

		function compute() {
			const missed = Math.min(read('missed'), read('perDay'));
			const check = read('check');
			const rate = read('rate');
			const loss = missed * check * 30;
			out('missed', fmt(missed));
			out('check', fmt(check));
			out('loss', fmt(loss));
			out('rate', fmt(rate));
			out('real', fmt((loss * rate) / 100));
		}

		// Поле приводится к границам, когда посетитель закончил ввод
		function clamp(c) {
			let v = Number(String(c.el.value).replace(',', '.'));
			if (!Number.isFinite(v) || String(c.el.value).trim() === '') v = c.def;
			v = Math.min(Math.max(v, c.min), c.max);
			if (c.el === (inputs.missed && inputs.missed.el)) v = Math.min(v, read('perDay'));
			c.el.value = String(Math.round(v));
		}

		form.addEventListener('input', compute);
		form.addEventListener('change', (e) => {
			const c = Object.values(inputs).find((x) => x.el === e.target);
			if (c) clamp(c);
			if (inputs.missed) clamp(inputs.missed);
			compute();
		});
		compute();
	}

	window.demoReady.then((data) => {
		initCalc(data);
		initFlow();
	});
})();
