# Game Playback Release Checklist

Production game retrieval is disabled by default. Use this checklist to verify
delivery, compatibility, accessibility, and privacy before enabling playback.

Use generated fictional content for repeatable tests. Keep package bytes, URLs,
IDs, descriptors, content strings, screenshots, traces, and browser diagnostics
from live-account smoke checks out of the repository.

## Delivery And Runtime

- [x] The observed video-linked redirect protocol, statuses, content types, and
      package sizes remain within the documented limits.
- [ ] `ALLOWED_GAME_ORIGINS` contains only the exact reviewed HTTPS redirect
      origin, which does not share the application cookie hostname.
- [ ] `ALLOWED_GAME_ARTWORK_ORIGINS` contains only the exact reviewed HTTPS
      artwork origin, independent of package/media origins and the app cookie host;
      map images load through private, bounded, no-store same-origin alias routes.
- [ ] Browser DOM/network contain aliases only, never raw map/section/game IDs,
      source artwork URLs, package redirects, or response bodies. Unauthorized,
      gate-off, stale, and cross-learner requests cause no external retrieval.
- [ ] Complete `LISTEN`, `EXPLORE`, `WILDCARD`, and bounded `PAINT` packages run;
      unsupported types or `PAINT` variants fail atomically before play.
- [ ] Host-level request-rate, concurrency, memory, and timeout controls are
      configured in addition to the process-local defense-in-depth limiter.
- [ ] Desktop Chromium, mobile Chromium, mobile WebKit, and the supported audio
      codec matrix complete the selected package without unsupported descriptors.
- [ ] Map markers/status remain understandable with images blocked, keyboard,
      pointer, touch, zoom, forced colors, and reduced motion; locked markers do
      not navigate, empty sections consume no position, and only the next actual
      position unlocks. Reload and learner changes reset local additions.
- [ ] `PAINT` supports replay, wrong colour, correct colour/wrong target, overlay,
      next prompt, completion, keyboard/pointer/touch, focus, and visible error and
      advancement feedback at desktop/mobile sizes. Neutral names do not provide
      complete nonvisual semantics; the exercise remains colour-dependent.
- [ ] CSP permits only same-origin connections and in-memory Blob image/audio use;
      package responses and protected pages remain private and `no-store`.
- [ ] Repeated start, exit, logout, expiry, and background/foreground cycles stop
      audio, timers, requests, and object URLs without unbounded memory growth.

## Privacy And Release

- [ ] No package, artwork, redirect URL, raw ID, descriptor, media content,
      completion, or compatibility result is persisted or logged by the browser,
      application, cache, Redis, filesystem, backup, or diagnostics.
- [ ] No `RegisterActivity` or other upstream progress mutation occurs; reveal and
      completion copy remains explicitly local to the current browser play.
- [ ] Production diagnostics and payload tracing are disabled, and repository,
      secret, personal/content-data, and diagnostic scans pass.
- [ ] A dated operator accepted-risk opt-in records the approved game and artwork
      origins, host controls, and rollback procedure before enabling playback.
- [ ] After synthetic approval, record only dated pass/fail for the bounded
      owned-account map artwork, first naturally available package, local unlock,
      cleanup, and gate-off rollback smoke. Retain no IDs, URLs, content, traces,
      screenshots, or network bodies from that smoke.
- [ ] Non-affiliation, transient-content, no-progress, and supported-type limits
      are accurate and visible.
- [ ] Disabling `ENABLE_GAME_PLAYBACK` stops package and artwork retrieval while
      catalog, audio, and video remain usable.
