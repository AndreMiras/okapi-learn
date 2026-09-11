# Operator Guide

## Runtime boundary

Run exactly one Node.js 24 process behind a reverse proxy that terminates HTTPS. Do not use multiple workers, replicas, serverless instances, or a rolling overlap: sessions exist only in one process and every restart intentionally invalidates them. The bounded store holds at most 500 active sessions and rejects new sessions safely at capacity.

## Configuration

All variables are server-only. Startup rejects missing, malformed, unsafe, or contradictory values.

| Variable                | Requirement                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`        | At least 32 random bytes; rotate by restarting and accepting that all sessions end.                     |
| `SESSION_TTL_SECONDS`   | Integer from 1 through 28800; absolute and non-sliding.                                                 |
| `PUBLIC_APP_ORIGIN`     | Exact public HTTPS origin, with no credentials, path, query, or fragment.                               |
| `MYLOCKER_API_BASE_URL` | Optional; production permits only the compiled approved origin.                                         |
| `ENABLE_AUDIO_PLAYBACK` | `false` by default; set to `true` only after the independent audio gate is approved.                    |
| `ENABLE_VIDEO_PLAYBACK` | `false` by default; set to `true` only after the independent video gate is approved.                    |
| `ALLOWED_AUDIO_ORIGINS` | Comma-separated exact HTTPS origins; no paths, wildcards, credentials, fragments, or non-default ports. |
| `ALLOWED_VIDEO_ORIGINS` | Same policy, independently approved for video.                                                          |

Media origins must not share the application hostname because a host-only session cookie could otherwise be sent to them. HTTP media origins are accepted only for loopback synthetic tests outside production.

## Operations

- `GET /api/health` reports process liveness without reading configuration or contacting upstream.
- `GET /api/ready` confirms runtime configuration and the local session store are ready. It does not contact upstream or disclose environment details.
- Both endpoints return `Cache-Control: no-store` and only a fixed status value.
- Operational logs must use safe categories and local correlation IDs only. Never enable request-body, response-body, cookie, authorization-header, URL, query, or host capture.
- Alert on readiness failure, restart loops, and sustained capacity rejection. Do not export session records or heap snapshots from production.

## Deployment and rollback

1. Run every automated release check with media disabled.
2. Start the built artifact with the documented environment and require successful health/readiness checks.
3. If a separately approved media gate is released, change only that type's flag and exact origin list.
4. Roll back media first by setting both playback flags to `false` and restarting.
5. Roll back the application artifact if needed. Every restart signs all users out; there are no schema or data migrations.
