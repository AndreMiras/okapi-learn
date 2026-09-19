# Okapi Learn

[![Tests](https://github.com/AndreMiras/okapi-learn/actions/workflows/tests.yml/badge.svg)](https://github.com/AndreMiras/okapi-learn/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/AndreMiras/okapi-learn/graph/badge.svg)](https://codecov.io/gh/AndreMiras/okapi-learn)

Okapi Learn, formerly developed under the name Merriloop, is an independent, unofficial web client for authorized MyLocker users. It is not affiliated with, endorsed by, or operated by Kids&Us. The project uses an original interface and does not include official branding, characters, artwork, application assets, or licensed course media.

## Okapi project family

Okapi is the shared project identity for two independently deployed clients:

| Product        | Purpose                                         | Website                                                | Source                                                              |
| -------------- | ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Okapi Learn    | Learner course and media catalog                | [learn.okapi.family](https://learn.okapi.family)       | [AndreMiras/okapi-learn](https://github.com/AndreMiras/okapi-learn) |
| Okapi Families | Parent attendance and school-information portal | [families.okapi.family](https://families.okapi.family) | Maintained separately                                               |

[okapi.family](https://okapi.family) is the main project domain and currently opens Okapi Learn. The product names describe the user-facing experiences; MyLocker and MyKids are used only where needed to explain compatibility with the corresponding Kids&Us services.

The applications share an umbrella identity, not an API or session. Okapi Learn uses the MyLocker `Alumnes` contract, while Okapi Families uses the separate MyKids and Student contracts. Their upstream tokens, authorization rules, domain models, deployments, and release lifecycles remain independent.

## Privacy and security

- Credentials are sent once from the browser to this server and exchanged with the fixed MyLocker API. Passwords are never retained or replayed.
- The upstream token and minimized learner/catalog graph remain server-side: in process memory for a single persistent process, or AES-GCM encrypted in Upstash Redis for Vercel and multi-instance deployments. The browser receives only an opaque authenticated `HttpOnly` session cookie.
- Sessions have a non-sliding lifetime of at most eight hours. Restarting clears memory-backed sessions; Redis-backed sessions remain available until sign-out or expiry. Rotating `SESSION_SECRET` makes all existing session cookies unusable.
- Stored learner data is limited to a display name and the relationships needed to select an owned catalog. Videos may retain up to three linked game IDs and validated viewed-learner references; the browser receives only random aliases and a safe viewed boolean. Surnames, birth dates, photos, game maps/sections/URLs/progress, and unknown response fields are discarded.
- Personalized pages are private and `no-store`. There is no analytics, advertising, session replay, or production payload tracing.
- Sign out, then sign in again to refresh the catalog. Okapi Learn does not silently refresh with a retained password.

## Media

Catalog metadata is available without playback. Production audio and video are independently disabled by default and must remain disabled until the corresponding entitlement, licensing, browser, codec, range, redirect, URL-lifetime, and exact-origin review is approved.

When an approved direct-media gate is enabled, the selected URL is disclosed to the authorized browser and used only by a native `<audio>` or `<video>` element. Okapi Learn does not proxy, download, transform, cache, or persist playback progress. Synthetic loopback media exists only for automated browser verification.

## Video-linked activities

Okapi Learn includes a bounded clean-room runtime for complete video-linked
packages containing only `LISTEN`, `EXPLORE`, and `WILDCARD`. Production package
retrieval is independently disabled by default. Operators can enable it for
authorized accounts by configuring the exact package redirect origin.

After explicit selection, the browser requests an alias-only same-origin route.
The server validates ownership, follows one approved package redirect, and
returns a bounded private/no-store ZIP without exposing upstream IDs or URLs. The
browser validates and extracts the package in memory, uses revocable Blob URLs,
and releases it on completion, exit, logout, expiry, failure, or unmount. No
package, compatibility result, reveal state, or completion is stored in browser
storage, Redis, caches, or the filesystem. Okapi Learn does not call
`RegisterActivity`; reveal and completion apply only to the current browser visit
or play and are not official progress.

Activities use their original pictures and audio. Package element names are
optional supplementary text; unnamed controls receive neutral picture or hotspot
identifiers. Pointer, touch, and sighted keyboard play are supported, but complete
screen-reader descriptions of the visual choices may be unavailable.

## Local development

Use Node.js 24 and npm. Create local server-only environment values based on `.env.example`; never place account credentials in environment files.

Generate a cryptographically random session secret and place the output in the
ignored local environment as `SESSION_SECRET`:

```sh
npm run generate:session-secret
```

```sh
npm ci
npm run dev
```

The full local quality interface is:

```sh
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e:functional
npm run test:e2e:visual
npm run check:dependencies
npm run check:licenses
npm run scan:secrets
npm run scan:personal-data
```

Automated tests use fictional loopback fixtures only. They must never use `.env.mylocker` or contact a production service.

If the host does not provide Playwright's Linux libraries, run browser tests in the Playwright image matching `@playwright/test`. Map the host user so generated files remain writable outside the container:

```sh
docker run --rm -it --ipc=host \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp \
  --volume "$PWD":/work \
  --workdir /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c "npm ci --ignore-scripts --no-audit && npm run build && \
    PLAYWRIGHT_SUITE=media-cross-browser npx playwright test tests/e2e/media.spec.ts \
      --project=mobile-webkit"
```

Replace the final Playwright command to run another focused browser scenario. Use `npm run test:e2e:functional` or `npm run test:e2e:visual` for the complete matrices; those scripts perform their own production build.

Maintainers can regenerate visual baselines explicitly with `npm run test:e2e:visual:update` in the pinned Linux browser environment. A refresh requires full-size review of both desktop and mobile diffs and must never be used merely to make CI green. Visual comparisons allow a per-pixel threshold of 0.2 and at most 2% differing pixels. After a successful redaction scan, failed visual CI runs retain only sanitized metadata and synthetic expected, actual, and diff PNGs for seven days.

## Deployment

Without Redis, run one persistent self-hosted Node process behind an HTTPS reverse proxy. This process-local fallback accepts at most 500 active sessions and is not horizontally scalable. Vercel and multi-instance deployments use encrypted Upstash Redis sessions; Vercel fails closed when Redis is not configured. See `docs/operator-guide.md` for configuration, health checks, capacity, and rollback.

## Known limits

Eight game dynamic types (`BOARD`, `MEMORY`, `GRID`, `CONNECT`, `DIFFERENCES`, `PAINT`, `DRAGCONTAINER`, and `FILLTHEGAP`) remain unsupported, as do game maps/sections, books, durable progress, downloads, offline or background playback, casting, learner photos, push notifications, terms acceptance, activation claims, complete nonvisual game semantics, and full official-engine parity. Pending terms and tester modes fail closed and must be handled through an official channel.

English is the only enabled interface locale. Spanish and Catalan require complete human review before release.

## License

Application source is available under the MIT License. Package-pinned fonts retain their SIL Open Font License terms. Upstream names and services belong to their respective owners; this license does not grant rights to course content.
