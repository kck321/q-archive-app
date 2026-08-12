# Q Archive

An open archive for Q research — every drop, searchable and cross-referenced.

**Live site:** https://qdrops.app

Built for researching the *language* of the posts: each drop is broken down into what it
asked, claimed, predicted and named, with the analysis searchable across all 4,966 posts.

## Download the desktop app

Grab an installer from the [**Releases**](../../releases/latest) page — Windows (`.msi`),
macOS (`.dmg`, universal), or Linux (`.AppImage` / `.deb`). The whole archive works offline
once installed; nothing is sent anywhere.

The installers are not code-signed, so the OS warns on first launch. On Windows choose
**More info → Run anyway**; on macOS right-click the app and choose **Open**. Unsigned means
unsigned, not unsafe — every build is produced by GitHub Actions from the source in this
repo, and you can read the build log for any release.

## The two builds

One codebase, two products, switched by `VITE_PUBLIC_SITE` at compile time:

| | Public build | Editing build |
|---|---|---|
| Command | `npm run dev:public` | `npm run dev` |
| `CAN_EDIT` | `false` | `true` |
| Edit controls, admin PIN | stripped at compile time | present |
| Firestore reads | none | overlays synced |

The published site and the downloadable app are both the **public** build. `CAN_EDIT` is a
build-time constant, so Rollup removes the edit controls entirely rather than hiding them —
they are not in the shipped JavaScript at all. The release workflow greps each bundle and
fails the build if an admin string survives.

## Data

The archive ships as JSON in `public/data/`, seeded into IndexedDB on first load, so
browsing and searching need no network and no database. `scripts/audit-vs-qalerts.mjs`
compares every post against the source archive field by field and currently reports text,
attachments, tripcodes and timestamps matching on 4,966 of 4,966.

## Development

```bash
npm install
npm run dev            # editing build,  http://localhost:5173
npm run dev:public     # what the public sees
npm run build          # web build
npm run app:dev        # desktop app (Tauri)
```

Releases are cut by tagging: `git tag v0.7.0 && git push origin v0.7.0` runs
`.github/workflows/release-desktop.yml`, which builds all three platforms and opens a draft
release.

## License

The code is open. The Q posts themselves are public record.
