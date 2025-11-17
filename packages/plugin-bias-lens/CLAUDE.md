# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@dkg/plugin-bias-lens** is a DKG plugin for detecting and analyzing bias in content from Grokipedia (compared against Wikipedia). It integrates with both MCP (Model Context Protocol) for AI agents and Express REST APIs.

## Development Commands

### Daily Development
```bash
npm run dev              # Watch mode with live rebuild
npm test                 # Run all tests
npm run check-types      # TypeScript type checking
npm run lint             # ESLint validation
npm run build            # Production build (outputs to dist/)
```

### Running the Full Application
The application requires two processes in sequence:

1. **Start server first**: `npm run dev:server` - Wait for it to fully start
2. **Then start app**: `npm run dev:app` - Starts after server is ready

### Testing Specific Files
```bash
npm test -- tests/loaders/grokipedia.spec.ts    # Test single file
```

**Important**: The test command uses `mocha --import=tsx` (NOT `--loader`). The `--loader` flag is deprecated and incompatible with tsx/Node.js v22+.

## Architecture

### Dual-Channel Plugin Pattern

This plugin uses a **dual-registration architecture** where everything is exposed through two channels:

1. **MCP Tool**: `mcp.registerTool("find-bias-in-grokipedia-page", ...)` - AI agents call this
2. **HTTP Endpoint**: `api.get("/find-bias-in-grokipedia-page", ...)` - REST clients call this

Both channels invoke the same business logic (`findBiasesInGrokipediaPage`). This design allows the plugin to work in any deployment context.

### Plugin Entry Point (`src/index.ts`)

```typescript
export default defineDkgPlugin((ctx, mcp, api) => {
  // ctx: { dkg: DKG, blob: BlobStorage }
  // mcp: McpServer for AI agent tools
  // api: express.Router for REST endpoints
});
```

The plugin receives three injected dependencies:
- **ctx**: DKG blockchain client and blob storage
- **mcp**: Model Context Protocol server for registering AI-accessible tools
- **api**: Express router for REST endpoints

### Document Loaders

Both loaders follow the same pattern but have different metadata:

**GrokipediaLoader** (`src/loaders/grokipedia.ts`):
- Validates URLs (must be from `grokipedia.com`)
- Uses CheerioWebBaseLoader with CSS selector `"body > article"`
- Returns: `GrokipediaDocument[]` with metadata: `{ source: string, title: string }`
- Adds UUID `id` to each document

**WikipediaLoader** (`src/loaders/wikipedia.ts`):
- Uses Jina AI as a Wikipedia proxy (`https://r.jina.ai/`)
- Returns: `WikipediaDocument[]` with metadata: `{ source: string }`
- Adds UUID `id` to each document
- Requires `JINA_AI_API_KEY` env var (optional, enables higher rate limits)

### Type System

Both loaders extend LangChain's Document type with typed metadata and UUID ids:

```typescript
interface GrokipediaMetadata { source: string; title: string; }
type GrokipediaDocument = Document<GrokipediaMetadata> & { id: string };

interface WikipediaMetadata { source: string; }
type WikipediaDocument = Document<WikipediaMetadata> & { id: string };
```

**Important**: Document IDs are generated at load time with `randomUUID()` and are NOT persisted. Each plugin run generates new UUIDs for the same content.

## Build System

- **Bundler**: tsup (fast TypeScript bundler)
- **Output**: Dual format (CommonJS `dist/index.js` + ESM `dist/index.mjs`) with type definitions (`dist/index.d.ts`)
- **Module Type**: CommonJS (no `"type": "module"` in package.json)

## Testing

### Test Structure

Three test files with different purposes:

1. **`tests/loaders/grokipedia.spec.ts`** ✅ Complete
   - Real integration tests against live grokipedia.com
   - URL validation tests (invalid formats, wrong domains)

2. **`tests/loaders/wikipedia.spec.ts`** ✅ Complete
   - Real network tests via Jina AI
   - UUID format validation (RFC 4122 v4)
   - Unique ID generation verification

3. **`tests/plugin-bias-lens.spec.ts`** ⚠️ Has placeholder tests
   - Contains TODO placeholders that must be replaced
   - Infrastructure is set up correctly (MCP server/client, Express app)
   - See PLUGIN_TESTING_GUIDE.md for requirements

### Test Infrastructure

The plugin uses modern testing utilities from `@dkg/plugins/testing`:

```typescript
import {
  createExpressApp,           // Express test app
  createInMemoryBlobStorage,  // Mock blob storage
  createMcpServerClientPair,  // MCP server/client pair
  createMockDkgClient,        // Mock DKG blockchain client
} from "@dkg/plugins/testing";
```

### Testing Requirements

According to `packages/PLUGIN_TESTING_GUIDE.md`, all plugins must have:
- **Core Functionality tests** - GitHub Actions validates this exists
- **Error Handling tests** - GitHub Actions validates this exists

**Current Status**: Placeholder tests in `plugin-bias-lens.spec.ts` need to be replaced with real tests before the plugin can be considered production-ready.

## Important Non-Obvious Details

### 1. Loader Error Handling Asymmetry
- **GrokipediaLoader**: Strict URL validation (throws synchronously on invalid URLs)
- **WikipediaLoader**: No URL validation (accepts any string, relies on Jina AI error handling)

### 2. OpenAPI Auto-Documentation
The plugin uses `openAPIRoute()` wrapper which generates Swagger documentation from Zod schemas:
```typescript
openAPIRoute({
  query: z.object({ url: z.string().url().openapi({ example: "..." }) }),
  // ... generates OpenAPI spec automatically
})
```

### 3. Environment Variables
- `JINA_AI_API_KEY` is loaded lazily (only in `wikipedia.ts` via dotenv)
- Not visible to GrokipediaLoader
- Gracefully handles missing key (Wikipedia loader still works with rate limits)

### 4. Current Implementation Status
- ✅ Core infrastructure complete
- ✅ Loaders implemented and tested
- ✅ Plugin registration working
- ⚠️ Bias detection is a placeholder (returns "0 biases")
- ⚠️ Plugin integration tests incomplete (TODO placeholders)

### 5. Namespace Pattern
Plugins can use `.withNamespace()` to avoid naming collisions:
```typescript
plugin.withNamespace("bias-lens", { middlewares: [...] })
// Results in:
//   MCP Tool: "bias-lens__find-bias-in-grokipedia-page"
//   HTTP Route: "/bias-lens/find-bias-in-grokipedia-page"
```

## Common Development Tasks

### Adding a New Loader

1. Create `src/loaders/myloader.ts`:
```typescript
import { Document } from "@langchain/core/documents";
import { randomUUID } from "node:crypto";

interface MyMetadata { source: string; /* ... */ }
type MyDocument = Document<MyMetadata> & { id: string };

export class MyLoader {
  async load(input: string): Promise<MyDocument[]> {
    // Implementation
    return docs.map(doc => ({ ...doc, id: randomUUID() }));
  }
}
```

2. Create `tests/loaders/myloader.spec.ts` with comprehensive tests

3. Import and use in `src/index.ts`

### Adding a New MCP Tool

1. Create the business logic function
2. Register with MCP: `mcp.registerTool(name, schema, handler)`
3. Optionally add HTTP endpoint with `openAPIRoute()`
4. Add tests in `tests/plugin-bias-lens.spec.ts`

### Fixing Test Command Issues

If tests fail to run or show experimental loader warnings:
- Ensure `package.json` uses: `"test": "mocha --import=tsx 'tests/**/*.spec.ts'"`
- Do NOT use `--loader` flag (deprecated in Node v20.6.0+)

## Dependencies

### Core Dependencies
- `@dkg/plugins` - Plugin SDK (defineDkgPlugin, types)
- `@dkg/plugin-swagger` - OpenAPI/Swagger integration
- `@langchain/core` - Document base class
- `@langchain/community` - CheerioWebBaseLoader
- `cheerio` - HTML parsing
- `zod` - Schema validation

### Why These Dependencies
- No direct blockchain imports (DKG access via injected context)
- LangChain ecosystem for document handling (maintains compatibility with AI chains)
- Zod for runtime validation + OpenAPI schema generation
- Minimal dependencies (6 direct, focused scope)

## References

- Testing standards: `/Users/jaksamalisic/origintrail/dkg-node/packages/PLUGIN_TESTING_GUIDE.md`
- Example plugin: `packages/plugin-example/tests/addition.spec.ts`
