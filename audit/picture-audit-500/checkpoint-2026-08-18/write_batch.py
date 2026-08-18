# Appends picture-analysis entries to pic-entries.jsonl.
# Usage: python write_batch.py <batch.json>  (a JSON array of entry dicts)
import json, sys, os
SCRATCH = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SCRATCH, 'pic-entries.jsonl')
with open(sys.argv[1], encoding='utf-8') as f:
    entries = json.load(f)
have = set()
if os.path.exists(OUT):
    with open(OUT, encoding='utf-8') as f:
        for line in f:
            if line.strip():
                have.add(json.loads(line)['n'])
new = [e for e in entries if e['n'] not in have]
with open(OUT, 'a', encoding='utf-8') as f:
    for e in new:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')
print(f'appended {len(new)} entries (skipped {len(entries)-len(new)} already present); total {len(have)+len(new)}')
