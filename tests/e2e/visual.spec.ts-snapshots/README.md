# Visual Baselines

These screenshots contain only fictional fixture data and repository-owned geometric artwork. They were reviewed at 1280x720 desktop Chromium and Pixel 5 mobile Chromium viewports using Playwright 1.63.0 on Linux, with package-pinned Fraunces and Atkinson Hyperlegible Next fonts and reduced motion enabled. Comparisons use a per-pixel threshold of 0.2 and fail when more than 2% of rendered pixels differ.

Regenerate baselines only in the pinned Linux browser environment with `npm run test:e2e:visual:update`. Review both desktop and mobile diffs at full size and never refresh a baseline merely to make CI green. Inspect every changed image and run the repository secret/personal-data scans before committing it. Native media controls are intentionally excluded because their rendering is platform-dependent.

After the diagnostics scanner passes, CI retains synthetic expected, actual, and diff PNGs from failed visual comparisons for seven days. Functional screenshots, traces, videos, and browser state are never retained.
