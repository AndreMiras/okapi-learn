# Media Release Checklist

Complete and approve this checklist independently for audio and video. Production playback remains off when any answer is absent or negative. Record protocol conclusions only; never retain a production URL, payload, identifier, media file, screenshot, trace, or log.

- [ ] The owned account is entitled to the tested item and ordinary browser playback is authorized.
- [ ] Applicable content and license terms permit direct delivery to an authorized browser.
- [ ] Native playback succeeds in each supported browser family without bypassing controls.
- [ ] Container, codec, redirects, MIME behavior, initial load, ranges, seeking, URL lifetime, expiry, truncation, and failures are documented.
- [ ] Every media origin is approved as an exact HTTPS origin and included only in that media type's allowlist and CSP.
- [ ] Direct URL exposure and ordinary transient browser buffering are accepted risks.
- [ ] Requests disclose no upstream token, application cookie, learner identifier, or application referrer.
- [ ] No proxy, scripted CORS workaround, service-worker cache, download, transformation, or redistribution is introduced.
- [ ] Diagnostics are disabled for the authorized smoke test and no artifact is retained.
- [ ] The gate is immediately disabled if any criterion fails.

Audio cannot inherit video approval, and video cannot inherit audio approval.

## Development Validation: Video

On 2026-09-12, an authorized user confirmed direct playback with an owned
account in Linux Brave and Linux Firefox. Pause, seek, volume, fullscreen, and
replay worked without application or browser console errors.

The bounded protocol probe established an ISO BMFF/MP4 container with H.264
video and AAC audio. The origin returned `application/octet-stream`, served
initial and tail byte ranges with `206`, and exposed no redirect or content
disposition. Native Chromium loaded metadata successfully without a proxy or
CORS workaround. Only protocol conclusions were retained; the credential,
token, payload, media URL, media bytes, and diagnostic artifacts were not.

The exact HTTPS origin is configured only in the ignored development
environment. Production playback remains disabled. The video gate remains open
pending applicable terms review, WebKit playback, URL lifetime/expiry behavior,
and the remaining checklist items above.

## Development Validation: Audio

The owned catalog supplied no audio URLs. Audio playback and its allowlist
remain disabled, and no audio delivery claim or approval is inferred.
