# Minthon 🎗️

**Generative NFT fundraiser for pediatric cancer — built on Hedera**

Each student team earns a unique NFT based on how much they fundraise. Higher donation totals unlock rarer traits. Every NFT lives permanently on the Hedera blockchain.

---

## How It Works

| Tier | Name | Min Donations | Guarantee |
|------|------|--------------|-----------|
| 1 | Common | Any | Standard traits |
| 2 | Uncommon | $50+ | At least 1 Uncommon trait |
| 3 | Rare | $150+ | At least 1 Rare trait |
| 4 | Epic | $350+ | At least 1 Epic trait |
| 5 | Legendary | $750+ | At least 1 Legendary trait |

Each NFT has **6 trait categories**: Background, Body, Eyes, Accessory, Special, Aura.

The "hero trait" (guaranteed rare slot) is randomly assigned to one category. Remaining traits are drawn from the team's tier and below, weighted by rarity.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### 3. Create a free Hedera testnet account
1. Go to [portal.hedera.com](https://portal.hedera.com)
2. Create an account → get your Account ID (`0.0.XXXXX`) and private key
3. Add them to `.env.local`
4. Testnet accounts come pre-loaded with test HBAR — no real money needed

### 4. Set up Pinata (IPFS storage)
1. Go to [pinata.cloud](https://pinata.cloud) — free tier works
2. Create API keys → add to `.env.local`

### 5. Add your NFT artwork
Place trait images in `/public/traits/{category}/` matching the filenames in `src/lib/tierConfig.ts`:
```
public/
  traits/
    background/  sky-blue.png, sunset.png, aurora.png ...
    body/        hoodie.png, jersey.png, superhero.png ...
    eyes/        bright.png, starry.png, glowing.png ...
    accessory/   ribbon.png, trophy.png, crown.png ...
    special/     sparkle.png, lightning.png, big-bang.png ...
    aura/        warm-glow.png, radiant.png, transcendent.png ...
```

### 6. Run the dev server
```bash
npm run dev
# Open http://localhost:3000
```

---

## Workflow

### For the teacher (admin)

1. Go to `/admin`
2. **Create teams** — one per student team
3. **Add members** — enter each student's name and Hedera wallet address
4. **Record donations** as they come in — the tier updates automatically
5. **Preview NFTs** to see what traits a team will get before minting
6. When ready, students go to `/mint` to claim their NFTs

### For students

1. Install [HashPack wallet](https://www.hashpack.app) (free Chrome extension or mobile app)
2. Create a Hedera account in HashPack
3. Give your Account ID (format: `0.0.12345`) to your teacher
4. Go to `/mint`, enter your Account ID
5. Preview your NFT traits, then click "Mint"
6. Your NFT arrives in your HashPack wallet in ~3 seconds

---

## Creating the NFT Collection (One-Time Setup)

Before anyone can mint, the teacher needs to create the Hedera HTS token (the NFT collection). Add this script to your project:

```typescript
// scripts/createCollection.ts
import { createNFTCollection } from "../src/lib/hedera";
import { setTokenId } from "../src/lib/store";

async function main() {
  const result = await createNFTCollection(
    {
      network: "testnet",
      treasuryAccountId: process.env.HEDERA_TREASURY_ID!,
      treasuryPrivateKey: process.env.HEDERA_TREASURY_KEY!,
    },
    "Minthon 2025 — Cure Kids Cancer",
    "MNTH25",
    500 // max NFTs
  );

  if (result.success) {
    console.log("Token ID:", result.tokenId);
    setTokenId(result.tokenId!);
  } else {
    console.error("Failed:", result.error);
  }
}

main();
```

Run with: `npx ts-node scripts/createCollection.ts`

Then paste the Token ID into the Admin → Settings page.

---

## Customizing Tiers

Edit `src/lib/tierConfig.ts`:

```typescript
export const DEFAULT_TIERS: Tier[] = [
  { level: 1, label: "Common",     minDonation: 0,      ... },
  { level: 2, label: "Uncommon",   minDonation: 5000,   ... }, // $50
  { level: 3, label: "Rare",       minDonation: 15000,  ... }, // $150
  { level: 4, label: "Epic",       minDonation: 35000,  ... }, // $350
  { level: 5, label: "Legendary",  minDonation: 75000,  ... }, // $750
];
```

All amounts are in **cents** (avoids float issues). `5000` = $50.

---

## Customizing Traits

Add/remove traits in the `TRAIT_POOL` array in `tierConfig.ts`. Each trait needs:
- `id` — unique string
- `name` — display name on the NFT
- `category` — one of: background, body, eyes, accessory, special, aura
- `tier` — 1–5
- `imageFile` — filename in `/public/traits/{category}/`
- `weight` — relative likelihood within the tier (higher = more common)

---

## Project Structure

```
src/
  app/
    page.tsx          ← Landing page
    admin/page.tsx    ← Teacher dashboard
    mint/page.tsx     ← Student mint page
    api/
      teams/          ← Team & member management
      donations/      ← Donation recording
      mint/           ← NFT preview & minting
  lib/
    tierConfig.ts     ← Tier thresholds & trait pool
    traitEngine.ts    ← Generative trait selection algorithm
    hedera.ts         ← Hedera HTS & Pinata integration
    store.ts          ← Data persistence
  types/
    index.ts          ← All TypeScript types
data/
  store.json          ← Auto-created, stores all team/donation data
public/
  traits/             ← Your NFT artwork goes here
```

---

## Deployment

### Vercel (recommended, free)
```bash
npm install -g vercel
vercel
# Follow prompts, add env vars in Vercel dashboard
```

### Important for production
- Switch `HEDERA_NETWORK=mainnet` when ready for real HBAR
- Replace `data/store.json` with a real database (Supabase is free and easy)
- Add authentication to `/admin` (NextAuth.js works well)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Blockchain | Hedera Hashgraph (HTS — Hedera Token Service) |
| NFT Standard | HIP-412 (Hedera Improvement Proposal) |
| Storage | IPFS via Pinata |
| Wallet | HashPack (browser extension + mobile) |

---

*Built with ❤️ for children with pediatric cancer.*
