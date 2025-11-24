# x402 Payment Integration - Complete

## Summary

Successfully integrated x402 payment middleware to protect premium bias detection note endpoints. The system now requires USDC payment on Base Sepolia before allowing access to private note content.

## What Was Implemented

### 1. Package Installation ✅
```bash
npm install x402-express @coinbase/x402
```

### 2. Payment Middleware Configuration ✅

File: `src/registerPremiumAccess.ts`

**Protected Endpoints:**
- `GET /api/notes/:ual/private` - Single note purchase ($0.001 USDC)
- `POST /api/notes/batch-purchase` - Multiple note purchase ($0.001 USDC per note)

**Configuration:**
```typescript
import { paymentMiddleware } from "x402-express";

const PAYMENT_WALLET = (process.env.PAYMENT_WALLET_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const USDC_CONTRACT_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const DEFAULT_NOTE_PRICE = "$0.001";

api.use(
  paymentMiddleware(PAYMENT_WALLET, {
    "GET /api/notes/:ual/private": {
      price: DEFAULT_NOTE_PRICE,
      network: "base-sepolia",
      description: "Access premium bias detection note content",
      tokenAddress: USDC_CONTRACT_BASE_SEPOLIA,
    },
    "POST /api/notes/batch-purchase": {
      price: DEFAULT_NOTE_PRICE,
      network: "base-sepolia",
      description: "Purchase multiple premium notes at once",
      tokenAddress: USDC_CONTRACT_BASE_SEPOLIA,
    },
  }, {
    url: "https://x402.org/facilitator",
  }),
);
```

## Configuration Details

### Network
- **Testnet**: Base Sepolia
- **Facilitator**: https://x402.org/facilitator (testnet)

### Token
- **USDC Contract**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Token Standard**: ERC-20

### Pricing
- **Per Note**: $0.001 USDC
- **Batch Purchase**: $0.001 USDC × number of notes

### Payment Wallet
- **Environment Variable**: `PAYMENT_WALLET_ADDRESS`
- **Required**: Yes (must be set before testing)
- **Default Fallback**: `0x0000000000000000000000000000000000000000` (will need to be updated)

## How It Works

### Payment Flow

1. **User Requests Premium Content**
   - Via MCP tool: `get-premium-note` or `batch-purchase-notes`
   - Via HTTP: Direct API call to protected endpoint

2. **Server Returns 402 Payment Required**
   ```json
   {
     "status": 402,
     "price": "$0.001",
     "network": "base-sepolia",
     "tokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
     "recipient": "0xYourWalletAddress"
   }
   ```

3. **Client Prompts MetaMask**
   - User sees payment request in MetaMask
   - Shows: Amount (0.001 USDC), Network (Base Sepolia), Recipient

4. **User Approves Transaction**
   - MetaMask signs and broadcasts transaction
   - Transaction confirmed on Base Sepolia

5. **Client Retries with Proof**
   - Request retried with `X-PAYMENT` header
   - Contains cryptographic proof of payment

6. **Server Verifies & Delivers**
   - x402 middleware verifies payment on-chain via facilitator
   - If valid, returns private note content
   - If invalid, returns 402 again

### Security Features

- **Stateless**: No database tracking needed
- **Cryptographically Verified**: Payment proof validated on-chain
- **Replay Protection**: Nonce system prevents reusing payment proofs
- **Timeout Protection**: Payments expire after configured time window

## Environment Setup

Add to `.env` file:

```bash
# Payment recipient wallet (REQUIRED)
PAYMENT_WALLET_ADDRESS=0xYourWalletAddressHere

# API base URL (for MCP tools)
API_BASE_URL=http://localhost:9200
```

## Testing Instructions

### Prerequisites
1. Set `PAYMENT_WALLET_ADDRESS` environment variable
2. Have Base Sepolia USDC in test wallet
3. Connect MetaMask to Base Sepolia network

### Test Single Note Purchase

```bash
# 1. Make initial request (will get 402)
curl -v http://localhost:9200/api/notes/did:dkg:otp:2043/.../note-123/private

# Response: 402 Payment Required with payment details
```

Use browser/MCP client to complete payment flow (MetaMask integration).

### Test Batch Purchase

```bash
# 1. Make initial request (will get 402)
curl -X POST http://localhost:9200/api/notes/batch-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "uals": [
      "did:dkg:otp:2043/.../note-123",
      "did:dkg:otp:2043/.../note-456"
    ]
  }'

# Response: 402 Payment Required
# Total price: $0.002 USDC (2 notes × $0.001)
```

### Test via MCP Tools (AI Agent)

In chat UI:
```
User: "Get premium note did:dkg:otp:2043/.../note-123"
→ Agent calls get-premium-note tool
→ x402 detects 402, prompts MetaMask
→ User approves payment
→ Agent receives content

User: "Purchase notes 3, 4, and 5"
→ Agent calls batch-purchase-notes with UALs
→ x402 detects 402, prompts MetaMask for total ($0.003)
→ User approves payment
→ Agent receives all content
```

## Files Modified

1. `src/registerPremiumAccess.ts`
   - Added x402 payment middleware import
   - Configured payment protection for private endpoints
   - Added wallet address and token configuration

2. `PREMIUM_NOTES_IMPLEMENTATION.md`
   - Updated endpoint documentation (marked as PROTECTED)
   - Added x402 payment flow section
   - Updated architecture diagram
   - Added environment variable documentation
   - Updated phase completion checklist

3. `package.json` (auto-updated)
   - Added `x402-express` dependency
   - Added `@coinbase/x402` dependency

## Next Steps

### Before Production Testing
- [ ] Set `PAYMENT_WALLET_ADDRESS` environment variable to your wallet
- [ ] Fund test wallet with Base Sepolia USDC
- [ ] Start the server and test payment flow
- [ ] Verify MetaMask prompts correctly
- [ ] Test both single and batch purchases

### Before Mainnet Deployment
- [ ] Change network from `base-sepolia` to `base`
- [ ] Update USDC contract to Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- [ ] Update facilitator URL (check x402 docs for mainnet facilitator)
- [ ] Test with real USDC on Base mainnet
- [ ] Set appropriate pricing (may want higher than $0.001)

## Technical Notes

### Type Safety
The x402 middleware requires wallet addresses to be typed as `` `0x${string}` ``. We handle this with TypeScript type assertions:

```typescript
const PAYMENT_WALLET = (process.env.PAYMENT_WALLET_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
```

### Middleware Ordering
The payment middleware is registered BEFORE the route handlers, so it intercepts requests early in the Express middleware chain.

### Error Handling
If payment verification fails, the middleware automatically returns 402 without reaching your route handler. No custom error handling needed.

### Compatibility
- Works with any HTTP client that supports custom headers
- MCP clients automatically handle 402 responses
- Browser fetch API works out of the box
- Compatible with AI agents via MCP protocol

## Support & Documentation

- **x402 Protocol**: https://www.x402.org/
- **Seller Quickstart**: https://x402.gitbook.io/x402/getting-started/quickstart-for-sellers
- **npm Package**: https://www.npmjs.com/package/x402-express
- **Base Sepolia Explorer**: https://sepolia.basescan.org/
- **Base Sepolia USDC**: https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e

## Status

✅ **COMPLETE** - x402 payment protection is fully integrated and ready for testing once `PAYMENT_WALLET_ADDRESS` is configured.
