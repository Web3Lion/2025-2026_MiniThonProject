/**
 * Server-Side Hedera Operations
 *
 * All Hedera SDK calls run here — in Next.js API routes (Node.js).
 * The browser sends decrypted credentials in the POST body.
 * Credentials are used once per request and never persisted server-side.
 *
 * This file is imported only by API route handlers — never by client components.
 */

export interface HederaCredentials {
  accountId: string;   // e.g. "0.0.12345"
  privateKey: string;  // DER-encoded or hex
  network: "testnet" | "mainnet";
}

export interface TokenSetupConfig {
  name: string;
  symbol: string;
  maxSupply: number;
  royaltyPercent: number;       // 0–100
  royaltyCollectorId: string;   // Hedera account for royalty payments
  royaltyFallbackHbar: number;  // fallback fee in HBAR
  keys: {
    admin: boolean;
    supply: boolean;
    freeze: boolean;
    wipe: boolean;
    kyc: boolean;
  };
}

export interface CreateTokenResult {
  success: boolean;
  tokenId?: string;
  transactionId?: string;
  error?: string;
}

export interface MintResult {
  success: boolean;
  serialNumber?: number;
  transactionId?: string;
  error?: string;
}

// ─── Parse private key — handles all Hedera key formats ──────────────────────
// Detection logic:
//   - DER prefix "3030" → ECDSA DER (secp256k1, used by EVM/ECDSA accounts)
//   - DER prefix "3026" → ED25519 DER
//   - Raw 64-char hex   → try ECDSA first (most portal accounts), then ED25519
//   - 0x prefix         → strip and treat as raw hex
async function parsePrivateKey(keyStr: string) {
  const { PrivateKey } = await import("@hashgraph/sdk");
  const key = keyStr.trim().replace(/^0x/, "");

  // DER-encoded: detect type from prefix
  if (key.startsWith("3030") || key.startsWith("3031")) {
    // ECDSA DER (secp256k1) — used by accounts with EVM addresses
    console.log("[Hedera] Parsing as ECDSA DER key");
    return PrivateKey.fromStringDer(key);
  }

  if (key.startsWith("3026") || key.startsWith("302e") || key.startsWith("3027")) {
    // ED25519 DER
    console.log("[Hedera] Parsing as ED25519 DER key");
    return PrivateKey.fromStringDer(key);
  }

  // Raw hex — try ECDSA first (Hedera portal accounts with EVM address use ECDSA)
  const attempts: Array<[string, () => ReturnType<typeof PrivateKey.fromStringECDSA>]> = [
    ["ECDSA hex",   () => PrivateKey.fromStringECDSA(key)],
    ["ED25519 hex", () => PrivateKey.fromStringED25519(key)],
    ["DER fallback",() => PrivateKey.fromStringDer(key)],
    ["SDK guess",   () => PrivateKey.fromString(key)],
  ];

  for (const [label, attempt] of attempts) {
    try {
      const pk = attempt();
      console.log(`[Hedera] Key parsed successfully as: ${label}`);
      return pk;
    } catch {
      // try next
    }
  }
  throw new Error("Could not parse private key. Use the DER Encoded Private Key from portal.hedera.com");
}

// ─── Build Hedera client from credentials ─────────────────────────────────────
async function buildClient(creds: HederaCredentials) {
  const { Client, AccountId } = await import("@hashgraph/sdk");
  const client = creds.network === "mainnet"
    ? Client.forMainnet()
    : Client.forTestnet();
  const privateKey = await parsePrivateKey(creds.privateKey);
  client.setOperator(AccountId.fromString(creds.accountId), privateKey);
  return { client, AccountId, privateKey };
}

// ─── Create NFT Collection ────────────────────────────────────────────────────
export async function serverCreateNFTCollection(
  creds: HederaCredentials,
  config: TokenSetupConfig
): Promise<CreateTokenResult> {
  try {
    const {
      Client, AccountId,
      TokenCreateTransaction, TokenType, TokenSupplyType,
      CustomRoyaltyFee, CustomFixedFee, Hbar,
    } = await import("@hashgraph/sdk");

    const client = creds.network === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

    const treasuryId = AccountId.fromString(creds.accountId);
    const privateKey = await parsePrivateKey(creds.privateKey);
    client.setOperator(treasuryId, privateKey);

    // Build royalty fee if configured
    const customFees = [];
    if (config.royaltyPercent > 0 && config.royaltyCollectorId?.trim()) {
      const collectorId = AccountId.fromString(config.royaltyCollectorId.trim());

      const fallbackFee = new CustomFixedFee()
        .setHbarAmount(new Hbar(config.royaltyFallbackHbar))
        .setFeeCollectorAccountId(collectorId);

      const royaltyFee = new CustomRoyaltyFee()
        .setNumerator(Math.round(config.royaltyPercent * 100)) // e.g. 5% → 500/10000
        .setDenominator(10000)
        .setFeeCollectorAccountId(collectorId)
        .setFallbackFee(fallbackFee);

      customFees.push(royaltyFee);
    }

    // Build token creation transaction
    let tx = new TokenCreateTransaction()
      .setTokenName(config.name)
      .setTokenSymbol(config.symbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(treasuryId)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(config.maxSupply)
      .setCustomFees(customFees);

    // Apply keys — all derived from the same private key
    if (config.keys.supply) tx = tx.setSupplyKey(privateKey.publicKey);
    if (config.keys.admin)  tx = tx.setAdminKey(privateKey.publicKey);
    if (config.keys.freeze) tx = tx.setFreezeKey(privateKey.publicKey);
    if (config.keys.wipe)   tx = tx.setWipeKey(privateKey.publicKey);
    if (config.keys.kyc)    tx = tx.setKycKey(privateKey.publicKey);

    const frozenTx = await tx.freezeWith(client);
    const signedTx = await frozenTx.sign(privateKey);
    const response = await signedTx.execute(client);
    const receipt  = await response.getReceipt(client);
    const tokenId  = receipt.tokenId?.toString();

    if (!tokenId) throw new Error("No token ID returned from Hedera");

    return {
      success: true,
      tokenId,
      transactionId: response.transactionId.toString(),
    };
  } catch (err) {
    console.error("[Hedera] createNFTCollection error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Token creation failed",
    };
  }
}

// ─── Mint a single NFT + transfer to recipient ────────────────────────────────
export async function serverMintNFT(
  creds: HederaCredentials,
  tokenId: string,
  recipientAccountId: string,
  metadataUri: string  // IPFS URI stored as token metadata
): Promise<MintResult> {
  try {
    const {
      Client, AccountId,
      TokenMintTransaction, TransferTransaction,
      TokenId, NftId,
    } = await import("@hashgraph/sdk");

    const client = creds.network === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

    const treasuryId = AccountId.fromString(creds.accountId);
    const privateKey = await parsePrivateKey(creds.privateKey);
    client.setOperator(treasuryId, privateKey);

    const htsTokenId   = TokenId.fromString(tokenId);
    const recipientId  = AccountId.fromString(recipientAccountId);

    // Step 1: Mint to treasury
    const mintTx = await new TokenMintTransaction()
      .setTokenId(htsTokenId)
      .addMetadata(Buffer.from(metadataUri))
      .freezeWith(client);

    const signedMint   = await mintTx.sign(privateKey);
    const mintResponse = await signedMint.execute(client);
    const mintReceipt  = await mintResponse.getReceipt(client);
    const serialNumber = Number(mintReceipt.serials[0]);

    // Step 2: Transfer from treasury to student wallet
    const transferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(htsTokenId, serialNumber),
        treasuryId,
        recipientId
      )
      .freezeWith(client);

    const signedTransfer = await transferTx.sign(privateKey);
    const transferResponse = await signedTransfer.execute(client);
    await transferResponse.getReceipt(client); // confirm transfer

    return {
      success: true,
      serialNumber,
      transactionId: mintResponse.transactionId.toString(),
    };
  } catch (err) {
    console.error("[Hedera] mintNFT error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Mint failed",
    };
  }
}

// ─── Upload image blob to IPFS via Pinata ────────────────────────────────────
export async function serverUploadImageToIPFS(
  imageBase64: string,   // base64 PNG from browser canvas
  filename: string,
  pinataApiKey: string,
  pinataApiSecret: string
): Promise<{ success: boolean; ipfsUri?: string; error?: string }> {
  try {
    // Convert base64 to Buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Build multipart form — use node-fetch compatible approach
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
    const footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="pinataMetadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: filename })}\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(header),
      buffer,
      Buffer.from(footer),
    ]);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataApiSecret,
      },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pinata error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return { success: true, ipfsUri: `ipfs://${data.IpfsHash}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Image upload failed",
    };
  }
}

// ─── Upload metadata JSON to IPFS via Pinata ─────────────────────────────────
export async function serverUploadMetadataToIPFS(
  metadata: object,
  name: string,
  pinataApiKey: string,
  pinataApiSecret: string
): Promise<{ success: boolean; ipfsUri?: string; error?: string }> {
  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataApiSecret,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pinata error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return { success: true, ipfsUri: `ipfs://${data.IpfsHash}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Metadata upload failed",
    };
  }
}

// ─── Validate account ID format ───────────────────────────────────────────────
export function isValidHederaAccountId(id: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(id.trim());
}

// ─── HashScan URLs ────────────────────────────────────────────────────────────
export function hashScanTx(txId: string, network: "testnet" | "mainnet"): string {
  const base = network === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";
  return `${base}/transaction/${txId.replace("@", "-")}`;
}

export function hashScanToken(tokenId: string, network: "testnet" | "mainnet"): string {
  const base = network === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";
  return `${base}/token/${tokenId}`;
}

// ─── Transfer NFT from treasury to student (claim) ────────────────────────────
// Called when student clicks "Claim" — no minting, just transfer
export async function serverTransferNFT(
  creds: HederaCredentials,
  tokenId: string,
  serialNumber: number,
  recipientAccountId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const {
      Client, AccountId, TokenId, NftId, TransferTransaction,
    } = await import("@hashgraph/sdk");

    const client = creds.network === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

    const treasuryId = AccountId.fromString(creds.accountId);
    const privateKey = await parsePrivateKey(creds.privateKey);
    client.setOperator(treasuryId, privateKey);

    const htsTokenId = TokenId.fromString(tokenId);
    const recipientId = AccountId.fromString(recipientAccountId);

    const transferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(htsTokenId, serialNumber),
        treasuryId,
        recipientId
      )
      .freezeWith(client);

    const signed   = await transferTx.sign(privateKey);
    const response = await signed.execute(client);
    await response.getReceipt(client);

    return { success: true, transactionId: response.transactionId.toString() };
  } catch (err) {
    console.error("[Hedera] transferNFT error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Transfer failed",
    };
  }
}