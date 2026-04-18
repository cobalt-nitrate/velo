# `@velo/web`

Next.js **Command Center** (React UI, Route Handlers, and Prisma). Agent logic lives in **`@velo/agents`**; shared policy/config in **`@velo/core`**; Sheets/Drive/email tools in **`@velo/tools`**.

There is **no separate backend service** — APIs are Next.js routes under `app/api/`.

Full setup (Node, pnpm, PostgreSQL, Docker, env files, migrations) is documented under **“Running Velo (development and Docker)”** in the **[repository root README](../../README.md)**.
