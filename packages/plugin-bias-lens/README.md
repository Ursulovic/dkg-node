# @dkg/plugin-bias-lens

A plugin for detecting and analyzing bias in content from Grokipedia based on Wikipedia.

## Features

- Load and analyze content from Grokipedia
- Query and analyze Wikipedia articles via Jina AI
- Automatic document ID generation using UUID
- TypeScript support with strict typing

## Installation

```bash
npm install
```

## Environment Variables

The plugin supports the following environment variables:

### Optional

- `JINA_AI_API_KEY` - API key for Jina AI service. Optional, but enables higher rate limits for Wikipedia queries.

To configure environment variables, create a `.env` file in the root directory:

```bash
JINA_AI_API_KEY=your_api_key_here
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

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run check-types
```

### Linting

```bash
npm run lint
```

## Testing

Run all tests:

```bash
npm test
```

The test suite includes:
- **GrokipediaLoader tests** - Validates URL handling and content loading from Grokipedia
- **WikipediaLoader tests** - Validates Wikipedia querying and document generation

Note: Wikipedia loader tests require network access. If `JINA_AI_API_KEY` is set, you'll get higher rate limits.

## Loaders

### GrokipediaLoader

Loads content from Grokipedia pages.

```typescript
import { GrokipediaLoader } from '@dkg/plugin-bias-lens';

const loader = new GrokipediaLoader();
const documents = await loader.loadPage('https://grokipedia.com/page/Example');
```

**Returns:** `GrokipediaDocument[]` with:
- `id` - Unique UUID for the document
- `pageContent` - The loaded content
- `metadata.source` - Source URL
- `metadata.title` - Page title

### WikipediaLoader

Queries Wikipedia articles using Jina AI.

```typescript
import { WikipediaLoader } from '@dkg/plugin-bias-lens';

const loader = new WikipediaLoader();
const documents = await loader.query('Climate change');
```

**Returns:** `WikipediaDocument[]` with:
- `id` - Unique UUID for the document
- `pageContent` - The article content
- `metadata.source` - Source URL

## License

See LICENSE file in the repository root.
