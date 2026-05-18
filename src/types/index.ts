// ─── Tiers ────────────────────────────────────────────────────────────────────
export type TierLevel = 1 | 2 | 3 | 4 | 5;

export interface Tier {
  level: TierLevel;
  name: string;
  label: string;
  minDonation: number;
  color: string;
  hexColor: string;
  description: string;
}

// ─── Traits ───────────────────────────────────────────────────────────────────
export type TraitCategory = string; // flexible — admin defines layer names

export interface TraitOption {
  id: string;
  name: string;
  category: TraitCategory;
  tier: TierLevel;
  imageFile: string;
  weight: number;
}

// ─── Layer definition (admin-configured) ─────────────────────────────────────
export interface LayerDefinition {
  id: string;
  name: string;       // display name e.g. "Background"
  order: number;      // 1 = bottom, 6 = top
  required: boolean;  // if true, every NFT must have this layer
}

// ─── NFT Metadata (HIP-412 compatible) ────────────────────────────────────────
export interface NFTAttribute {
  trait_type: string;
  value: string;
  rarity_tier: TierLevel;
  tier_name: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  edition: number;
  attributes: NFTAttribute[];
  properties: Record<string, unknown>;
}

// ─── Teams ────────────────────────────────────────────────────────────────────
export interface TeamMember {
  id: string;
  name: string;
  walletAddress?: string;
  mintedNFT?: MintRecord;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  donationTotal: number;
  currentTier: TierLevel;
  donationLog: DonationEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DonationEntry {
  id: string;
  amount: number;
  donor?: string;
  note?: string;
  recordedAt: string;
  recordedBy: string;
}

// ─── Minting ──────────────────────────────────────────────────────────────────

// States of an NFT through its lifecycle
// preminted = teacher minted it, sitting in treasury, not yet claimed by student
// claimed   = student connected wallet and it was transferred to them
export type NFTStatus = "preminted" | "claimed";

export interface MintRecord {
  serialNumber: number;
  tokenId: string;
  transactionId: string;       // mint transaction
  claimTransactionId?: string; // transfer transaction (set when claimed)
  metadata: NFTMetadata;
  mintedAt: string;            // when teacher minted
  claimedAt?: string;          // when student claimed
  walletAddress: string;       // student's registered wallet
  status: NFTStatus;
  imageUri?: string;           // IPFS image URI
  metadataUri?: string;        // IPFS metadata URI
  compositeImageData?: string; // base64 preview (stored temporarily for claim screen)
}

export interface GeneratedTraits {
  [category: string]: TraitOption;
}

// ─── Student Wallet ───────────────────────────────────────────────────────────
export interface StudentWallet {
  studentName: string;
  accountId: string;
  privateKey: string;
  publicKey: string;
  mnemonic: string;
  network: "testnet" | "mainnet";
  createdAt: string;
}

// ─── App Theme ────────────────────────────────────────────────────────────────
export type AppTheme = "dark-violet" | "dark-blue" | "light-green";

// ─── Admin State ──────────────────────────────────────────────────────────────
export interface AdminState {
  teams: Team[];
  tiers: Tier[];
  traitPool: TraitOption[];
  layers: LayerDefinition[];
  tokenId: string | null;
  collectionName: string;
  totalDonations: number;
  lastUpdated: string;
}