# Release Checklist

## Automated

- [ ] Frozen install, coverage, lint, strict typecheck, formatting, and production build pass.
- [ ] Functional Chromium and mobile WebKit suites pass against `next build` plus `next start`.
- [ ] Deterministic desktop and genuine-mobile visual regression passes.
- [ ] Dependency tree, package licenses, repository secrets, personal-data patterns, and diagnostics pass inspection.
- [ ] The fixture is loopback-only and browser tests reject unapproved external requests.
- [ ] Production media and game flags are disabled and health/readiness checks pass with documented environment values.
- [ ] Any game opt-in has a separate dated operator accepted-risk sign-off.

## Manual

- [ ] Desktop/mobile, keyboard, focus, screen reader, reduced motion, zoom, loading, empty, error, and logout checks pass.
- [ ] The working name has completed trademark and domain review.
- [ ] Any authorized service smoke test leaves browser/server diagnostics clean and retains no sensitive or licensed artifact.
- [ ] Rollback is demonstrated independently for games and media; restart invalidates all sessions.
