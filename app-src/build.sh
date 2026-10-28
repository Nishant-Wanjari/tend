#!/bin/bash
set -e
cd /home/claude/tracker
mkdir -p dist
./tailwindcss -c tailwind.config.js -i src/styles.css -o dist/app.css --minify 2>&1 | grep -v "^$" | grep -vi "browserslist\|update-browserslist\|npx" || true
bun build src/main.jsx --outfile dist/app.js --minify --define 'process.env.NODE_ENV="production"' --target browser
python3 - <<'PY'
css = open('dist/app.css').read()
js = open('dist/app.js').read().replace('</script', '<\\/script')
head = '''<title>Tend Life Tracker</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Reading, money, fitness and habits in one calm tracker.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&display=swap">
'''
html = head + '<style>' + css + '</style>\n<div id="root"></div>\n<script>' + js + '</script>\n'
open('dist/tend.html', 'w').write(html)
print('tend.html', round(len(html)/1024), 'KB')
PY
