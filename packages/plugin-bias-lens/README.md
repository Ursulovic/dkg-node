# @dkg/plugin-bias-lens

A DKG plugin for detecting and analyzing bias in content from Grokipedia (compared against Wikipedia). Uses LangChain agents with access to Wikidata, Google Scholar, and web search to verify claims.

## Features

- **Bias Detection Agent** - AI agent that fact-checks Grokipedia articles against Wikipedia
- **Wikidata Query Tool** - Verifies structured facts (dates, populations, locations) with fuzzy search
- **Google Scholar Integration** - Validates scientific/medical claims with peer-reviewed sources
- **Web Search** - Verifies recent news, events, and quotes
- **Vector Database (Pinecone)** - RAG for efficient document retrieval
- **External Assets Loader** - Processes PDFs, HTML pages, images, video, and audio
- **Content Hashing** - SHA-256 versioning for provenance tracking
- **TypeScript** - Full type safety with zero `any` types

## Prerequisites

### Git LFS (Required for Development)

The Wikidata cache files (~21.77 MB) are tracked with Git LFS. You must install Git LFS before cloning or pulling.

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

**Setup (one-time):**

```bash
# Initialize Git LFS
git lfs install

# Verify LFS is tracking cache files
git lfs ls-files
# Should show: src/data/wikidata/*.json
```

**If you cloned before installing Git LFS:**

```bash
# Install Git LFS (see above)
git lfs install

# Fetch LFS files
git lfs fetch
git lfs checkout

# Verify cache files (should be ~21.77 MB total)
ls -lh src/data/wikidata/
```

**Alternative (without Git LFS):**

```bash
# Generate cache locally
npm run fetch-wikidata-cache
# Warning: Do not commit these files without LFS
```

## Installation

```bash
npm install
```

## Environment Variables

### Required for Vector Database (RAG)

- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX` - Pinecone index name
- `OPENAI_API_KEY` - OpenAI API key for embeddings

### Required for Bias Detection Agent

- `SERPAPI_API_KEY` - Google Scholar API (peer-reviewed source verification)
- `TAVILY_API_KEY` - Web search API (news, events, quotes)

### Required for External Assets Loader

- `GOOGLE_API_KEY` - Google Gemini API key (media interpretation: images, video, audio)

### Optional for Observability

- `LANGSMITH_TRACING=true` - Enable LangSmith tracing
- `LANGSMITH_API_KEY` - LangSmith API key
- `LANGSMITH_PROJECT=plugin-bias-lens` - Project name

**Configuration:**

Create a `.env` file in the package root:

```bash
# Vector Database
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=your_index_name
OPENAI_API_KEY=your_openai_key

# Bias Detection Agent
SERPAPI_API_KEY=your_serpapi_key
TAVILY_API_KEY=your_tavily_key

# External Assets
GOOGLE_API_KEY=your_google_api_key

# Observability (optional)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=plugin-bias-lens
```

## Running the Project

The project should be run in two steps:

### 1. Start the Development Server

```bash
npm run dev:server
```

Wait for the server to fully start before proceeding to the next step.

### 2. Start the Development Application

After the server has started, run:

```bash
npm run dev:app
```

## Development

### Available Scripts

```bash
# Development (watch mode with live rebuild)
npm run dev

# Build for production
npm run build

# Type checking
npm run check-types

# Linting
npm run lint

# Run tests
npm test

# Wikidata cache management
npm run fetch-wikidata-cache    # Download/update Wikidata cache
npm run update-wikidata-cache   # Alias for fetch-wikidata-cache

# Vector database management
npm run reset-vector-db         # Reset Pinecone vector database
```

### Code Quality Standards

**Mandatory (zero tolerance):**

1. **No code comments** - Code must be self-documenting
2. **No `any` type** - Use proper TypeScript types
3. **Zero TypeScript errors** - Run `npm run check-types` before committing
4. **100% test coverage** - All new code must have tests
5. **All tests pass** - Run `npm test` before committing

### Wikidata Cache Management

The Wikidata cache (~21.77 MB) contains:
- 13,054 properties with labels and aliases
- 77,591 property constraints for validation
- 22 common entity types
- 22 common qualifiers
- 235 countries with metadata
- 500 units of measurement

**Update cache periodically:**

```bash
npm run fetch-wikidata-cache
git add src/data/wikidata/*.json
git commit -m "chore: update Wikidata cache"
git push  # Git LFS handles large files automatically
```

## Testing

### Run All Tests

```bash
npm test
```

### Test Structure

The test suite includes:

1. **Loaders** (`tests/loaders/`)
   - `grokipedia.spec.ts` - Real integration tests with live grokipedia.com
   - `wikipedia.spec.ts` - Wikipedia querying with UUID validation
   - `external.spec.ts` - PDF, HTML, and media loading (fully mocked)

2. **Vector Database** (`tests/vectordb/`)
   - `pinecone.spec.ts` - Pinecone RAG with mocked API calls

3. **Utilities** (`tests/utils/`)
   - `hash.spec.ts` - SHA-256 content hashing with Wikipedia API

4. **Plugin Integration** (`tests/`)
   - `plugin-bias-lens.spec.ts` - MCP/Express integration tests

### Test-Specific Commands

```bash
# Test single file
npm test -- tests/loaders/grokipedia.spec.ts

# Test with specific pattern
npm test -- tests/vectordb/*.spec.ts
```

**Note:** Some tests require network access. External assets tests are fully mocked for speed.

## Architecture

### Loaders

**GrokipediaLoader** - Loads Grokipedia articles with metadata:
```typescript
const loader = new GrokipediaLoader();
const docs = await loader.loadPage('https://grokipedia.com/page/Example');
// Returns: { id, pageContent, metadata: { source, title } }
```

**WikipediaLoader** - Fetches Wikipedia articles and converts to Markdown:
```typescript
const loader = new WikipediaLoader();
const docs = await loader.loadPage('https://en.wikipedia.org/wiki/Climate_change');
// Returns: { id, pageContent, metadata: { source } }
```

**ExternalAssetsLoader** - Processes external content (PDFs, HTML, media):
```typescript
const loader = new ExternalAssetsLoader();
const links = extractLinks(articleContent);
const docs = await loader.loadLinks(links, sourceUrl);
// Handles: PDFs, HTML pages, images, video, audio
// Uses Google Gemini for media interpretation
```

### Vector Database (RAG)

**PineconeRAG** - Semantic search with automatic chunking:
```typescript
const rag = new PineconeRAG();
await rag.upsert(documents);  // Auto-chunks and deduplicates
const results = await rag.retrieve("climate change", {
  filter: { source: "https://grokipedia.com/wiki/Climate" },
  k: 5
});
```

### Bias Detection Agent

**Agent Tools:**
- `web_search` - Tavily API for news, events, quotes
- `google_scholar_search` - SERPAPI for peer-reviewed papers
- `wikidata_query` - SPARQL queries for structured facts

**Tool Selection:**
- Scientific claims → `google_scholar_search`
- Structured facts (dates, populations) → `wikidata_query`
- Recent events/news → `web_search`

### Wikidata Query Tool

Fast fuzzy search over 13K+ properties with constraint validation:

```typescript
// Query: "When was Tesla Inc. founded?"
// → Fuzzy matches "founded" to P571 (inception)
// → Validates: P571 works on Q4830453 (business) ✓
// → Returns: "2003-07-01" with Wikidata URL
```

**Features:**
- Typo tolerance: "populaton" → finds "population"
- Constraint validation: Prevents invalid queries
- API fallback: Live search if cache misses
- Offline-friendly: Works without internet after cache download

## Documentation

- **CLAUDE.md** - Comprehensive developer guide, architecture, testing
- **README.md** - Quick start and setup instructions

## License

See LICENSE file in the repository root.
