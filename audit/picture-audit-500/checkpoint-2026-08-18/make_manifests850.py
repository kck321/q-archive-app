# Generate per-agent manifests for phase 2 (batch850.json, n=601-850).
# Usage: python make_manifests850.py <first_agent_idx> <n1> <n2> ... (up to 25 seq numbers)
# Splits into chunks of 5, writes manifests/agentNN.json with resolved local paths.
# Video rows get framePaths (3 extracted frames) instead of a single image path.
import json, os, sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
MB = r'C:\Users\heath\q-app\media-bundle'

rows = {r['n']: r for r in json.load(open(os.path.join(SCRATCH, 'batch850.json'), encoding='utf-8'))}
first_agent = int(sys.argv[1])
seqs = [int(x) for x in sys.argv[2:]]

def resolve_path(r):
    f = r['file']
    if f.startswith('FETCHED:'):
        return os.path.join(SCRATCH, 'fetched', f[len('FETCHED:'):])
    return os.path.join(MB, f)

chunks = [seqs[i:i+5] for i in range(0, len(seqs), 5)]
for i, chunk in enumerate(chunks):
    agent = first_agent + i
    manifest = []
    for n in chunk:
        r = rows[n]
        entry = {
            'n': n, 'hash': r['hash'], 'filename': r['filename'],
            'firstPost': r['firstPost'], 'source': r['source'], 'posts': r['posts'],
        }
        if r.get('video'):
            frames = [os.path.join(SCRATCH, 'vframes', f'n{n}_f{k}.jpg') for k in range(3)]
            for p in frames:
                assert os.path.exists(p), f'missing frame for n={n}: {p}'
            entry['video'] = True
            entry['framePaths'] = frames
        else:
            p = resolve_path(r)
            assert os.path.exists(p), f'missing file for n={n}: {p}'
            entry['path'] = p
        manifest.append(entry)
    out = os.path.join(SCRATCH, 'manifests', f'agent{agent:02d}.json')
    json.dump(manifest, open(out, 'w', encoding='utf-8'), indent=1)
    print(f'agent{agent:02d}: {len(manifest)} rows -> {out}  seqs={chunk}')
