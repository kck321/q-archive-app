import json, io, os
d = r"C:\Users\heath\AppData\Local\Temp\claude\C--Users-heath\ecf8983a-6aaa-432f-ad4e-54d4208d5f82\scratchpad\agent-out"
batch = os.path.join(d, "agent09.batch.json")
out = os.path.join(d, "agent09.jsonl")
es = json.load(io.open(batch, encoding="utf-8"))
with io.open(out, "a", encoding="utf-8") as f:
    for e in es:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")
print("appended", len(es), [e["n"] for e in es])
