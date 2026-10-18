// ============================================================
// Демо «Editorial Wine»: блокировка скролла, бургер, форма-демонстрация,
// появление блоков, обводка телефона, выбор услуги из списка.
// Данные лида подставляет ../shared/demo.js — всё, что зависит от данных,
// стартует после window.demoReady.
// ============================================================

/* ---------- Блокировка скролла (verstka-recipes/core-utils) ---------- */
let bodyLockStatus = true;

function bodyLock(delay = 500) {
	if (!bodyLockStatus) return;
	const lockPaddingValue = window.innerWidth - document.body.offsetWidth + 'px';
	document.querySelectorAll('[data-lp]').forEach((el) => {
		el.style.paddingRight = lockPaddingValue;
	});
	document.body.style.paddingRight = lockPaddingValue;
	document.documentElement.setAttribute('data-scroll-lock', '');
	bodyLockStatus = false;
	setTimeout(() => {
		bodyLockStatus = true;
	}, delay);
}

function bodyUnlock(delay = 500) {
	if (!bodyLockStatus) return;
	setTimeout(() => {
		document.querySelectorAll('[data-lp]').forEach((el) => {
			el.style.paddingRight = '';
		});
		document.body.style.paddingRight = '';
		document.documentElement.removeAttribute('data-scroll-lock');
	}, delay);
	bodyLockStatus = false;
	setTimeout(() => {
		bodyLockStatus = true;
	}, delay);
}

function bodyLockToggle(delay = 500) {
	if (document.documentElement.hasAttribute('data-scroll-lock')) bodyUnlock(delay);
	else bodyLock(delay);
}

/* ---------- Бургер-меню ---------- */
function menuInit() {
	const html = document.documentElement;
	const burger = document.querySelector('[data-menu]');
	if (!burger) return;
	const sync = () => burger.setAttribute('aria-expanded', html.hasAttribute('data-menu-open'));
	const close = () => {
		if (!html.hasAttribute('data-menu-open')) return;
		bodyUnlock(0);
		html.removeAttribute('data-menu-open');
		sync();
	};
	document.addEventListener('click', (e) => {
		if (bodyLockStatus && e.target.closest('[data-menu]')) {
			bodyLockToggle();
			html.toggleAttribute('data-menu-open');
			sync();
			return;
		}
		// Пункт меню-якорь закрывает панель
		if (e.target.closest('.menu__body a')) close();
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') close();
	});
}
menuInit();

/* ---------- Год в копирайте ---------- */
document.querySelectorAll('[data-year]').forEach((el) => {
	el.textContent = new Date().getFullYear();
});

/* ---------- Форма: проверка + показ «Так заявка прийде вам у Telegram» ---------- */
/* Сети нет: отправку гасит shared/demo.js, здесь только проверка и сообщение */
function formsInit() {
	document.querySelectorAll('[data-form]').forEach((form) => {
		form.setAttribute('novalidate', '');
		form.addEventListener('submit', () => {
			if (!validateForm(form)) return;
			form.hidden = true;
			const success = form.closest('[data-form-wrap]')?.querySelector('[data-form-success]');
			if (success) success.hidden = false;
		});
		form.addEventListener('input', (e) => {
			const field = e.target.closest('[data-required]');
			if (field) field.closest('.form__field')?.classList.remove('form__field--error');
		});
	});

	function validateForm(form) {
		let valid = true;
		form.querySelectorAll('[data-required]').forEach((field) => {
			let ok = field.value.trim().length > 0;
			// в номере не меньше 10 цифр
			if (ok && field.dataset.required === 'phone') ok = field.value.replace(/\D/g, '').length >= 10;
			if (!ok) {
				field.closest('.form__field')?.classList.add('form__field--error');
				valid = false;
			}
		});
		return valid;
	}
}
formsInit();

/* ---------- Клик по услуге — выбираем её в форме ---------- */
document.addEventListener('click', (e) => {
	const row = e.target.closest('[data-service]');
	if (!row) return;
	const select = document.getElementById('cta-service');
	const name = row.querySelector('[data-demo-item]')?.textContent || '';
	if (select && name) select.value = name;
});

/* ---------- Появление блоков и обводка телефона ---------- */
function motionInit() {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
	const html = document.documentElement;
	html.classList.add('motion');

	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.setAttribute('data-reveal-in', '');
				io.unobserve(entry.target);
			});
		},
		{ rootMargin: '0px 0px -8% 0px' }
	);
	document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

	// Эллипс «от руки» вокруг телефона рисуется при появлении
	document.querySelectorAll('[data-ellipse]').forEach((path) => {
		const len = path.getTotalLength();
		path.style.strokeDasharray = len;
		path.style.strokeDashoffset = len;
		const pio = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return;
			path.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.65, 0, 0.35, 1) 0.3s';
			path.style.strokeDashoffset = '0';
			pio.disconnect();
		});
		pio.observe(path);
	});
}

(window.demoReady || Promise.resolve()).then(motionInit);
