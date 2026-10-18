/* ==========================================================================
   Демо-основа «Розсекречено» — базовая логика (копия основы без попапов,
   картотеки-модалки, кастомного селекта и маски телефона).
   Форма ничего не отправляет: режим data-form="dev" показывает штамп
   «Прийнято» с подписью «Так заявка прийде вам у Telegram».
   ========================================================================== */

/* ------------------------- 1. ХЕЛПЕРЫ (core-utils) ---------------------- */

let bodyLockStatus = true;

function bodyLock(delay = 500) {
	if (!bodyLockStatus) return;
	const lockPaddingElements = document.querySelectorAll('[data-lp]');
	const lockPaddingValue = window.innerWidth - document.body.offsetWidth + 'px';
	lockPaddingElements.forEach((el) => {
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
	const lockPaddingElements = document.querySelectorAll('[data-lp]');
	setTimeout(() => {
		lockPaddingElements.forEach((el) => {
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
	if (document.documentElement.hasAttribute('data-scroll-lock')) {
		bodyUnlock(delay);
	} else {
		bodyLock(delay);
	}
}

function slideUp(target, duration = 500, showmore = 0) {
	if (target.classList.contains('--slide')) return;
	target.classList.add('--slide');
	target.style.transitionProperty = 'height, margin, padding';
	target.style.transitionDuration = duration + 'ms';
	target.style.height = `${target.offsetHeight}px`;
	target.offsetHeight;
	target.style.overflow = 'hidden';
	target.style.height = showmore ? `${showmore}px` : '0px';
	target.style.paddingTop = 0;
	target.style.paddingBottom = 0;
	target.style.marginTop = 0;
	target.style.marginBottom = 0;
	window.setTimeout(() => {
		target.hidden = !showmore ? true : false;
		if (!showmore) target.style.removeProperty('height');
		target.style.removeProperty('padding-top');
		target.style.removeProperty('padding-bottom');
		target.style.removeProperty('margin-top');
		target.style.removeProperty('margin-bottom');
		if (!showmore) target.style.removeProperty('overflow');
		target.style.removeProperty('transition-duration');
		target.style.removeProperty('transition-property');
		target.classList.remove('--slide');
		document.dispatchEvent(new CustomEvent('slideUpDone', { detail: { target } }));
	}, duration);
}

function slideDown(target, duration = 500, showmore = 0) {
	if (target.classList.contains('--slide')) return;
	target.classList.add('--slide');
	target.hidden = target.hidden ? false : null;
	if (showmore) target.style.removeProperty('height');
	const height = target.offsetHeight;
	target.style.overflow = 'hidden';
	target.style.height = showmore ? `${showmore}px` : '0px';
	target.style.paddingTop = 0;
	target.style.paddingBottom = 0;
	target.style.marginTop = 0;
	target.style.marginBottom = 0;
	target.offsetHeight;
	target.style.transitionProperty = 'height, margin, padding';
	target.style.transitionDuration = duration + 'ms';
	target.style.height = height + 'px';
	target.style.removeProperty('padding-top');
	target.style.removeProperty('padding-bottom');
	target.style.removeProperty('margin-top');
	target.style.removeProperty('margin-bottom');
	window.setTimeout(() => {
		target.style.removeProperty('height');
		target.style.removeProperty('overflow');
		target.style.removeProperty('transition-duration');
		target.style.removeProperty('transition-property');
		target.classList.remove('--slide');
		document.dispatchEvent(new CustomEvent('slideDownDone', { detail: { target } }));
	}, duration);
}

function slideToggle(target, duration = 500) {
	return target.hidden ? slideDown(target, duration) : slideUp(target, duration);
}

function debounce(delay, fn) {
	let timerId;
	return (...args) => {
		if (timerId) clearTimeout(timerId);
		timerId = setTimeout(() => {
			fn(...args);
			timerId = null;
		}, delay);
	};
}

const isMobile = {
	Android: () => navigator.userAgent.match(/Android/i),
	BlackBerry: () => navigator.userAgent.match(/BlackBerry/i),
	iOS: () => navigator.userAgent.match(/iPhone|iPad|iPod/i),
	Opera: () => navigator.userAgent.match(/Opera Mini/i),
	Windows: () => navigator.userAgent.match(/IEMobile/i),
	any: () =>
		isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows(),
};

function isTouchDevice() {
	return (
		'ontouchstart' in window ||
		window.navigator.maxTouchPoints > 0 ||
		window.navigator.msMaxTouchPoints > 0
	);
}

function addTouchAttr() {
	if (isMobile.any() || isTouchDevice()) {
		document.documentElement.setAttribute('data-touch', '');
	}
}
addTouchAttr();

function addLoadedAttr() {
	// Прелоадера в демо нет: первый экран играет, как только подставлены данные лида
	const ready = window.demoReady || Promise.resolve();
	ready.then(() => {
		document.documentElement.setAttribute('data-loaded', '');
		document.dispatchEvent(new CustomEvent('pageRevealed'));
	});
}
addLoadedAttr();

/* ------------- 2. ПЛАВНЫЙ СКРОЛЛ К ЯКОРЮ (gotoBlock + Lenis) ------------ */

function gotoBlock(targetBlock, noHeader = false, speed = 500, offsetTop = 0) {
	const targetBlockElement = document.querySelector(targetBlock);
	if (!targetBlockElement) return;

	let headerItemHeight = 0;
	if (noHeader) {
		const headerElement = document.querySelector('.header');
		if (headerElement) {
			if (!headerElement.classList.contains('--header-scroll')) {
				headerElement.style.cssText = 'transition-duration: 0s;';
				headerElement.classList.add('--header-scroll');
				headerItemHeight = headerElement.offsetHeight;
				headerElement.classList.remove('--header-scroll');
				setTimeout(() => {
					headerElement.style.cssText = '';
				}, 0);
			} else {
				headerItemHeight = headerElement.offsetHeight;
			}
		}
	}

	// Меню закрываем до скролла — иначе на телефоне прокрутка уйдёт «за» открытой панелью.
	// Lenis обязательно возобновляем: на остановленном инстансе scrollTo молча ничего не делает
	if (document.documentElement.hasAttribute('data-menu-open')) {
		bodyUnlock();
		document.documentElement.removeAttribute('data-menu-open');
		if (window.lenis) window.lenis.start();
	}

	const offset = headerItemHeight + offsetTop;

	// На странице работает Lenis — программный скролл только через него,
	// иначе window.scrollTo подерётся с инерцией библиотеки
	if (window.lenis) {
		window.lenis.scrollTo(targetBlockElement, { offset: -offset, duration: speed / 1000 + 0.6 });
		return;
	}

	let position = targetBlockElement.getBoundingClientRect().top + window.scrollY - offset;
	window.scrollTo({ top: position, behavior: 'smooth' });
}

document.addEventListener('click', (e) => {
	const gotoLink = e.target.closest('[data-goto]');
	if (!gotoLink) return;
	e.preventDefault();
	gotoBlock(
		gotoLink.dataset.goto,
		gotoLink.hasAttribute('data-goto-header'),
		500,
		parseInt(gotoLink.dataset.gotoTop) || 0
	);
});

/* ------------------------- 3. ШАПКА ПРИ СКРОЛЛЕ ------------------------- */

function headerScroll() {
	const header = document.querySelector('[data-header-scroll]');
	if (!header) return;
	const startPoint = header.dataset.headerScroll ? header.dataset.headerScroll : 1;

	const onScroll = () => {
		if (window.scrollY >= startPoint) {
			if (!header.classList.contains('--header-scroll')) header.classList.add('--header-scroll');
		} else {
			if (header.classList.contains('--header-scroll')) header.classList.remove('--header-scroll');
		}
	};

	document.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}
headerScroll();

/* ---------------------------- 4. БУРГЕР-МЕНЮ ---------------------------- */

function menuInit() {
	document.addEventListener('click', (e) => {
		if (bodyLockStatus && e.target.closest('[data-menu]')) {
			bodyLockToggle();
			document.documentElement.toggleAttribute('data-menu-open');
			const burger = document.querySelector('[data-menu]');
			const isOpen = document.documentElement.hasAttribute('data-menu-open');
			burger.setAttribute('aria-label', isOpen ? 'Закрити меню' : 'Відкрити меню');
			if (window.lenis) isOpen ? window.lenis.stop() : window.lenis.start();
		}
	});
}
menuInit();

/* ---------------------- 7. ФОРМЫ: валидация + отправка ------------------- */

const formValidate = {
	getErrors(form) {
		let error = 0;
		const formRequiredItems = form.querySelectorAll('[required]');
		if (formRequiredItems.length) {
			formRequiredItems.forEach((formRequiredItem) => {
				if (
					(formRequiredItem.offsetParent !== null || formRequiredItem.tagName === 'SELECT') &&
					!formRequiredItem.disabled
				) {
					error += this.validateInput(formRequiredItem);
				}
			});
		}
		return error;
	},
	validateInput(formRequiredItem) {
		let error = 0;
		if (formRequiredItem.type === 'email') {
			formRequiredItem.value = formRequiredItem.value.replace(/\s+/g, '');
			if (this.emailTest(formRequiredItem)) {
				this.addError(formRequiredItem);
				this.removeSuccess(formRequiredItem);
				error++;
			} else {
				this.removeError(formRequiredItem);
				this.addSuccess(formRequiredItem);
			}
		} else if (formRequiredItem.type === 'checkbox' && !formRequiredItem.checked) {
			this.addError(formRequiredItem);
			this.removeSuccess(formRequiredItem);
			error++;
		} else {
			if (!formRequiredItem.value.trim()) {
				this.addError(formRequiredItem);
				this.removeSuccess(formRequiredItem);
				error++;
			} else {
				this.removeError(formRequiredItem);
				this.addSuccess(formRequiredItem);
			}
		}
		return error;
	},
	addError(formRequiredItem) {
		formRequiredItem.classList.add('--form-error');
		formRequiredItem.setAttribute('aria-invalid', 'true');
		formRequiredItem.parentElement.classList.add('--form-error');
		const inputError = formRequiredItem.parentElement.querySelector('[data-form-error]');
		if (inputError) formRequiredItem.parentElement.removeChild(inputError);
		if (formRequiredItem.dataset.formErrtext) {
			const errorNode = document.createElement('div');
			errorNode.setAttribute('data-form-error', '');
			errorNode.textContent = formRequiredItem.dataset.formErrtext;
			formRequiredItem.parentElement.append(errorNode);
		}
	},
	removeError(formRequiredItem) {
		formRequiredItem.classList.remove('--form-error');
		formRequiredItem.removeAttribute('aria-invalid');
		formRequiredItem.parentElement.classList.remove('--form-error');
		const inputError = formRequiredItem.parentElement.querySelector('[data-form-error]');
		if (inputError) formRequiredItem.parentElement.removeChild(inputError);
	},
	addSuccess(formRequiredItem) {
		formRequiredItem.classList.add('--form-success');
		formRequiredItem.parentElement.classList.add('--form-success');
	},
	removeSuccess(formRequiredItem) {
		formRequiredItem.classList.remove('--form-success');
		formRequiredItem.parentElement.classList.remove('--form-success');
	},
	removeFocus(formRequiredItem) {
		formRequiredItem.classList.remove('--form-focus');
		formRequiredItem.parentElement.classList.remove('--form-focus');
	},
	formClean(form) {
		form.reset();
		setTimeout(() => {
			const inputs = form.querySelectorAll('input,textarea');
			for (let index = 0; index < inputs.length; index++) {
				const el = inputs[index];
				formValidate.removeFocus(el);
				formValidate.removeSuccess(el);
				formValidate.removeError(el);
			}
			form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
				checkbox.checked = false;
			});
		}, 0);
	},
	emailTest(formRequiredItem) {
		return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formRequiredItem.value);
	},
};

function formInit() {
	function formSubmit() {
		const forms = document.forms;
		if (!forms.length) return;

		for (const form of forms) {
			if (!form.hasAttribute('data-form-novalidate')) form.setAttribute('novalidate', true);
			form.addEventListener('submit', (e) => formSubmitAction(e.target, e));
			form.addEventListener('reset', (e) => formValidate.formClean(e.target));
		}

		async function formSubmitAction(form, e) {
			const error = formValidate.getErrors(form);
			if (error === 0) {
				if (form.dataset.form === 'ajax') {
					e.preventDefault();
					if (form.classList.contains('--sending')) return;
					const formAction = form.getAttribute('action') ? form.getAttribute('action').trim() : '#';
					const formMethod = form.getAttribute('method') ? form.getAttribute('method').trim() : 'GET';
					const formData = new FormData(form);
					form.classList.add('--sending');
					try {
						const response = await fetch(formAction, { method: formMethod, body: formData });
						if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
						const responseResult = await response.json();
						formSent(form, responseResult);
					} catch (err) {
						showFormError(form, 'Не вдалося надіслати. Спробуйте ще раз.');
					} finally {
						form.classList.remove('--sending');
					}
				} else if (form.dataset.form === 'dev') {
					// Демо-режим: бэкенда нет, сразу показываем успешную отправку
					e.preventDefault();
					formSent(form);
				}
			} else {
				e.preventDefault();
				if (
					form.querySelector('.--form-error') &&
					form.hasAttribute('data-form-gotoerr') &&
					typeof gotoBlock === 'function'
				) {
					const formGoToErrorClass = form.dataset.formGotoerr ? form.dataset.formGotoerr : '.--form-error';
					gotoBlock(formGoToErrorClass, true, 500, 40);
				}
			}
		}

		function showFormError(form, text) {
			let errorBlock = form.querySelector('[data-form-senderror]');
			if (!errorBlock) {
				errorBlock = document.createElement('div');
				errorBlock.setAttribute('data-form-senderror', '');
				form.append(errorBlock);
			}
			errorBlock.textContent = text;
			setTimeout(() => errorBlock.remove(), 5000);
		}

		function formSent(form, responseResult = ``) {
			document.dispatchEvent(new CustomEvent('formSent', { detail: { form } }));
			formValidate.formClean(form);
		}
	}

	function formFieldsInit() {
		document.body.addEventListener('focusin', (e) => {
			const el = e.target;
			if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
				if (!el.hasAttribute('data-form-nofocus')) {
					el.classList.add('--form-focus');
					el.parentElement.classList.add('--form-focus');
				}
				if (el.hasAttribute('data-form-validatenow')) formValidate.removeError(el);
			}
		});
		document.body.addEventListener('focusout', (e) => {
			const el = e.target;
			if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
				if (!el.hasAttribute('data-form-nofocus')) {
					el.classList.remove('--form-focus');
					el.parentElement.classList.remove('--form-focus');
				}
				if (el.hasAttribute('data-form-validatenow')) formValidate.validateInput(el);
			}
		});
	}

	formSubmit();
	formFieldsInit();
}

// Штамп «Принято» вместо содержимого формы
document.addEventListener('formSent', (e) => {
	e.detail.form.classList.add('--form-sent');
});

/* ------------------------- 9. АВТОВЫСОТА ПОЛЯ ----------------------------- */

const autoHeight = () => {
	const textareas = document.querySelectorAll('textarea[data-input-autoheight]');
	if (!textareas.length) return;
	textareas.forEach((textarea) => {
		const startHeight = textarea.hasAttribute('data-input-autoheight-min')
			? Number(textarea.dataset.inputAutoheightMin)
			: Number(textarea.offsetHeight);
		const maxHeight = textarea.hasAttribute('data-input-autoheight-max')
			? Number(textarea.dataset.inputAutoheightMax)
			: Infinity;
		setHeight(textarea, Math.min(startHeight, maxHeight));
		textarea.addEventListener('input', () => {
			if (textarea.scrollHeight > startHeight) {
				textarea.style.height = `auto`;
				setHeight(textarea, Math.min(Math.max(textarea.scrollHeight, startHeight), maxHeight));
			}
		});
	});
	function setHeight(textarea, height) {
		textarea.style.height = `${height}px`;
	}
};

/* -------------------- 11. ПОДСВЕТКА ПУНКТА МЕНЮ -------------------------- */

function navSpy() {
	const links = document.querySelectorAll('.nav__link[data-goto]');
	if (!links.length) return;
	const map = new Map();
	links.forEach((link) => {
		const section = document.querySelector(link.dataset.goto);
		if (section) map.set(section, link);
	});
	if (!map.size) return;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				links.forEach((l) => l.classList.remove('nav__link--active'));
				map.get(entry.target)?.classList.add('nav__link--active');
			});
		},
		{ rootMargin: '-45% 0px -50% 0px' }
	);
	map.forEach((_, section) => observer.observe(section));
}
navSpy();

/* ------------------------------ 12. СТАРТ -------------------------------- */

// Год в копирайте
document.querySelectorAll('[data-year]').forEach((el) => {
	el.textContent = new Date().getFullYear();
});

window.addEventListener('load', () => {
	formInit();
	autoHeight();
});

// Клик по теке — выбираем этот напрям у бланку звернення
document.addEventListener('click', (e) => {
	const folder = e.target.closest('[data-service]');
	if (!folder) return;
	const select = document.querySelector('select[name="form[direction]"]');
	const name = folder.querySelector('[data-demo-item]')?.textContent || '';
	if (select && name) select.value = name;
});
