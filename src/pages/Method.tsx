import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { SECTIONS, DIRECTIVE_FAMILIES, CLAIM_ATTRIBUTES, ASSERTIONS, EVIDENCE, ENTITIES, CODES_INFO, METHOD_INTRO, METHOD_PRINCIPLE, CERTIFIED } from '../lib/sectionInfo'

// The full classification method. Every word of section language comes from lib/sectionInfo,
// which the per-section ⓘ popovers also read — so the short and long forms cannot disagree.

export default function Method() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <BackButton />

      <h1 className="text-2xl font-bold text-gray-100 mt-2">How Q Drops classifies the posts</h1>
      {METHOD_INTRO.map(p => (
        <p key={p} className="mt-3 text-sm text-gray-400 leading-relaxed">{p}</p>
      ))}

      <div className="mt-4 rounded-lg border border-q-border bg-q-panel p-4">
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-gray-200">Why something can appear twice.</span>{' '}
          An information request like <span className="font-mono text-gray-200">Define&nbsp;X.</span> is
          grammatically an instruction, but what it asks for is an answer — so it is both a directive
          and a question. There are <span className="text-emerald-400 font-semibold">{CERTIFIED.overlap}</span>{' '}
          such units. Each counts <em>once</em> in Questions and <em>once</em> in Directives, and never
          twice inside the same section.
        </p>
      </div>

      {/* ── sections ─────────────────────────────────────────────────────── */}
      <h2 className="text-lg font-semibold text-gray-200 mt-8">The sections</h2>
      <div className="mt-3 space-y-4">
        {SECTIONS.map(s => (
          <section key={s.id} className="rounded-lg border border-q-border bg-q-panel p-4">
            <h3 className="text-base font-semibold text-gray-100">{s.title}</h3>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">{s.covers}</p>

            {s.examples && (
              <div className="mt-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Examples</div>
                <ul className="space-y-0.5">
                  {s.examples.map(ex => (
                    <li key={ex} className="text-sm text-gray-300 font-mono">{ex}</li>
                  ))}
                </ul>
              </div>
            )}

            {s.answers && (
              <p className="mt-2 text-sm text-gray-300">
                <span className="text-gray-500">This section answers: </span>“{s.answers}”
              </p>
            )}

            {s.note && <p className="mt-2 text-xs text-gray-500 leading-relaxed">{s.note}</p>}

            {s.certified && (
              <p className="mt-3 pt-2 border-t border-q-border text-xs text-gray-400">
                <span className="text-emerald-500 font-medium">Certified dataset:</span> {s.certified}
              </p>
            )}

            {s.id === 'namedEntities' && (
              <div className="mt-3 pt-3 border-t border-q-border space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">When we do not know</div>
                <div>
                  <div className="text-sm font-medium text-gray-200">{ENTITIES.otherNamedEntity.label}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{ENTITIES.otherNamedEntity.blurb}</p>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">
                    {ENTITIES.unresolvedAlias.label}{' '}
                    <span className="text-gray-500 font-normal">
                      · {ENTITIES.unresolvedTokens.toLocaleString()} references, {ENTITIES.unresolvedOccurrences.toLocaleString()} occurrences
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{ENTITIES.unresolvedAlias.blurb}</p>
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Which mentions the figure counts.</span>{' '}
                  {ENTITIES.mentionScope}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded border border-q-border/60 px-2 py-1.5">
                      <div className="text-gray-500 text-[11px] uppercase tracking-wide">Core registry</div>
                      <div className="text-gray-200">
                        {ENTITIES.coreEntities} entities · {ENTITIES.coreRegistryMentions.toLocaleString()} mentions
                      </div>
                    </div>
                    <div className="rounded border border-q-border/60 px-2 py-1.5">
                      <div className="text-gray-500 text-[11px] uppercase tracking-wide">Adjudicated tail</div>
                      <div className="text-gray-200">
                        {ENTITIES.tailEntities.toLocaleString()} entities · {ENTITIES.tailMentions.toLocaleString()} mentions
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{ENTITIES.occurrenceSpecific}</p>
                <p className="text-xs text-gray-500">
                  {ENTITIES.contextResolved.toLocaleString()} ambiguous references were resolved by reading the
                  surrounding lines; {ENTITIES.routedToThemes} concept terms were routed to Themes rather than
                  counted as entities.
                </p>
              </div>
            )}

            {s.id === 'brackets' && (
              <div className="mt-3 pt-3 border-t border-q-border space-y-2">
                <p className="text-sm text-gray-300 leading-relaxed">
                  <span className="font-semibold text-gray-200">Detected as code is not the same as decoded.</span>{' '}
                  {CODES_INFO.interpreted} of {CODES_INFO.distinct.toLocaleString()} codes carry an
                  interpretation, each stating the evidence for it. The other{' '}
                  {CODES_INFO.unresolved.toLocaleString()} are preserved exactly as written with no
                  meaning attached.
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">{CODES_INFO.overlap}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{CODES_INFO.excluded}</p>
              </div>
            )}

            {s.id === 'links' && (
              <div className="mt-3 pt-3 border-t border-q-border">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Reference subtypes</div>
                <dl className="space-y-2">
                  {EVIDENCE.subtypes.map(t => (
                    <div key={t.key}>
                      <dt className="text-sm font-medium text-gray-200">
                        {t.label}{' '}
                        <span className="text-gray-500 font-normal">
                          · {t.occurrences.toLocaleString()} occurrences · {t.distinct.toLocaleString()} {t.distinctLabel}
                        </span>
                      </dt>
                      <dd className="text-xs text-gray-400 leading-relaxed">{t.blurb}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">{EVIDENCE.counting}</p>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Links inside pasted text.</span>{' '}
                  {EVIDENCE.embeddedInSource.blurb}
                </p>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">{EVIDENCE.unresolvedReferences.label}.</span>{' '}
                  {EVIDENCE.unresolvedReferences.blurb}
                </p>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Archived media.</span>{' '}
                  {EVIDENCE.archivedMedia.blurb}{' '}
                  <span className="text-gray-500">
                    ({EVIDENCE.archivedMedia.count.toLocaleString()} of{' '}
                    {EVIDENCE.archivedMedia.total.toLocaleString()} media items.)
                  </span>
                </p>
              </div>
            )}

            {s.id === 'claims' && (
              <div className="mt-3 pt-3 border-t border-q-border">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Claim labels — and what they do not mean</div>
                <dl className="space-y-2">
                  {CLAIM_ATTRIBUTES.map(a => (
                    <div key={a.key}>
                      <dt className="text-sm font-medium text-gray-200">
                        {a.label} <span className="text-gray-500 font-normal">· {a.count.toLocaleString()}</span>
                      </dt>
                      <dd className="text-xs text-gray-400 leading-relaxed">{a.blurb}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                  Claims and Predictions are both assertions, shown as separate sections.
                  Together they cover{' '}
                  <span className="text-gray-300">{ASSERTIONS.combined.toLocaleString()}</span>{' '}
                  assertions ({CERTIFIED.claims.occurrences.toLocaleString()} claims +{' '}
                  {CERTIFIED.predictions.occurrences.toLocaleString()} predictions). The Claims
                  section shows {CERTIFIED.claims.occurrences.toLocaleString()}.
                </p>
              </div>
            )}

            {s.id === 'requests' && (
              <div className="mt-3 pt-3 border-t border-q-border">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Directive families</div>
                <dl className="space-y-2">
                  {DIRECTIVE_FAMILIES.map(f => (
                    <div key={f.key}>
                      <dt className="text-sm font-medium text-gray-200">{f.label}</dt>
                      <dd className="text-xs text-gray-400 leading-relaxed">
                        {f.blurb}
                        <span className="block mt-0.5 font-mono text-gray-500">{f.examples.join(' · ')}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* ── principle ────────────────────────────────────────────────────── */}
      <h2 className="text-lg font-semibold text-gray-200 mt-8">{METHOD_PRINCIPLE.title}</h2>
      <div className="mt-3 rounded-lg border border-q-border bg-q-panel p-4 space-y-3">
        {METHOD_PRINCIPLE.body.map(p => (
          <p key={p} className="text-sm text-gray-300 leading-relaxed">{p}</p>
        ))}

        <div>
          <div className="text-xs text-gray-500">{METHOD_PRINCIPLE.primaryNote}</div>
          <div className="text-sm text-gray-200 font-medium mt-0.5">{METHOD_PRINCIPLE.primary}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{METHOD_PRINCIPLE.secondaryNote}</div>
          <div className="text-sm text-gray-200 font-medium mt-0.5">{METHOD_PRINCIPLE.secondary}</div>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">{METHOD_PRINCIPLE.overlap}</p>
        <p className="text-sm text-gray-400 leading-relaxed">{METHOD_PRINCIPLE.editorial}</p>
      </div>

      <p className="mt-6 text-xs text-gray-600">
        Classification is applied to {CERTIFIED.totalPosts.toLocaleString()} posts. Where a section
        shows a certified dataset, those figures have been audited against the source text and each
        entry resolves to Q’s exact wording.
      </p>

      {/* The museum sign — added by owner ruling 2026-08-28 as part of the legality review.
          Two things in one breath: displaying is not endorsing, and rights-holders have an
          easy path to ask before anything escalates. */}
      <p className="mt-3 text-xs text-gray-600">
        Q Drops is an archival research resource. It presents historical posts, and the material
        they referenced, as a record — displaying that material is not an endorsement of any claim
        it contains. If you own material shown here and would like it reviewed or removed, contact
        us through{' '}
        <Link to="/feedback" className="text-gray-500 underline hover:text-gray-300">
          Comments &amp; Ideas
        </Link>{' '}
        and it will be addressed.
      </p>
    </div>
  )
}
