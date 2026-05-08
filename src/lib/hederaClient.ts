/**
 * Client-Side Hedera Operations
 *
 * All transactions are built and signed in the browser using the pasted private key.
 * The key NEVER leaves the browser — no server calls for signing.
 *
 * Uses @hashgraph/sdk loaded dynamically (it's a large SDK, lazy-load it).
 */

export type HederaNetwork = "testnet" | "mainnet";

export interface WalletCredentials {
  accountId: string;   // e.g. "0.0.12345"
  privateKey: string;  // DER-encoded or raw hex
  network: HederaNetwork;
}

export interface TokenConfig {
  name: string;
  symbol: string;
  maxSupply: number;
  initialMint: number;         // how many to mint at creation (usually 0 for NFT collections)
  royaltyPercent: number;      // 0–100, e.g. 5 = 5%
  royaltyCollector: string;    // Hedera account ID for royalty payments (charity wallet)
  royaltyFallbackHbar: number; // fallback fee in HBAR when NFT transferred for free
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

export interface MintNFTResult {
  success: boolean;
  serialNumber?: number;
  transactionId?: string;
  error?: string;
}

/**
 * Validate a Hedera account ID format
 */
export function isValidAccountId(id: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(id.trim());
}

/**
 * Derive a display-safe account ID from private key + network
 * (just validates the key can be parsed)
 */
export async function validatePrivateKey(
  privateKeyStr: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { PrivateKey } = await import("@hashgraph/sdk");
    PrivateKey.fromString(privateKeyStr);
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid private key format" };
  }
}

/**
 * Create an NFT collection (HTS token) on Hedera.
 * All keys are derived from the same private key for simplicity.
 * Runs entirely client-side.
 */
export async function createNFTCollection(
  credentials: WalletCredentials,
  config: TokenConfig
): Promise<CreateTokenResult> {
  try {
    const {
      Client,
      TokenCreateTransaction,
      TokenType,
      TokenSupplyType,
      PrivateKey,
      AccountId,
      CustomRoyaltyFee,
      CustomFixedFee,
      Hbar,
    } = await import("@hashgraph/sdk");

    const client =
      credentials.network === "mainnet"
        ? Client.forMainnet()
        : Client.forTestnet();

    const treasuryId = AccountId.fromString(credentials.accountId);
    const privateKey = PrivateKey.fromString(credentials.privateKey);
    client.setOperator(treasuryId, privateKey);

    // Build royalty fee
    const royaltyFees = [];
    if (config.royaltyPercent > 0 && isValidAccountId(config.royaltyCollector)) {
      const fallbackFee = new CustomFixedFee()
        .setAmount(Math.round(config.royaltyFallbackHbar * 100_000_000)) // convert HBAR to tinybar
        .setDenominatingTokenId(null as unknown as import("@hashgraph/sdk").TokenId) // HBAR
        .setFeeCollectorAccountId(AccountId.fromString(config.royaltyCollector));

      const royaltyFee = new CustomRoyaltyFee()
        .setNumerator(config.royaltyPercent)
        .setDenominator(100)
        .setFeeCollectorAccountId(AccountId.fromString(config.royaltyCollector))
        .setFallbackFee(fallbackFee);

      royaltyFees.push(royaltyFee);
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
      .setCustomFees(royaltyFees);

    // Apply selected keys — all derived from the same private key
    if (config.keys.supply) tx = tx.setSupplyKey(privateKey);
    if (config.keys.admin)  tx = tx.setAdminKey(privateKey);
    if (config.keys.freeze) tx = tx.setFreezeKey(privateKey);
    if (config.keys.wipe)   tx = tx.setWipeKey(privateKey);
    if (config.keys.kyc)    tx = tx.setKycKey(privateKey);

    tx.freezeWith(client);
    const signedTx = await tx.sign(privateKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);
    const tokenId = receipt.tokenId?.toString();

    if (!tokenId) throw new Error("No token ID returned");

    return {
      success: true,
      tokenId,
      transactionId: response.transactionId.toString(),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Token creation failed",
    };
  }
}

/**
 * Mint a single NFT and transfer to recipient.
 * metadataUri = IPFS URI of the metadata JSON.
 */
export async function mintAndTransferNFT(
  credentials: WalletCredentials,
  tokenId: string,
  recipientAccountId: string,
  metadataUri: string
): Promise<MintNFTResult> {
  try {
    const {
      Client,
      TokenMintTransaction,
      TransferTransaction,
      AccountId,
      TokenId,
      PrivateKey,
      NftId,
    } = await import("@hashgraph/sdk");

    const client =
      credentials.network === "mainnet"
        ? Client.forMainnet()
        : Client.forTestnet();

    const treasuryId = AccountId.fromString(credentials.accountId);
    const privateKey = PrivateKey.fromString(credentials.privateKey);
    client.setOperator(treasuryId, privateKey);

    const htsTokenId = TokenId.fromString(tokenId);

    // 1. Mint to treasury
    const mintTx = await new TokenMintTransaction()
      .setTokenId(htsTokenId)
      .addMetadata(Buffer.from(metadataUri))
      .freezeWith(client)
      .sign(privateKey);

    const mintResponse = await mintTx.execute(client);
    const mintReceipt = await mintResponse.getReceipt(client);
    const serialNumber = Number(mintReceipt.serials[0]);

    // 2. Transfer from treasury to student
    const transferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(htsTokenId, serialNumber),
        treasuryId,
        AccountId.fromString(recipientAccountId)
      )
      .freezeWith(client)
      .sign(privateKey);

    await transferTx.execute(client);

    return {
      success: true,
      serialNumber,
      transactionId: mintResponse.transactionId.toString(),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Mint failed",
    };
  }
}

/**
 * HashScan explorer URL for a transaction
 */
export function hashScanTxUrl(txId: string, network: HederaNetwork): string {
  const base = network === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";
  return `${base}/transaction/${txId.replace("@", "-")}`;
}

/**
 * HashScan token URL
 */
export function hashScanTokenUrl(tokenId: string, network: HederaNetwork): string {
  const base = network === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";
  return `${base}/token/${tokenId}`;
}
