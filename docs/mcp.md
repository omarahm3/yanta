# Yanta MCP Server

Yanta can expose your vault to external AI agents (Claude Code, Codex, opencode,
…) over the [Model Context Protocol](https://modelcontextprotocol.io). When
enabled, the running Yanta app hosts a local MCP server that lets an agent
search, read, and edit your notes, journal, and tags.

The server is **hosted by the running app** and reuses the exact same services
the UI uses. That means external edits stay fully consistent with what you see:
the search index, project sidebar, and git-sync all update live, and there is
never a second process writing to the vault behind the app's back.

## Enabling

The server is **off by default**. Enable it either in `~/.yanta/config.toml`:

```toml
[mcp]
enabled = true
port = 47600   # optional; defaults to 47600
```

…or for a quick session, with an environment variable:

```bash
YANTA_ENABLE_MCP=1 yanta
```

On startup Yanta binds `127.0.0.1:<port>` and writes two files into the app root
(`$YANTA_HOME` or `~/.yanta`), both with `0600` permissions:

- `mcp-token` — a persistent bearer token (stable across restarts).
- `mcp.json` — `{ "url", "token", "pid" }`, the discovery file clients read.

## Connecting an agent

### 1. Build the bridge binary

Most agents launch MCP servers as a stdio subprocess. `yanta-mcp` is a tiny
bridge that reads `mcp.json` and relays stdio ↔ the app's loopback HTTP endpoint:

```bash
go build -o ~/.local/bin/yanta-mcp ./cmd/yanta-mcp   # ensure it's on your PATH
```

If Yanta is not running (or its MCP server is disabled), `yanta-mcp` exits with
a clear message.

### 2. Register it

**Claude Code** (stdio via the bridge):

```bash
claude mcp add yanta -- yanta-mcp
```

**Codex** — in `~/.codex/config.toml`:

```toml
[mcp_servers.yanta]
command = "yanta-mcp"
```

**opencode** — in `opencode.json`:

```json
{ "mcp": { "yanta": { "type": "local", "command": ["yanta-mcp"] } } }
```

**Direct HTTP** (clients that speak the Streamable-HTTP transport can skip the
bridge). Copy the `url` and `token` from `~/.yanta/mcp.json`:

```bash
claude mcp add --transport http yanta http://127.0.0.1:47600/ \
  --header "Authorization: Bearer <token>"
```

## Tools

| Tool | Kind | Description |
|------|------|-------------|
| `search_notes` | read | Full-text search across documents and journal notes. Supports `project:`, `tag:`, `in:title`, `in:body` filters. |
| `list_projects` | read | List projects (optionally including archived). |
| `list_documents` | read | List a project's documents (metadata only). |
| `get_document` | read | Read a document's body as Markdown. |
| `read_journal` | read | Read a project's journal for a day (defaults to today). |
| `list_journal_dates` | read | Dates that have journal entries. |
| `list_tags` | read | All tags in the vault. |
| `create_document` | write | Create a document from a Markdown body in an existing project. |
| `update_document` | write | Patch a document's title / body / tags (only provided fields change). |
| `move_document` | write | Move a document to another project. |
| `delete_document` | write | Soft-delete (recoverable) or, with `hard=true`, permanently delete. |
| `append_journal` | write | Append a plain-text journal entry (today or backdated). |
| `add_tags_to_document` / `remove_tags_from_document` | write | Manage a document's tags. |

Document bodies cross the boundary as **Markdown** and are converted to/from
Yanta's internal BlockNote block format. Journal entries are plain text.

Settings and git operations are intentionally **not** exposed in this version.

## Security

- Binds **loopback only** (`127.0.0.1`); never a public interface.
- Every request must present the bearer token (`Authorization: Bearer …`).
- An **Origin/Host check** rejects requests carrying a non-loopback `Origin`
  header, defending against DNS-rebinding from a browser.
- The token and discovery files are written `0600`.
- The `yanta-mcp` bridge runs as your user with no listening port of its own.

## Consistency & concurrency

Because the MCP server calls the same in-process service instances as the UI:

- **All DB access is serialized** (the app uses a single SQLite connection with
  WAL + a busy timeout), so concurrent tool calls and UI actions cannot corrupt
  each other.
- **Writes are indexed transactionally**: `create/update/delete_document` go
  through `document.Service.Save`, which updates the FTS index, tags, and links
  in one transaction and notifies git-sync — exactly as a UI edit does.
- **The project cache and event bus stay coherent**, so new/changed notes appear
  in the running UI without a restart.
- **git-sync uses one shared in-process lock**, so MCP writes and UI writes
  never race on the git index.

Known race (pre-existing, low impact): `create_document` verifies the project
exists and then writes; a project deleted in that window could leave an orphaned
document (recoverable). This matches the UI's own behavior.

## Limitations & roadmap

- The Markdown ⇄ BlockNote codec covers the common blocks (headings,
  paragraphs, code, quotes, bullet/numbered/check lists) and inline styles
  (bold, italic, code, strike, links). Nested lists are flattened on write;
  images, files, and tables are rendered read-only on `get_document` and not
  authored from Markdown.
- Settings and git tools are not exposed yet.
- The server only runs while the Yanta app is running.
