# Generate per-agent manifests for the next group of missing sequence numbers.
# Usage: python make_manifests.py <first_agent_idx> <n1> <n2> ... (up to 25 seq numbers)
# Splits into chunks of 5, writes manifests/agentNN.json with resolved local paths.
import json, os, sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
MB = r'C:\Users\heath\q-app\media-bundle'

rows = {r['n']: r for r in json.load(open(os.path.join(SCRATCH, 'batch500.json'), encoding='utf-8'))}
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
        p = resolve_path(r)
        assert os.path.exists(p), f'missing file for n={n}: {p}'
        manifest.append({
            'n': n, 'hash': r['hash'], 'filename': r['filename'],
            'firstPost': r['firstPost'], 'source': r['source'],
            'posts': r['posts'], 'path': p,
        })
    out = os.path.join(SCRATCH, 'manifests', f'agent{agent:02d}.json')
    json.dump(manifest, open(out, 'w', encoding='utf-8'), indent=1)
    print(f'agent{agent:02d}: {len(manifest)} rows -> {out}  seqs={chunk}')
