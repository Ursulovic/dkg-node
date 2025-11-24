# Premium Notes API Implementation

## Overview

This implementation adds an API for discovering and accessing premium bias detection notes with payment protection (x402 to be added later).

## Files Created

### 1. `src/services/NoteSearchService.ts`
Service layer containing all search logic:
- SPARQL query building
- Filter construction
- DKG asset retrieval
- Public and private content access

### 2. `src/registerPremiumAccess.ts`
Plugin registration with:
- HTTP API endpoints (Express)
- MCP tools (AI agent integration)

### 3. Updated `src/index.ts`
Registered the new `registerPremiumAccess` plugin.

## API Endpoints

### 1. Search Notes
**GET** `/api/notes/search`

Query parameters:
- `topic` - Keyword to search in topic field
- `category` - Filter by factualError, missingContext, or sourceProblem
- `minReliability` - Minimum reliability score (0.0-1.0)
- `maxReliability` - Maximum reliability score (0.0-1.0)
- `isPremium` - Filter by premium status (true/false)
- `grokipediaUrl` - Filter by source article
- `parentReport` - Filter by parent report UAL
- `sortBy` - Sort by reliability, createdAt, or price
- `limit` - Max results (default: 20)
- `offset` - Pagination offset

**Response:**
```json
{
  "notes": [
    {
      "ual": "did:dkg:otp:2043/.../note-123",
      "topic": "Global Warming - Climate Data",
      "category": "factualError",
      "reliability": 0.97,
      "isPremium": true,
      "price": {
        "usdAmount": "$0.50",
        "network": "base"
      },
      "summary": "High-reliability finding contradicts peer-reviewed source"
    }
  ],
  "total": 5,
  "filters": { ... }
}
```

### 2. Preview Note
**GET** `/api/notes/:ual`

Returns public metadata for a specific note (free access).

**Response:**
```json
{
  "ual": "did:dkg:otp:2043/.../note-123",
  "isPremium": true,
  "metadata": {
    "topic": "...",
    "category": "...",
    "reliability": 0.97,
    "summary": "...",
    "price": { ... }
  }
}
```

### 3. Get Private Content (PROTECTED WITH x402)
**GET** `/api/notes/:ual/private`

Protected by x402 payment middleware. Requires payment before accessing private content.

**Response:**
```json
{
  "ual": "did:dkg:otp:2043/.../note-123",
  "content": {
    "claim": "Full claim text...",
    "issue": "Full issue description...",
    "sources": [ ... ],
    "confidence": 0.97,
    "verification": "..."
  }
}
```

### 4. Batch Purchase (PROTECTED WITH x402)
**POST** `/api/notes/batch-purchase`

Protected by x402 payment middleware. Purchase multiple notes in a single transaction.

**Request Body:**
```json
{
  "uals": [
    "did:dkg:otp:2043/.../note-123",
    "did:dkg:otp:2043/.../note-456",
    "did:dkg:otp:2043/.../note-789"
  ]
}
```

**Response:**
```json
{
  "totalPrice": {
    "usdAmount": "$1.50",
    "network": "base"
  },
  "notes": [
    {
      "ual": "did:dkg:otp:2043/.../note-123",
      "price": { "usdAmount": "$0.50", "network": "base" },
      "content": { ... }
    },
    {
      "ual": "did:dkg:otp:2043/.../note-456",
      "price": { "usdAmount": "$0.50", "network": "base" },
      "content": { ... }
    },
    {
      "ual": "did:dkg:otp:2043/.../note-789",
      "price": { "usdAmount": "$0.50", "network": "base" },
      "content": { ... }
    }
  ],
  "failed": [
    {
      "ual": "did:dkg:otp:2043/.../note-999",
      "error": "No private content found"
    }
  ]
}
```

**Notes:**
- All successful notes are returned with their content
- Failed notes are listed separately with error messages
- If all notes fail, returns 404 status
- Total price is calculated by summing individual note prices

## MCP Tools

### 1. `search-premium-notes`
Search for bias detection notes by topic, category, reliability.

**Input:**
```typescript
{
  topic?: string,
  category?: "factualError" | "missingContext" | "sourceProblem",
  minReliability?: number,
  isPremium?: boolean,
  limit?: number
}
```

**Output:**
Formatted list of notes with summary information.

### 2. `preview-note`
Get public metadata for a specific note.

**Input:**
```typescript
{
  ual: string
}
```

**Output:**
Note metadata with premium status and pricing.

### 3. `get-premium-note`
Access premium note content (will require payment via x402 in future).

**Input:**
```typescript
{
  ual: string
}
```

**Output:**
Full private note content.

### 4. `batch-purchase-notes`
Purchase and access multiple premium notes in a single transaction.

**Input:**
```typescript
{
  uals: string[]  // Array of note UALs
}
```

**Output:**
Batch purchase summary with total price, all note contents, and any failures.

**Example Usage:**
```
User: "I want to purchase notes 3, 4, and 5"
Agent: Extracts UALs from search results and calls batch-purchase-notes
```

## Testing

### Test Search Endpoint

```bash
# Search for climate-related notes
curl "http://localhost:9200/api/notes/search?topic=climate"

# Search for premium notes with high reliability
curl "http://localhost:9200/api/notes/search?isPremium=true&minReliability=0.9"

# Search by category
curl "http://localhost:9200/api/notes/search?category=factualError"
```

### Test Preview Endpoint

```bash
# Preview a specific note
curl "http://localhost:9200/api/notes/did:dkg:otp:2043/.../note-123"
```

### Test Private Content Endpoint

```bash
# Get private content (currently no payment required)
curl "http://localhost:9200/api/notes/did:dkg:otp:2043/.../note-123/private"
```

### Test Batch Purchase Endpoint

```bash
# Purchase multiple notes at once
curl -X POST "http://localhost:9200/api/notes/batch-purchase" \
  -H "Content-Type: application/json" \
  -d '{
    "uals": [
      "did:dkg:otp:2043/.../note-123",
      "did:dkg:otp:2043/.../note-456",
      "did:dkg:otp:2043/.../note-789"
    ]
  }'
```

### Test MCP Tools

In the chat UI, you can now use:
```
User: "Search for premium notes about climate change"
Agent: Uses search-premium-notes tool

User: "Show me details on the first note"
Agent: Uses preview-note tool

User: "Get the full content"
Agent: Uses get-premium-note tool

User: "I want to purchase notes 3, 4, and 5"
Agent: Uses batch-purchase-notes tool with UALs from search results
```

## Next Steps

### Phase 1: ✅ COMPLETED
- [x] Create search service with SPARQL logic
- [x] Implement API endpoints (search, preview, private, batch-purchase)
- [x] Create MCP tools (search, preview, single purchase, batch purchase)
- [x] Register in plugin system

### Phase 2: ✅ COMPLETED - x402 Payment Protection
- [x] Install x402-express package
- [x] Add payment middleware to `/api/notes/:ual/private` endpoint
- [x] Add payment middleware to `/api/notes/batch-purchase` endpoint
- [x] Configure Base Sepolia USDC token (0x036CbD53842c5426634e7929541eC2318f3dCF7e)
- [x] Set price to $0.001 USDC per note
- [x] Configure testnet facilitator (https://x402.org/facilitator)

### Phase 3: TODO - Configure Wallet & Test
1. Set `PAYMENT_WALLET_ADDRESS` environment variable to your wallet address
2. Test payment flow with MetaMask on Base Sepolia
3. Verify x402 prompts payment correctly
4. Test both single and batch purchases

### Phase 4: TODO - Create Note Format
Your friend needs to modify bias detector to:
1. Extract array of notes from bias report
2. Create individual DKG assets per note
3. Use public/private split based on reliability threshold

## Environment Variables

Add to `.env`:
```bash
# API base URL (for MCP tools)
API_BASE_URL=http://localhost:9200

# Payment wallet (REQUIRED for x402)
PAYMENT_WALLET_ADDRESS=0xYourWalletAddress...

# x402 Configuration (already set in code)
# USDC Contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia)
# Network: base-sepolia
# Price: $0.001 USDC per note
# Facilitator: https://x402.org/facilitator
```

## x402 Payment Flow

When a user or AI agent requests premium content:

1. **Initial Request**: Client calls `/api/notes/:ual/private` or `/api/notes/batch-purchase`
2. **402 Response**: x402 middleware intercepts and returns HTTP 402 Payment Required with payment details:
   ```json
   {
     "price": "$0.001",
     "network": "base-sepolia",
     "tokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
     "recipient": "0xYourWallet..."
   }
   ```
3. **Payment Prompt**: Browser/MCP client detects 402 and prompts MetaMask
4. **User Approves**: User reviews transaction in MetaMask and approves USDC transfer
5. **Payment Proof**: Client retries request with `X-PAYMENT` header containing cryptographic proof
6. **Verification**: x402 middleware verifies payment on-chain via facilitator
7. **Content Delivered**: If valid, endpoint returns private note content

**Key Benefits:**
- No backend payment tracking needed (stateless)
- Cryptographic proof prevents fraud
- Nonce prevents replay attacks
- Works seamlessly with AI agents via MCP

## Architecture

```
User/AI Agent
    ↓
MCP Tools (thin wrappers)
    ↓
x402 Payment Middleware (intercepts private endpoints)
    ↓
HTTP API Endpoints
    ↓
NoteSearchService (search logic)
    ↓
DKG Network (SPARQL queries)
```

## Notes

- Search logic uses SPARQL queries against DKG
- All filtering happens at query level (efficient)
- MCP tools call HTTP endpoints (reusable)
- Private endpoint ready for x402 protection
- No database needed (DKG is the database)
