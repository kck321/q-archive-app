// Deterministic serialisation for everything the Firestore dump writes.
//
// WHY
// ───
// Two consecutive exports of an unchanged database produced different bytes for posts.json,
// topics.json and analysisConfirmed.json. Nothing had changed: the document array came back in
// the same order and every value was identical. The Firestore SDK simply does not guarantee the
// KEY order of the object `d.data()` returns, so the same drop serialised as
//
//     id,actionRequests,analysisScanned,media,link,threadId,…
//     id,qpubRequestsScanned,media,userId,references,requestsScanned,…
//
// on two runs an hour apart.
//
// The certification manifest never saw it — it compares a key-sorted semantic hash, which is
// exactly the right thing for deciding whether the DATA changed. But it means "run the pipeline
// twice and diff the bundle" was not available as a check, and that is the check that proves a
// pipeline is reproducible rather than merely passing its own gates.
//
// So key order is normalised at the point it enters the repo. This changes bytes once and then
// never again; it changes no value, no array order, and no count.
//
// Arrays keep their order — an array's order is data. Only object keys are sorted, recursively.

const sortValue = v => {
  if (Array.isArray(v)) return v.map(sortValue)
  // `null` is typeof 'object'; Date and other class instances must not be rebuilt as plain
  // objects. Only true plain objects are reordered.
  if (v === null || typeof v !== 'object') return v
  if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) return v
  const out = {}
  for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k])
  return out
}

/** JSON.stringify with object keys sorted recursively. Same value, one spelling. */
export function stableStringify(value, space) {
  return JSON.stringify(sortValue(value), null, space)
}

export { sortValue as withSortedKeys }
