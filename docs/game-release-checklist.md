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
      artwork origin; map images load through private same-origin alias routes.
- [ ] Supported `LISTEN`, `EXPLORE`, and `WILDCARD` packages complete; map games
      containing unsupported dynamics remain atomic failures.
- [ ] Host-level request-rate, concurrency, memory, and timeout controls are
      configured in addition to the process-local defense-in-depth limiter.
- [ ] Desktop Chromium, mobile Chromium, mobile WebKit, and the supported audio
      codec matrix complete the selected package without unsupported descriptors.
- [ ] Map markers, replay, and exit work with keyboard, pointer, touch, zoom,
      forced colors, and reduced motion. Neutral control names do not imply
      complete nonvisual descriptions.
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
      secret, personal/licensed-data, and diagnostic scans pass.
- [ ] Non-affiliation, transient-content, no-progress, and supported-type limits
      are accurate and visible.
- [ ] Disabling `ENABLE_GAME_PLAYBACK` stops package and artwork retrieval while
      catalog, audio, and video remain usable.
