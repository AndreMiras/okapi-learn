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
