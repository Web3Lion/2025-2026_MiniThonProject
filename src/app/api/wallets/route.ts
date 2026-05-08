import { NextRequest, NextResponse } from "next/server";
import { generateStudentWallets, walletsToCSV, parseStudentCSV } from "@/lib/walletGenerator";
import { getAllTeams, readStore } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "generate": {
      const { csvContent, credentials } = body;
      if (!csvContent) return NextResponse.json({ error: "CSV content required" }, { status: 400 });
      if (!credentials?.payerAccountId || !credentials?.payerPrivateKey) {
        return NextResponse.json({ error: "Payer credentials required" }, { status: 400 });
      }

      const names = parseStudentCSV(csvContent);
      if (!names.length) return NextResponse.json({ error: "No student names found in CSV" }, { status: 400 });

      const result = await generateStudentWallets(names, {
        payerAccountId: credentials.payerAccountId,
        payerPrivateKey: credentials.payerPrivateKey,
        network: credentials.network ?? "testnet",
      });

      return NextResponse.json({
        success:  true,
        wallets:  result.wallets,
        failed:   result.failed,
        csv:      walletsToCSV(result.wallets),
        count:    result.wallets.length,
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
