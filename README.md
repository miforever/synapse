<p align="center">
  <img src="frontend/public/branding/synapse-desktop.svg" alt="SYNAPSE" width="420">
</p>

<p align="center">
  A local-first memory graph daemon — a connection-based memory layer for AI
  agents and the humans working alongside them.
</p>

---

SYNAPSE runs as a local async Python daemon over embedded SQLite, exposes
itself to agents through the Model Context Protocol, and renders the resulting
memory graph as an interactive WebGL canvas. No cloud services, no database
server, no configuration.

## Why

Agents accumulate context but have nowhere durable to put it. SYNAPSE stores
memories as a graph of linked nodes and hands agents a deliberately
token-frugal read path — search a lightweight index, fetch only the node you
need, then traverse outward — so recall costs a fraction of the context that
dumping a transcript would.

## Stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Daemon   | Python 3.11, FastAPI, uvicorn                                    |
| Storage  | SQLite via aiosqlite — WAL journaling, FTS5 full-text search     |
| Agents   | FastMCP (Model Context Protocol)                                 |
| Realtime | WebSockets                                                       |
| Canvas   | Next.js, Tailwind CSS, react-force-graph 2D/3D, Three.js         |

## Layout

```
synapse/
├── backend/    FastAPI + aiosqlite + FastMCP daemon
├── frontend/   Next.js + react-force-graph canvas
└── docker/     Dockerfiles and compose stack
```

## Quickstart

Docker — brings up both services:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Or run them natively:

```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

- Daemon: http://localhost:8000 (health at `/health`)
- Canvas: http://localhost:3000

Under Docker the database persists in the `synapse-data` volume; natively it
lands at `backend/synapse.db`. Override with `SYNAPSE_DB_PATH`.

## Memory model

Each memory is a **node** — a title, a short summary for cheap index reads, a
full Markdown body, and free-form JSON metadata. Nodes are joined by typed,
weighted **edges** (`depends_on`, `relates_to`, `blocks`, `part_of`).

Nodes are organized two ways:

- **Class** (`person`, `project`, `idea`, `event`, `fact`, `plan`, `issue`, …) —
  exactly one per node, carrying the color the canvas draws it with. The set
  lives in a table rather than a fixed enum, so agents can register new classes
  as they need them.
- **Tags** — any number per node, created freely and indexed for filtering.

Names are normalized on write, so `Task`, `task`, and `TASK` resolve to a single
class instead of three.

## Agent tools

Exposed over MCP:

| Tool                              | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `search_index(query, limit)`      | FTS5 search returning lightweight candidates    |
| `read_node(node_id)`              | Full content and immediate connections          |
| `traverse_graph(node_id, depth)`  | Local structural map N hops out                 |
| `add_memory(...)`                 | Persist a node, its tags, and optional edges    |
| `list_types()` / `list_tags()`    | Existing vocabulary, so agents reuse over invent |

## Development

```bash
cd backend
uv run ruff check --fix . && uv run ruff format .
uv run mypy app
uv run pytest

cd frontend
npm run lint && npm run build
```

CI runs the same checks and builds both images on every push and pull request
to `main` and `develop`.

## Status

- **Storage engine and graph services** — implemented and tested.
- **MCP tools** — implemented; live WebSocket broadcast on write is pending.
- **Canvas** — shell and design system in place; the force-graph view, hover
  cards, and Markdown drawer are next.
