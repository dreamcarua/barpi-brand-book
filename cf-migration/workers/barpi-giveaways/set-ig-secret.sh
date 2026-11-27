#!/bin/bash
# Ставить секрет IG_TOKEN воркера barpi-giveaways: токен СТОРІНКИ Barpi (доступ лише до цієї сторінки та її Instagram),
# отриманий із системного токена в Keychain. Значення ніде не друкується і не зберігається у файлах.
# Передумова: системний користувач має роль на сторінці Barpi (Meta Business → Сторінки → Barpi).
set -euo pipefail
cd "$(dirname "$0")"
PAGE_ID="450223831502000"
SYS="$(security find-generic-password -s dreamcar-meta-token -w)"
PT="$(curl -sS -G "https://graph.facebook.com/v21.0/${PAGE_ID}" --data-urlencode "fields=access_token" --data-urlencode "access_token=${SYS}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')"
if [ -z "$PT" ]; then echo "Немає доступу до сторінки: системний користувач ще не має ролі на сторінці Barpi."; exit 1; fi
printf '%s' "$PT" | npx --yes wrangler@4.97.0 secret put IG_TOKEN
echo "Готово: IG_TOKEN встановлено. Перевірка: відкрийте /dashboard/giveaways/ (банер про Instagram має зникнути)."
