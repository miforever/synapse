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

## Connect an agent

With the daemon running, point any MCP client at `http://localhost:8000/mcp`.

**Claude Code** — one command:

```bash
claude mcp add --transport http synapse http://localhost:8000/mcp
```

Or commit it to the project by writing `.mcp.json`:

```json
{
  "mcpServers": {
    "synapse": {
      "type": "http",
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

**Cursor** — add the same block to `~/.cursor/mcp.json`.

Then ask the agent to remember something. The node appears on the canvas as it
is written, with no refresh.

## Memory model

Each memory is a **node** — a title, a short summary for cheap index reads, a
full Markdown body, and free-form JSON metadata. Nodes are joined by typed,
weighted **edges** (`depends_on`, `relates_to`, `blocks`, `part_of`).

Nodes are organized two ways:

- **Class** — exactly one per node, describing the coarse shape of the thing.
  Ships with entities (`person`, `organization`, `place`, `object`), work
  (`project`, `plan`, `issue`, `event`), and knowledge (`idea`, `fact`,
  `decision`, `preference`, `resource`). The set lives in a table rather than a
  fixed enum, so agents register new classes as they need them — no migration.
- **Tags** — any number per node, created freely and indexed for filtering.

The split is deliberate: a class is the shape, tags are the specifics. A pet is
an `object` tagged `animal`, not a class of its own — unless you track enough of
them to want one, which costs nothing.

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

## Privacy

Everything stays on your machine — one SQLite file, no telemetry, no accounts.

Memory content is written by agents, so the canvas will not load media from it
until you say so. Images render by default; audio and video are click-to-load,
and remote sources are blocked entirely until enabled. Those switches live in
the control bar and persist in the daemon. Agents can read them (so they know
what is worth attaching) but cannot change them.

## License

[MIT](LICENSE).
