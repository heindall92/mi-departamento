#!/usr/bin/env bash
# Copia el sitio estático a dist/ para Cloudflare Workers.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
rm -rf dist
mkdir -p dist
cp index.html favicon.svg 404.html _headers dist/
cp -r css js data dist/
python3 -m json.tool dist/data/office.json >/dev/null
python3 -m json.tool dist/data/feed.json >/dev/null
test -s dist/index.html
test -s dist/css/styles.css
test -s dist/js/app.js
test -s dist/404.html
test -s dist/_headers
echo "dist listo"
