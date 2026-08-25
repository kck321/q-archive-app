# Reproduce the picture-audit enumeration ("distinct images in post order") and emit the
# next 200 rows (n=851-1050) as batch1050.json — but ONLY after proving the reproduction
# matches first100.json (n=1-100), batch500.json (n=101-600) AND batch850.json (n=601-850)
# hash-for-hash.
import json, os, sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
ROOT = r'C:\Users\heath\q-app'
POSTS = os.path.join(ROOT, 'public', 'data', 'posts.json')
BUNDLE = os.path.join(ROOT, 'media-bundle')
MANIFEST = os.path.join(BUNDLE, 'manifest.json')

posts = json.load(open(POSTS, encoding='utf-8'))
posts_sorted = sorted(posts, key=lambda p: p['id'])

def stem(url):
    base = url.rstrip('/').split('/')[-1]
    return base.rsplit('.', 1)[0] if '.' in base else base

def ext(url):
    base = url.rstrip('/').split('/')[-1]
    return base.rsplit('.', 1)[1].lower() if '.' in base else ''

VIDEO_EXTS = {'mp4', 'webm', 'mov', 'm4v'}

order = []          # hashes in first-occurrence order
byhash = {}         # hash -> row
for p in posts_sorted:
    for source, key in (('attached', 'media'), ('referenced', 'refMedia')):
        for m in (p.get(key) or []):
            url = m.get('url') or ''
            if not url:
                continue
            h = stem(url)
            if h not in byhash:
                byhash[h] = {
                    'n': None, 'hash': h, 'file': None,
                    'video': ext(url) in VIDEO_EXTS,
                    'firstPost': p['id'], 'source': source,
                    'filename': m.get('filename') or '',
                    'url': url, 'posts': [],
                }
                order.append(h)
            byhash[h]['posts'].append({'num': int(p['id']), 'source': source})

for i, h in enumerate(order, 1):
    byhash[h]['n'] = i
    byhash[h]['posts'].sort(key=lambda x: x['num'])

# ---- verification against the existing 850 rows ----
first100 = json.load(open(os.path.join(SCRATCH, 'first100.json'), encoding='utf-8'))
batch500 = json.load(open(os.path.join(SCRATCH, 'batch500.json'), encoding='utf-8'))
batch850 = json.load(open(os.path.join(SCRATCH, 'batch850.json'), encoding='utf-8'))
existing = {r['n']: r for r in first100 + batch500 + batch850}
mismatch = 0
for n in range(1, 851):
    want = existing[n]
    got = byhash[order[n - 1]]
    if got['hash'] != want['hash']:
        mismatch += 1
        if mismatch <= 5:
            print(f'MISMATCH n={n}: got {got["hash"][:16]} want {want["hash"][:16]}')
    else:
        gp = [(x['num'], x['source']) for x in got['posts']]
        wp = [(x['num'], x['source']) for x in want['posts']]
        if gp != wp and mismatch <= 5:
            mismatch += 1
            print(f'POSTS MISMATCH n={n}: got {gp[:4]} want {wp[:4]}')
print(f'verification: {850 - mismatch}/850 rows reproduced exactly; total distinct images {len(order)}')
if mismatch:
    sys.exit('REFUSING to emit batch1050.json — enumeration does not reproduce the existing batches')

# ---- resolve local files for n=851-1050 via the media-bundle manifest ----
man = json.load(open(MANIFEST, encoding='utf-8'))
local_by_stem = {}
for url, local in man.items():
    if isinstance(local, str):
        local_by_stem[stem(url)] = local
out, missing, videos = [], [], []
for n in range(851, 1051):
    if n > len(order):
        break
    r = dict(byhash[order[n - 1]])
    local = local_by_stem.get(r['hash'])
    if local and os.path.exists(os.path.join(BUNDLE, local)):
        r['file'] = local
    else:
        r['file'] = 'FETCH'
        missing.append(n)
    if r['video']:
        videos.append(n)
    out.append(r)
json.dump(out, open(os.path.join(SCRATCH, 'batch1050.json'), 'w', encoding='utf-8'), indent=1)
print(f'batch1050.json: {len(out)} rows (n {out[0]["n"]}-{out[-1]["n"]})')
print(f'needs fetch ({len(missing)}):', missing)
print(f'videos ({len(videos)}):', videos)
