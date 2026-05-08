import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore, setTokenId } from "@/lib/store";
import { TraitOption, Tier, TierLevel, LayerDefinition } from "@/types";
import { serverCreateNFTCollection, isValidHederaAccountId, HederaCredentials } from "@/lib/hederaServer";

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    tokenId:        store.tokenId,
    collectionName: store.collectionName,
    tiers:          store.tiers,
    traitPool:      store.traitPool ?? [],
    layers:         store.layers ?? [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "set_token_id": {
      const { tokenId } = body;
      if (!tokenId?.trim()) return NextResponse.json({ error: "Token ID required" }, { status: 400 });
      setTokenId(tokenId.trim());
      return NextResponse.json({ success: true });
    }

    case "set_collection_name": {
      const store = readStore(); store.collectionName = body.name; writeStore(store);
      return NextResponse.json({ success: true });
    }

    case "save_layers": {
      const { layers }: { layers: LayerDefinition[] } = body;
      const store = readStore(); store.layers = layers; writeStore(store);
      return NextResponse.json({ success: true });
    }

    case "update_tiers": {
      const { tiers }: { tiers: Tier[] } = body;
      const store = readStore();
      for (let i = 1; i < tiers.length; i++) {
        if (tiers[i].minDonation <= tiers[i-1].minDonation)
          return NextResponse.json({ error: `Tier ${tiers[i].level} must be > Tier ${tiers[i-1].level}` }, { status: 400 });
      }
      store.tiers = tiers;
      for (const team of store.teams) {
        const sorted = [...tiers].sort((a, b) => b.minDonation - a.minDonation);
        team.currentTier = (sorted.find(t => team.donationTotal >= t.minDonation)?.level ?? 1) as TierLevel;
      }
      writeStore(store);
      return NextResponse.json({ success: true, tiers: store.tiers });
    }

    case "save_traits": {
      const { traits }: { traits: TraitOption[] } = body;
      const store = readStore(); store.traitPool = traits; writeStore(store);
      return NextResponse.json({ success: true, count: traits.length });
    }

    case "batch_mint_preview": {
      const store = readStore();
      const eligible = store.teams.flatMap(team =>
        team.members
          .filter(m => m.walletAddress && !m.mintedNFT)
          .map(m => ({ teamId: team.id, teamName: team.name, tier: team.currentTier as TierLevel, memberId: m.id, memberName: m.name, walletAddress: m.walletAddress! }))
      );
      return NextResponse.json({
        eligible,
        missingWallet: store.teams.flatMap(t => t.members.filter(m => !m.walletAddress && !m.mintedNFT).map(m => ({ teamName: t.name, memberName: m.name }))),
        alreadyMinted: store.teams.flatMap(t => t.members.filter(m => m.mintedNFT).map(m => ({ teamName: t.name, memberName: m.name, serial: m.mintedNFT!.serialNumber }))),
      });
    }

    case "create_token": {
      const { credentials, tokenConfig } = body;
      if (!credentials?.accountId || !credentials?.privateKey || !credentials?.network)
        return NextResponse.json({ error: "Hedera credentials required" }, { status: 400 });
      if (!isValidHederaAccountId(credentials.accountId))
        return NextResponse.json({ error: "Invalid Hedera account ID" }, { status: 400 });

      const result = await serverCreateNFTCollection(credentials as HederaCredentials, tokenConfig);
      if (result.success && result.tokenId) {
        setTokenId(result.tokenId);
        const store = readStore(); store.collectionName = tokenConfig.name; writeStore(store);
      }
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
