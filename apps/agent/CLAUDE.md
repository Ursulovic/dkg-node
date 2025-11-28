# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DKG Agent is a full-stack application that combines an Expo-based React Native web interface with a Node.js plugin server. The application provides a chat interface for interacting with OriginTrail's Decentralized Knowledge Graph (DKG) through MCP (Model Context Protocol) tools, with OAuth authentication, LLM integration, and a plugin architecture.

## Core Architecture

### Dual-Process System

The application runs as two separate processes:

1. **Web App (`dev:app`)**: Expo-based React Native web interface on port 8081
2. **Server (`dev:server`)**: Node.js plugin server with MCP endpoint on port 9200

Both processes are required for full functionality. Use `turbo dev` to run them together.

### Plugin Architecture

The server is built on `@dkg/plugins` framework (src/server/index.ts:82). Plugins are registered in a specific order:

1. **defaultPlugin**: Base functionality
2. **oauthPlugin**: OAuth2 authentication with scope-based access control
3. **Authorization middleware**: Protects routes by scope (`/mcp` needs "mcp" scope, `/llm` needs "llm" scope, etc.)
4. **accountManagementPlugin**: User management and password reset
5. **dkgEssentialsPlugin**: DKG blockchain operations
6. **examplePlugin**: Demo plugin with namespace protection
7. **swaggerPlugin**: OpenAPI documentation
8. **webInterfacePlugin**: Serves Expo web build
9. **biasLensPlugin**: BiasLens AI analysis features

All plugins must be registered before the server starts listening. Middleware order matters for authorization.

### Database Layer

Uses Drizzle ORM with SQLite (default: `dev.db`). Database schema is defined in `src/server/database/sqlite/`:

- `users.ts`: User accounts with email, hashed password (argon2), and scope string
- `oauth.ts`: OAuth authorization codes, tokens, and refresh tokens
- Migrations generated in `drizzle/sqlite/` via `npm run build:migrations`

Storage providers implement interfaces for OAuth and account management, abstracting database operations from plugin logic.

### Authentication Flow

1. User submits credentials to `/login` endpoint
2. Server validates via argon2 password verification (src/server/index.ts:39-51)
3. OAuth plugin generates authorization code
4. Client exchanges code for access token
5. Client stores token in AsyncStorage (web) or native storage
6. Subsequent requests include Bearer token
7. Middleware checks scopes against required permissions

### MCP Integration

The client connects to the server's MCP endpoint via:

- `useMcpClientConnection`: WebSocket transport to `/mcp`
- `useMcpToolsSession`: Manages tool calls and results
- LangChain integration for LLM providers (OpenAI, Anthropic, Google, Groq, Mistral, xAI)

Server-side MCP tools are provided by registered plugins. The chat interface sends user messages to LLM, which can call MCP tools via function calling.

### File-Based Routing

Expo Router provides file-based routing in `src/app/`:

- `(protected)/`: Authenticated routes (chat, settings, login)
- `index.tsx`: Root redirect
- `password-reset.tsx`: Public password reset flow
- `llm+api.ts`: API route for LLM streaming responses

Route groups use parentheses for organization without affecting URL structure.

## Development Commands

### Initial Setup

```bash
npm install
turbo build                 # Builds migrations, server, scripts, and web app
npm run script:setup        # Creates initial admin user
```

### Development

```bash
turbo dev                   # Runs dev:app + dev:server + drizzle:studio concurrently
npm run dev:app             # Expo web dev server only (port 8081)
npm run dev:server          # Server with hot reload (port 9200)
npm run drizzle:studio      # Database admin at https://local.drizzle.studio
```

For manual development without turbo, run each dev script in separate terminals.

### Building

```bash
npm run build:server        # Compiles src/server/*.ts to dist/ (ESM + CJS)
npm run build:scripts       # Compiles scripts to dist/scripts/
npm run build:web           # Exports Expo web to dist/app/
npm run build:migrations    # Generates Drizzle migrations from schema
turbo build                 # Runs all build steps in correct order
```

Build outputs:
- `dist/index.js`: Production server entry point
- `dist/app/`: Static web assets
- `dist/scripts/`: Setup and user creation scripts

### Testing

```bash
# Integration tests (Mocha + Chai + Supertest)
npm run test:integration    # Tests OAuth flow, DKG operations, plugin interactions

# E2E tests (Playwright)
npm run test:install        # Install browser dependencies
npm run test:e2e            # Full UI test suite
npm run test                # GitHub Actions subset (@gh_actions tag)

# RAGAS evaluation (LLM chatbot quality metrics)
npm run test:ragas          # Run evaluation against question dataset
npm run test:ragas:results  # View latest results
npm run test:ragas:dashboard # Interactive results dashboard
npm run ragas               # Full workflow (evaluate + show results)
```

RAGAS tests measure context retrieval and answer quality. Dataset: `tests/ragas/questionsAnswers/dkg-node-evaluation-dataset.json`

### Scripts

```bash
npm run script:setup        # Interactive setup wizard (creates admin user)
npm run script:createUser   # Create additional users
npm run script:createToken  # Generate API tokens
```

Scripts must be built first (`npm run build:scripts`).

### Type Checking

```bash
npm run check-types         # Run TypeScript compiler without emitting files
npm run lint                # Expo ESLint
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

**Required:**
- `DATABASE_URL`: SQLite file path (default: `dev.db`)
- `EXPO_PUBLIC_MCP_URL`: Server URL for MCP endpoint
- `EXPO_PUBLIC_APP_URL`: Public app URL (for OAuth redirects)
- `LLM_PROVIDER`: `openai`, `anthropic`, `google`, `groq`, `mistralai`, or `xai`
- `LLM_MODEL`: Model identifier for chosen provider
- `OPENAI_API_KEY` (or equivalent for chosen provider)
- `DKG_PUBLISH_WALLET`: Private key for blockchain publishing
- `DKG_BLOCKCHAIN`: Blockchain identifier (e.g., `otp:20430`)
- `DKG_OTNODE_URL`: OriginTrail node endpoint

**Optional:**
- SMTP configuration for password reset emails (if omitted, uses ethereal.email test accounts)
- LangSmith tracing for observability
- Research tool API keys (SerpAPI, Tavily) for BiasLens plugin

## Key Patterns

### Adding a New Plugin

1. Create plugin file in `src/server/` or install from `@dkg/plugin-*`
2. Import and register in `src/server/index.ts` plugins array
3. Add middleware before plugin if authorization needed
4. Define tools/resources in plugin using `defineDkgPlugin`
5. Update OpenAPI schemas in swagger plugin if needed

### Working with Database

1. Modify schema in `src/server/database/sqlite/*.ts`
2. Run `npm run build:migrations` to generate migration
3. Restart server to apply migration
4. Use `npm run drizzle:studio` to inspect data

### Adding UI Components

- Components in `src/components/` (reusable UI)
- Layout components in `src/components/layout/`
- Chat-specific in `src/components/Chat/`
- Use `useColors()` hook for theme-aware colors
- Forms use `src/components/forms/` components

### React Native + Web Compatibility

- Use platform-specific files: `.web.ts` for web-only code
- Polyfills in `src/polyfills.ts` and `src/polyfills.web.ts`
- UUID requires postinstall fix (see `fix-uuid.js`)
- Expo packages provide cross-platform APIs

## Common Issues

### Server Won't Start

Check:
1. `.env` file exists with required variables
2. Database file is accessible (check `DATABASE_URL`)
3. Port 9200 is available
4. Dependencies installed (`npm install`)

### Build Failures

- Run `turbo build` instead of individual build commands to ensure correct order
- Migrations must be built before server
- Web app build requires server to be built first

### Type Errors

- Run `npm run check-types` to see all errors
- Some packages lack types (dkg.js) - use `//@ts-expect-error` with comment

### Test Failures

- Integration tests need server built (`npm run build:server`)
- E2E tests need browsers installed (`npm run test:install`)
- RAGAS tests require valid LLM API keys in `.env`

## Production Deployment

```bash
turbo build
node dist/index.js          # Serves both API and web interface on PORT
```

Server handles both MCP endpoint and static web assets via webInterfacePlugin.
