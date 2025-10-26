# Technical Guidelines

Technical reference for developers working on Yanta.

## Architecture Overview

### Core Principle: Files as Source of Truth

```
JSON Files (vault/)  ←  Source of Truth
         ↓
    File Watcher
         ↓
      Indexer
         ↓
  SQLite Database  ←  Disposable Query Index (FTS5)
```

**Key Points:**
- Your notes are JSON files (portable, version-controllable)
- SQLite is a disposable cache for search/filtering
- Database can be rebuilt from files anytime
- No data loss if database corrupts

### Backend Structure (Go)

```
internal/
├── app/          # Wails initialization & bindings
├── project/      # Project domain (service, store, cache)
├── document/     # Document domain (service, store, parser)
├── tag/          # Tag domain (service, store)
├── search/       # FTS5 search (service, store, parser)
├── db/           # Database connection & migrations
├── indexer/      # File watcher & indexing orchestrator
├── vault/        # File I/O operations
└── asset/        # Asset management

Pattern: domain/
  - {domain}.go   # Types, validation, constructors
  - store.go      # Database operations
  - service.go    # Business logic (if complex)
```

### Frontend Structure (React/TypeScript)

```
frontend/src/
├── pages/        # Main app pages
├── components/   # Reusable UI components
│   ├── ui/      # Basic UI primitives
│   └── commandline/  # Command palette
├── hooks/        # React hooks (hotkeys, etc.)
├── contexts/     # React contexts (HotkeyContext, ProjectContext)
├── types/        # Frontend types + backend converters
└── utils/        # Utility functions
```

#### Page Composition Pattern

- Keep files inside `pages/` focused on high-level composition. Heavy data wiring, command parsing, and hotkey registration belong in colocated hooks (for example, `pages/document/useDocumentController.ts` and `pages/dashboard/useDashboardCommandHandler.ts`).
- Controller hooks should return the props required by presentational components so page components mainly choose between loading, error, or content renders.
- Command-heavy flows expose dedicated handlers through these hooks to keep side effects isolated, simplify testing, and prevent monolithic component files.
- UI components in `components/` remain presentational and continue to consume frontend types supplied by controller hooks—never import Wails models directly.

## Critical Rules

### 1. Type Safety - NEVER use `any`

**Rule:** ABSOLUTE PROHIBITION on `any` type in TypeScript.

```typescript
// ❌ NEVER
function process(data: any) { ... }

// ✅ ALWAYS
function process(data: Document) { ... }

// ✅ If truly unknown
function parse(json: string): unknown { ... }
```

**Alternatives:**
- Specific types
- Generics `<T>`
- Union types `string | number | null`
- Type guards `obj is Document`

### 2. Type Decoupling - NEVER use backend models in UI

**Rule:** Frontend NEVER imports Wails-generated models directly.

```typescript
// ❌ WRONG - Backend types in UI
import { models } from "../../wailsjs/go/models";
const documents = await DocumentService.List();
setDocuments(documents); // Backend type!

// ✅ CORRECT - Use converters at API boundary
import { documentsFromModels } from "../types";
const models = await DocumentService.List();
const documents = documentsFromModels(models);
setDocuments(documents); // Frontend type!
```

**Architecture:**
```
Backend (Go) → Wails Models → Converters → Frontend Types → UI
                                   ↑
                             Boundary Layer
```

**Pattern:**
- Each domain has `frontend/src/types/{Domain}.ts`
- Contains frontend type + `fromModel()` / `toModel()` converters
- Conversion happens at API boundaries ONLY

### 3. Code Comments - Only for non-obvious complexity

**ONLY comment when:**
- Hard-to-understand edge cases
- Workarounds for external issues
- Complex algorithm explanations
- WHY something is done (not WHAT)

**NEVER comment:**
- Self-explanatory code
- Function/variable descriptions
- Step-by-step operations
- Standard patterns

## Development Workflows

### Adding a Backend Feature

1. **Create/modify domain types** in `internal/{domain}/{domain}.go`
2. **Add database operations** in `internal/{domain}/store.go`
3. **Add business logic** in `internal/{domain}/service.go` (if needed)
4. **Expose to frontend** in `internal/app/bindings.go`
5. **Regenerate bindings**: `wails dev`
6. **Add frontend type converters** in `frontend/src/types/{Domain}.ts`

### Adding a Frontend Feature

1. **Create component** in appropriate directory
2. **Use hotkeys** via `useHotkey()` hook (not manual listeners)
3. **Convert backend types** at API boundaries
4. **NEVER import** `wailsjs/go/models` in components

### Adding a Database Migration

```bash
cd internal/db/migrations
goose create migration_name sql
# Edit the generated .sql file
# Restart app - migrations run automatically on startup
```

### Adding a Hotkey

```typescript
useHotkey({
  key: "k",
  modifiers: ["ctrl"],
  handler: () => openSearch(),
  description: "Open search",
  allowInInput: false
});
```

## Database Patterns

### Store Pattern: Create/CreateTx

**Rule:** Implementation in `*Tx` variant, non-Tx is wrapper.

```go
// CreateTx - actual implementation
func (s *Store) CreateTx(ctx context.Context, tx *sql.Tx, p *Project) error {
    query := `INSERT INTO project (...) VALUES (...) RETURNING id`
    err := tx.QueryRowContext(ctx, query, ...).Scan(&p.ID)
    return err
}

// Create - convenience wrapper
func (s *Store) Create(ctx context.Context, p *Project) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    if err := s.CreateTx(ctx, tx, p); err != nil {
        return err
    }

    return tx.Commit()
}
```

**Why:**
- `CreateTx` is primitive for coordination
- `Create` is convenient for standalone use
- Zero code duplication

### Multi-Store Coordination

**Rule:** Service orchestrates transactions across stores.

```go
type Service struct {
    db        *sql.DB
    docStore  *Store
    tagStore  *tag.Store
}

func (s *Service) CreateWithTags(ctx context.Context, doc *Document, tags []string) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    if err := s.tagStore.EnsureExistTx(ctx, tx, tags); err != nil {
        return err
    }

    if err := s.docStore.CreateTx(ctx, tx, doc); err != nil {
        return err
    }

    return tx.Commit()
}
```

## Architecture Decisions

### File-Based Storage

**Why:** Version control, portability, no vendor lock-in, human-readable.

**Format:** `vault/projects/{project-alias}/doc-{uuid}.json`

### Path-Based IDs

**Why:** Self-describing, hierarchical, no ID conflicts, Git-friendly.

**Format:** `projects/work/doc-abc123.json`

### BlockNote Editor

**Why:** Structured content (AST), rich editing, extensible, portable JSON.

### Hotkey System

**Architecture:**
- Frontend: `HotkeyProvider` context + `useHotkey()` hooks
- Declarative registration
- Priority-based conflict resolution
- Input field awareness

**Current shortcuts:**
- `:` - Focus command line
- `Escape` - Exit command line

### Project Alias

**Why:** Human-readable, stable references, file-system friendly.

**Format:** Lowercase alphanumeric + hyphens, 2-32 chars (e.g., `work`, `personal`)

## Testing

### Backend

```bash
go test ./...                   # All tests
go test ./internal/project      # Specific package
```

**Pattern:** In-memory SQLite for store tests

### Frontend

```bash
cd frontend
npm run build  # TypeScript check + Vite build
```

## Common Pitfalls

### ❌ Don't

- Use `any` type in TypeScript
- Import backend models in UI components
- Create custom wrappers around `*sql.Tx`
- Add comments for self-explanatory code
- Commit without being asked (master branch)
- Force commit with `--no-verify`
- Run dev server unless instructed

### ✅ Do

- Use type converters at API boundaries
- Follow Create/CreateTx pattern
- Write concise, self-documenting code
- Use declarative hotkey hooks
- Run tests before committing
- Make PRs to `develop` branch

## Performance

- **Caching:** Services share `ProjectCache` to avoid redundant DB queries
- **Indexing:** File watcher triggers incremental reindexing
- **Search:** FTS5 for fast full-text search with ranking
- **Frontend:** Code splitting, lazy loading

## Data Flow

```
User Action
    ↓
UI Component
    ↓
Frontend Type (converted from backend)
    ↓
Wails Service Call
    ↓
Go Service (business logic)
    ↓
Store (database operations)
    ↓
SQLite (query index) + JSON Files (source of truth)
```

## Git Workflow

- **Main branch:** `master` (production releases)
- **Development:** `develop` branch
- **Pull requests:** Always to `develop`, never to `master`
- **Commits:** Descriptive messages, never force-push to master

---

**For detailed architectural decisions, see root-level docs files. For project overview, see README.md.**
