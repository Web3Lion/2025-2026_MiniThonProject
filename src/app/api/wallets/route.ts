import { NextRequest, NextResponse } from "next/server";
import { generateStudentWallets, walletsToCSV, parseStudentCSV } from "@/lib/walletGenerator";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "generate": {
      const { csvContent, credentials, initialHbar } = body;

      if (!csvContent?.trim())
        return NextResponse.json({ error: "CSV content required" }, { status: 400 });
      if (!credentials?.payerAccountId || !credentials?.payerPrivateKey)
        return NextResponse.json({ error: "Payer credentials required" }, { status: 400 });

      const names = parseStudentCSV(csvContent);
      if (!names.length)
        return NextResponse.json({ error: "No student names found in CSV — one name per line" }, { status: 400 });

      const hbarAmount = Math.max(0, parseFloat(initialHbar) || 1);

      console.log(`[Wallets] Generating ${names.length} wallets on ${credentials.network}, seeding ${hbarAmount} HBAR each`);

      const result = await generateStudentWallets(names, {
        payerAccountId: credentials.payerAccountId,
        payerPrivateKey: credentials.payerPrivateKey,
        network: credentials.network ?? "testnet",
        initialHbar: hbarAmount,
      });

      return NextResponse.json({
        success:  true,
        wallets:  result.wallets,
        failed:   result.failed,
        csv:      walletsToCSV(result.wallets),
        count:    result.wallets.length,
        totalHbarSpent: hbarAmount * result.wallets.length,
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}