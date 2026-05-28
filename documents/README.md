# Barpi — База документів

Усі ключові документи бренду у markdown-форматі. Конвертовано з оригінальних DOCX через pandoc.

## Основні документи

| # | Файл | Опис |
|---|------|------|
| 01 | [Brand Book v7](01_Brand_Book_v7.md) | Головний документ бренду — маніфест, платформа, продукт, технологія, ідентичність, голос, контент, документи |
| 02 | [Guideline Logo & Visual Style](02_Guideline_Logo_Visual_Style.md) | Гайдлайн логотипу, кольорів, шрифтів, патернів, носіїв |
| 03 | [Knowledge Base 2026](03_Knowledge_Base_2026.md) | Єдина база знань про проект (детальніша, ніж Brand Book) |
| 04 | [Target Audience (ЦА)](04_Target_Audience.md) | 10 сегментів цільової аудиторії з мотиваціями і портретами |
| 05 | [Customer Journey Map](05_Customer_Journey_Map.md) | Шлях клієнта від першого контакту до повторної покупки |

## SMM Playbook (16 документів)

| # | Файл | Опис |
|---|------|------|
| 01 | [Brand Basics](smm/01_Brand_Basics.md) | Базовий документ для SMM-команди |
| 02 | [Tone of Voice](smm/02_Tone_Of_Voice.md) | 70% турбота / 30% дружба |
| 03 | [Visual Guidelines V2](smm/03_Visual_Guidelines_V2.md) | Візуальні правила для Instagram, Stories, Reels, Canva |
| 04 | [Logos](smm/04_Logos.md) | Правила використання логотипу |
| 05 | [Product Photos](smm/05_Product_Photos.md) | Правила фото продукції |
| 06 | [Product Videos](smm/06_Product_Videos.md) | Правила відео продукції |
| 07 | [Canva Templates](smm/07_Canva_Templates.md) | Система Canva-шаблонів |
| 08 | [Content Plan v2](smm/08_Content_Plan.md) | Планування контенту, пілари, формати |
| 09 | [Caption Templates](smm/09_Caption_Templates.md) | Готові шаблони підписів |
| 10 | [Direct Scripts](smm/10_Direct_Scripts.md) | Скрипти для Instagram Direct |
| 11 | [Comment Scripts](smm/11_Comment_Scripts.md) | Скрипти відповідей на коментарі |
| 12 | [UGC & Ambassadors](smm/12_UGC_Ambassadors.md) | Робота з амбасадорами і UGC-креаторами |
| 13 | [Partner Materials](smm/13_Partner_Materials.md) | Матеріали для торгових партнерів |
| 14 | [Product Knowledge Base](smm/14_Product_Knowledge_Base.md) | База знань по продуктах |
| 15 | [Reports](smm/15_Reports.md) | Система SMM-звітності |
| 16 | [Crisis Communication](smm/16_Crisis_Communication.md) | Правила реагування на кризи |

## Юридичні документи (заплановано до завантаження)

| Документ | Реквізит | Файл |
|---|---|---|
| Торгова марка | №383307 (08.04.2026 → 25.10.2034) | _додати TM_383307.pdf_ |
| Технічні умови | ТУ У 10.9-45519838-001:2024 | _додати TU.pdf_ |
| Потужність оператора | r-UA-21-17 | _додати power_registration.pdf_ |
| Сертифікат відповідності | №ТЕР.1.Х.112-24 | _додати certificate.pdf_ ⚠️ перевірити оновлення |
| Лабораторний висновок | №001636 н/24 (14.10.2024) | _додати lab_001636.pdf_ |
| Патент | Україна №160558 | _додати patent_160558.pdf_ |

## Як оновлювати

1. Локально DOCX → markdown через `pandoc input.docx -o output.md`
2. Commit у відповідну папку (`documents/` або `documents/smm/`)
3. Brand Bible (`index.html`) синхронізується вручну при суттєвих змінах
