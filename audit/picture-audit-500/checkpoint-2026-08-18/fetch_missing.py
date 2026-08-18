# Fetch the batch850 rows whose image is not in media-bundle, into fetched/.
# Same URL rewrite as scripts/build-media-bundle.mjs (file_store -> qalerts.app/media).
# Prefers the full-size file over the /thumb/ variant; verifies each download decodes.
# Updates batch850.json file fields to "FETCHED:<basename>" on success.
import json, os, time, urllib.request
from PIL import Image

SCRATCH = os.path.dirname(os.path.abspath(__file__))
FETCHED = os.path.join(SCRATCH, 'fetched')
os.makedirs(FETCHED, exist_ok=True)

def candidates(url):
    marker = '/file_store/'
    if marker in url:
        rest = url.split(marker, 1)[1]
        out = []
        if rest.startswith('thumb/'):
            out.append('https://qalerts.app/media/' + rest[len('thumb/'):])  # full size first
        out.append('https://qalerts.app/media/' + rest)
        return out
    return [url]

batch = json.load(open(os.path.join(SCRATCH, 'batch850.json'), encoding='utf-8'))
ok, fail = 0, []
for r in batch:
    if r['file'] != 'FETCH':
        continue
    base = r['url'].rstrip('/').split('/')[-1]
    dest = os.path.join(FETCHED, base)
    got = False
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        got = True
    else:
        for cu in candidates(r['url']):
            try:
                req = urllib.request.Request(cu, headers={'User-Agent': 'Mozilla/5.0'})
                data = urllib.request.urlopen(req, timeout=30).read()
                if len(data) < 200:
                    continue
                open(dest, 'wb').write(data)
                got = True
                break
            except Exception:
                continue
            finally:
                time.sleep(0.2)
    if got:
        try:
            Image.open(dest).verify()
        except Exception:
            os.remove(dest)
            got = False
    if got:
        r['file'] = 'FETCHED:' + base
        ok += 1
    else:
        fail.append(r['n'])

json.dump(batch, open(os.path.join(SCRATCH, 'batch850.json'), 'w', encoding='utf-8'), indent=1)
print(f'fetched ok: {ok}  failed: {fail}')
