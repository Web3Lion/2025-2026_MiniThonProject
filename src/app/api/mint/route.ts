import { NextRequest, NextResponse } from "next/server";
import { getTeamByMemberWallet, readStore, writeStore } from "@/lib/store";
import { generateTraits, traitsToAttributes, calculateRarityScore } from "@/lib/traitEngine";
import { serverMintNFT, serverUploadImageToIPFS, serverUploadMetadataToIPFS, isValidHederaAccountId, HederaCredentials } from "@/lib/hederaServer";
import { DEFAULT_TIERS } from "@/lib/tierConfig";
import { TierLevel } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {

    case "preview": {
      const { teamId } = body;
      const store = readStore();
      const team  = store.teams.find(t => t.id === teamId);
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const categories = (store.layers ?? []).sort((a,b)=>a.order-b.order).map(l => l.name.toLowerCase());
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
        return NextResponse.json({ error: "Pinata API key and secret required" }, { status: 400 });

      const store = readStore();
      if (!store.tokenId)
        return NextResponse.json({ error: "NFT collection not created yet — complete Collection Setup → Step 3 first" }, { status: 503 });

      const team = store.teams.find(t => t.id === teamId);
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const member = team.members.find(m => m.id === memberId);
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      if (member.mintedNFT) return NextResponse.json({ error: "This member has already minted their NFT" }, { status: 409 });

      const creds: HederaCredentials = credentials;
      const categories = (store.layers ?? []).sort((a,b) => a.order - b.order).map(l => l.name.toLowerCase());
      const traits      = generateTraits(store.traitPool ?? [], categories, team.currentTier as TierLevel);
      const attributes  = traitsToAttributes(traits);
      const rarityScore = calculateRarityScore(traits);
      const tierName    = DEFAULT_TIERS[(team.currentTier as number) - 1]?.label ?? "Common";

      // 1. Upload composite image to IPFS
      let imageUri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // placeholder
      if (compositeImage) {
        const imgResult = await serverUploadImageToIPFS(
          compositeImage,
          `minthon-${teamId}-${memberId}.png`,
          pinataApiKey, pinataApiSecret
        );
        if (imgResult.success && imgResult.ipfsUri) imageUri = imgResult.ipfsUri;
        else console.warn("[Mint] Image upload failed:", imgResult.error);
      }

      // 2. Build HIP-412 compliant metadata
      const hip412Metadata = {
        name:        `${store.collectionName} — ${member.name}`,
        creator:     "Minthon Pediatric Cancer Fundraiser",
        description: `This NFT was earned by ${member.name} of team "${team.name}" through fundraising for children with pediatric cancer. Every donation made a difference.`,
        image:       imageUri,
        type:        "image/png",
        format:      "HIP412@2.0.0",
        attributes:  attributes.map((a: { trait_type: string; value: string }) => ({
          trait_type: a.trait_type,
          value:      a.value,
        })),
        properties: {
          files: [
            { uri: imageUri, type: "image/png", is_default_file: true }
          ],
          team:          team.name,
          member:        member.name,
          donationTotal: `$${(team.donationTotal / 100).toFixed(2)}`,
          tier:          team.currentTier,
          tierName,
          rarityScore,
          mintedAt:      new Date().toISOString(),
          charity:       "Pediatric Cancer Research Foundation",
          network:       creds.network,
        },
      };

      // 3. Upload metadata JSON to IPFS
      const metaResult = await serverUploadMetadataToIPFS(
        hip412Metadata,
        `minthon-meta-${teamId}-${memberId}.json`,
        pinataApiKey, pinataApiSecret
      );
      if (!metaResult.success || !metaResult.ipfsUri)
        return NextResponse.json({ error: `Metadata upload failed: ${metaResult.error}` }, { status: 502 });

      // 4. Mint on Hedera + transfer to student wallet
      const mintResult = await serverMintNFT(creds, store.tokenId, walletAddress, metaResult.ipfsUri);
      if (!mintResult.success || !mintResult.serialNumber)
        return NextResponse.json({ error: `Hedera mint failed: ${mintResult.error}` }, { status: 502 });

      // 5. Record in store
      const freshStore  = readStore();
      const freshTeam   = freshStore.teams.find(t => t.id === teamId);
      const freshMember = freshTeam?.members.find(m => m.id === memberId);
      if (freshMember) {
        freshMember.mintedNFT = {
          serialNumber:  mintResult.serialNumber,
          tokenId:       store.tokenId,
          transactionId: mintResult.transactionId ?? "",
          metadata:      hip412Metadata as any,
          mintedAt:      new Date().toISOString(),
          walletAddress,
        };
        writeStore(freshStore);
      }

      return NextResponse.json({
        success:       true,
        serialNumber:  mintResult.serialNumber,
        transactionId: mintResult.transactionId,
        imageUri,
        metadataUri:   metaResult.ipfsUri,
        rarityScore,
        tierName,
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