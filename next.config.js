"use client";

import { useState } from "react";
import { Team, TeamMember, TierLevel } from "@/types";
import { DEFAULT_TIERS, formatDollars } from "@/lib/tierConfig";

// ─── Tier visual config ───────────────────────────────────────────────────────
const TIER_STYLES: Record<TierLevel, { glow: string; badge: string; star: string }> = {
  1: { glow: "shadow-slate-500/20", badge: "bg-slate-700 text-slate-200", star: "⚪" },
  2: { glow: "shadow-blue-500/30", badge: "bg-blue-900 text-blue-200", star: "🔵" },
  3: { glow: "shadow-emerald-500/30", badge: "bg-emerald-900 text-emerald-200", star: "💚" },
  4: { glow: "shadow-purple-500/40", badge: "bg-purple-900 text-purple-200", star: "💜" },
  5: { glow: "shadow-amber-500/50", badge: "bg-amber-800 text-amber-100", star: "⭐" },
};

// ─── Trait card ───────────────────────────────────────────────────────────────
function TraitCard({
  traitType,
  value,
  tierName,
  tierLevel,
}: {
  traitType: string;
  value: string;
  tierName: string;
  tierLevel: TierLevel;
}) {
  const style = TIER_STYLES[tierLevel];
  return (
    <div className={`bg-white/5 rounded-xl p-3 border border-white/10 shadow-lg ${style.glow}`}>
      <div className="text-xs text-white/40 mb-1">{traitType}</div>
      <div className="font-medium text-sm">{value}</div>
      <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${style.badge}`}>
        {style.star} {tierName}
      </div>
    </div>
  );
}

// ─── NFT Preview Card ─────────────────────────────────────────────────────────
function NFTPreview({
  attributes,
  rarityScore,
  tierLevel,
  teamName,
}: {
  attributes: Array<{ trait_type: string; value: string; tier_name: string; rarity_tier: TierLevel }>;
  rarityScore: number;
  tierLevel: TierLevel;
  teamName: string;
}) {
  const tierCfg = DEFAULT_TIERS[tierLevel - 1];
  const style = TIER_STYLES[tierLevel];

  return (
    <div className={`rounded-2xl border border-white/15 overflow-hidden shadow-2xl ${style.glow}`}>
      {/* NFT image placeholder */}
      <div className="aspect-square bg-gradient-to-br from-violet-900/50 via-fuchsia-900/30 to-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.15)_0%,transparent_70%)]" />
        <div className="text-center z-10">
          <div className="text-5xl mb-3">{style.star}</div>
          <div className="text-white/60 text-sm">Your NFT artwork will appear here</div>
          <div className="text-white/30 text-xs mt-1">Add trait images to /public/traits/</div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold">{teamName}</div>
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1 ${style.badge}`}>
              {tierCfg.label} Tier
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-violet-400">{rarityScore}</div>
            <div className="text-xs text-white/40">rarity score</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {attributes.map((attr) => (
            <TraitCard
              key={attr.trait_type}
              traitType={attr.trait_type}
              value={attr.value}
              tierName={attr.tier_name}
              tierLevel={attr.rarity_tier}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Mint Page ───────────────────────────────────────────────────────────
export default function MintPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [preview, setPreview] = useState<{
    attributes: Array<{ trait_type: string; value: string; tier_name: string; rarity_tier: TierLevel }>;
    rarityScore: number;
    tier: TierLevel;
  } | null>(null);
  const [minted, setMinted] = useState<{
    serialNumber: number;
    transactionId: string;
  } | null>(null);
  const [step, setStep] = useState<"connect" | "preview" | "minting" | "done">("connect");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Step 1: Connect wallet & look up team ──────────────────────────────────
  async function handleConnect() {
    if (!walletAddress.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lookup_wallet", walletAddress: walletAddress.trim() }),
    });
    const data = await res.json();

    if (!data.team) {
      setError("Wallet address not found. Make sure your teacher has registered you.");
      setLoading(false);
      return;
    }

    setTeam(data.team);
    setMember(data.member);

    if (data.member?.mintedNFT) {
      setMinted({
        serialNumber: data.member.mintedNFT.serialNumber,
        transactionId: data.member.mintedNFT.transactionId,
      });
      setStep("done");
      setLoading(false);
      return;
    }

    // Load NFT preview
    const previewRes = await fetch("/api/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", teamId: data.team.id }),
    });
    const previewData = await previewRes.json();

    if (previewData.attributes) {
      setPreview({
        attributes: previewData.attributes,
        rarityScore: previewData.rarityScore,
        tier: previewData.tier,
      });
      setStep("preview");
    }

    setLoading(false);
  }

  // ── Step 2: Confirm mint ───────────────────────────────────────────────────
  async function handleMint() {
    if (!team || !member) return;
    setStep("minting");
    setError(null);

    const res = await fetch("/api/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mint",
        teamId: team.id,
        memberId: member.id,
        walletAddress: member.walletAddress,
      }),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error ?? "Mint failed. Please try again.");
      setStep("preview");
      return;
    }

    setMinted({
      serialNumber: data.serialNumber,
      transactionId: data.transactionId,
    });
    setStep("done");
  }

  const tierCfg = team ? DEFAULT_TIERS[team.currentTier - 1] : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-['DM_Sans',sans-serif]">
      {/* Hero header */}
      <div className="text-center pt-16 pb-8 px-4">
        <div className="inline-flex items-center gap-2 bg-violet-900/30 border border-violet-500/30 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          Minthon 2025 — Pediatric Cancer Fundraiser
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
          Claim Your NFT
        </h1>
        <p className="text-white/50 max-w-md mx-auto text-sm leading-relaxed">
          Your team raised funds to help children with pediatric cancer. 
          This NFT is your permanent record of that impact on the Hedera blockchain.
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-16">
        {/* ── STEP: Connect ──────────────────────────────────────────────── */}
        {step === "connect" && (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="text-center mb-2">
              <div className="text-sm text-white/50">Enter your Hedera wallet address to get started</div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Your Hedera Account ID</label>
              <input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="0.0.12345"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center font-mono text-lg placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <div className="text-xs text-white/30 mt-1.5 text-center">
                Find this in your HashPack wallet under Account ID
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={loading || !walletAddress.trim()}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-all"
            >
              {loading ? "Looking up…" : "Connect & Preview NFT →"}
            </button>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs text-white/30 text-center mb-3">Don&apos;t have HashPack yet?</div>
              <a
                href="https://www.hashpack.app"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Download HashPack Wallet →
              </a>
            </div>
          </div>
        )}

        {/* ── STEP: Preview ──────────────────────────────────────────────── */}
        {step === "preview" && team && preview && (
          <div className="space-y-5">
            {/* Team info bar */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center font-bold text-sm">
                {team.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium">{team.name}</div>
                <div className="text-xs text-white/50">
                  {formatDollars(team.donationTotal)} raised
                  {tierCfg && <span className="ml-2 text-amber-400">→ {tierCfg.label} Tier</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/40">member</div>
                <div className="text-sm font-medium">{member?.name}</div>
              </div>
            </div>

            {/* NFT Preview */}
            <NFTPreview
              attributes={preview.attributes}
              rarityScore={preview.rarityScore}
              tierLevel={preview.tier as TierLevel}
              teamName={team.name}
            />

            <div className="bg-violet-900/20 rounded-xl border border-violet-500/20 p-4 text-sm text-violet-300/80 text-center">
              This is a preview. Your final NFT traits are randomly generated at mint time 
              and may differ slightly.
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleMint}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-violet-900/50"
            >
              Mint My NFT on Hedera ✦
            </button>
          </div>
        )}

        {/* ── STEP: Minting ──────────────────────────────────────────────── */}
        {step === "minting" && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto" />
            <div className="text-lg font-medium">Minting your NFT…</div>
            <div className="text-sm text-white/40">This takes a few seconds on Hedera</div>
          </div>
        )}

        {/* ── STEP: Done ─────────────────────────────────────────────────── */}
        {step === "done" && minted && (
          <div className="space-y-5">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">NFT Minted!</h2>
              <p className="text-white/50 text-sm">
                Your NFT is now permanently on the Hedera blockchain.
                Thank you for helping children with cancer!
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Serial Number</span>
                <span className="font-mono font-semibold">#{minted.serialNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Transaction</span>
                <span className="font-mono text-xs text-violet-400 truncate ml-4">
                  {minted.transactionId}
                </span>
              </div>
              <a
                href={`https://hashscan.io/testnet/transaction/${minted.transactionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 rounded-xl text-sm text-violet-300 transition-all"
              >
                View on HashScan Explorer →
              </a>
            </div>

            <div className="text-center text-xs text-white/30 px-4">
              Open HashPack and check your NFTs tab to see your Minthon token.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
