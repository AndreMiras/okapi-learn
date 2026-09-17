# Operator Guide

## Runtime boundary

Without Upstash Redis, run exactly one Node.js 24 process behind a reverse proxy that terminates HTTPS. The fallback session store is process-local, holds at most 500 active sessions, and is suitable only for local development or a single persistent process. Vercel deployments require the Upstash Redis integration so sessions are shared by all function instances.

## Configuration

All variables are server-only. Startup rejects missing, malformed, unsafe, or contradictory values.

| Variable                | Requirement                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`        | At least 32 random bytes; rotate by restarting and accepting that all sessions end.                     |
| `SESSION_TTL_SECONDS`   | Integer from 1 through 28800; absolute and non-sliding.                                                 |
| `PUBLIC_APP_ORIGIN`     | Exact public HTTPS origin, with no credentials, path, query, or fragment.                               |
| `KV_REST_API_URL`       | Upstash REST endpoint; required with `KV_REST_API_TOKEN` on Vercel.                                     |
| `KV_REST_API_TOKEN`     | Upstash REST token; required with `KV_REST_API_URL` on Vercel.                                          |
| `MYLOCKER_API_BASE_URL` | Optional; production permits only the compiled approved origin.                                         |
| `ENABLE_AUDIO_PLAYBACK` | `false` by default; set to `true` only after the independent audio gate is approved.                    |
| `ENABLE_VIDEO_PLAYBACK` | `false` by default; set to `true` only after the independent video gate is approved.                    |
| `ENABLE_GAME_PLAYBACK`  | `false` by default; requires the separate accepted-risk game checklist and exact origin approval.       |
| `ALLOWED_AUDIO_ORIGINS` | Comma-separated exact HTTPS origins; no paths, wildcards, credentials, fragments, or non-default ports. |
| `ALLOWED_VIDEO_ORIGINS` | Same policy, independently approved for video.                                                          |
| `ALLOWED_GAME_ORIGINS`  | Exact package redirect origins only; required when games are enabled and independent of media origins.  |

Media and game origins must not share the application hostname because a host-only session cookie could otherwise be sent to them. HTTP origins are accepted only for loopback synthetic tests outside production. Game package approval does not enable audio or video, and media approval does not enable games.

## Game package boundary

Game playback supports only complete video-linked packages composed of `LISTEN`,
`EXPLORE`, and `WILDCARD`. The browser calls an authenticated same-origin route;
the server resolves random aliases, follows one allowlisted redirect, and returns
at most 25 MiB with private, `no-store` headers. The browser validates at most 500
archive entries and 50 MiB of declared expanded content before creating
revocable in-memory Blob URLs. Packages, compatibility results, and completion
state are not written to Redis, disk, browser storage, caches, or upstream
progress APIs.

Supported activities use the package's original images, hotspot geometry, and
audio. Interactive element names are optional supplementary text and do not
determine package acceptance or correctness. The browser supplies stable neutral
control identifiers when text is unavailable. Operators should verify visual,
pointer, touch, and keyboard play; these identifiers do not promise that visual
choices can be independently understood with a screen reader.

The built-in limiter permits six starts per minute per session and two concurrent
fetches per process. These are defense in depth only. Horizontally scaled and
serverless production deployments require authoritative host-level rate,
concurrency, request-size, timeout, and memory controls.

Capacity-test the actual package and supported browsers before opt-in. A request
can temporarily consume at least the compressed package, expanded bytes, Blob
backing data, and decoded image/audio memory. The 25 MiB compressed and 50 MiB
expanded limits are safety ceilings, not expected operating targets. Complete a
separately maintained, dated operator accepted-risk review before enabling
production retrieval.

## Operations

- `GET /api/health` reports process liveness without reading configuration or contacting upstream.
- `GET /api/ready` confirms runtime configuration and the local session store are ready. It does not contact upstream or disclose environment details.
- Both endpoints return `Cache-Control: no-store` and only a fixed status value.
- Operational logs must use safe categories and local correlation IDs only. Never enable request-body, response-body, cookie, authorization-header, URL, query, or host capture.
- Alert on readiness failure, restart loops, and sustained capacity rejection. Do not export session records or heap snapshots from production.

## Deployment and rollback

1. Run every automated release check with media and games disabled.
2. Start the built artifact with the documented environment and require successful health/readiness checks.
3. Confirm the deployment can create, read, and delete an Upstash-backed session.
4. If a separately approved media gate is released, change only that type's flag and exact origin list.
5. Enable games only after a dated accepted-risk sign-off, then change only `ENABLE_GAME_PLAYBACK` and `ALLOWED_GAME_ORIGINS`.
6. Roll back games by setting `ENABLE_GAME_PLAYBACK=false`, clearing `ALLOWED_GAME_ORIGINS`, and restarting or redeploying. Confirm readiness and verify package requests stop. No package or progress cleanup is required because neither is persisted.
7. Roll back media independently by setting its playback flags to `false` and restarting.
8. Roll back the application artifact if needed; there are no schema migrations.
