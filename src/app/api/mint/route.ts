import { NextRequest, NextResponse } from "next/server";
import { getTeamByMemberWallet, readStore, writeStore } from "@/lib/store";
import { generateTraits, traitsToAttributes, calculateRarityScore } from "@/lib/traitEngine";
import {
  serverMintNFT, serverTransferNFT,
  serverUploadImageToIPFS, serverUploadMetadataToIPFS,
  isValidHederaAccountId, HederaCredentials,
} from "@/lib/hederaServer";
import { DEFAULT_TIERS } from "@/lib/tierConfig";
import { TierLevel } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {

    // ── Preview traits (no mint) ──────────────────────────────────────────────
    case "preview": {
      const { teamId } = body;
      const store = readStore();
      const team  = store.teams.find(t => t.id === teamId);
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const categories = (store.layers ?? []).sort((a,b) => a.order-b.order).map(l => l.name.toLowerCase());
      const traits = generateTraits(store.traitPool ?? [], categories, team.currentTier as TierLevel, teamId);
      return NextResponse.json({
        traits,
        attributes: traitsToAttributes(traits),
        rarityScore: calculateRarityScore(traits),
        tier: team.currentTier,
      });
    }

    // ── Teacher pre-mints ONE member's NFT → stays in treasury ───────────────
    case "premint": {
      const { teamId, memberId, credentials, pinataApiKey, pinataApiSecret, compositeImage } = body;

      if (!credentials?.accountId || !credentials?.privateKey || !credentials?.network)
        return NextResponse.json({ error: "Hedera credentials required" }, { status: 400 });
      if (!pinataApiKey || !pinataApiSecret)
        return NextResponse.json({ error: "Pinata API key and secret required" }, { status: 400 });

      const store = readStore();
      if (!store.tokenId)
        return NextResponse.json({ error: "NFT collection not created yet" }, { status: 503 });

      const team   = store.teams.find(t => t.id === teamId);
      if (!team)   return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const member = team.members.find(m => m.id === memberId);
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      if (member.mintedNFT) return NextResponse.json({ error: "Already minted" }, { status: 409 });

      const creds: HederaCredentials = credentials;
      const categories = (store.layers ?? []).sort((a,b) => a.order-b.order).map(l => l.name.toLowerCase());
      const traits      = generateTraits(store.traitPool ?? [], categories, team.currentTier as TierLevel);
      const attributes  = traitsToAttributes(traits);
      const rarityScore = calculateRarityScore(traits);
      const tierName    = DEFAULT_TIERS[(team.currentTier as number) - 1]?.label ?? "Common";

      // 1. Upload image to IPFS
      let imageUri = "ipfs://placeholder";
      if (compositeImage) {
        const imgResult = await serverUploadImageToIPFS(
          compositeImage, `minthon-${teamId}-${memberId}.png`, pinataApiKey, pinataApiSecret
        );
        if (imgResult.success && imgResult.ipfsUri) imageUri = imgResult.ipfsUri;
      }

      // 2. Build HIP-412 metadata
      const metadata = {
        name:        `${store.collectionName} — ${member.name}`,
        creator:     "Minthon Pediatric Cancer Fundraiser",
        description: `This NFT was earned by ${member.name} of team "${team.name}" through fundraising for children with pediatric cancer.`,
        image:       imageUri,
        type:        "image/png",
        format:      "HIP412@2.0.0",
        attributes:  attributes.map((a: {trait_type:string;value:string}) => ({trait_type:a.trait_type,value:a.value})),
        properties: {
          files:         [{ uri: imageUri, type: "image/png", is_default_file: true }],
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

      // 3. Upload metadata to IPFS
      const metaResult = await serverUploadMetadataToIPFS(
        metadata, `minthon-meta-${teamId}-${memberId}.json`, pinataApiKey, pinataApiSecret
      );
      if (!metaResult.success || !metaResult.ipfsUri)
        return NextResponse.json({ error: `Metadata upload failed: ${metaResult.error}` }, { status: 502 });

      // 4. Mint to TREASURY (not to student yet!)
      // We pass the treasury account as recipient so it stays held
      const mintResult = await serverMintNFT(
        creds, store.tokenId,
        creds.accountId, // ← mint to treasury, NOT student wallet
        metaResult.ipfsUri
      );
      if (!mintResult.success || !mintResult.serialNumber)
        return NextResponse.json({ error: `Hedera mint failed: ${mintResult.error}` }, { status: 502 });

      // 5. Record as preminted — NOT yet claimed
      const freshStore  = readStore();
      const freshTeam   = freshStore.teams.find(t => t.id === teamId);
      const freshMember = freshTeam?.members.find(m => m.id === memberId);
      if (freshMember) {
        freshMember.mintedNFT = {
          serialNumber:  mintResult.serialNumber,
          tokenId:       store.tokenId,
          transactionId: mintResult.transactionId ?? "",
          metadata:      metadata as any,
          mintedAt:      new Date().toISOString(),
          walletAddress: member.walletAddress ?? "",
          status:        "preminted", // ← key: held in treasury
          imageUri,
          metadataUri:   metaResult.ipfsUri,
          compositeImageData: compositeImage, // store for claim preview
        };
        writeStore(freshStore);
      }

      return NextResponse.json({
        success:      true,
        serialNumber: mintResult.serialNumber,
        transactionId: mintResult.transactionId,
        imageUri,
        metadataUri:  metaResult.ipfsUri,
        rarityScore,
        tierName,
      });
    }

    // ── Batch mint one NFT (composite → Pinata image → Pinata JSON → Hedera mint) ─
    case "batch_mint": {
      const { teamId, memberId, compositeImage, pinataApiKey, pinataApiSecret, credentials,
              collectionName: reqName, collectionCreator: reqCreator, collectionDescription: reqDesc } = body;

      if (!credentials?.accountId || !credentials?.privateKey || !credentials?.network)
        return NextResponse.json({ error: "Hedera credentials required" }, { status: 400 });
      if (!pinataApiKey || !pinataApiSecret)
        return NextResponse.json({ error: "Pinata API key and secret required" }, { status: 400 });

      const store = readStore();
      if (!store.tokenId)
        return NextResponse.json({ error: "NFT collection not created yet" }, { status: 503 });

      const team   = store.teams.find(t => t.id === teamId);
      if (!team)   return NextResponse.json({ error: "Team not found" }, { status: 404 });
      const member = team.members.find(m => m.id === memberId);
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      if (member.mintedNFT)            return NextResponse.json({ success: true, skipped: true, serialNumber: member.mintedNFT.serialNumber });
      if ((member as any).mintPending) return NextResponse.json({ error: "Mint already in progress for this member" }, { status: 409 });

      // Lock immediately to prevent duplicate from a concurrent request
      {
        const lockStore  = readStore();
        const lockTeam   = lockStore.teams.find(t => t.id === teamId);
        const lockMember = lockTeam?.members.find(m => m.id === memberId);
        if (!lockMember) return NextResponse.json({ error: "Member not found" }, { status: 404 });
        if (lockMember.mintedNFT) return NextResponse.json({ success: true, skipped: true, serialNumber: lockMember.mintedNFT.serialNumber });
        (lockMember as any).mintPending = true;
        writeStore(lockStore);
      }

      const creds: HederaCredentials = credentials;
      const categories = (store.layers ?? []).sort((a,b) => a.order-b.order).map(l => l.name.toLowerCase());
      const traits      = generateTraits(store.traitPool ?? [], categories, team.currentTier as TierLevel);
      const attributes  = traitsToAttributes(traits);
      const tierName    = DEFAULT_TIERS[(team.currentTier as number) - 1]?.label ?? "Common";

      // Sequential edition number based on already-minted count
      const edition = store.teams.flatMap(t => t.members).filter(m => m.mintedNFT).length + 1;

      const nftCollectionName = reqName     ?? store.collectionName;
      const creator           = reqCreator  ?? store.collectionCreator ?? store.collectionName;
      const description       = reqDesc     ?? store.collectionDescription ??
        `This NFT was earned by ${member.name} of team "${team.name}" through fundraising for pediatric cancer research.`;
      const nftName = `${nftCollectionName} #${edition}`;
      const slug    = nftCollectionName.replace(/\s+/g, "-").toLowerCase();

      function clearPendingLock() {
        try {
          const s = readStore();
          const t = s.teams.find(t => t.id === teamId);
          const m = t?.members.find(m => m.id === memberId);
          if (m) { delete (m as any).mintPending; writeStore(s); }
        } catch { /* best-effort */ }
      }

      try {
        // 1. Upload composite image to IPFS
        let imageUri = "ipfs://placeholder";
        if (compositeImage) {
          const imgResult = await serverUploadImageToIPFS(
            compositeImage, `${slug}-${edition}.png`, pinataApiKey, pinataApiSecret
          );
          if (imgResult.success && imgResult.ipfsUri) imageUri = imgResult.ipfsUri;
        }

        // 2. Build metadata (HANGRY BARBOONS / HIP-412 compatible format)
        const metadata = {
          creator,
          description,
          format: "none",
          name:   nftName,
          image:  imageUri,
          type:   "image/png",
          properties: { edition },
          files: [{
            uri:  imageUri,
            type: "image/png",
            metadata: { name: nftName, creator },
          }],
          attributes: attributes.map((a: {trait_type:string;value:string}) => ({
            trait_type: a.trait_type,
            value:      a.value,
          })),
        };

        // 3. Upload metadata JSON to IPFS
        const metaResult = await serverUploadMetadataToIPFS(
          metadata, `${slug}-meta-${edition}.json`, pinataApiKey, pinataApiSecret
        );
        if (!metaResult.success || !metaResult.ipfsUri) {
          clearPendingLock();
          return NextResponse.json({ error: `Metadata upload failed: ${metaResult.error}` }, { status: 502 });
        }

        // 4. Mint to treasury (student claims later)
        const mintResult = await serverMintNFT(
          creds, store.tokenId,
          creds.accountId,
          metaResult.ipfsUri
        );
        if (!mintResult.success || !mintResult.serialNumber) {
          clearPendingLock();
          return NextResponse.json({ error: `Hedera mint failed: ${mintResult.error}` }, { status: 502 });
        }

        // 5. Record as preminted in store (replaces the pending lock)
        const freshStore  = readStore();
        const freshTeam   = freshStore.teams.find(t => t.id === teamId);
        const freshMember = freshTeam?.members.find(m => m.id === memberId);
        if (freshMember) {
          delete (freshMember as any).mintPending;
          freshMember.mintedNFT = {
            serialNumber:       mintResult.serialNumber,
            tokenId:            store.tokenId,
            transactionId:      mintResult.transactionId ?? "",
            metadata:           metadata as any,
            mintedAt:           new Date().toISOString(),
            walletAddress:      member.walletAddress ?? "",
            status:             "preminted",
            imageUri,
            metadataUri:        metaResult.ipfsUri,
            compositeImageData: compositeImage,
          };
          writeStore(freshStore);
        }

        return NextResponse.json({
          success:       true,
          serialNumber:  mintResult.serialNumber,
          transactionId: mintResult.transactionId,
          imageUri,
          metadataUri:   metaResult.ipfsUri,
          edition,
          tierName,
          nftName,
        });
      } catch (err) {
        clearPendingLock();
        throw err;
      }
    }

    // ── Student claims their pre-minted NFT (just a transfer) ─────────────────
    case "claim": {
      const { walletAddress, credentials } = body;

      if (!isValidHederaAccountId(walletAddress))
        return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
      if (!credentials?.accountId || !credentials?.privateKey || !credentials?.network)
        return NextResponse.json({ error: "Treasury credentials required" }, { status: 400 });

      // Find the preminted NFT for this wallet
      const store = readStore();
      const team  = store.teams.find(t => t.members.some(m => m.walletAddress === walletAddress));
      if (!team)  return NextResponse.json({ error: "Wallet not registered" }, { status: 404 });

      const member = team.members.find(m => m.walletAddress === walletAddress);
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

      if (!member.mintedNFT)
        return NextResponse.json({ error: "No NFT minted for this student yet — ask your teacher" }, { status: 404 });

      if (member.mintedNFT.status === "claimed")
        return NextResponse.json({ success: true, alreadyClaimed: true, nft: member.mintedNFT });

      if (member.mintedNFT.status !== "preminted")
        return NextResponse.json({ error: "NFT not ready to claim" }, { status: 400 });

      // Transfer from treasury to student
      const creds: HederaCredentials = credentials;
      const transferResult = await serverTransferNFT(
        creds,
        member.mintedNFT.tokenId,
        member.mintedNFT.serialNumber,
        walletAddress
      );

      if (!transferResult.success)
        return NextResponse.json({ error: `Transfer failed: ${transferResult.error}` }, { status: 502 });

      // Update status to claimed
      const freshStore  = readStore();
      const freshTeam   = freshStore.teams.find(t => t.id === team.id);
      const freshMember = freshTeam?.members.find(m => m.id === member.id);
      if (freshMember?.mintedNFT) {
        freshMember.mintedNFT.status            = "claimed";
        freshMember.mintedNFT.claimedAt         = new Date().toISOString();
        freshMember.mintedNFT.claimTransactionId = transferResult.transactionId;
        writeStore(freshStore);
      }

      return NextResponse.json({
        success:      true,
        alreadyClaimed: false,
        serialNumber: member.mintedNFT.serialNumber,
        claimTransactionId: transferResult.transactionId,
        nft: freshMember?.mintedNFT,
      });
    }

    // ── Look up wallet → return team + NFT status for student page ────────────
    case "lookup_wallet": {
      const { walletAddress } = body;
      const team = getTeamByMemberWallet(walletAddress);
      if (!team) return NextResponse.json({ team: null, member: null, nftStatus: null });

      const member = team.members.find(m => m.walletAddress === walletAddress);
      const nftStatus = member?.mintedNFT?.status ?? null;

      return NextResponse.json({ team, member, nftStatus });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}