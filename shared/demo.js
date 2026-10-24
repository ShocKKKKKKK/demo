/* ==========================================================================
   Загрузчик демо-данных лида.
   Адрес демо: /<основа>/?d=<token>, token — ровно 10 символов [a-z0-9].
   Данные: ../data/<token>.json. Нет файла, битый JSON или срок вышел —
   уходим на заглушку ../index.html.
   Локальная проверка: ?test=0|1|2 берёт профиль из ../test/sample.json
   (папка test/ на GitHub Pages не выкладывается, там такой адрес даст заглушку).

   Подстановка только через textContent / setAttribute — данные лида никогда
   не попадают в разметку как HTML.

   Метки в разметке:
   data-demo="<поле>"          текст элемента = значение поля;
                               поле *_href (phone_href) — пишется в атрибут href
   data-demo-default="…"       значение, если поля нет или оно пустое (поля, добавленные позже)
   data-demo-repeat="N"        значение повторяется N раз (разделитель — data-demo-sep, по умолчанию пробел)
   data-demo-if="<поле>"       элемент удаляется, если поля нет или оно пустое
   data-demo-list="services"   список: первый ребёнок — шаблон, клонируется на каждый пункт;
                               внутри шаблона data-demo-item — текст пункта, data-demo-index — номер «01»
   data-demo-long="<блок__элемент>"  модификатор по длине названия:
                               > 28 символов — <блок__элемент>--long, > 40 — ещё и --xlong

   <html data-demo-optional>    основа открывается и без ?d= / ?test= (свои вымышленные значения,
                               без ленты); неверный или просроченный ?d= всё равно ведёт на заглушку

   После подстановки на <html> ставятся CSS-переменные:
   --demo-name-word  длина самого длинного слова названия (для ограничения кегля)
   --demo-ribbon-h   высота ленты «Демо для …» (шапки основ сдвигаются на неё)
   ========================================================================== */

(function () {
	'use strict';

	var html = document.documentElement;
	var LONG_NAME = 28;
	var XLONG_NAME = 40;
	var STUB = '../index.html';

	// Пока данных нет — страница скрыта (см. shared/demo.css), иначе мелькают пустые метки
	html.classList.add('demo-wait');

	function toStub() {
		location.replace(STUB);
	}

	var params = new URLSearchParams(location.search);
	var token = params.get('d');
	var test = params.get('test');
	var url = null;

	if (token && /^[a-z0-9]{10}$/.test(token)) {
		url = '../data/' + token + '.json';
	} else if (test !== null && /^[0-9]$/.test(test)) {
		url = '../test/sample.json';
	}

	var domReady = new Promise(function (resolve) {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', resolve, { once: true });
		} else {
			resolve();
		}
	});

	// Строка для показа: числа рейтинга — с запятой (4,8), остальное как есть
	function format(key, value) {
		if (value === null || value === undefined) return '';
		if (key === 'rating' && typeof value === 'number') {
			return value.toFixed(1).replace('.', ',');
		}
		return String(value).trim();
	}

	function has(data, key) {
		var v = data[key];
		if (Array.isArray(v)) return v.length > 0;
		return format(key, v) !== '';
	}

	function apply(data) {
		// 1. Условные блоки — до подстановки, чтобы не заполнять удаляемое
		document.querySelectorAll('[data-demo-if]').forEach(function (el) {
			if (!has(data, el.getAttribute('data-demo-if'))) el.remove();
		});

		// 2. Списки
		document.querySelectorAll('[data-demo-list]').forEach(function (list) {
			var items = data[list.getAttribute('data-demo-list')];
			var tpl = list.firstElementChild;
			if (!tpl) return;
			tpl.remove();
			if (!Array.isArray(items)) return;
			items.forEach(function (item, i) {
				var text = format('', item);
				if (!text) return;
				var node = tpl.cloneNode(true);
				var targets = node.matches('[data-demo-item]') ? [node] : [];
				node.querySelectorAll('[data-demo-item]').forEach(function (t) {
					targets.push(t);
				});
				targets.forEach(function (t) {
					t.textContent = text;
				});
				if (node.tagName === 'OPTION') node.value = text;
				node.querySelectorAll('[data-demo-index]').forEach(function (t) {
					t.textContent = String(i + 1).padStart(2, '0');
				});
				list.appendChild(node);
			});
		});

		// 3. Поля
		document.querySelectorAll('[data-demo]').forEach(function (el) {
			var key = el.getAttribute('data-demo');
			var value = format(key, data[key]);
			if (/_href$/.test(key)) {
				// В href пускаем только tel: — никаких javascript: и чужих ссылок
				if (/^tel:\+?[0-9]{5,15}$/.test(value)) el.setAttribute('href', value);
				else el.removeAttribute('href');
				return;
			}
			// Поле, которого нет в старых JSON (словарь ниши), — значение по умолчанию из разметки
			if (!value && el.hasAttribute('data-demo-default')) value = el.getAttribute('data-demo-default');
			var times = parseInt(el.getAttribute('data-demo-repeat'), 10);
			if (times > 1 && value) {
				var sep = el.getAttribute('data-demo-sep') || ' ';
				value = new Array(times).fill(value).join(sep);
			}
			el.textContent = value;
		});

		// 4. Длинное название — уменьшенный кегль (модификаторы --long / --xlong)
		var name = format('name', data.name);
		document.querySelectorAll('[data-demo-long]').forEach(function (el) {
			var base = el.getAttribute('data-demo-long');
			if (name.length > LONG_NAME) el.classList.add(base + '--long');
			if (name.length > XLONG_NAME) el.classList.add(base + '--xlong');
		});

		// Самое длинное слово названия — основы по нему ограничивают кегль первого экрана,
		// чтобы слово не рвалось по буквам: font-size: min(…, 100cqi / (--demo-name-word * k))
		var longest = name.split(/\s+/).reduce(function (max, w) {
			return Math.max(max, w.length);
		}, 0);
		html.style.setProperty('--demo-name-word', String(Math.max(longest, 6)));

		// Подпись вкладки: основа может задать свою через <html data-demo-title="…">
		if (name) document.title = name + ' — ' + (html.getAttribute('data-demo-title') || 'демо сайту');
	}

	// Высота ленты зависит от шрифта и ширины — меряем, а не хардкодим
	function measureRibbon() {
		var ribbon = document.querySelector('.demo-ribbon');
		html.style.setProperty('--demo-ribbon-h', (ribbon ? ribbon.offsetHeight : 0) + 'px');
	}

	// Форма демо никуда не отправляет данные: сабмит гасится в фазе перехвата,
	// показ «Так заявка прийде вам у Telegram» делает скрипт основы
	document.addEventListener(
		'submit',
		function (e) {
			e.preventDefault();
		},
		true
	);

	if (!url) {
		// Основа с <html data-demo-optional> работает и без данных лида (вымышленные значения):
		// ленты «Демо для …» нет, страница показывается сразу, demoReady отдаёт null
		if (html.hasAttribute('data-demo-optional')) {
			window.demoReady = domReady.then(function () {
				document.querySelectorAll('.demo-ribbon').forEach(function (r) {
					r.remove();
				});
				measureRibbon();
				html.classList.remove('demo-wait');
				html.classList.add('demo-ready');
				document.dispatchEvent(new CustomEvent('demo:ready'));
				return null;
			});
			return;
		}
		toStub();
		window.demoReady = new Promise(function () {});
		return;
	}

	window.demoReady = fetch(url, { cache: 'no-store', credentials: 'omit' })
		.then(function (r) {
			if (!r.ok) throw new Error('нет данных');
			return r.json();
		})
		.then(function (data) {
			if (url.indexOf('/test/') !== -1) data = Array.isArray(data) ? data[Number(test)] : null;
			if (!data || typeof data !== 'object') throw new Error('битые данные');
			if (!(Number(data.expires_at) > Date.now())) throw new Error('срок вышел');
			return domReady.then(function () {
				apply(data);
				measureRibbon();
				window.addEventListener('resize', measureRibbon, { passive: true });
				if (document.fonts) document.fonts.ready.then(measureRibbon);
				html.classList.remove('demo-wait');
				html.classList.add('demo-ready');
				document.dispatchEvent(new CustomEvent('demo:ready'));
				return data;
			});
		})
		.catch(function () {
			toStub();
			return new Promise(function () {});
		});
})();
