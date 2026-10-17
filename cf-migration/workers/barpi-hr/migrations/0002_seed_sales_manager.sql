-- Migration 0002 (17.10.2026): перша вакансія Barpi на сайті. Вадим 17.10.2026: «можеш нейтрально менеджера з продажів додати».
-- Умови «як у snEco» (офіційне працевлаштування, ставка + бонуси, Пн–Пт), формат: Мукачево, гібрид або віддалено.
-- Зарплата на сайті не показується (show_salary = 0), як у snEco для цієї ролі.
-- Ідемпотентна: WHERE NOT EXISTS за slug.
INSERT INTO hr_vacancies (title, public_title, company, department, headcount, priority, open_date, status, publish_site, slug, lang, region, city, work_format, employment_type, summary, responsibilities, public_requirements, offer, show_salary, salary_from_kop, salary_to_kop, currency, created_by, updated_by, published_at, created_at, updated_at)
SELECT 'Менеджер з продажу', 'Менеджер з продажу', 'Barpi', 'Продажі', 1, 'normal', '2026-10-17', 'open', 1, 'menedzher-z-prodazhu', 'uk', 'ua', 'Мукачево', 'hybrid', 'full',
'Barpi робить натуральні ласощі для собак і котів: один інгредієнт, без зайвого. Шукаємо менеджера з продажу, який розвиватиме зоомагазини, ветклініки, мережі та онлайн-партнерів і хоче бачити результат своєї роботи в цифрах.',
'Пошук і залучення нових партнерів: зоомагазини, ветеринарні клініки, грумінг-салони, мережі, маркетплейси
Презентація асортименту Barpi, переговори про умови співпраці та перше замовлення
Супровід партнерів: прийом замовлень, контроль оплат і представленості продукції на полиці
Опрацювання вхідних заявок з сайту, соцмереж і виставок
Координація з виробництвом, складом і логістикою, ведення CRM і звітності
Виконання плану продажів і пошук нових точок росту',
'Легко знаходите спільну мову з різними людьми і не боїтеся телефонувати першими
Вмієте слухати, розуміти потреби партнера і домовлятися
Самоорганізовані, відповідальні, готові працювати з результатом, а не з годинами
Досвід у продажах, особливо FMCG або зоотоварах, буде перевагою, але не обов''язковий: навчимо і детально розкажемо про продукт
Любов до тварин вітається',
'Офіційне працевлаштування
Фіксована ставка + бонуси від продажів (рівень доходу обговоримо на співбесіді)
Графік Пн–Пт
Офіс у Мукачеві, гібридний або віддалений формат
Навчання і підтримка під час адаптації
Продукт, який легко презентувати: натуральні ласощі, зроблені за власною технологією низькотемпературного сушіння',
0, 0, 0, 'UAH', 'claude (seed, owner request 17.10.2026)', 'claude (seed, owner request 17.10.2026)', CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)
WHERE NOT EXISTS (SELECT 1 FROM hr_vacancies WHERE slug = 'menedzher-z-prodazhu');
INSERT INTO hr_audit_log (entity, entity_id, action, diff, actor_email, at)
SELECT 'vacancy', v.id, 'create', '{"title": "Менеджер з продажу", "department": "Продажі", "status": "open", "publish_site": 1, "slug": "menedzher-z-prodazhu", "lang": "uk", "show_salary": 0, "via": "seed"}', 'claude (seed, owner request 17.10.2026)', CAST(strftime('%s','now') AS INTEGER)
FROM hr_vacancies v WHERE v.slug = 'menedzher-z-prodazhu'
  AND NOT EXISTS (SELECT 1 FROM hr_audit_log a WHERE a.entity = 'vacancy' AND a.entity_id = v.id AND a.action = 'create');
