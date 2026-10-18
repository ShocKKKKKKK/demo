/* ==========================================================================
   Демо advokaty-gribovod: шапка при скролле, бургер, появление блоков,
   выбор услуги в форме и показ «Так заявка прийде вам у Telegram».
   Данные лида подставляет ../shared/demo.js.
   ========================================================================== */

(function () {
	'use strict';

	// Шапка уплотняется после прокрутки
	const header = document.getElementById('header');
	const onScroll = () => header.classList.toggle('header--scrolled', window.scrollY > 40);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	// Боковое меню
	const burger = document.getElementById('burger');
	const menu = document.getElementById('menu');
	const backdrop = document.getElementById('backdrop');
	function setMenu(open) {
		menu.classList.toggle('menu--open', open);
		burger.classList.toggle('burger--open', open);
		backdrop.classList.toggle('backdrop--shown', open);
		burger.setAttribute('aria-expanded', open);
		document.body.style.overflow = open ? 'hidden' : '';
	}
	burger.addEventListener('click', () => setMenu(!menu.classList.contains('menu--open')));
	backdrop.addEventListener('click', () => setMenu(false));
	menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') setMenu(false);
	});
	window.addEventListener('resize', () => {
		if (window.innerWidth > 1280 && menu.classList.contains('menu--open')) setMenu(false);
	});

	// Год в подвале
	document.querySelectorAll('[data-year]').forEach((el) => {
		el.textContent = new Date().getFullYear();
	});

	// Клик по услуге — выбираем её в форме
	document.addEventListener('click', (e) => {
		const row = e.target.closest('[data-service]');
		if (!row) return;
		const select = document.getElementById('f-service');
		const name = row.querySelector('[data-demo-item]')?.textContent || '';
		if (select && name) select.value = name;
	});

	// Форма: проверка имени и телефона, затем сообщение-демонстрация.
	// Сети нет — отправку гасит shared/demo.js.
	const form = document.getElementById('leadForm');
	const card = document.getElementById('leadCard');
	form.addEventListener('submit', () => {
		const name = form.elements.name;
		const phone = form.elements.phone;
		const nameOk = name.value.trim().length > 0;
		const phoneOk = phone.value.replace(/\D/g, '').length >= 10;
		name.classList.toggle('field__input--error', !nameOk);
		phone.classList.toggle('field__input--error', !phoneOk);
		if (!nameOk || !phoneOk) {
			(nameOk ? phone : name).focus();
			return;
		}
		card.classList.add('form-card--done');
	});
	form.addEventListener('input', (e) => e.target.classList.remove('field__input--error'));

	// Появление блоков — после подстановки данных, чтобы высоты были настоящими
	(window.demoReady || Promise.resolve()).then(() => {
		const items = document.querySelectorAll('.reveal');
		if (!('IntersectionObserver' in window)) {
			items.forEach((el) => el.classList.add('reveal--in'));
			return;
		}
		const io = new IntersectionObserver(
			(entries) =>
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					entry.target.classList.add('reveal--in');
					io.unobserve(entry.target);
				}),
			{ threshold: 0.1 }
		);
		items.forEach((el) => io.observe(el));
	});
})();
