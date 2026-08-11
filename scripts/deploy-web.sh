#!/usr/bin/env bash
# Deploy the web build to GitHub Pages (permanent link, works with PC off).
# Live URL: https://kck321.github.io/q-archive-app/
# Run from repo root:  npm run deploy:web
set -e

# The public build reads NO Firestore, so the bundle must carry the current edits and
# aliases. Skipping this ships a site that silently lacks your latest analysis work.
echo "Baking current Firestore edits + aliases into public/data/ ..."
node scripts/export-firestore.mjs || {
  echo "  !! export failed (quota/offline). The bundle may be stale — fix before publishing."
  exit 1
}

echo "Type-checking (tsc)..."
npx tsc -b

echo "Building web bundle (subpath /q-archive-app/, READ-ONLY public site)..."
# VITE_PUBLIC_SITE=1 makes CAN_EDIT false (src/lib/appMode.ts), so every editing
# control is compiled OUT of the public bundle — not hidden, absent. The desktop
# (Tauri) build and `npm run dev` leave it unset and keep the full workbench.
DEPLOY_TARGET=pages VITE_PUBLIC_SITE=1 NODE_OPTIONS="--max-old-space-size=4096" npx vite build

# SPA fallback so deep-link refreshes (e.g. /posts) still load the app.
cp dist/index.html dist/404.html

echo "Publishing to gh-pages branch..."
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email=Kck321@comcast.net -c user.name=kck321 commit -qm "Deploy web build"
git remote add origin https://github.com/kck321/q-archive-app.git
git push -f -q origin gh-pages

echo "Deployed. Live in ~1 min at https://kck321.github.io/q-archive-app/"
