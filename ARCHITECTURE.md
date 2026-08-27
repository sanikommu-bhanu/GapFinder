# Architecture

The architecture documentation lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

This file used to hold a second, independently maintained copy. The two drifted
— this one still claimed 88 unit tests and a SQLite datasource long after the
suite passed 200 and the database moved to Postgres — which is the usual fate of
two documents describing one system. There is now one.

| Document | What it covers |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, boundaries, the verification rule |
| [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md) | Provider cascade, caching, quota handling, fallbacks |
| [`docs/RESEARCH_PIPELINE.md`](docs/RESEARCH_PIPELINE.md) | How papers are found, filtered and ranked |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Every external service, its limits and its fallback |
| [`docs/API.md`](docs/API.md) | Every route, its shape and its failure modes |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Every variable, what breaks without it |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Secret handling, auth, the client/server boundary |
| [`docs/TESTING.md`](docs/TESTING.md) | What is verified, what is measured, what is not |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Symptoms and their actual causes |
| [`docs/DEMO.md`](docs/DEMO.md) | The demo path, and what to do when something fails live |
