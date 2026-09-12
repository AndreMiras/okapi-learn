# Merriloop

Merriloop is an independent, unofficial web client for authorized MyLocker users. It is not affiliated with, endorsed by, or operated by Kids&Us. The project uses an original interface and does not include official branding, characters, artwork, application assets, or licensed course media.

## Privacy and security

- Credentials are sent once from the browser to this server and exchanged with the fixed MyLocker API. Passwords are never retained or replayed.
- The upstream token and minimized learner/catalog graph remain in process memory. The browser receives only an opaque authenticated `HttpOnly` session cookie.
- Sessions have a non-sliding lifetime of at most eight hours. Restarting the single server process signs everyone out.
- Stored learner data is limited to a display name and the relationships needed to select an owned catalog. Surnames, birth dates, photos, progress, games, and unknown response fields are discarded.
- Personalized pages are private and `no-store`. There is no analytics, advertising, session replay, or production payload tracing.
- Sign out, then sign in again to refresh the catalog. Merriloop does not silently refresh with a retained password.

## Media

Catalog metadata is available without playback. Production audio and video are independently disabled by default and must remain disabled until the corresponding entitlement, licensing, browser, codec, range, redirect, URL-lifetime, and exact-origin review is approved.

When an approved direct-media gate is enabled, the selected URL is disclosed to the authorized browser and used only by a native `<audio>` or `<video>` element. Merriloop does not proxy, download, transform, cache, or persist playback progress. Synthetic loopback media exists only for automated browser verification.

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

## Deployment

The MVP supports one self-hosted Node process behind an HTTPS reverse proxy. It is intentionally not horizontally scalable. The in-memory store accepts at most 500 active sessions; expiry sweeps reclaim capacity. See `docs/operator-guide.md` for configuration, health checks, capacity, and rollback.

## Known limits

Merriloop does not implement games, downloads, offline or background playback, casting, learner photos, push notifications, books, progress reporting, terms acceptance, or activation claims. Pending terms and tester modes fail closed and must be handled through an official channel.

English is the only enabled interface locale. Spanish and Catalan require complete human review before release.

## License

Application source is available under the MIT License. Package-pinned fonts retain their SIL Open Font License terms. Upstream names and services belong to their respective owners; this license does not grant rights to course content.
