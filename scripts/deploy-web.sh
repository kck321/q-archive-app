#!/usr/bin/env bash
# Deploy the web build to GitHub Pages (permanent link, works with PC off).
# Live URL: https://kck321.github.io/q-archive-app/
# Run from repo root:  npm run deploy:web
set -e

# ── Custom domain ────────────────────────────────────────────────────────────
# Set SITE_DOMAIN once the domain's DNS is live, e.g.
#   SITE_DOMAIN=qdrops.app npm run deploy:web
# or flip the default below to make it permanent.
#
# Two things have to change together, and BOTH are easy to miss:
#
#  1. Base path. On kck321.github.io the site lives under /q-archive-app/, so the bundle is
#     built with that base. On an apex domain it is served from the ROOT — deploying the
#     subpath build to qdrops.app gives a blank page, because every asset would be requested
#     from qdrops.app/q-archive-app/assets/... which does not exist.
#
#  2. The CNAME file. GitHub's "Custom domain" box writes a CNAME file into the gh-pages
#     branch, and this script FORCE-PUSHES that branch — so the very next deploy would
#     delete it and silently unset the custom domain. Writing it as part of the build makes
#     it survive every deploy.
SITE_DOMAIN="${SITE_DOMAIN:-qdrops.app}"

# The public build reads NO Firestore, so the bundle must carry the current edits and
# aliases. Skipping this ships a site that silently lacks your latest analysis work.
echo "Baking current Firestore edits + aliases into public/data/ ..."
node scripts/export-firestore.mjs || {
  echo "  !! export failed (quota/offline). The bundle may be stale — fix before publishing."
  exit 1
}

echo "Type-checking (tsc)..."
npx tsc -b

# VITE_PUBLIC_SITE=1 makes CAN_EDIT false (src/lib/appMode.ts), so every editing
# control is compiled OUT of the public bundle — not hidden, absent. The desktop
# (Tauri) build and `npm run dev` leave it unset and keep the full workbench.
if [ -n "$SITE_DOMAIN" ]; then
  echo "Building web bundle (root base for $SITE_DOMAIN, READ-ONLY public site)..."
  VITE_PUBLIC_SITE=1 NODE_OPTIONS="--max-old-space-size=4096" npx vite build
else
  echo "Building web bundle (subpath /q-archive-app/, READ-ONLY public site)..."
  DEPLOY_TARGET=pages VITE_PUBLIC_SITE=1 NODE_OPTIONS="--max-old-space-size=4096" npx vite build
fi

# SPA fallback so deep-link refreshes (e.g. /posts) still load the app.
cp dist/index.html dist/404.html

# Stamp the service worker with this deploy's version. Without this an installed app keeps
# serving the build it first cached — the classic way a PWA strands users on old code.
SW_VERSION="qdrops-$(date +%Y%m%d-%H%M%S)"
if [ -f dist/sw.js ]; then
  sed -i.bak "s/const CACHE_VERSION = '[^']*'/const CACHE_VERSION = '$SW_VERSION'/" dist/sw.js
  rm -f dist/sw.js.bak
  echo "Service worker cache version: $SW_VERSION"
fi

# Re-assert the custom domain on every deploy (see the note at the top).
if [ -n "$SITE_DOMAIN" ]; then
  echo "$SITE_DOMAIN" > dist/CNAME
  echo "Wrote dist/CNAME -> $SITE_DOMAIN"
fi

echo "Publishing to gh-pages branch..."
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email=Kck321@comcast.net -c user.name=kck321 commit -qm "Deploy web build"
git remote add origin https://github.com/kck321/q-archive-app.git
git push -f -q origin gh-pages

if [ -n "$SITE_DOMAIN" ]; then
  echo "Deployed. Live in ~1 min at https://$SITE_DOMAIN/"
else
  echo "Deployed. Live in ~1 min at https://kck321.github.io/q-archive-app/"
fi
