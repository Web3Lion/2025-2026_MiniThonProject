import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    tokenId:        store.tokenId,
    collectionName: store.collectionName,
    network:        process.env.HEDERA_NETWORK ?? "testnet",
    hasServerCreds: Boolean(process.env.HEDERA_TREASURY_ID && process.env.HEDERA_TREASURY_KEY),
  });
}