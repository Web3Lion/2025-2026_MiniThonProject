/**
 * Hedera Integration Layer
 *
 * Uses @hashgraph/sdk for server-side operations (token creation, minting)
 * Uses HashConnect for client-side wallet connection (HashPack)
 *
 * Server-side (admin): uses treasury private key from env vars
 * Client-side (student): uses HashConnect to request wallet signature
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HederaConfig {
  network: "testnet" | "mainnet";
  treasuryAccountId: string; // e.g. "0.0.12345"
  treasuryPrivateKey: string; // DER-encoded or hex
  tokenId?: string; // set after collection is created
}

export interface MintResult {
  success: boolean;
  serialNumber?: number;
  transactionId?: string;
  error?: string;
}

export interface CreateCollectionResult {
  success: boolean;
  tokenId?: string;
  transactionId?: string;
  error?: string;
}

// ─── Server-Side: Token Collection Creation ───────────────────────────────────
/**
 * Creates the NFT collection (HTS token) on Hedera.
 * Called once by the admin to set up the event.
 * Run server-side only — never expose private keys to browser.
 */
export async function createNFTCollection(
  config: HederaConfig,
  collectionName: string,
  symbol: string,
  maxSupply: number
): Promise<CreateCollectionResult> {
  try {
    // Dynamic import so SDK is only loaded server-side
    const {
      Client,
      TokenCreateTransaction,
      TokenType,
      TokenSupplyType,
      PrivateKey,
      AccountId,
    } = await import("@hashgraph/sdk");

    const client =
      config.network === "mainnet"
        ? Client.forMainnet()
        : Client.forTestnet();

    const treasuryId = AccountId.fromString(config.treasuryAccountId);
    const treasuryKey = PrivateKey.fromString(config.treasuryPrivateKey);

    client.setOperator(treasuryId, treasuryKey);

    const transaction = new TokenCreateTransaction()
      .setTokenName(collectionName)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(treasuryId)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(maxSupply)
      .setSupplyKey(treasuryKey)
      .freezeWith(client);

    const signedTx = await transaction.sign(treasuryKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const tokenId = receipt.tokenId?.toString();

    if (!tokenId) throw new Error("Token ID not returned");

    return {
      success: true,
      tokenId,
      transactionId: txResponse.transactionId.toString(),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Server-Side: Mint NFT ────────────────────────────────────────────────────
/**
 * Mints a single NFT to a student's wallet.
 * metadataUri should be an IPFS URI: ipfs://CID
 */
export async function mintNFT(
  config: HederaConfig,
  recipientAccountId: string,
  metadataUri: string
): Promise<MintResult> {
  if (!config.tokenId) {
    return { success: false, error: "Token ID not configured" };
  }

  try {
    const {
      Client,
      TokenMintTransaction,
      TransferTransaction,
      AccountId,
      TokenId,
      PrivateKey,
    } = await import("@hashgraph/sdk");

    const client =
      config.network === "mainnet"
        ? Client.forMainnet()
        : Client.forTestnet();

    const treasuryId = AccountId.fromString(config.treasuryAccountId);
    const treasuryKey = PrivateKey.fromString(config.treasuryPrivateKey);
    client.setOperator(treasuryId, treasuryKey);

    const tokenId = TokenId.fromString(config.tokenId);

    // 1. Mint to treasury
    const mintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .addMetadata(Buffer.from(metadataUri))
      .execute(client);

    const mintReceipt = await mintTx.getReceipt(client);
    const serialNumbers = mintReceipt.serials;
    const serialNumber = Number(serialNumbers[0]);

    // 2. Transfer from treasury to student wallet
    await new TransferTransaction()
      .addNftTransfer(
        tokenId,
        serialNumber,
        treasuryId,
        AccountId.fromString(recipientAccountId)
      )
      .execute(client);

    return {
      success: true,
      serialNumber,
      transactionId: mintTx.transactionId.toString(),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Mint failed",
    };
  }
}

// ─── Client-Side: HashPack Wallet Connection ──────────────────────────────────
/**
 * HashConnect integration for student wallet connection.
 * Import and use this in client components only.
 *
 * NOTE: Install with: npm install hashconnect
 *
 * Usage in a React component:
 *   const { connect, accountId, disconnect } = useHashConnect()
 */
export const HASHCONNECT_APP_METADATA = {
  name: "Minthon — Pediatric Cancer Fundraiser",
  description:
    "Mint your fundraising NFT on Hedera. Every mint supports children with cancer.",
  icon: "/logo.png",
};

// ─── IPFS / Pinata Helpers ────────────────────────────────────────────────────
export interface PinataConfig {
  apiKey: string;
  apiSecret: string;
}

/**
 * Upload NFT metadata JSON to IPFS via Pinata
 * Returns the IPFS CID
 */
export async function uploadMetadataToIPFS(
  metadata: object,
  pinataConfig: PinataConfig
): Promise<{ success: boolean; ipfsUri?: string; error?: string }> {
  try {
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: pinataConfig.apiKey,
          pinata_secret_api_key: pinataConfig.apiSecret,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `minthon-nft-metadata-${Date.now()}`,
          },
        }),
      }
    );

    if (!response.ok) throw new Error(`Pinata error: ${response.statusText}`);

    const data = await response.json();
    return {
      success: true,
      ipfsUri: `ipfs://${data.IpfsHash}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "IPFS upload failed",
    };
  }
}

// ─── Hedera Account ID Validation ─────────────────────────────────────────────
export function isValidHederaAccountId(id: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(id.trim());
}

// ─── Format transaction ID for HashScan explorer link ─────────────────────────
export function hashScanUrl(
  transactionId: string,
  network: "testnet" | "mainnet" = "testnet"
): string {
  const base =
    network === "mainnet"
      ? "https://hashscan.io/mainnet"
      : "https://hashscan.io/testnet";
  const formatted = transactionId.replace("@", "-").replace(".", "-");
  return `${base}/transaction/${formatted}`;
}
