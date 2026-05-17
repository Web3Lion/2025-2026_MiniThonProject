/**
 * Student Wallet Generator
 * Creates Hedera ED25519 accounts server-side.
 * Uses the same parsePrivateKey logic as hederaServer.ts to fix ECDSA key issue.
 * Admin credentials are passed in — same wallet used for token creation.
 */

import { StudentWallet } from "@/types";

export interface WalletGenCredentials {
  payerAccountId: string;
  payerPrivateKey: string;
  network: "testnet" | "mainnet";
  initialHbar: number; // how many HBAR to seed each wallet with
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

  if (key.startsWith("3030") || key.startsWith("3031")) {
    return PrivateKey.fromStringDer(key); // ECDSA DER
  }
  if (key.startsWith("3026") || key.startsWith("302e") || key.startsWith("3027")) {
    return PrivateKey.fromStringDer(key); // ED25519 DER
  }

  const attempts: Array<() => ReturnType<typeof PrivateKey.fromStringECDSA>> = [
    () => PrivateKey.fromStringECDSA(key),
    () => PrivateKey.fromStringED25519(key),
    () => PrivateKey.fromStringDer(key),
    () => PrivateKey.fromString(key),
  ];
  for (const attempt of attempts) {
    try { return attempt(); } catch { /* try next */ }
  }
  throw new Error("Could not parse payer private key");
}

export async function generateStudentWallets(
  studentNames: string[],
  payerCreds: WalletGenCredentials
): Promise<GenerateWalletsResult> {
  const {
    Client, AccountCreateTransaction, Hbar,
    PrivateKey, Mnemonic, AccountId,
  } = await import("@hashgraph/sdk");

  const client = payerCreds.network === "mainnet"
    ? Client.forMainnet()
    : Client.forTestnet();

  // Use the same key parsing fix as token creation
  const payerKey = await parsePrivateKey(payerCreds.payerPrivateKey);
  client.setOperator(AccountId.fromString(payerCreds.payerAccountId), payerKey);

  const hbarSeed = Math.max(0, payerCreds.initialHbar ?? 1);
  const wallets: StudentWallet[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const name of studentNames) {
    try {
      // Generate a fresh ED25519 mnemonic + key for each student
      // ED25519 is recommended for student wallets — simpler, HashPack supports it
      const mnemonic = await Mnemonic.generate();
      const newKey   = await mnemonic.toPrivateKey();
      const publicKey = newKey.publicKey;

      // Create the account on Hedera
      const tx = await new AccountCreateTransaction()
        .setKey(publicKey)
        .setInitialBalance(new Hbar(hbarSeed))
        .setAccountMemo(`Minthon Student: ${name}`)
        .execute(client);

      const receipt   = await tx.getReceipt(client);
      const accountId = receipt.accountId?.toString();
      if (!accountId) throw new Error("No account ID returned from Hedera");

      wallets.push({
        studentName: name,
        accountId,
        privateKey:  newKey.toStringRaw(), // raw hex — easy to import into HashPack
        publicKey:   publicKey.toStringRaw(),
        mnemonic:    mnemonic.toString(),
        network:     payerCreds.network,
        createdAt:   new Date().toISOString(),
      });

      // Rate limit buffer
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      failed.push({ name, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { success: true, wallets, failed };
}

// ─── CSV export ───────────────────────────────────────────────────────────────
export function walletsToCSV(wallets: StudentWallet[]): string {
  const header = "Student Name,Account ID,Private Key (hex),Public Key,Mnemonic (24 words),Network,Created At";
  const rows   = wallets.map(w =>
    [`"${w.studentName}"`, w.accountId, w.privateKey, w.publicKey,
     `"${w.mnemonic}"`, w.network, w.createdAt].join(",")
  );
  return [header, ...rows].join("\n");
}

export function parseStudentCSV(csv: string): string[] {
  return csv
    .split("\n")
    .map(line => line.trim().replace(/^["']|["']$/g, ""))
    .filter(line =>
      line &&
      !line.toLowerCase().startsWith("name") &&
      !line.toLowerCase().startsWith("student") &&
      !line.toLowerCase().startsWith("#")
    );
}