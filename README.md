import { NextRequest, NextResponse } from "next/server";
import { getTeam, getTeamByMemberWallet, readStore } from "@/lib/store";
import { generateTraits, traitsToAttributes, calculateRarityScore } from "@/lib/traitEngine";
import { mintNFT, uploadMetadataToIPFS } from "@/lib/hedera";
import { NFTMetadata, TierLevel } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    // ── Preview traits (no minting, no side effects) ──────────────────────────
    case "preview": {
      const { teamId } = body;
      const team = getTeam(teamId);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      // Deterministic preview using team ID as seed
      const traits = generateTraits(team.currentTier as TierLevel, teamId);
      const attributes = traitsToAttributes(traits);
      const rarityScore = calculateRarityScore(traits);
      return NextResponse.json({ traits, attributes, rarityScore, tier: team.currentTier });
    }

    // ── Mint NFT for a team member ────────────────────────────────────────────
    case "mint": {
      const { teamId, memberId, walletAddress } = body;

      if (!teamId || !memberId || !walletAddress) {
        return NextResponse.json(
          { error: "teamId, memberId, and walletAddress required" },
          { status: 400 }
        );
      }

      const team = getTeam(teamId);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      const member = team.members.find((m) => m.id === memberId);
      if (!member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      if (member.mintedNFT) {
        return NextResponse.json(
          { error: "This member has already minted their NFT" },
          { status: 409 }
        );
      }

      const store = readStore();
      if (!store.tokenId) {
        return NextResponse.json(
          { error: "NFT collection not yet created. Admin must set up the Hedera token first." },
          { status: 503 }
        );
      }

      // 1. Generate traits (fresh random — not seeded)
      const traits = generateTraits(team.currentTier as TierLevel);
      const attributes = traitsToAttributes(traits);
      const rarityScore = calculateRarityScore(traits);

      // 2. Build HIP-412 metadata
      const metadata: NFTMetadata = {
        name: `${store.collectionName} #${Date.now()}`,
        description: `This NFT was earned by ${team.name} for raising funds to support children with pediatric cancer. Thank you for making a difference.`,
        image: "ipfs://placeholder", // Updated after IPFS upload
        edition: Math.floor(Math.random() * 9999),
        attributes,
        properties: {
          team: team.name,
          teamId: team.id,
          donationTotal: team.donationTotal,
          mintedAt: new Date().toISOString(),
          highestTier: team.currentTier as TierLevel,
          charity: "Pediatric Cancer Research Foundation",
        },
      };

      // 3. Upload metadata to IPFS
      if (!process.env.PINATA_API_KEY || !process.env.PINATA_API_SECRET) {
        return NextResponse.json(
          { error: "IPFS credentials not configured (PINATA_API_KEY / PINATA_API_SECRET)" },
          { status: 503 }
        );
      }

      const ipfsResult = await uploadMetadataToIPFS(metadata, {
        apiKey: process.env.PINATA_API_KEY,
        apiSecret: process.env.PINATA_API_SECRET,
      });

      if (!ipfsResult.success || !ipfsResult.ipfsUri) {
        return NextResponse.json(
          { error: `IPFS upload failed: ${ipfsResult.error}` },
          { status: 502 }
        );
      }

      metadata.image = ipfsResult.ipfsUri;

      // 4. Mint on Hedera
      if (!process.env.HEDERA_TREASURY_ID || !process.env.HEDERA_TREASURY_KEY) {
        return NextResponse.json(
          { error: "Hedera credentials not configured" },
          { status: 503 }
        );
      }

      const mintResult = await mintNFT(
        {
          network: (process.env.HEDERA_NETWORK as "testnet" | "mainnet") ?? "testnet",
          treasuryAccountId: process.env.HEDERA_TREASURY_ID,
          treasuryPrivateKey: process.env.HEDERA_TREASURY_KEY,
          tokenId: store.tokenId,
        },
        walletAddress,
        ipfsResult.ipfsUri
      );

      if (!mintResult.success || !mintResult.serialNumber) {
        return NextResponse.json(
          { error: `Hedera mint failed: ${mintResult.error}` },
          { status: 502 }
        );
      }

      // 5. Record mint in store
      const { writeStore } = await import("@/lib/store");
      const freshStore = (await import("@/lib/store")).readStore();
      const freshTeam = freshStore.teams.find((t) => t.id === teamId);
      const freshMember = freshTeam?.members.find((m) => m.id === memberId);
      if (freshMember) {
        freshMember.mintedNFT = {
          serialNumber: mintResult.serialNumber,
          tokenId: store.tokenId,
          transactionId: mintResult.transactionId ?? "",
          metadata,
          mintedAt: new Date().toISOString(),
          walletAddress,
        };
        writeStore(freshStore);
      }

      return NextResponse.json({
        success: true,
        serialNumber: mintResult.serialNumber,
        transactionId: mintResult.transactionId,
        ipfsUri: ipfsResult.ipfsUri,
        traits,
        attributes,
        rarityScore,
        metadata,
      });
    }

    // ── Lookup by wallet address (student dashboard) ──────────────────────────
    case "lookup_wallet": {
      const { walletAddress } = body;
      const team = getTeamByMemberWallet(walletAddress);
      if (!team) {
        return NextResponse.json({ team: null });
      }
      const member = team.members.find((m) => m.walletAddress === walletAddress);
      return NextResponse.json({ team, member });
    }

    // ── Record a mint completed client-side (batch mint) ─────────────────────
    case "record_mint": {
      const { teamId, memberId, serialNumber, transactionId, tokenId, metadata, walletAddress } = body;
      const { readStore, writeStore } = await import("@/lib/store");
      const store = readStore();
      const team = store.teams.find((t) => t.id === teamId);
      const member = team?.members.find((m) => m.id === memberId);
      if (member) {
        member.mintedNFT = { serialNumber, transactionId, tokenId, metadata, mintedAt: new Date().toISOString(), walletAddress };
        writeStore(store);
      }
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
