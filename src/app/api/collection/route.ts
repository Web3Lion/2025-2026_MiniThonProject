import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore, setTokenId } from "@/lib/store";
import { TraitOption, Tier, TierLevel } from "@/types";

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    tokenId: store.tokenId,
    collectionName: store.collectionName,
    tiers: store.tiers,
    traitPool: store.traitPool ?? [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    // ── Save Hedera token ID ──────────────────────────────────────────────────
    case "set_token_id": {
      const { tokenId } = body;
      if (!tokenId?.trim()) {
        return NextResponse.json({ error: "Token ID required" }, { status: 400 });
      }
      setTokenId(tokenId.trim());
      return NextResponse.json({ success: true });
    }

    // ── Save collection name ──────────────────────────────────────────────────
    case "set_collection_name": {
      const { name } = body;
      const store = readStore();
      store.collectionName = name;
      writeStore(store);
      return NextResponse.json({ success: true });
    }

    // ── Update tier unlock thresholds ─────────────────────────────────────────
    case "update_tiers": {
      const { tiers }: { tiers: Tier[] } = body;
      const store = readStore();
      // Validate: tiers must be ascending, level 1 must be $0
      for (let i = 1; i < tiers.length; i++) {
        if (tiers[i].minDonation <= tiers[i - 1].minDonation) {
          return NextResponse.json(
            { error: `Tier ${tiers[i].level} unlock must be greater than Tier ${tiers[i - 1].level}` },
            { status: 400 }
          );
        }
      }
      store.tiers = tiers;
      // Recalculate all team tiers based on new thresholds
      for (const team of store.teams) {
        const sorted = [...tiers].sort((a, b) => b.minDonation - a.minDonation);
        const matched = sorted.find((t) => team.donationTotal >= t.minDonation);
        team.currentTier = (matched?.level ?? 1) as TierLevel;
      }
      writeStore(store);
      return NextResponse.json({ success: true, tiers: store.tiers });
    }

    // ── Save trait pool (from trait editor) ───────────────────────────────────
    case "save_traits": {
      const { traits }: { traits: TraitOption[] } = body;
      const store = readStore();
      store.traitPool = traits;
      writeStore(store);
      return NextResponse.json({ success: true, count: traits.length });
    }

    // ── Update a single trait's tier assignment ───────────────────────────────
    case "update_trait_tier": {
      const { traitId, tier }: { traitId: string; tier: TierLevel } = body;
      const store = readStore();
      const pool = store.traitPool ?? [];
      const trait = pool.find((t) => t.id === traitId);
      if (!trait) {
        return NextResponse.json({ error: "Trait not found" }, { status: 404 });
      }
      trait.tier = tier;
      store.traitPool = pool;
      writeStore(store);
      return NextResponse.json({ success: true, trait });
    }

    // ── Batch mint — all eligible unminted members ────────────────────────────
    case "batch_mint_preview": {
      const store = readStore();
      const eligible: Array<{
        teamId: string;
        teamName: string;
        tier: TierLevel;
        memberId: string;
        memberName: string;
        walletAddress: string;
      }> = [];

      for (const team of store.teams) {
        for (const member of team.members) {
          if (member.walletAddress && !member.mintedNFT) {
            eligible.push({
              teamId: team.id,
              teamName: team.name,
              tier: team.currentTier as TierLevel,
              memberId: member.id,
              memberName: member.name,
              walletAddress: member.walletAddress,
            });
          }
        }
      }

      return NextResponse.json({
        eligible,
        totalEligible: eligible.length,
        missingWallet: store.teams.flatMap((t) =>
          t.members
            .filter((m) => !m.walletAddress && !m.mintedNFT)
            .map((m) => ({ teamName: t.name, memberName: m.name }))
        ),
        alreadyMinted: store.teams.flatMap((t) =>
          t.members
            .filter((m) => m.mintedNFT)
            .map((m) => ({ teamName: t.name, memberName: m.name, serial: m.mintedNFT!.serialNumber }))
        ),
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
