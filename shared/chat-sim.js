/* ==========================================================================
   Общий движок чат-симуляторов демо (ai-sekretar/, automation/).
   Пузыри, «друкує…» бота, клавиатура ответов с полосой автонажатия, автопоказ.

   Автопоказ: сцена идёт сама, перед «нажатием» на кнопке заполняется полоса. Любой клик
   посетителя по кнопке внутри root (или ввод текста) переводит в ручной режим; кнопки с
   [data-auto-keep] («Почати знову», переключатель) режим не меняют. На скрытой вкладке
   время автопоказа стоит. При prefers-reduced-motion полоса не анимируется.

   Использование:
     const sim = ChatSim.create({
       root: document,                 // где клик выключает автопоказ
       manual: 'button',               // что считается кнопкой демо
       getRun: () => runId,            // номер текущего прогона: сменился — ожидания отменяются
       onAuto: (on) => { … },          // перерисовать переключатель
       tempo: { userStep: 2500 },      // свой темп поверх ChatSim.TEMPO
     });
     sim.press(() => el, ms)   — «нажать» кнопку после полосы (ждёт, пока кнопка появится)
     sim.pause(ms)             — промис, выполняется только в автопоказе
     sim.delay(ms, run)        — пауза видимого времени в любом режиме; false — прогон сменился
     sim.waitFor(cond, run)    — ждёт условие; false — прогон сменился
     sim.addMsg(body, cls, html), sim.typing(body, ms, statusEl)
   Подключается обычным <script> до скрипта страницы.
   ========================================================================== */

(function () {
	'use strict';

	// Темп по умолчанию, мс. Страница передаёт свой объект TEMPO поверх.
	const TEMPO = {
		userStep: 2500, // полоса на кнопке перед «нажатием»
		choice: 2500,   // решение на экране администратора или адвоката
		botTyping: 1100, // «друкує…» перед ответом бота
		next: 5000,     // пауза после конца сценария перед повтором
	};

	const CLASSES = {
		msg: 'msg',
		typing: 'typing',
		dot: 'typing__dot',
		bar: 'autobar',
		still: 'autobar--static',
	};

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const time = () => new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
	const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

	function create(opts) {
		const o = opts || {};
		const root = o.root || document;
		const manual = o.manual || 'button';
		const getRun = o.getRun || (() => 0);
		const cls = Object.assign({}, CLASSES, o.classes);
		const tempo = Object.assign({}, TEMPO, o.tempo);

		let auto = o.auto !== false;
		let autoHook = null; // ожидающее автодействие; запускается снова, если автопоказ включили
		let autoSeq = 0;     // смена — отмена текущего ожидания

		// Ждёт ms «видимого» времени, пока включён автопоказ; вкладка скрыта — время стоит
		function wait(ms, onTick) {
			const seq = autoSeq;
			const run = getRun();
			return new Promise((resolve) => {
				let elapsed = 0;
				let last = performance.now();
				const tick = () => {
					const now = performance.now();
					if (!auto || seq !== autoSeq || run !== getRun()) return resolve(false);
					if (!document.hidden) elapsed += Math.min(now - last, 200);
					last = now;
					if (onTick) onTick(Math.min(elapsed / ms, 1));
					if (elapsed >= ms) return resolve(true);
					setTimeout(tick, 40);
				};
				tick();
			});
		}

		// Пауза видимого времени в любом режиме (сцены, которые идут и без автопоказа)
		function delay(ms, run) {
			return new Promise((resolve) => {
				let elapsed = 0;
				let last = performance.now();
				const tick = () => {
					const now = performance.now();
					if (run !== getRun()) return resolve(false);
					if (!document.hidden) elapsed += Math.min(now - last, 200);
					last = now;
					if (elapsed >= ms) return resolve(true);
					setTimeout(tick, 40);
				};
				tick();
			});
		}

		function startHook() {
			if (!autoHook) return;
			autoSeq++;
			autoHook();
		}

		function schedule(job) {
			autoHook = job;
			if (auto) startHook();
		}

		function setAuto(on) {
			auto = on;
			autoSeq++;
			if (o.onAuto) o.onAuto(on);
			if (on) startHook();
		}

		// Новый прогон сценария: ожидающее автодействие снимается
		function reset() {
			autoHook = null;
			autoSeq++;
		}

		// «Нажать» кнопку после паузы с полосой прогресса. target — элемент или функция, его находящая
		function press(target, ms) {
			const find = typeof target === 'function' ? target : () => target;
			const run = getRun();
			const dur = ms === undefined ? tempo.userStep : ms;
			schedule(async function job() {
				const seq = autoSeq;
				let el = find();
				while ((!el || el.disabled) && auto && seq === autoSeq && run === getRun() && autoHook === job) {
					await sleep(150);
					el = find();
				}
				if (!el || el.disabled || seq !== autoSeq || autoHook !== job) return;
				const bar = document.createElement('span');
				bar.className = cls.bar + (reduceMotion.matches ? ' ' + cls.still : '');
				bar.setAttribute('aria-hidden', 'true');
				el.appendChild(bar);
				const ok = await wait(dur, (p) => { if (!reduceMotion.matches) bar.style.transform = `scaleX(${p})`; });
				bar.remove();
				if (!ok || autoHook !== job || !el.isConnected || el.disabled) return;
				autoHook = null;
				el.click();
			});
		}

		// Пауза автопоказа (промис выполняется только при включённом автопоказе)
		function pause(ms) {
			return new Promise((resolve) => schedule(async function job() {
				const ok = await wait(ms);
				if (!ok || autoHook !== job) return;
				autoHook = null;
				resolve();
			}));
		}

		// Ждёт условие; false — прогон сменился
		function waitFor(cond, run) {
			return new Promise((resolve) => {
				const tick = () => {
					if (run !== getRun()) return resolve(false);
					if (cond()) return resolve(true);
					setTimeout(tick, 100);
				};
				tick();
			});
		}

		function scrollDown(body) { body.scrollTop = body.scrollHeight; }

		function addMsg(body, extra, html) {
			const el = document.createElement('div');
			el.className = cls.msg + (extra ? ' ' + extra : '');
			el.innerHTML = html;
			body.appendChild(el);
			scrollDown(body);
			return el;
		}

		// «друкує…» в ленте body; statusEl (необязательно) на время печати показывает «друкує…»
		async function typing(body, ms, statusEl, idleText) {
			const before = statusEl ? statusEl.textContent : '';
			if (statusEl) statusEl.textContent = 'друкує…';
			const t = document.createElement('div');
			t.className = cls.typing;
			t.setAttribute('aria-hidden', 'true');
			t.innerHTML = `<span class="${cls.dot}"></span><span class="${cls.dot}"></span><span class="${cls.dot}"></span>`;
			body.appendChild(t);
			scrollDown(body);
			await sleep(ms);
			t.remove();
			if (statusEl) statusEl.textContent = idleText === undefined ? before : idleText;
		}

		// Клик посетителя по кнопке демо — ручной режим
		root.addEventListener('click', (e) => {
			if (!e.isTrusted || !auto) return;
			const el = e.target.closest(manual);
			if (!el || el.closest('[data-auto-keep]')) return;
			setAuto(false);
		}, true);
		root.addEventListener('input', (e) => {
			if (!e.isTrusted || !auto) return;
			if (e.target.closest && e.target.closest('[data-auto-keep]')) return;
			setAuto(false);
		}, true);

		return {
			get auto() { return auto; },
			tempo,
			reduceMotion,
			setAuto,
			reset,
			press,
			pause,
			wait,
			delay,
			waitFor,
			addMsg,
			typing,
			scrollDown,
			sleep,
			esc,
			time,
		};
	}

	window.ChatSim = { create, TEMPO, sleep, esc, time, reduceMotion };
})();
