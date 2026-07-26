## Planning & docs

Product planning, specs and design docs are **not in this repo**. They live in the
private `mindmap` repo under `velo/`: https://github.com/cobalt-nitrate/mindmap

- `velo/README.md` — current state, how to run it, known stale-doc traps
- `velo/notes/` — dated brain dumps; newest thinking lives here
- `velo/docs/v1`, `velo/docs/v2` — design docs and backlogs
- `velo/PLATFORM_PLAN.md` — full product thesis

This repo holds code only. When planning changes, update `mindmap`, not this repo.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
