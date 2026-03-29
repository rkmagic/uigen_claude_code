# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup      # First-time setup: install deps + Prisma generate + migrate
npm run dev        # Start dev server with Turbopack
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Run vitest tests
npm run db:reset   # Reset SQLite database
```

Single test: `npx vitest run <test-file-path>`

## Environment

Create `.env` with an optional `ANTHROPIC_API_KEY`. Without a key, the app uses `MockLanguageModel` (see `src/lib/provider.ts`) which returns a hardcoded fallback response — useful for frontend development.

## Architecture

**UIGen** is a Next.js 15 app where users describe React components in a chat interface, and Claude generates them with a live preview.

### Core Data Flow

1. User sends a message → `POST /api/chat` streams a response from Anthropic Claude (or `MockLanguageModel`)
2. Claude invokes tools (`str_replace_editor`, `file_manager`) to create/edit files
3. `FileSystemProvider` (`src/lib/contexts/`) intercepts tool calls and applies them to the in-memory `VirtualFileSystem`
4. `PreviewFrame` detects file changes, compiles JSX via Babel standalone in the browser, and re-renders the live component inside an iframe
5. On conversation end, the entire file system + messages are serialized and saved to SQLite via Prisma

### Virtual File System (`src/lib/file-system.ts`)

All generated files are in-memory (no disk I/O). The `VirtualFileSystem` class stores files in a `Map<path, FileNode>`. It serializes to/from JSON for database persistence. `FileSystemContext` wraps this and triggers React re-renders on mutations.

### AI Tools (`src/lib/tools/`)

Claude uses two tools:
- **`str_replace_editor`** — view/create/edit files (str_replace, insert, undo_edit operations)
- **`file_manager`** — rename/delete files

Tool calls flow: API route → streamed back to client → `ChatContext` → `FileSystemContext.handleToolCall()` → updates VFS + refreshes preview.

### JSX Transformer (`src/lib/transform/jsx-transformer.ts`)

Runs entirely in the browser. Uses `@babel/standalone` to compile JSX/TSX → JS, builds an ES module import map with `blob:` URLs for cross-file imports, and injects Tailwind CSS. The entry point is always `/App.jsx` (or `App.tsx`).

### System Prompt (`src/lib/prompts/generation.tsx`)

Instructs Claude to:
- Use `/App.jsx` as the entry point
- Style exclusively with Tailwind CSS (no inline styles)
- Import between files using `@/` prefix
- Keep text responses brief (code changes are communicated via tool calls)

### Authentication (`src/lib/auth.ts`, `src/actions/index.ts`)

JWT stored in an HTTP-only cookie. `getUser()` decodes the session server-side. Passwords hashed with bcrypt.

### Project Persistence (Prisma + SQLite)

Schema: `User` (id, email, password) → `Project` (id, name, messages JSON, data JSON, userId). The `data` field stores the serialized VFS. Schema in `prisma/schema.prisma`.

### Key Path Aliases

`@/*` maps to `src/*` — used throughout the codebase and also within generated component imports.
