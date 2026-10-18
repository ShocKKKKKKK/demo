/* ==========================================================================
   Основа «Автоматизация заявок»: проигрыватель сцен.
   Сцена 0 → 1 → 2 → 3, у каждой своя длительность (data-duration). Поля формы
   «печатаются» (data-type, старт — data-type-at мс). Клик по шагу — переход к сцене,
   «Програти ще раз» — с начала. При prefers-reduced-motion текст появляется сразу.
   ========================================================================== */

(function () {
	'use strict';

	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var TYPE_MS = 45;

	function init() {
		var player = document.querySelector('[data-player]');
		if (!player) return;
		var scenes = Array.prototype.slice.call(player.querySelectorAll('[data-scene]'));
		var buttons = Array.prototype.slice.call(player.querySelectorAll('[data-step]'));
		var replay = player.querySelector('[data-replay]');
		var caption = player.querySelector('[data-caption]');
		var timers = [];
		var started = false;

		// Задержки появления — из data-delay в CSS-переменную
		player.querySelectorAll('[data-delay]').forEach(function (el) {
			el.style.setProperty('--delay', el.getAttribute('data-delay') + 'ms');
		});

		function later(fn, ms) {
			timers.push(setTimeout(fn, ms));
		}

		function clear() {
			timers.forEach(clearTimeout);
			timers = [];
		}

		function typeInto(el) {
			var text = el.getAttribute('data-type') || '';
			el.textContent = '';
			if (reduce) {
				el.textContent = text;
				return;
			}
			var start = Number(el.getAttribute('data-type-at')) || 0;
			later(function () {
				el.classList.add('lead-form__field--typing');
				var i = 0;
				(function tick() {
					i++;
					el.textContent = text.slice(0, i);
					if (i < text.length) later(tick, TYPE_MS);
					else later(function () { el.classList.remove('lead-form__field--typing'); }, 400);
				})();
			}, start);
		}

		function show(index, auto) {
			// Любой показ (клик по шагу тоже) отменяет автозапуск при прокрутке
			started = true;
			clear();
			replay.classList.remove('player__replay--attention');
			scenes.forEach(function (s, i) {
				// Перезапуск CSS-появлений: снять активность, дать кадр, поставить снова
				s.classList.remove('player__scene--active');
				if (i === index) {
					void s.offsetWidth;
					s.classList.add('player__scene--active');
				}
			});
			var duration = Number(scenes[index].getAttribute('data-duration')) || 6000;
			buttons.forEach(function (b, i) {
				b.classList.remove('player__step-button--active');
				b.classList.toggle('player__step-button--done', i < index);
				b.removeAttribute('aria-current');
				if (i === index) {
					b.style.setProperty('--step-duration', duration + 'ms');
					void b.offsetWidth;
					b.classList.add('player__step-button--active');
					b.setAttribute('aria-current', 'step');
				}
			});
			player.classList.toggle('player--paused', !auto);
			// Подпись активного шага для узких экранов, где у кнопок остались только номера
			if (caption) {
				var t = buttons[index].querySelector('.player__step-title');
				var l = buttons[index].querySelector('.player__step-lead');
				caption.textContent = (t ? t.textContent : '') + (l ? '. ' + l.textContent : '');
			}
			scenes[index].querySelectorAll('[data-type]').forEach(typeInto);
			if (!auto) return;
			later(function () {
				if (index + 1 < scenes.length) show(index + 1, true);
				else finish();
			}, duration);
		}

		function finish() {
			buttons[buttons.length - 1].classList.add('player__step-button--done');
			replay.classList.add('player__replay--attention');
		}

		buttons.forEach(function (b) {
			b.addEventListener('click', function () {
				show(Number(b.getAttribute('data-step')), false);
			});
		});
		replay.addEventListener('click', function () { show(0, true); });

		// Запуск, когда проигрыватель попал в экран (до этого человек читает первый экран)
		function start() {
			if (started) return;
			started = true;
			show(0, true);
		}
		if ('IntersectionObserver' in window) {
			var io = new IntersectionObserver(function (entries) {
				if (entries.some(function (e) { return e.isIntersecting; })) {
					io.disconnect();
					start();
				}
			}, { threshold: 0.35 });
			io.observe(player.querySelector('.player__stage'));
		} else {
			start();
		}
	}

	window.demoReady.then(init);
})();
