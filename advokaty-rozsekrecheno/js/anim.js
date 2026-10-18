/* ==========================================================================
   Демо-основа «Розсекречено» — анимации (первый экран, появления, заголовки
   по строкам, параллакс штампа). Стартовые состояния лежат в CSS под js-anim.
   ========================================================================== */

(function () {
	const html = document.documentElement;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// GSAP не приехал с CDN или пользователь просил меньше движения —
	// снимаем стартовые состояния, весь контент виден как обычная страница
	if (reduced || !window.gsap) {
		clearTimeout(window.animFallbackTimer);
		html.classList.remove('js-anim');
		return;
	}

	// Анимации поднялись — страховочный таймер больше не нужен
	clearTimeout(window.animFallbackTimer);

	gsap.registerPlugin(ScrollTrigger);
	if (window.SplitText) gsap.registerPlugin(SplitText);

	gsap.defaults({ ease: 'expo', duration: 0.8 });

	const BREAKPOINTS = { desktop: 1024 };

	/* ------------------ 1. Плавный скролл (Lenis + ScrollTrigger) --------- */

	if (window.Lenis) {
		const lenis = new Lenis({
			autoRaf: false,
			duration: 1.1,
			smoothWheel: true,
		});
		window.lenis = lenis;
		lenis.on('scroll', ScrollTrigger.update);
		gsap.ticker.add((time) => lenis.raf(time * 1000));
		gsap.ticker.lagSmoothing(0);
	}

	/* ---------------------------- 2. Первый экран ------------------------- */

	function playHero() {
		const title = document.querySelector('.hero__title');
		const tl = gsap.timeline();

		tl.fromTo('.hero__meta', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0);

		// Снятие плашек — CSS-переход, JS только ставит класс
		if (title) tl.add(() => title.classList.add('hero__title--revealed'), 0.2);

		// Анимируем сам svg, а не обёртку: у обёртки живёт поворот и мобильная
		// прозрачность из CSS, плюс на неё вешается параллакс
		tl.fromTo(
			'.hero__stamp .stamp__svg',
			{ scale: 1.4, rotate: -15, opacity: 0 },
			{ scale: 1, rotate: 0, opacity: 1, duration: 1.2 },
			0.9
		)
			.fromTo('.hero__slogan', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 1.05)
			.fromTo('.hero__lead', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 1.15)
			.fromTo('.hero__actions', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 1.25)
			.fromTo('.hero__scroll', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.5);
	}

	// main.js сообщает, когда данные лида подставлены и страница показана
	document.addEventListener('pageRevealed', playHero, { once: true });

	/* ------------------- 3. Появление блоков при скролле ------------------ */

	function initFade() {
		const fadeElements = document.querySelectorAll('.js-fade');
		if (!fadeElements.length) return;

		// Синхронизируем инлайновое состояние с тем, что уже стоит в CSS
		gsap.set(fadeElements, { y: 24, opacity: 0 });

		ScrollTrigger.batch(fadeElements, {
			start: 'top 88%',
			once: true,
			onEnter: (batch) =>
				gsap.to(batch, {
					y: 0,
					opacity: 1,
					duration: 0.7,
					stagger: 0.08,
					ease: 'power2.out',
				}),
		});
	}

	/* ---------------------- 4. Заголовки по строкам ----------------------- */

	function initSplitTitles() {
		const titles = document.querySelectorAll('.js-split');
		if (!titles.length) return;

		// Плагин не приехал — просто показываем заголовки с лёгким появлением
		if (!window.SplitText) {
			gsap.set(titles, { opacity: 1 });
			ScrollTrigger.batch(titles, {
				start: 'top 88%',
				once: true,
				onEnter: (batch) => gsap.fromTo(batch, { y: 24 }, { y: 0, duration: 0.8 }),
			});
			return;
		}

		titles.forEach((title) => {
			SplitText.create(title, {
				type: 'lines',
				mask: 'lines',
				autoSplit: true,
				linesClass: 'split-line',
				onSplit(self) {
					// Строки уже нарезаны и спрятаны маской — заголовок можно показывать
					gsap.set(title, { opacity: 1 });
					return gsap.fromTo(
						self.lines,
						{ yPercent: 115 },
						{
							yPercent: 0,
							duration: 1.1,
							stagger: 0.09,
							ease: 'expo',
							scrollTrigger: { trigger: title, start: 'top 88%', once: true },
						}
					);
				},
			});
		});
	}

	/* ------------------------- 6. Лёгкий параллакс ------------------------ */

	function initParallax() {
		const mm = gsap.matchMedia();
		mm.add(`(min-width: ${BREAKPOINTS.desktop}px)`, () => {
			const stamp = document.querySelector('.hero__stamp');
			if (!stamp) return;
			// Только yPercent: поворот уже занят таймлайном первого экрана,
			// два твина на одном свойстве подрались бы
			gsap.to(stamp, {
				yPercent: 55,
				ease: 'none',
				scrollTrigger: {
					trigger: '.hero',
					start: 'top top',
					end: 'bottom top',
					scrub: true,
				},
			});
		});
	}

	/* ------------------------------ 7. Старт ----------------------------- */

	// Нарезка по строкам зависит от шрифтов — только после полной загрузки,
	// а список тек клонируется из данных лида — ещё и после подстановки
	const loaded = new Promise((resolve) => {
		if (document.readyState === 'complete') resolve();
		else window.addEventListener('load', resolve, { once: true });
	});
	Promise.all([loaded, window.demoReady || Promise.resolve()]).then(() => {
		initFade();
		initSplitTitles();
		initParallax();
		ScrollTrigger.refresh();
	});
})();
