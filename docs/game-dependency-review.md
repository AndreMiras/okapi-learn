# Game Package Dependency Review

## Decision

Okapi Learn pins `@zip.js/zip.js` 2.14.1 for browser-memory ZIP inspection and
extraction. The package is licensed under BSD-3-Clause and has no runtime
dependencies. The repository license policy accepts BSD-3-Clause.

## Security Properties

- `ZipReader.getEntries()` reads central-directory metadata before entry
  extraction. Entries expose compressed and expanded sizes, compression method,
  encryption, ZIP64, disk number, symbolic-link, executable, and raw-name data.
- Reader `strictness: "strict"` rejects prepended/appended ambiguity, duplicate
  names, inconsistent directory records, and local-header mismatches.
- `FileEntry.getData()` supports CRC-32 checking, overlapping-entry detection,
  and an `AbortSignal`. Okapi Learn enables all three controls.
- ZIP64, split/multidisk, encrypted, executable, symbolic-link, and unsupported
  compression entries are rejected from metadata before `getData()`.
- `useWebWorkers: false` is supplied to the reader and every extraction. No Blob
  worker or `worker-src` CSP permission is required.
- Extraction writes only to bounded `Uint8Array` instances. No package path is
  passed to a filesystem API.

## Browser And Bundle Notes

The package supports current browser, Node.js, and Web Streams environments.
The published package is approximately 8.2 MB unpacked; the application imports
only reader/writer APIs, and the production build must be reviewed for the
resulting client chunk before release. Workers remain disabled because the
observed package is below the application limits and a Blob worker would broaden
CSP.

## Verification

`npm run check:dependencies` reports one direct ZIP dependency with no runtime
children. `npm run check:licenses` accepts its BSD-3-Clause metadata. Generated
fictional archives test metadata-before-extraction rejection, CRC failure,
strict archive ambiguity, cancellation, and every application-level size/path
limit.

## Runtime Test Dependencies

Phase 4 pins `@testing-library/react` 16.3.3 and `happy-dom` 20.14.5 as
development-only dependencies. Both are MIT-licensed, support the project's
Node 24 runtime, and are excluded from production bundles. They provide DOM,
focus, native-control, timer, and unmount coverage for the client activity
runtime; the repository license and dependency checks include their transitive
trees.
