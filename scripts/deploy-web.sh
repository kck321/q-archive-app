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
# SKIP_EXPORT IS CONTAINMENT, AND EVERY USE NEEDS ITS OWN CURRENT REASON AND OWNER APPROVAL.
# scripts/preflight-deploy.mjs (which has already run) refuses the deploy unless SKIP_EXPORT_REASON
# and SKIP_EXPORT_APPROVED_BY are both set for THIS deploy, and refuses a reason that claims the
# export is broken without SKIP_EXPORT_EVIDENCE naming the current failing run. Five consecutive
# deploys once shipped on a single inherited justification which had gone stale — the qc-pin
# blocker they cited was closed by the question-identity registry, and a real export had already
# shipped through it at f3f0901 on 2026-09-01. There is no standing permission.
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
  # Pre-flight has already judged this skip against scripts/lib/exportPolicy.mjs and refused the
  # deploy if the reason or the approval was missing, so reaching here means the owner approved
  # THIS skip, today, in words. Record what was approved next to the run that used it.
  echo "SKIP_EXPORT=1 — publishing the bundle on disk (manifest gate below still applies)"
  echo "  reason:   ${SKIP_EXPORT_REASON}"
  echo "  approved: ${SKIP_EXPORT_APPROVED_BY}"
  node -e "import('./scripts/lib/exportPolicy.mjs').then(m => m.writeLedger(process.cwd(), {
    ran: false,
    reason: process.env.SKIP_EXPORT_REASON ?? '',
    approvedBy: process.env.SKIP_EXPORT_APPROVED_BY ?? '',
    evidence: process.env.SKIP_EXPORT_EVIDENCE ?? '',
    commit: process.env.DEPLOY_COMMIT ?? null,
  }))"
else
  echo "Baking current Firestore edits + aliases into public/data/ ..."
  node scripts/export-firestore.mjs || {
    echo "  !! export failed (quota/offline). The bundle may be stale — fix before publishing."
    echo "     If the bundle is already certified and current, re-run with SKIP_EXPORT=1."
    exit 1
  }
fi

# ── THE EXPORT MAY HAVE CHANGED THE BYTES PRE-FLIGHT APPROVED ────────────────
# preflight-deploy.mjs runs FIRST and checks a clean tree against the validation receipt. The
# export then writes public/data/*.json. If it changed anything, the bundle about to be built is no
# longer the bundle that was validated — and write-build-info.mjs would refuse to stamp it anyway,
# four minutes later, after the whole vite build. Catching it here costs a second and says why.
POST_EXPORT_DIRTY="$(git status --porcelain | wc -l | tr -d ' ')"
if [ "$POST_EXPORT_DIRTY" != "0" ]; then
  echo ""
  echo "  !! DEPLOY BLOCKED — the Firestore export changed $POST_EXPORT_DIRTY tracked file(s)."
  git status --porcelain | head -10
  echo ""
  echo "     These bytes were not the bytes that were validated, and a build stamp cannot"
  echo "     describe them. Commit them and re-validate at the profile the diff now requires:"
  echo ""
  echo "         git add -A && git commit"
  echo "         node scripts/validate.mjs        (the floor comes from the diff)"
  echo "         npm run deploy:web"
  echo ""
  echo "     If the bundle on disk is already the certified one, SKIP_EXPORT=1 publishes it"
  echo "     without re-dumping — the manifest gate below still refuses a genuinely stale bundle."
  exit 1
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

# Stamp the bundle with WHAT it is: commit, seed, manifest hash, service-worker version, assets.
# AFTER the sw stamp, so it records the cache version this deploy actually shipped.
#
# This is what makes "is it live yet?" a fact rather than a guess. The CDN serves the previous
# bundle for minutes after a push, so a page that loads and looks right is not evidence the change
# shipped — and a 45-minute stuck Pages build looked exactly like a slow one. verify-live.mjs and
# await-pages-build.mjs both compare production's copy of this file to the one on disk.
node scripts/write-build-info.mjs

echo "Publishing to gh-pages branch..."
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email=Kck321@comcast.net -c user.name=kck321 commit -qm "Deploy web build"
git remote add origin https://github.com/kck321/q-archive-app.git
git push -f -q origin gh-pages

cd ..

# ── WAIT FOR IT TO BE SERVED, AND NAME A STALL WHEN IT IS ONE ────────────────
# A normal Pages build is 33-75s. On 17 Aug 2026 one sat queued ~45 min and an earlier one the same
# day errored after 66 — both GitHub-side, and both cost far more than they had to because the
# response was to keep waiting. This polls the deployed build stamp and, at five minutes, stops:
# it reports the build EXTERNALLY STALLED, prints what the Pages API says, and tells you to re-push.
# SKIP_WAIT=1 returns the old fire-and-forget behaviour.
if [ "$SKIP_WAIT" = "1" ]; then
  echo "SKIP_WAIT=1 — not waiting for the Pages build."
else
  node scripts/await-pages-build.mjs --url "https://${SITE_DOMAIN:-qdrops.app}" || {
    echo ""
    echo "  The push succeeded; GitHub has not served it. Nothing in the repo needs fixing."
    exit 2
  }
fi

if [ -n "$SITE_DOMAIN" ]; then
  echo "Deployed: https://$SITE_DOMAIN/"
else
  echo "Deployed: https://kck321.github.io/q-archive-app/"
fi
