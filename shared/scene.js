/* ==========================================================================
   Общее для демо-сцен (reviews/, automation/): инициалы в аватарах.
   Подключается с defer после ../shared/demo.js; работает по событию готовности данных.
   ========================================================================== */

(function () {
	'use strict';

	// «Ірина Мельничук» → «ІМ», «Адвокатське об'єднання «Захист»» → «АО»
	function initials(name) {
		var words = String(name || '').split(/\s+/).map(function (w) {
			return w.replace(/[^\p{L}]/gu, '');
		}).filter(Boolean);
		return words.slice(0, 2).map(function (w) {
			return w.charAt(0).toUpperCase();
		}).join('') || '•';
	}

	window.demoReady.then(function (data) {
		document.querySelectorAll('[data-initials]').forEach(function (el) {
			el.textContent = initials(data.name);
		});
	});
})();
