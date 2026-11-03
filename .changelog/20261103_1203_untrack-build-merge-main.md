# Untrack build/ and merge to main

**Date:** 2026-11-03 12:03

- `build/` (about 13 MB of screenshots and `optimist.glb`) is no longer in git
  and is listed in `.gitignore`. The local files are still on disk; the
  `.tools/` scripts regenerate them.
- The README now describes `build/` as git-ignored local output.
- Merged branch `accurate-model-rebuild` into `main` and pushed `main`.
