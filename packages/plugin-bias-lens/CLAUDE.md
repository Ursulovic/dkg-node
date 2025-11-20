# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@dkg/plugin-bias-lens** is a DKG plugin for detecting and analyzing bias in content from Grokipedia (compared against Wikipedia). It integrates with both MCP (Model Context Protocol) for AI agents and Express REST APIs.

## Code Quality Standards

**MANDATORY RULES - Zero Tolerance:**

1. **No Code Comments**: Do NOT add code comments anywhere in the codebase. Code should be self-documenting through clear naming and structure.

2. **No `any` Type**: NEVER use TypeScript `any` type. Always use proper type definitions, unknown, or generics.

3. **Zero TypeScript Errors**: Always run `npm run check-types` and ensure there are zero TypeScript errors before completing any task.

4. **Test Coverage**: Every new function, class, or feature MUST have corresponding test coverage. No untested code.

5. **Passing Tests**: Always run `npm test` and ensure all tests pass before completing any task. If tests fail, fix them.

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
npm test -- tests/utils/hash.spec.ts            # Test hash utility
```

**Important**: The test command uses `mocha --import=tsx` (NOT `--loader`). The `--loader` flag is deprecated and incompatible with tsx/Node.js v22+.

### Adding New Agent Tools

When adding tools to the bias detection agent:

1. Create `src/agents/bias-detector/tools/{tool-name}.ts`:
```typescript
import { z } from "zod";
import { ToolClass } from "@langchain/...";

const toolSchema = z.object({
  // Define schema
});

export const myTool = new ToolClass({
  // Configuration
}).asTool({
  name: "tool-name",
  description: "Detailed description for agent...",
  schema: toolSchema,
});
```

2. Export from `src/agents/bias-detector/tools/index.ts`:
```typescript
import { myTool } from "./my-tool.js";
// Add to tools array
```

**Pattern**: Declare schema as `const` at file top, then reference in `.asTool()` call. This keeps schema definitions clean and reusable.

### OpenAI Schema Validation Rules

When creating Zod schemas for OpenAI's Structured Output API (used in `src/agents/bias-detector/schema.ts`), follow these critical rules:

**1. No `.default()` in `.required()` Objects**

OpenAI requires ALL properties in a `.required()` object to be explicitly required. Fields with `.default()` are treated as optional, causing validation errors.

```typescript
z.object({
  field: z.string().default("value")
}).required()
```

Instead, use `.describe()` for documentation without defaults:

```typescript
z.object({
  field: z.string().describe("Description of the field")
}).required()
```

**2. No `.url()` Validators**

Zod's `.url()` generates JSON Schema with `format: "uri"`, which OpenAI's API doesn't support. Always use `.string()` only:

```typescript
url: z.string().describe("URL to the source")
```

**3. No Nested Schema References**

OpenAI's Structured Output doesn't support nested `$ref` schema references. All schemas must be fully inlined at their usage point:

```typescript
factualErrors: z.array(
  z.object({
    claim: z.string().describe("The claim being evaluated"),
    sources: z.array(
      z.object({
        name: z.string().describe("Source name"),
        url: z.string().describe("Source URL"),
      }).required()
    ).describe("Supporting sources")
  }).required()
)
```

Do NOT create reusable schema constants and reference them with composition.

**4. Always Test with Real API**

After modifying schemas, always test with the actual OpenAI API (run `npx tsx ./run.ts`) to catch validation errors early. Schema errors only appear at runtime, not during TypeScript compilation.

## Architecture

### Dual-Channel Plugin Pattern

This plugin uses a **dual-registration architecture** where everything is exposed through two channels:

1. **MCP Tool**: `mcp.registerTool("find-bias-in-grokipedia-page", ...)` - AI agents call this
2. **HTTP Endpoint**: `api.get("/find-bias-in-grokipedia-page", ...)` - REST clients call this

Both channels invoke the same business logic (`findBiasesInGrokipediaPage`). This design allows the plugin to work in any deployment context.

### Content Hash Utility

**Standalone utility** (`src/utils/hash.ts`) for content versioning and provenance tracking:

```typescript
import { generateSourceVersions } from "./utils/hash.js";

const versions = await generateSourceVersions(
  "https://grokipedia.com/page/COVID-19",
  "https://en.wikipedia.org/wiki/COVID-19"
);
```

**Key Features:**
- Fetches raw HTML from both URLs in parallel
- Calculates SHA-256 hashes of raw HTML content (not markdown)
- Fetches Wikipedia revision ID from Wikipedia API for exact version tracking
- Uses single timestamp for both sources (ensures consistency)
- Completely independent of loaders (accepts URLs directly)

**Output Structure:**
```typescript
{
  grokipedia: {
    url: string,
    accessedAt: string,      // ISO 8601 timestamp
    pageHash: string         // "sha256:..."
  },
  wikipedia: {
    url: string,
    accessedAt: string,      // Same timestamp as grokipedia
    pageHash: string,        // "sha256:..."
    revisionId: string       // Wikipedia revision ID
  }
}
```

This enables **audit trails**: any bias report can be re-verified against exact page versions using the revision ID and content hash.

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
- Fetches Wikipedia pages directly and converts HTML to Markdown
- Uses Cheerio to select article content with selector `#mw-content-text .mw-parser-output`
- Converts HTML to Markdown using Turndown to preserve links and structure
- Returns: `WikipediaDocument[]` with metadata: `{ source: string }`
- Adds UUID `id` to each document
- Custom Turndown rules convert relative links to absolute and citations to `[[n]]` format

**Preprocessing Pipeline (Both Loaders):**
Both loaders apply identical preprocessing to ensure consistent markdown output:
1. Remove navigation elements (Wikipedia navboxes, Grokipedia menus)
2. Convert relative URLs to absolute (`/wiki/Page` → `https://en.wikipedia.org/wiki/Page`)
3. Convert protocol-relative URLs (`//cdn.example.com` → `https://cdn.example.com`)
4. Flatten table structures and convert to GitHub-flavored markdown
5. Convert citations to `[[n]]` format
6. Remove Wikipedia-specific metadata (sortable table keys, hidden elements)

This creates a **unified content representation** that downstream agents consume consistently.

**ExternalAssetsLoader** (`src/loaders/external.ts`):
- Loads external content (PDFs, HTML pages, images, video, audio) from URLs found in articles
- Unified interface that routes different link types to appropriate handlers
- Returns typed documents: `PdfDocument[]`, `HtmlDocument[]`, or `MediaDocument[]`
- All documents include UUID `id` and proper metadata structure

**Key Features:**
- **PDF Loading**: Downloads PDFs to temp directory, extracts text using LangChain's PDFLoader
- **HTML Scraping**: Fetches HTML directly, converts to Markdown using Turndown to preserve links
- **Media Interpretation**: Uses Google Gemini (multimodal AI) to generate descriptions/transcriptions for images, video, and audio
- **Batching Support**: Efficiently processes multiple links of the same type
- **Error Isolation**: One link type failing doesn't break others
- **Parallel Processing**: Processes different link types in parallel for optimal performance

**Metadata Structure:**
- `metadata.source` - The Wikipedia/Grokipedia article URL where the asset was referenced
- `metadata.assetSource` - The actual URL of the asset itself
- `metadata.assetType` - Type of asset: "pdf" | "html" | "image" | "video" | "audio"

**Environment Variables Required:**
- `GOOGLE_API_KEY` - Google Gemini API key (required for media interpretation)

**Usage Example:**
```typescript
import { ExternalAssetsLoader } from "./loaders/external";
import { extractLinks } from "./parsers/wikipedia";

const loader = new ExternalAssetsLoader();
const sourceUrl = "https://en.wikipedia.org/wiki/Climate_change";

// Extract links from article content
const links = extractLinks(articleContent);

// Load all external assets with unified interface
const documents = await loader.loadLinks(links, sourceUrl);

// Or load specific types
const pdfs = await loader.loadPDFs(pdfLinks, sourceUrl);
const htmlPages = await loader.loadHTML(htmlLinks, sourceUrl);
const media = await loader.loadMedia(mediaLinks, sourceUrl);
```

### Vector Database (RAG Utility)

**PineconeRAG** (`src/vectordb/pinecone.ts`):
- Cloud-based vector store using Pinecone for semantic search
- Enables Retrieval Augmented Generation (RAG) for bias detection agents
- Global caching across all users (hackathon-friendly)
- Uses OpenAI embeddings (`text-embedding-3-large`)

**Key Features:**
- **Automatic Chunking**: Documents are automatically split into chunks (default: 1000 chars with 200 char overlap) before embedding to avoid token limits
- **Deduplication**: Automatically skips re-indexing documents with same source URL
- **Filtered Retrieval**: Filter by `source`, `title`, `documentType`, or any combination
- **Semantic Search**: Returns top-k relevant documents based on query similarity
- **Type-Safe**: Extends document metadata with `documentType`, `indexedAt` fields
- **Extensible**: Filter interface designed to accommodate future document types

**Environment Variables Required:**
- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX` - Pinecone index name
- `OPENAI_API_KEY` - OpenAI API key for embeddings

**Usage Example:**
```typescript
import { PineconeRAG } from "./vectordb";

// Default configuration (1000 char chunks, 200 char overlap, 1024 dimensions)
const rag = new PineconeRAG();

// Custom configuration
const ragCustom = new PineconeRAG({
  chunkSize: 500,      // Smaller chunks
  chunkOverlap: 50,    // Less overlap
  dimensions: 3072,    // Custom embedding dimensions (must match Pinecone index)
});

// Upsert documents (with automatic chunking and deduplication)
const result = await rag.upsert(documents);
// result: { cached: ["url1"], indexed: ["url2"] }
// Large documents are automatically split into chunks before embedding

// Semantic search with filtering (single field)
const results = await rag.retrieve("climate change", {
  filter: { source: "https://grokipedia.com/wiki/Climate" },
  k: 5
});

// Filter by multiple fields
const grokResults = await rag.retrieve("query", {
  filter: {
    documentType: "grokipedia",
    title: "Climate Change"
  }
});

// Check if URL already indexed
const exists = await rag.isIndexed("https://example.com/article");
```

**Testing Note:** All Pinecone and OpenAI calls are mocked in tests using Sinon to avoid real API calls and ensure fast, deterministic test execution.

### Observability

The plugin automatically supports **LangSmith observability** for tracing and monitoring RAG operations. LangChain components (embeddings, vector stores, etc.) automatically send traces to LangSmith when enabled.

**What gets traced:**
- Document upserting (chunking, embedding generation, vector store operations)
- Semantic search queries
- OpenAI embedding API calls
- Pinecone vector database operations

**Trace Tags and Metadata:**

All `upsert()` operations are automatically tagged for easy filtering in LangSmith:
- **Tag: `indexing`** - Identifies all indexing operations
- **Tag: Document source URLs** - Each trace tagged with the source URLs being processed
- **Metadata:**
  - `documentCount` - Total documents in the batch
  - `cachedCount` - Documents already indexed (skipped)
  - `indexedCount` - New documents indexed
  - `documentTypes` - Types of documents processed (grokipedia, wikipedia)

Example LangSmith UI filtering:
- Filter by tag `"indexing"` to see all RAG indexing operations
- Filter by tag `"https://grokipedia.com/page/Climate_change"` to see traces for that specific page

**Setup (Optional):**

Add these environment variables to enable tracing:

```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_PROJECT=plugin-bias-lens  # Optional: organize traces by project
```

Get your API key from [LangSmith Settings](https://smith.langchain.com/settings).

**No code changes required** - tracing works automatically once environment variables are set. View traces in the [LangSmith UI](https://smith.langchain.com) to debug, monitor performance, and analyze RAG operations.

### Type System

All loaders extend LangChain's Document type with typed metadata and UUID ids:

**Grokipedia & Wikipedia Loaders:**
```typescript
interface GrokipediaMetadata { source: string; title: string; }
type GrokipediaDocument = Document<GrokipediaMetadata> & { id: string };

interface WikipediaMetadata { source: string; }
type WikipediaDocument = Document<WikipediaMetadata> & { id: string };
```

**ExternalAssetsLoader:**
```typescript
interface PdfMetadata {
  source: string;        // Article URL where PDF was found
  assetSource: string;   // Actual PDF URL
  assetType: "pdf";
}
type PdfDocument = Document<PdfMetadata> & { id: string };

interface HtmlMetadata {
  source: string;        // Article URL where link was found
  assetSource: string;   // Actual page URL
  assetType: "html";
}
type HtmlDocument = Document<HtmlMetadata> & { id: string };

interface MediaMetadata {
  source: string;        // Article URL where media was found
  assetSource: string;   // Actual media URL
  assetType: "image" | "video" | "audio";
}
type MediaDocument = Document<MediaMetadata> & { id: string };

type ExternalAssetDocument = PdfDocument | HtmlDocument | MediaDocument;
```

**Link Types (Parsers):**
Following the refactoring in Issues #3-6, academic and archive sources are now classified as "html":
```typescript
export type LinkType =
  | "wiki-page"    | "grok-page"
  | "image"        | "video"       | "audio"
  | "pdf"          | "doc"         | "excel"
  | "html"         // Includes academic sources (arxiv, doi.org, nature.com, etc.)
                   // and archive sources (web.archive.org, archive.ipcc.ch, etc.)
  | "citation"     | "other";
```

**Important**: Document IDs are generated at load time with `randomUUID()` and are NOT persisted. Each plugin run generates new UUIDs for the same content.

## Build System

- **Bundler**: tsup (fast TypeScript bundler)
- **Output**: Dual format (CommonJS `dist/index.js` + ESM `dist/index.mjs`) with type definitions (`dist/index.d.ts`)
- **Module Type**: CommonJS (no `"type": "module"` in package.json)

## Testing

### Test Structure

Six test files with different purposes:

1. **`tests/loaders/grokipedia.spec.ts`** ✅ Complete
   - Real integration tests against live grokipedia.com
   - URL validation tests (invalid formats, wrong domains)

2. **`tests/loaders/wikipedia.spec.ts`** ✅ Complete
   - Real network integration tests
   - UUID format validation (RFC 4122 v4)
   - Unique ID generation verification

3. **`tests/loaders/external.spec.ts`** ✅ Complete
   - Comprehensive tests for PDF, HTML, and media loading
   - Tests all three phases: PDF loading, HTML scraping, media interpretation
   - **Fully mocked** - No real network/API calls (uses `tests/helpers/mocks.ts`)
   - Tests LoadResult structure (documents, errors, stats)
   - Tests error tracking, deduplication, timeout handling, concurrent processing
   - Uses small fixtures (`wikipedia-links-small.json`, `grokipedia-links-small.json`)
   - Tests unified interface (`loadLinks`) with mixed link types
   - Fast execution (<5 seconds)

4. **`tests/vectordb/pinecone.spec.ts`** ✅ Complete
   - Comprehensive unit tests with mocked Pinecone/OpenAI calls
   - Tests: Core Functionality, Error Handling, Deduplication, Filtering
   - Uses Sinon to stub all external API calls (no real network requests)
   - Fast execution (<1 second)

5. **`tests/utils/hash.spec.ts`** ✅ Complete
   - Real integration tests with Wikipedia API
   - Tests SHA-256 hash calculation (deterministic, handles unicode)
   - Tests Wikipedia title extraction from various URL formats
   - Tests Wikipedia revision ID fetching
   - Tests complete sourceVersions generation with real HTML fetching
   - Validates timestamp consistency and hash format

6. **`tests/plugin-bias-lens.spec.ts`** ⚠️ Has placeholder tests
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

**Custom Mocking Utilities** (`tests/helpers/mocks.ts`):
- `setupFetchMock(fetchStub)` - Mocks global fetch with predefined responses
- `setupGeminiMock(invokeStub)` - Mocks Gemini API calls for media interpretation
- `createTimeoutFetchMock(fetchStub)` - Simulates slow/timeout requests
- `createSlowFetchMock(fetchStub, delayMs)` - Simulates delayed responses
- `countMockCalls(stub, urlPattern)` - Helper to count specific URL calls
- `getCalledUrls(stub)` - Helper to get all URLs called during tests

**Test Fixtures** (Small representative datasets for fast testing):
- `tests/fixtures/wikipedia-links-small.json` - 19 links (images, PDFs, HTML, wiki-pages, duplicates, broken)
- `tests/fixtures/grokipedia-links-small.json` - 15 links (HTML, PDFs, duplicates, broken)

### Testing Requirements

According to `packages/PLUGIN_TESTING_GUIDE.md`, all plugins must have:
- **Core Functionality tests** - GitHub Actions validates this exists
- **Error Handling tests** - GitHub Actions validates this exists

**Current Status**: Placeholder tests in `plugin-bias-lens.spec.ts` need to be replaced with real tests before the plugin can be considered production-ready.

## Important Non-Obvious Details

### 1. Loader Error Handling Asymmetry
- **GrokipediaLoader**: Strict URL validation (throws synchronously on invalid URLs)
- **WikipediaLoader**: No URL validation (accepts any string, relies on fetch error handling)

### 2. OpenAPI Auto-Documentation
The plugin uses `openAPIRoute()` wrapper which generates Swagger documentation from Zod schemas:
```typescript
openAPIRoute({
  query: z.object({ url: z.string().url().openapi({ example: "..." }) }),
  // ... generates OpenAPI spec automatically
})
```

### 3. System Requirements

**Development Prerequisites:**
- **Git LFS** (Large File Storage) - Required for Wikidata cache files (~21.77 MB)
  - Install: `brew install git-lfs` (macOS) or see detailed instructions in section 5 (Wikidata Query Tool)
  - Setup: `git lfs install` (one-time)
  - Verify: `git lfs ls-files` (should show `src/data/wikidata/*.json`)
  - Without Git LFS: Run `npm run fetch-wikidata-cache` to generate cache locally

**Runtime Dependencies:**
- Node.js (compatible with the monorepo requirements)
- npm (for package management)

### 4. Environment Variables

**Required for Vector Database:**
- `PINECONE_API_KEY` - Pinecone API key (required for RAG functionality)
- `PINECONE_INDEX` - Pinecone index name (required for RAG functionality)
- `OPENAI_API_KEY` - OpenAI API key for embeddings (required for RAG functionality)

**Required for Bias Detection Agent:**
- `SERPAPI_API_KEY` - Google Scholar API (peer-reviewed source verification)
- `TAVILY_API_KEY` - Web search API (news, events, quotes verification)

**Required for ExternalAssetsLoader:**
- `GOOGLE_API_KEY` - Google Gemini API key (required for media interpretation: images, video, audio)

**Optional for Observability:**
- `LANGSMITH_TRACING=true` - Enable LangSmith tracing
- `LANGSMITH_API_KEY` - LangSmith API key
- `LANGSMITH_PROJECT=plugin-bias-lens` - Project name for trace organization

### 5. Bias Detection Agent Architecture

The bias detection agent (`src/agents/bias-detector/`) implements a sophisticated fact-checking methodology:

**Agent Tools** (`src/agents/bias-detector/tools/`):
- **web-search.ts** - Tavily API for recent news, events, policy announcements, quotes
- **google-scholar-search.ts** - SERPAPI for peer-reviewed papers, systematic reviews, academic consensus
- **wikidata-query.ts** - Wikidata SPARQL endpoint for structured encyclopedia facts (dates, populations, locations, relationships)

**Tool Selection Rules** (enforced by system prompt):
- Scientific/medical/statistical claims → MUST use `google_scholar_search`
- Claims citing specific studies → MUST use `google_scholar_search`
- Structured encyclopedia facts (dates, populations, locations, relationships) → MUST use `wikidata_query`
- Recent events/news/quotes → Use `web_search`
- Fallback: `web_search` when Scholar returns no results

**Evidence Hierarchy** (affects confidence scoring):
```
peer-reviewed > systematic-review > government > academic-institution >
major-news-outlet > think-tank > blog-opinion
```

Every finding includes a `credibilityTier` from this hierarchy. Lower-tier sources reduce confidence scores even when claims are verified.

**Critical Pattern**: The agent is taught to distinguish between:
- Peer-reviewed paper in journal (peer-reviewed tier)
- News article ABOUT research (blog-opinion tier)
- Editorial in journal (blog-opinion tier)

This prevents "citation inflation" where news coverage is mistaken for primary evidence.

#### Wikidata Query Tool (`wikidata-query.ts`)

The Wikidata query tool enables verification of structured encyclopedia facts against authoritative knowledge graph data.

**Architecture:**
- **PropertyResolver** - Fuzzy search (Fuse.js) over 13,000+ properties with API fallback
- **ConstraintValidator** - Validates property-entity type compatibility using 77,000+ constraints
- **EntityTypeResolver** - Determines entity types (Q5=human, Q515=city, etc.)
- **Entity Resolution** - Searches Wikidata for Q-codes from natural language
- **SPARQL Execution** - Queries Wikidata with 5s timeout and error handling

**Wikidata Cache** (`src/data/wikidata/` - ~21.77 MB total, tracked with Git LFS):
- `properties.json` - 13,054 properties with labels, descriptions, aliases (3.40 MB)
- `constraints.json` - 77,591 property constraints for type validation (18.28 MB)
- `entity-types.json` - 22 common entity classes (Q5, Q515, Q6256, etc.) (3.59 KB)
- `qualifiers.json` - 22 common qualifiers (P585, P580, P582, etc.) (4.66 KB)
- `countries.json` - 235 countries with ISO codes, populations, capitals (35.31 KB)
- `units.json` - 500 units of measurement (meter, kilogram, etc.) (48.39 KB)

**Git LFS Setup (Required for Development):**

The Wikidata cache files (~21.77 MB) are tracked with Git LFS. Developers must install Git LFS before cloning or pulling the repository.

**Installation:**
```bash
# macOS (Homebrew)
brew install git-lfs

# Ubuntu/Debian
sudo apt-get install git-lfs

# Fedora/RedHat
sudo dnf install git-lfs

# Windows (Chocolatey)
choco install git-lfs

# Or download from: https://git-lfs.github.com/
```

**Initial Setup (one-time):**
```bash
# Initialize Git LFS in your Git configuration
git lfs install

# Verify LFS is tracking the cache files
git lfs ls-files
# Should show: src/data/wikidata/*.json
```

**Cloning the Repository:**
```bash
# Git LFS files download automatically during clone
git clone <repo-url>
cd dkg-node/packages/plugin-bias-lens

# Verify cache files are present and correct size
ls -lh src/data/wikidata/
# Should show ~21.77 MB total
```

**Updating the Cache:**
```bash
# Fetch latest Wikidata data (requires internet)
npm run fetch-wikidata-cache

# Commit the updated cache files
git add src/data/wikidata/*.json
git commit -m "chore: update Wikidata cache"

# Git LFS handles large files automatically
git push
```

**Troubleshooting:**

If cache files appear as small text pointers instead of full files:
```bash
# Pull LFS files manually
git lfs pull

# Check LFS status
git lfs status
```

If you cloned before installing Git LFS:
```bash
# Install Git LFS (see above)
git lfs install

# Fetch LFS files
git lfs fetch
git lfs checkout
```

**Without Git LFS:**
If you cannot install Git LFS, you can generate the cache locally:
```bash
npm run fetch-wikidata-cache
# Generates all cache files in src/data/wikidata/
# Warning: Do not commit these files without LFS (will bloat repository)
```

**Usage Patterns:**
- Founding dates: "When was Tesla Inc. founded?" → P571 (inception)
- Population: "What is the population of Tokyo?" → P1082
- CEO relationships: "Who is the CEO of Microsoft?" → P169
- Geographic facts: "What is the capital of France?" → P36

**Constraint Validation Example:**
```typescript
// Query: "What is the date of birth of Tesla Inc.?"
// ❌ BLOCKED: P569 (date of birth) requires Q5 (human)
// Tesla Inc. (Q478214) is Q4830453 (business)
// ✅ SUGGESTED: Use P571 (inception) instead
```

**Fuzzy Property Matching:**
- "founded" → finds P571 (inception)
- "populaton" (typo) → finds P1082 (population)
- "CEO" → finds P169 (chief executive officer)
- Unknown properties → fallback to live Wikidata API search

**Source Attribution:**
- All results include Wikidata entity URLs (e.g., `https://www.wikidata.org/wiki/Q312`)
- Classified as `credibilityTier: "government"` (Wikimedia Foundation)

### 6. Current Implementation Status
- ✅ Core infrastructure complete
- ✅ Loaders implemented and tested (GrokipediaLoader, WikipediaLoader, ExternalAssetsLoader)
- ✅ Vector database (PineconeRAG) implemented and tested
- ✅ Content hash utility implemented and tested
- ✅ Plugin registration working
- ✅ External assets loading complete (PDF, HTML, media with Gemini)
- ✅ Bias detection agent tools complete (web_search, google_scholar_search, wikidata_query)
- ✅ Wikidata query tool with fuzzy search and constraint validation
- ✅ Wikidata cache system (~21.77 MB) with Git LFS tracking
- ⚠️ Bias detection agent integration incomplete
- ⚠️ Plugin integration tests incomplete (TODO placeholders)
- ⚠️ Wikidata query tool tests incomplete

### 7. Namespace Pattern
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
- `@langchain/pinecone` - Pinecone vector store integration
- `@langchain/openai` - OpenAI embeddings for RAG
- `@pinecone-database/pinecone` - Pinecone client SDK
- `cheerio` - HTML parsing
- `zod` - Schema validation

### Why These Dependencies
- No direct blockchain imports (DKG access via injected context)
- LangChain ecosystem for document handling (maintains compatibility with AI chains)
- Pinecone for cloud-based vector search with global caching
- OpenAI for semantic embeddings (text-embedding-3-large)
- Zod for runtime validation + OpenAPI schema generation

## References

- Testing standards: `/Users/jaksamalisic/origintrail/dkg-node/packages/PLUGIN_TESTING_GUIDE.md`
- Example plugin: `packages/plugin-example/tests/addition.spec.ts`
