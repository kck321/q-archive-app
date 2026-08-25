# Phase 2 (n=601-850): validate agent outputs / merge into picture-analysis.json.
# Mirrors merge850.py exactly, but reads batch1050.json and agent-out-1050/*.jsonl.
# Usage:
#   python merge850.py check     - validate + report gaps, write nothing
#   python merge850.py compile   - merge validated entries into the app data file
import json, os, sys, glob

SCRATCH = os.path.dirname(os.path.abspath(__file__))
APP_JSON = r'C:\Users\heath\q-app\public\data\picture-analysis.json'
REQ = ('n', 'kind', 'description', 'text', 'people', 'orgs', 'objects', 'places', 'terms', 'flags', 'confidence')

batch = {r['n']: r for r in json.load(open(os.path.join(SCRATCH, 'batch1050.json'), encoding='utf-8'))}
entries, problems, dupes = {}, [], []
for path in sorted(glob.glob(os.path.join(SCRATCH, 'agent-out-1050', '*.jsonl'))):
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except Exception as ex:
            problems.append(f'{os.path.basename(path)}:{ln} bad JSON: {ex}')
            continue
        n = e.get('n')
        if n not in batch:
            problems.append(f'{os.path.basename(path)}:{ln} n={n} not in batch range')
            continue
        missing = [k for k in REQ if k not in e]
        if missing:
            problems.append(f'{os.path.basename(path)}:{ln} n={n} missing {missing}')
            continue
        if e['confidence'] not in ('green', 'yellow', 'red'):
            problems.append(f'{os.path.basename(path)}:{ln} n={n} bad confidence {e["confidence"]!r}')
            continue
        if n in entries:
            dupes.append(n)   # keep the FIRST occurrence; later dupes usually mean a resumed agent re-wrote
            continue
        entries[n] = e

done = set(entries)
want = set(batch)
gaps = sorted(want - done)
review = sorted(n for n, e in entries.items() if e.get('needsReview'))
conf = {}
for e in entries.values():
    conf[e['confidence']] = conf.get(e['confidence'], 0) + 1
print(f'entries {len(done)}/{len(want)}  dupes-skipped {len(dupes)}  problems {len(problems)}')
print('confidence:', conf, ' needsReview:', len(review), review[:20])
if gaps:
    print(f'gaps ({len(gaps)}):', gaps)
for p in problems[:20]:
    print('PROBLEM:', p)

if len(sys.argv) > 1 and sys.argv[1] == 'compile':
    data = json.load(open(APP_JSON, encoding='utf-8'))
    have_hashes = {img['hash'] for img in data['images']}
    added = 0
    for n in sorted(entries):
        e, r = entries[n], batch[n]
        if r['hash'] in have_hashes:
            continue
        img = {
            'hash': r['hash'], 'filename': r['filename'],
            'posts': [{'num': c['num'], 'source': c['source']} for c in r['posts']],
            'kind': e['kind'], 'description': e['description'], 'text': e['text'],
            'people': e['people'], 'orgs': e['orgs'], 'objects': e['objects'],
            'places': e['places'], 'terms': e['terms'], 'flags': e['flags'],
            'confidence': e['confidence'],
        }
        if e.get('needsReview'):
            img['needsReview'] = True
        data['images'].append(img)
        added += 1
    data['coverage'] = f'first {len(data["images"])} distinct images in post order (plus videos via frames)'
    json.dump(data, open(APP_JSON, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print(f'compiled: +{added} entries -> {len(data["images"])} total in picture-analysis.json')
