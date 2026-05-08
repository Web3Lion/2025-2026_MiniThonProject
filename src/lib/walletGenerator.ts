/**
 * Student Wallet Generator
 * Creates Hedera accounts server-side using the SDK.
 * Returns account ID, private key, public key, and mnemonic.
 */

import { StudentWallet } from "@/types";

export interface WalletGenCredentials {
  payerAccountId: string;
  payerPrivateKey: string;
  network: "testnet" | "mainnet";
}

export interface GenerateWalletsResult {
  success: boolean;
  wallets: StudentWallet[];
  failed: { name: string; error: string }[];
}

export async function generateStudentWallets(
  studentNames: string[],
  payerCreds: WalletGenCredentials
): Promise<GenerateWalletsResult> {
  const {
    Client, AccountCreateTransaction, Hbar,
    PrivateKey, AccountId,
  } = await import("@hashgraph/sdk");

  const client = payerCreds.network === "mainnet"
    ? Client.forMainnet()
    : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(payerCreds.payerAccountId),
    PrivateKey.fromString(payerCreds.payerPrivateKey)
  );

  const wallets: StudentWallet[]       = [];
  const failed: { name: string; error: string }[] = [];

  for (const name of studentNames) {
    try {
      // Generate a fresh key pair + mnemonic
      const mnemonic   = await (PrivateKey as any).generateMnemonic?.() ?? null;
      const newKey     = mnemonic ? await mnemonic.toPrivateKey() : PrivateKey.generateED25519();
      const publicKey  = newKey.publicKey;

      // Create the account on Hedera with 1 HBAR starting balance
      const tx = await new AccountCreateTransaction()
        .setKey(publicKey)
        .setInitialBalance(new Hbar(1))
        .execute(client);

      const receipt   = await tx.getReceipt(client);
      const accountId = receipt.accountId?.toString();
      if (!accountId) throw new Error("No account ID returned");

      wallets.push({
        studentName: name,
        accountId,
        privateKey:  newKey.toString(),
        publicKey:   publicKey.toString(),
        mnemonic:    mnemonic ? mnemonic.toString() : "Key generated without mnemonic — store private key securely",
        network:     payerCreds.network,
        createdAt:   new Date().toISOString(),
      });

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      failed.push({ name, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { success: true, wallets, failed };
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
export function walletsToCSV(wallets: StudentWallet[]): string {
  const header = "Student Name,Account ID,Private Key,Public Key,Mnemonic,Network,Created At";
  const rows   = wallets.map(w =>
    [w.studentName, w.accountId, w.privateKey, w.publicKey, `"${w.mnemonic}"`, w.network, w.createdAt]
      .join(",")
  );
  return [header, ...rows].join("\n");
}

export function parseStudentCSV(csv: string): string[] {
  return csv
    .split("\n")
    .map(line => line.trim().replace(/^["']|["']$/g, ""))
    .filter(line => line && !line.toLowerCase().startsWith("name") && !line.toLowerCase().startsWith("student"));
}
