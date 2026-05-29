/**
 * Student Wallet Generator
 * Creates Hedera ED25519 accounts server-side.
 * Supports CSV with optional team name column: "Name, Team Name"
 */

import { useState, useEffect, useCallback } from "react";
import { StudentWallet } from "@/types";

// ─── useHashPack Hook ─────────────────────────────────────────────────────────
// Attempts to connect via the HashPack browser extension (window.hashpack).
// Falls back to a window.prompt() for manual Hedera account ID entry when the
// extension is not installed — sufficient for school-event use where students
// know their account IDs.

export type HashPackConnectionState = "idle" | "connecting" | "connected" | "not_installed";

export interface HashPackHook {
  connectionState: HashPackConnectionState;
  accountId: string | null;
  isInstalled: boolean;
  connect: () => void;
  disconnect: () => void;
}

const SESSION_KEY = "minthon_connected_account";

export function useHashPack(_network: "testnet" | "mainnet"): HashPackHook {
  const [connectionState, setConnectionState] = useState<HashPackConnectionState>("idle");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      setAccountId(stored);
      setConnectionState("connected");
    }
    // Detect HashPack extension (injects window.hashpack)
    setIsInstalled(typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).hashpack);
  }, []);

  const connect = useCallback(async () => {
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : null;
    const hp = win?.hashpack as { requestAccounts?: () => Promise<string[]> } | undefined;

    if (hp?.requestAccounts) {
      // Real HashPack extension path
      setConnectionState("connecting");
      try {
        const accounts = await hp.requestAccounts();
        const id = accounts?.[0] ?? null;
        if (id) {
          setAccountId(id);
          setConnectionState("connected");
          sessionStorage.setItem(SESSION_KEY, id);
        } else {
          setConnectionState("idle");
        }
      } catch {
        setConnectionState("idle");
      }
    } else {
      // Manual fallback: prompt for account ID
      setConnectionState("connecting");
      const id = window.prompt("Enter your Hedera Account ID (e.g. 0.0.12345):");
      if (id && /^\d+\.\d+\.\d+$/.test(id.trim())) {
        setAccountId(id.trim());
        setConnectionState("connected");
        sessionStorage.setItem(SESSION_KEY, id.trim());
      } else {
        setConnectionState(id === null ? "idle" : "not_installed");
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccountId(null);
    setConnectionState("idle");
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  return { connectionState, accountId, isInstalled, connect, disconnect };
}

// ─────────────────────────────────────────────────────────────────────────────

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