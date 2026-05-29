#!/usr/bin/env bash
# ============================================================
# configure-supabase-auth.sh
# Sets Supabase Auth Site URL + Redirect URLs allowlist
# so that magic-link sign-in to /auth-callback/ works.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN="sbp_..."
#   ./supabase/configure-auth.sh
#
# Get token: https://supabase.com/dashboard/account/tokens
# ============================================================
set -euo pipefail

PROJECT_REF="zrcqmwlpsggiqgipvxhv"
SITE_URL="https://brand.barpi.ua"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3Ftd2xwc2dnaXFnaXB2eGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzcyMTYsImV4cCI6MjA5NTUxMzIxNn0.ROzbQ6aGRs-9rDVIDv0UyzlrvBRWFmFMQ7n77bLALmY"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN not set."
  echo ""
  echo "Get a token from https://supabase.com/dashboard/account/tokens"
  echo "Then run:"
  echo "  export SUPABASE_ACCESS_TOKEN='sbp_...'"
  echo "  $0"
  exit 1
fi

echo ">> PATCH Supabase Auth config for project $PROJECT_REF"
echo "   Site URL: $SITE_URL"
echo ""

response=$(curl -sS -w "\n%{http_code}" -X PATCH \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://brand.barpi.ua",
    "uri_allow_list": "https://brand.barpi.ua,https://brand.barpi.ua/**,https://brand.barpi.ua/auth-callback,https://brand.barpi.ua/auth-callback/,https://brand.barpi.ua/auth-callback/**,https://brand.barpi.ua/dashboard,https://brand.barpi.ua/dashboard/,https://brand.barpi.ua/dashboard/**",
    "external_email_enabled": true,
    "mailer_otp_exp": 3600,
    "mailer_otp_length": 6,
    "disable_signup": false
  }')

body=$(echo "$response" | sed '$d')
code=$(echo "$response" | tail -n1)

echo "HTTP $code"
echo "$body" | head -c 2000
echo ""

if [ "$code" -ge 400 ]; then
  echo ""
  echo "ERROR: API returned $code"
  exit 1
fi

echo ""
echo ">> Done. Verifying public settings:"
curl -s "https://${PROJECT_REF}.supabase.co/auth/v1/settings" \
  -H "apikey: ${ANON}" \
  | python3 -m json.tool 2>/dev/null | head -10 || cat

echo ""
echo ">> Optionally — update Email OTP template to include {{ .Token }}:"
echo "   Dashboard → Auth → Email Templates → 'Magic Link'"
echo "   Add a line like:  Or paste this code: {{ .Token }}"
echo "   This unlocks 6-digit OTP code as a fallback to clicking the link."
