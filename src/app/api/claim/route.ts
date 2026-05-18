/**
 * Student claim endpoint — uses server-side treasury credentials from .env.local
 * Students never see or handle the private key.
 * This transfers the pre-minted NFT from treasury to the student's wallet.
 */
import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { serverTransferNFT } from "@/lib/hederaServer";
import { isValidHederaAccountId } from "@/lib/hederaServer";

export async function POST(req: NextRequest) {
  const { walletAddress } = await req.json();

  if (!walletAddress || !isValidHederaAccountId(walletAddress))
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });

  // Credentials come from server env — student never provides them
  const treasuryId  = process.env.HEDERA_TREASURY_ID;
  const treasuryKey = process.env.HEDERA_TREASURY_KEY;
  const network     = (process.env.HEDERA_NETWORK ?? "testnet") as "testnet" | "mainnet";

  if (!treasuryId || !treasuryKey)
    return NextResponse.json({
      error: "Treasury credentials not configured on server. Add HEDERA_TREASURY_ID and HEDERA_TREASURY_KEY to .env.local"
    }, { status: 503 });

  const store  = readStore();
  const team   = store.teams.find(t => t.members.some(m => m.walletAddress === walletAddress));
  if (!team)   return NextResponse.json({ error: "Wallet not registered for this event" }, { status: 404 });

  const member = team.members.find(m => m.walletAddress === walletAddress);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (!member.mintedNFT)
    return NextResponse.json({ error: "No NFT minted for you yet — ask your teacher to mint first" }, { status: 404 });

  if (member.mintedNFT.status === "claimed")
    return NextResponse.json({ success: true, alreadyClaimed: true, nft: member.mintedNFT });

  if (member.mintedNFT.status !== "preminted")
    return NextResponse.json({ error: "NFT not ready to claim" }, { status: 400 });

  // Transfer from treasury to student — server signs with treasury key
  const result = await serverTransferNFT(
    { accountId: treasuryId, privateKey: treasuryKey, network },
    member.mintedNFT.tokenId,
    member.mintedNFT.serialNumber,
    walletAddress
  );

  if (!result.success)
    return NextResponse.json({ error: `Transfer failed: ${result.error}` }, { status: 502 });

  // Mark as claimed
  const freshStore  = readStore();
  const freshTeam   = freshStore.teams.find(t => t.id === team.id);
  const freshMember = freshTeam?.members.find(m => m.id === member.id);
  if (freshMember?.mintedNFT) {
    freshMember.mintedNFT.status             = "claimed";
    freshMember.mintedNFT.claimedAt          = new Date().toISOString();
    freshMember.mintedNFT.claimTransactionId = result.transactionId;
    writeStore(freshStore);
  }

  return NextResponse.json({
    success:            true,
    alreadyClaimed:     false,
    serialNumber:       member.mintedNFT.serialNumber,
    claimTransactionId: result.transactionId,
    nft:                freshMember?.mintedNFT,
    memberName:         member.name,
    teamName:           team.name,
  });
}