#!/usr/bin/env bash
# Deploy the web build to GitHub Pages (permanent link, works with PC off).
# Live URL: https://kck321.github.io/q-archive-app/
# Run from repo root:  npm run deploy:web
set -e

# Never publish from a state git cannot reproduce, or while another agent is certifying.
node scripts/preflight-deploy.mjs

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
# SKIP_EXPORT=1 publishes the bundle already on disk instead of re-dumping Firestore.
#
# SKIP_EXPORT IS A QUOTA ESCAPE HATCH, NOT A WORKFLOW. Seed 75 shipped through it because the
# export re-derived audit/entities-audit.json with a detector that had moved since the section was
# certified, produced 9,804 entity mentions against 9,786, and apply-entities.mjs refused to write.
# That is fixed at the source — the deploy chain applies certified artifacts and no longer
# re-derives them (scripts/lib/chainSteps.mjs). If the ordinary export cannot run again, treat it
# as the bug rather than reaching for this flag.
#
# Only safe when the local bundle is known current — which the certification manifest can prove.
# The export exists to catch a STALE bundle; when `certification-manifest.mjs --verify` passes,
# the bundle matches the certified state by definition and re-dumping adds nothing. Firestore's
# free-tier read quota blocks the export for hours at a time, and that must not hold a verified
# certified change off the site.
#
# The manifest gate below still runs either way, so a genuinely stale bundle is still refused.
if [ "$SKIP_EXPORT" = "1" ]; then
  echo "SKIP_EXPORT=1 — publishing the bundle on disk (manifest gate below still applies)"
else
  echo "Baking current Firestore edits + aliases into public/data/ ..."
  node scripts/export-firestore.mjs || {
    echo "  !! export failed (quota/offline). The bundle may be stale — fix before publishing."
    echo "     If the bundle is already certified and current, re-run with SKIP_EXPORT=1."
    exit 1
  }
fi

# ── MANDATORY CERTIFICATION GATE ─────────────────────────────────────────────
# Runs AFTER the export chain, so it checks what will actually ship rather than what was on
# disk beforehand. The chain re-dumps posts.json and replays every apply step; the manifest
# compares a key-sorted semantic hash, so that re-serialisation is reported and does not fail.
#
# Blocking the deploy is the point. Eight sections were certified one at a time, and the
# failures that got through were never wrong counts — they were correct counts that stopped
# reaching the reader (SEED_VERSION stuck at 4 through three applies) or shipped rows that
# collided (five Resolution Center ids shared by six rows). A per-section gate cannot see either.
#
# If a change was intended, re-certify deliberately:
#   node scripts/certification-manifest.mjs
echo "Verifying the certification manifest (mandatory pre-deploy gate)..."
node scripts/certification-manifest.mjs --verify || {
  echo ""
  echo "  !! DEPLOY BLOCKED — the bundle does not match the certified state."
  echo "     Every certified count, artifact and the seed version must match audit/certification-manifest.json."
  echo "     If the change was intended: node scripts/certification-manifest.mjs   (then re-run this deploy)"
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
