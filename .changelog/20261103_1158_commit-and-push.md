# Commit and push of the model rebuild

**Date:** 2026-11-03 11:58

- Added `.gitignore`. It excludes `node_modules/` (55 MB of puppeteer under
  `.tools/`) and `*.log`.
- Created branch `accurate-model-rebuild`, because the work was on `main`.
- Commit `9203cda` holds the rebuild, the reference assets moved into
  `init_assets/`, the tools, the screenshots and `optimist.glb` in `build/`,
  and the README and changelog updates.
- Pushed to `origin/accurate-model-rebuild`. A PR can be opened at
  https://github.com/ctranoris/opt3d/pull/new/accurate-model-rebuild
