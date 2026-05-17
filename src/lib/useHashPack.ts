/**
 * Student Wallet Generator
 * Creates Hedera ED25519 accounts server-side.
 * Supports CSV with optional team name column: "Name, Team Name"
 */

import { StudentWallet } from "@/types";

export interface WalletGenCredentials {
  payerAccountId: string;
  payerPrivateKey: string;
  network: "testnet" | "mainnet";
  initialHbar: number;
}

export interface ParsedStudent {
  name: string;
  teamName: string | null;
}

export interface GenerateWalletsResult {
  success: boolean;
  wallets: StudentWallet[];
  failed: { name: string; error: string }[];
}

// ─── Same key parser as hederaServer.ts ───────────────────────────────────────
async function parsePrivateKey(keyStr: string) {
  const { PrivateKey } = await import("@hashgraph/sdk");
  const key = keyStr.trim().replace(/^0x/, "");
  if (key.startsWith("3030") || key.startsWith("3031")) return PrivateKey.fromStringDer(key);
  if (key.startsWith("3026") || key.startsWith("302e") || key.startsWith("3027")) return PrivateKey.fromStringDer(key);
  const attempts = [
    () => PrivateKey.fromStringECDSA(key),
    () => PrivateKey.fromStringED25519(key),
    () => PrivateKey.fromStringDer(key),
    () => PrivateKey.fromString(key),
  ];
  for (const a of attempts) { try { return a(); } catch { /* next */ } }
  throw new Error("Could not parse payer private key");
}

// ─── Parse CSV with optional team column ──────────────────────────────────────
// Supports:
//   "Alice Johnson"             → { name: "Alice Johnson", teamName: null }
//   "Alice Johnson, Team Alpha" → { name: "Alice Johnson", teamName: "Team Alpha" }
export function parseStudentCSV(csv: string): ParsedStudent[] {
  return csv
    .split("\n")
    .map(line => line.trim())
    .filter(line =>
      line &&
      !line.toLowerCase().startsWith("name") &&
      !line.toLowerCase().startsWith("student") &&
      !line.startsWith("#")
    )
    .map(line => {
      const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
      return {
        name:     parts[0] ?? line,
        teamName: parts[1] || null,
      };
    })
    .filter(s => s.name.length > 0);
}

export async function generateStudentWallets(
  students: ParsedStudent[],
  payerCreds: WalletGenCredentials
): Promise<GenerateWalletsResult> {
  const { Client, AccountCreateTransaction, Hbar, Mnemonic, AccountId } = await import("@hashgraph/sdk");

  const client = payerCreds.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const payerKey = await parsePrivateKey(payerCreds.payerPrivateKey);
  client.setOperator(AccountId.fromString(payerCreds.payerAccountId), payerKey);

  const hbarSeed = Math.max(0, payerCreds.initialHbar ?? 1);
  const wallets: StudentWallet[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const student of students) {
    try {
      const mnemonic = await Mnemonic.generate();
      const newKey   = await mnemonic.toPrivateKey();
      const publicKey = newKey.publicKey;

      const tx = await new AccountCreateTransaction()
        .setKey(publicKey)
        .setInitialBalance(new Hbar(hbarSeed))
        .setAccountMemo(`Minthon: ${student.name}`)
        .execute(client);

      const receipt   = await tx.getReceipt(client);
      const accountId = receipt.accountId?.toString();
      if (!accountId) throw new Error("No account ID returned");

      wallets.push({
        studentName: student.name,
        accountId,
        privateKey:  newKey.toStringRaw(),
        publicKey:   publicKey.toStringRaw(),
        mnemonic:    mnemonic.toString(),
        network:     payerCreds.network,
        createdAt:   new Date().toISOString(),
      });

      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      failed.push({ name: student.name, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { success: true, wallets, failed };
}

export function walletsToCSV(wallets: StudentWallet[]): string {
  const header = "Student Name,Account ID,Private Key (hex),Public Key,Mnemonic,Network,Created At";
  const rows = wallets.map(w =>
    [`"${w.studentName}"`, w.accountId, w.privateKey, w.publicKey, `"${w.mnemonic}"`, w.network, w.createdAt].join(",")
  );
  return [header, ...rows].join("\n");
}