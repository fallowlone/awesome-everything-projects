# awesome-everything — projects

51 standalone engineering projects. Each one is a failing test suite plus a
stubbed implementation: make the suite green, then push past it using the rubric in the
project's `BRIEF.md`. Every project here is machine-verified upstream — a reference
solution exists and passes CI, so the tests are known to be both biting and satisfiable.

Solutions are **not** in this repo on purpose.

Companion to the course at https://fallowlone.com — project pages there track progress and link the
lessons each project draws on.

## Grab one project

```bash
npx degit fallowlone/awesome-everything-projects/projects/lru-cache my-lru-cache
cd my-lru-cache && bun test
```

Or clone everything:

```bash
git clone https://github.com/fallowlone/awesome-everything-projects.git
```

## Get graded automatically

1. **Fork this repo** (top-right).
2. Enable Actions in the fork (GitHub asks once, on the Actions tab).
3. Work inside `projects/<slug>/`, commit, push.
4. The `grade` workflow runs the project's test suite plus static checks for its stack
   and writes a pass/fail report into the run summary.

Nothing is sent anywhere — the workflow runs in your fork, on your account's runners.

Locally, the same grader:

```bash
bun tools/grade.mjs lru-cache      # one project
bun tools/grade.mjs --all          # everything you have touched
```

## Toolchains

| Stack | Needs | Test command |
|---|---|---|
| `bun-ts` | [bun](https://bun.sh) | `bun test` |
| `python` | python 3.11+ (stdlib only) | `python3 -m unittest discover -p "test_*.py"` |
| `go` | go 1.21+ | `go test ./...` |

No project has third-party runtime dependencies — stdlib and the test runner only.

## Projects

| Project | Slug | Stack | Difficulty | Est. days |
|---|---|---|---|---|
| [B2B Order & Billing Platform Architecture](projects/architecture-patterns-platform/) | `architecture-patterns-platform` | bun-ts | advanced | 5 |
| [At-least-once job queue](projects/at-least-once-queue/) | `at-least-once-queue` | bun-ts | advanced | 6 |
| [Authorized Recon-to-Remediation Lab](projects/authorized-recon-ctf-lab/) | `authorized-recon-ctf-lab` | bun-ts | advanced | 8 |
| [Bloom filter](projects/bloom-filter/) | `bloom-filter` | bun-ts | intermediate | 4 |
| [Cache stampede lab](projects/cache-stampede-lab/) | `cache-stampede-lab` | bun-ts | intermediate | 4 |
| [Circuit breaker](projects/circuit-breaker/) | `circuit-breaker` | bun-ts | intermediate | 4 |
| [Cloud Hardening Lab](projects/cloud-hardening-lab/) | `cloud-hardening-lab` | bun-ts | advanced | 9 |
| [Collaborative cursors](projects/collab-cursors/) | `collab-cursors` | bun-ts | intermediate | 6 |
| [Command palette](projects/command-palette/) | `command-palette` | bun-ts | intermediate | 3 |
| [Consistent hashing ring](projects/consistent-hashing/) | `consistent-hashing` | bun-ts | advanced | 5 |
| [Feature-flag service](projects/feature-flags-service/) | `feature-flags-service` | bun-ts | intermediate | 5 |
| [A concurrent Go ingest service](projects/go-concurrent-service/) | `go-concurrent-service` | go | advanced | 8 |
| [Grounded RAG Service](projects/grounded-rag-service/) | `grounded-rag-service` | bun-ts | advanced | 9 |
| [Homelab Secure Stack](projects/homelab-secure-stack/) | `homelab-secure-stack` | bun-ts | advanced | 5 |
| [Hot-Path Profiler Lab](projects/hotpath-profiler-lab/) | `hotpath-profiler-lab` | bun-ts | advanced | 8 |
| [Huffman coding](projects/huffman-coding/) | `huffman-coding` | bun-ts | advanced | 6 |
| [Idempotent ETL Pipeline](projects/idempotent-etl-pipeline/) | `idempotent-etl-pipeline` | bun-ts | advanced | 9 |
| [Job scheduler](projects/job-scheduler/) | `job-scheduler` | bun-ts | advanced | 6 |
| [JSON parser from scratch](projects/json-parser/) | `json-parser` | bun-ts | advanced | 6 |
| [LRU cache](projects/lru-cache/) | `lru-cache` | bun-ts | intermediate | 4 |
| [A Service systemd Trusts](projects/managed-service-unit/) | `managed-service-unit` | bun-ts | intermediate | 7 |
| [Mini CRUD API](projects/mini-crud-api/) | `mini-crud-api` | bun-ts | starter | 4 |
| [Production-Shaped Nest Service](projects/nest-modular-service/) | `nest-modular-service` | bun-ts | advanced | 9 |
| [A Next.js app to production](projects/nextjs-app-to-production/) | `nextjs-app-to-production` | bun-ts | advanced | 9 |
| [Numeric Toolkit](projects/numeric-toolkit/) | `numeric-toolkit` | bun-ts | advanced | 8 |
| [Mini OAuth 2.0 + PKCE login](projects/oauth-mini/) | `oauth-mini` | bun-ts | starter | 3 |
| [Offline PWA sync](projects/offline-pwa-sync/) | `offline-pwa-sync` | bun-ts | advanced | 6 |
| [Pathfinding Route Engine](projects/pathfinding-route-engine/) | `pathfinding-route-engine` | bun-ts | intermediate | 8 |
| [Personal portfolio page](projects/personal-portfolio-page/) | `personal-portfolio-page` | bun-ts | starter | 3 |
| [Presigned upload flow](projects/presigned-upload/) | `presigned-upload` | bun-ts | intermediate | 4 |
| [Async Python service, built and operated](projects/python-async-service/) | `python-async-service` | python | advanced | 8 |
| [Query plan visualizer](projects/query-plan-visualizer/) | `query-plan-visualizer` | bun-ts | intermediate | 5 |
| [Distributed rate limiter](projects/rate-limiter/) | `rate-limiter` | bun-ts | intermediate | 4 |
| [React feature at scale](projects/react-feature-at-scale/) | `react-feature-at-scale` | bun-ts | advanced | 8 |
| [Regex engine](projects/regex-engine/) | `regex-engine` | bun-ts | advanced | 7 |
| [Reporting Schema Optimizer](projects/reporting-schema-optimizer/) | `reporting-schema-optimizer` | bun-ts | advanced | 8 |
| [Signals mini](projects/signals-mini/) | `signals-mini` | bun-ts | intermediate | 3 |
| [Skip list](projects/skip-list/) | `skip-list` | bun-ts | advanced | 6 |
| [System Design Dossier](projects/system-design-dossier/) | `system-design-dossier` | bun-ts | advanced | 8 |
| [Text diff — Myers algorithm](projects/text-diff-myers/) | `text-diff-myers` | bun-ts | advanced | 6 |
| [Threat-Model and Harden a Small App](projects/threat-model-and-harden/) | `threat-model-and-harden` | bun-ts | advanced | 8 |
| [Three-Tier App on AWS, by IaC](projects/three-tier-on-aws/) | `three-tier-on-aws` | bun-ts | advanced | 9 |
| [Tiny Stack VM](projects/tiny-stack-vm/) | `tiny-stack-vm` | bun-ts | advanced | 9 |
| [Topological build scheduler](projects/topological-scheduler/) | `topological-scheduler` | bun-ts | intermediate | 4 |
| [Trie autocomplete engine](projects/trie-autocomplete/) | `trie-autocomplete` | bun-ts | intermediate | 4 |
| [Truth-Table Prover](projects/truth-table-prover/) | `truth-table-prover` | bun-ts | advanced | 8 |
| [Type-Safe API SDK](projects/type-safe-sdk/) | `type-safe-sdk` | bun-ts | advanced | 8 |
| [Union-Find (Disjoint Set Union)](projects/union-find/) | `union-find` | bun-ts | intermediate | 4 |
| [URL shortener at scale](projects/url-shortener-at-scale/) | `url-shortener-at-scale` | bun-ts | advanced | 10 |
| [Virtual data grid](projects/virtual-data-grid/) | `virtual-data-grid` | bun-ts | advanced | 5 |
| [Crash-safe key-value store with a WAL](projects/write-ahead-log/) | `write-ahead-log` | bun-ts | advanced | 7 |

## Licence

Code — see [LICENSE](LICENSE). Briefs and rubrics — see [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
