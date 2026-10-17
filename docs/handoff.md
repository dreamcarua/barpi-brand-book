# Handoff — стан посеред задачі

Оновлено: 17.10.2026 11:45 CEST

## Задача дослівно
«вже і у снеко і у Абриса є розділи з вакансіями, які повʼязані зі сторінками-дашбордами. Зробимо аналог для Барпі? https://abrisart.com/en/careers https://sneco.ua/kariera/ повтори повныстю функцыонал, зроби красиво і зручно, задай питання якщо треба» — Вадим, 17.10.2026
Відповіді Вадима: адреса barpi.com.ua/kariera/; лише UA; вакансія «менеджер з продажу» нейтрально; роботодавець ТОВ; Мукачево + гібрид + віддалено, умови як у snEco; сповіщення Олександр, Вадим, office@; фото колективу є; дашборд — точна копія.

## Зроблено (гілка `careers`)
- Воркер `cf-migration/workers/barpi-hr` (копія Abris `lib/hr.js` + `lib/careers.js`), Access JWT у `src/access.js`, міграції 0001 (схема) і 0002 (вакансія), 8 тестів зелені.
- Дашборд `dashboard/careers/index.html` (копія Abris `brand/hr.html`, стиль Barpi), картка в `dashboard/index.html`.
- Сторінка `site-embed/pages/careers.html` + `site-embed/careers.js` + блок стилів у `bp.css`.
- Локально перевірено: wrangler dev + Playwright 1440 і 390, відгук з резюме доходить у воронку, лист і TG формуються.

## Не зроблено (чекає «так» Вадима на прев'ю)
1. R2 `barpi-hr-files`; 2. D1 міграції 0001, 0002 на barpi-bible; 3. `wrangler deploy` barpi-hr + секрети TG_TOKEN, HR_TG_CHATS, HR_ADMIN_EMAILS; 4. Email Routing: перевірити, що office@barpi.ua — підтверджена адреса; 5. Horoshop: сторінка /kariera/ (поле контенту = careers.html), лоадер: додати "/kariera/" у P і careers.js, V=9; пункт меню; 6. злити гілку.

## Наступна одна дія
Показати Вадиму прев'ю і отримати «так» на запуск.
