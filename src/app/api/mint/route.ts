import { NextRequest, NextResponse } from "next/server";
import { getTeam, getTeamByMemberWallet, readStore, writeStore } from "@/lib/store";
import { generateTraits, traitsToAttributes, calculateRarityScore } from "@/lib/traitEngine";
import { serverMintNFT, serverUploadImageToIPFS, serverUploadMetadataToIPFS, isValidHederaAccountId, HederaCredentials } from "@/lib/hederaServer";
import { DEFAULT_TIERS } from "@/lib/tierConfig";
import { TierLevel, NFTMetadata } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {

    case "preview": {
      const { teamId } = body;
      const store = readStore();
      const team  = store.teams.find(t => t.id === teamId);
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const categories = (store.layers ?? []).map(l => l.name.toLowerCase());
      const traits = generateTraits(store.traitPool ?? [], categories, team.currentTier as TierLevel, teamId);
      return NextResponse.json({ traits, attributes: traitsToAttributes(traits), rarityScore: calculateRarityScore(traits), tier: team.currentTier });
    }

    case "mint":
    case "batch_mint": {
      const { teamId, memberId, walletAddress, credentials, pinataApiKey, pinataApiSecret, compositeImage } = body;

      if (!credentials?.accountId || !credentials?.privateKey || !credentials?.network)
        return NextResponse.json({ error: "Hedera credentials required" }, { status: 400 });
      if (!isValidHederaAccountId(credentials.accountId))
        return NextResponse.json({ error: "Invalid Hedera account ID" }, { status: 400 });
      if (!pinataApiKey || !pinataApiSecret)
        return NextResponse.json({ error: "Pinata credentials required" }, { status: 400 });

      const store = readStore();
      if (!store.tokenId)
        return NextResponse.json({ error: "NFT collection not created yet — complete Collection Setup first" }, { status: 503 });

      const team = store.teams.find(t => t.id === teamId);
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const member = team.members.find(m => m.id === memberId);
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      if (member.mintedNFT) return NextResponse.json({ error: "Already minted" }, { status: 409 });

      const creds: HederaCredentials = credentials;
      const categories = (store.layers ?? []).sort((a,b) => a.order - b.order).map(l => l.name.toLowerCase());
      const traits      = generateTraits(store.traitPool ?? [], categories, team.currentTier as TierLevel);
      const attributes  = traitsToAttributes(traits);
      const rarityScore = calculateRarityScore(traits);

      // Upload composite image to IPFS
      let imageUri = "ipfs://no-image";
      if (compositeImage && pinataApiKey && pinataApiSecret) {
        const imgResult = await serverUploadImageToIPFS(
          compositeImage,
          `${teamId}-${memberId}.png`, pinataApiKey, pinataApiSecret
        );
        if (imgResult.success && imgResult.ipfsUri) imageUri = imgResult.ipfsUri;
      }

      // Build HIP-412 metadata
      const metadata: NFTMetadata = {
        name:        `${store.collectionName} — ${team.name}`,
        description: `Earned by ${member.name} of ${team.name} for fundraising to support children with pediatric cancer.`,
        image:       imageUri,
        edition:     Math.floor(Math.random() * 99999),
        attributes,
        properties: {
          team: team.name, teamId: team.id, member: member.name, memberId: member.id,
          donationTotal: team.donationTotal, tier: team.currentTier,
          tierName: DEFAULT_TIERS[(team.currentTier as number) - 1]?.label ?? "Common",
          rarityScore, mintedAt: new Date().toISOString(),
          charity: "Pediatric Cancer Research Foundation", network: creds.network,
        },
      };

      const metaResult = await serverUploadMetadataToIPFS(metadata, `meta-${teamId}-${memberId}.json`, pinataApiKey, pinataApiSecret);
      if (!metaResult.success || !metaResult.ipfsUri)
        return NextResponse.json({ error: `Metadata upload failed: ${metaResult.error}` }, { status: 502 });

      const mintResult = await serverMintNFT(creds, store.tokenId, walletAddress, metaResult.ipfsUri);
      if (!mintResult.success || !mintResult.serialNumber)
        return NextResponse.json({ error: `Hedera mint failed: ${mintResult.error}` }, { status: 502 });

      // Record mint
      const freshStore  = readStore();
      const freshTeam   = freshStore.teams.find(t => t.id === teamId);
      const freshMember = freshTeam?.members.find(m => m.id === memberId);
      if (freshMember) {
        freshMember.mintedNFT = {
          serialNumber:  mintResult.serialNumber,
          tokenId:       store.tokenId,
          transactionId: mintResult.transactionId ?? "",
          metadata,
          mintedAt:      new Date().toISOString(),
          walletAddress,
        };
        writeStore(freshStore);
      }

      return NextResponse.json({
        success: true, serialNumber: mintResult.serialNumber,
        transactionId: mintResult.transactionId, imageUri, metadataUri: metaResult.ipfsUri, rarityScore,
      });
    }

    case "lookup_wallet": {
      const { walletAddress } = body;
      const team = getTeamByMemberWallet(walletAddress);
      if (!team) return NextResponse.json({ team: null });
      const member = team.members.find(m => m.walletAddress === walletAddress);
      return NextResponse.json({ team, member });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
