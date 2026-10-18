/* ==========================================================================
   Основа «Сбор отзывов»: QR-код на картке и вікно оцінки.
   QR ведёт на эту же страницу к шагу 3 (#review) — демо-заглушка, никуда наружу.
   ========================================================================== */

(function () {
	'use strict';

	// QR — библиотека qrcode-generator 1.4.4 (jsDelivr); не загрузилась — остаётся узор-заглушка
	function drawQr() {
		var box = document.querySelector('[data-qr]');
		if (!box || typeof window.qrcode !== 'function') return;
		var target = location.origin + location.pathname + location.search + '#review';
		try {
			var qr = window.qrcode(0, 'M');
			qr.addData(target);
			qr.make();
			box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
			box.classList.add('qr-card__code--ready');
		} catch (e) {
			/* заглушка остаётся */
		}
	}

	// Звёзды: клик ставит оценку, стрелки — для клавиатуры
	function initStars(form) {
		var stars = Array.prototype.slice.call(form.querySelectorAll('[data-star]'));
		function set(n) {
			stars.forEach(function (s, i) {
				s.classList.toggle('rate__star--on', i < n);
				s.setAttribute('aria-checked', String(i === n - 1));
				s.tabIndex = i === n - 1 ? 0 : -1;
			});
		}
		stars.forEach(function (s, i) {
			s.addEventListener('click', function () { set(i + 1); });
			s.addEventListener('keydown', function (e) {
				var k = e.key;
				if (k !== 'ArrowRight' && k !== 'ArrowLeft') return;
				e.preventDefault();
				var n = Math.min(5, Math.max(1, i + 1 + (k === 'ArrowRight' ? 1 : -1)));
				set(n);
				stars[n - 1].focus();
			});
		});
		set(5);

		var done = form.querySelector('[data-rate-done]');
		// Отправку гасит ../shared/demo.js — здесь только подсказка
		form.addEventListener('submit', function () {
			if (done) done.hidden = false;
		});
		form.addEventListener('reset', function () {
			if (done) done.hidden = true;
			set(5);
		});
	}

	window.demoReady.then(function () {
		drawQr();
		var form = document.querySelector('[data-rate]');
		if (form) initStars(form);
	});
})();
