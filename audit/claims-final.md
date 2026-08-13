# Q Drops — Claims, final reconciled totals

One materialised set. The invariants are a **gate in `scripts/reconcile-claims.mjs`**, not a claim in a report: the script exits non-zero unless every claim resolves verbatim to its post, conclusions are a subset of claims, and no claim is counted twice for one post.


Claims, Predictions and Conclusions are a connected family. A unit is a claim, and `isPrediction` / `isConclusion` ride on it as attributes, so Claim, Claim+Prediction and Claim+Conclusion are all representable rather than being forced into exclusive bins.


## Final totals

| Measure | Value |
|---|---|
| **Claims** | **4,181** |
| — distinct (canonical `key()`) | 3,226 |
| — posts containing a claim | 1,951 |
| — in-post repeats included | 13 |
| **Predictions** | **630** |
| — posts | 520 |

### Claim attributes

| Attribute | Count |
|---|---|
| checkable | 1,926 |
| sourceProvided | 438 |
| isConclusion | 966 |
| telegraphic | 331 |

### Held out of the Q-authored count

| Category | Count |
|---|---|
| Editorial paraphrases | 1,277 |
| NEEDS_CONTEXT | 2,912 |
| Source material | 927 |

### Where the claims came from

| Source | Count |
|---|---|
| v2 | 3,747 |
| uncovered720 | 240 |
| phase3-source | 119 |
| phase3-prediction | 75 |
