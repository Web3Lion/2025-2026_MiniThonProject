"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import { TraitOption, Tier, TierLevel, TraitCategory } from "@/types";
import { DEFAULT_TIERS, formatDollars } from "@/lib/tierConfig";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES: TraitCategory[] = ["background", "body", "eyes", "accessory", "special", "aura"];
const CATEGORY_ICONS: Record<TraitCategory, string> = {
  background: "🌄", body: "👕", eyes: "👁️", accessory: "🎒", special: "✨", aura: "💫",
};

const TIER_COLORS: Record<TierLevel, { bg: string; border: string; text: string; dot: string }> = {
  1: { bg: "bg-slate-900/60",  border: "border-slate-600/50",  text: "text-slate-300",  dot: "bg-slate-400"  },
  2: { bg: "bg-blue-900/40",   border: "border-blue-600/50",   text: "text-blue-300",   dot: "bg-blue-400"   },
  3: { bg: "bg-emerald-900/40",border: "border-emerald-600/50",text: "text-emerald-300",dot: "bg-emerald-400" },
  4: { bg: "bg-purple-900/40", border: "border-purple-600/50", text: "text-purple-300", dot: "bg-purple-400"  },
  5: { bg: "bg-amber-900/40",  border: "border-amber-600/50",  text: "text-amber-300",  dot: "bg-amber-400"   },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface BatchItem {
  teamId: string; teamName: string; tier: TierLevel;
  memberId: string; memberName: string; walletAddress: string;
}
interface BatchPreview {
  eligible: BatchItem[];
  missingWallet: { teamName: string; memberName: string }[];
  alreadyMinted: { teamName: string; memberName: string; serial: number }[];
}
interface MintProgress {
  total: number; done: number; failed: number;
  log: { name: string; status: "pending"|"ok"|"err"; msg?: string }[];
}

// ─── Sub-component: Section header ───────────────────────────────────────────
function SectionHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0 mt-0.5">
        {step}
      </div>
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Sub-component: Flash message ────────────────────────────────────────────
function Flash({ msg }: { msg: { type: "ok"|"err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`px-4 py-2.5 rounded-lg text-sm mb-4 ${msg.type === "ok" ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/40" : "bg-red-900/50 text-red-300 border border-red-700/40"}`}>
      {msg.text}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Collection Token Setup
// ═══════════════════════════════════════════════════════════════════════════════
function CollectionSetup() {
  const [tokenId, setTokenId] = useState("");
  const [collectionName, setCollectionName] = useState("Minthon 2025 — Cure Kids Cancer");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok"|"err"; text: string }|null>(null);

  useEffect(() => {
    fetch("/api/collection").then(r => r.json()).then(d => {
      if (d.tokenId) setTokenId(d.tokenId);
      if (d.collectionName) setCollectionName(d.collectionName);
    });
  }, []);

  const flash = (type: "ok"|"err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  async function saveCollection() {
    setSaving(true);
    await fetch("/api/collection", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_collection_name", name: collectionName }) });
    if (tokenId.trim()) {
      await fetch("/api/collection", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_token_id", tokenId: tokenId.trim() }) });
    }
    setSaving(false);
    flash("ok", "Collection settings saved");
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <SectionHeader step={1} title="Hedera Collection Token" subtitle="Create your NFT collection on Hedera once, then paste the token ID here." />
      <Flash msg={msg} />

      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Collection Name</label>
          <input value={collectionName} onChange={e => setCollectionName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Hedera Token ID</label>
          <div className="flex gap-2">
            <input value={tokenId} onChange={e => setTokenId(e.target.value)}
              placeholder="0.0.XXXXXXX"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors placeholder-white/20" />
            {tokenId && (
              <a href={`https://hashscan.io/testnet/token/${tokenId}`} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-violet-400 transition-colors whitespace-nowrap">
                View ↗
              </a>
            )}
          </div>
          <p className="text-xs text-white/30 mt-1.5">
            Run <code className="bg-white/10 px-1 rounded">npx ts-node scripts/createCollection.ts</code> to generate this
          </p>
        </div>

        <button onClick={saveCollection} disabled={saving}
          className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
          {saving ? "Saving…" : "Save Collection Settings"}
        </button>
      </div>

      {tokenId && (
        <div className="mt-5 pt-5 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400">Collection active — students can mint</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Tier Unlock Thresholds
// ═══════════════════════════════════════════════════════════════════════════════
function TierEditor() {
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok"|"err"; text: string }|null>(null);

  useEffect(() => {
    fetch("/api/collection").then(r => r.json()).then(d => {
      if (d.tiers?.length) setTiers(d.tiers);
    });
  }, []);

  const flash = (type: "ok"|"err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  function updateDollar(level: TierLevel, dollars: string) {
    const cents = Math.round(parseFloat(dollars || "0") * 100);
    setTiers(prev => prev.map(t => t.level === level ? { ...t, minDonation: cents } : t));
  }

  async function saveTiers() {
    setSaving(true);
    const res = await fetch("/api/collection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_tiers", tiers }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) flash("ok", "Tier thresholds saved — all team tiers have been recalculated");
    else flash("err", data.error ?? "Save failed");
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <SectionHeader step={2} title="Donation Tier Unlock Values"
        subtitle="Set the minimum donation amount (in dollars) for each tier. Teams that hit these totals unlock rarer NFT traits." />
      <Flash msg={msg} />

      <div className="space-y-3">
        {tiers.map((tier) => {
          const c = TIER_COLORS[tier.level as TierLevel];
          const isBase = tier.level === 1;
          return (
            <div key={tier.level} className={`flex items-center gap-4 p-4 rounded-xl border ${c.bg} ${c.border}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
              <div className="w-24 shrink-0">
                <div className={`text-sm font-semibold ${c.text}`}>{tier.label}</div>
                <div className="text-xs text-white/30">Tier {tier.level}</div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40">{tier.description}</p>
              </div>
              {isBase ? (
                <div className="w-36 text-right">
                  <span className="text-sm text-white/40 italic">No minimum — everyone starts here</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-white/50 text-sm">$</span>
                  <input
                    type="number" min="1" step="1"
                    value={tier.minDonation / 100}
                    onChange={e => updateDollar(tier.level as TierLevel, e.target.value)}
                    className={`w-28 bg-black/30 border ${c.border} rounded-lg px-3 py-1.5 text-sm font-mono text-right focus:outline-none focus:border-violet-400 transition-colors`}
                  />
                  <span className="text-white/30 text-xs">min</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Visual threshold bar */}
      <div className="mt-5 pt-5 border-t border-white/10">
        <div className="text-xs text-white/30 mb-2">Threshold preview</div>
        <div className="flex gap-1 h-4 rounded-full overflow-hidden">
          {tiers.map((tier, i) => {
            const next = tiers[i + 1];
            const max = tiers[tiers.length - 1].minDonation * 1.3;
            const w = next
              ? ((next.minDonation - tier.minDonation) / max) * 100
              : ((max - tier.minDonation) / max) * 100;
            const colors = ["bg-slate-500","bg-blue-500","bg-emerald-500","bg-purple-500","bg-amber-500"];
            return <div key={tier.level} style={{ width: `${w}%` }} className={`${colors[i]} transition-all duration-300`} />;
          })}
        </div>
        <div className="flex justify-between text-xs text-white/25 mt-1">
          <span>$0</span>
          {tiers.slice(1).map(t => (
            <span key={t.level}>{formatDollars(t.minDonation)}</span>
          ))}
        </div>
      </div>

      <button onClick={saveTiers} disabled={saving}
        className="mt-5 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
        {saving ? "Saving…" : "Save Tier Thresholds"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Trait Artwork & Tier Assignment
// ═══════════════════════════════════════════════════════════════════════════════
function TraitEditor() {
  const [traits, setTraits] = useState<TraitOption[]>([]);
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [activeCategory, setActiveCategory] = useState<TraitCategory>("background");
  const [dragOver, setDragOver] = useState<TraitCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok"|"err"; text: string }|null>(null);

  const flash = (type: "ok"|"err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  useEffect(() => {
    fetch("/api/collection").then(r => r.json()).then(d => {
      if (d.traitPool?.length) setTraits(d.traitPool);
      if (d.tiers?.length) setTiers(d.tiers);
    });
  }, []);

  // ── Drag & Drop folder handling ─────────────────────────────────────────────
  function handleDragOver(e: DragEvent, cat: TraitCategory) {
    e.preventDefault();
    setDragOver(cat);
  }

  function handleDragLeave() { setDragOver(null); }

  async function handleDrop(e: DragEvent, category: TraitCategory) {
    e.preventDefault();
    setDragOver(null);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/")
    );

    if (files.length === 0) {
      flash("err", "No image files found — drag a folder of PNG/JPG images");
      return;
    }

    const newTraits: TraitOption[] = files.map((file, i) => {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const displayName = nameWithoutExt
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      // Check if trait already exists (by filename)
      const existing = traits.find(t => t.category === category && t.imageFile === file.name);
      if (existing) return existing;

      return {
        id: `${category}-${Date.now()}-${i}`,
        name: displayName,
        category,
        tier: 1 as TierLevel,  // default to tier 1 — admin assigns later
        imageFile: file.name,
        weight: 10,
      };
    });

    // Merge: keep existing, add new
    const existingForCat = traits.filter(t => t.category !== category || !newTraits.find(n => n.id === t.id));
    const merged = [...existingForCat, ...newTraits];
    setTraits(merged);
    flash("ok", `${files.length} image${files.length !== 1 ? "s" : ""} registered for ${category}. Assign their tiers below, then save.`);
  }

  // ── Trait tier assignment ───────────────────────────────────────────────────
  function setTraitTier(traitId: string, tier: TierLevel) {
    setTraits(prev => prev.map(t => t.id === traitId ? { ...t, tier } : t));
  }

  function setTraitName(traitId: string, name: string) {
    setTraits(prev => prev.map(t => t.id === traitId ? { ...t, name } : t));
  }

  function removeTrait(traitId: string) {
    setTraits(prev => prev.filter(t => t.id !== traitId));
  }

  async function saveTraits() {
    setSaving(true);
    const res = await fetch("/api/collection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_traits", traits }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) flash("ok", `${data.count} traits saved successfully`);
    else flash("err", "Save failed");
  }

  const categoryTraits = traits.filter(t => t.category === activeCategory);
  const totalByTier = (tier: TierLevel) => traits.filter(t => t.tier === tier).length;

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <SectionHeader step={3} title="Trait Artwork & Tier Assignment"
        subtitle="Drag a folder of images onto a category to register them. Then assign each trait its unlock tier." />
      <Flash msg={msg} />

      {/* Trait counts by tier */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {([1,2,3,4,5] as TierLevel[]).map(tier => {
          const c = TIER_COLORS[tier];
          const cfg = DEFAULT_TIERS[tier - 1];
          return (
            <div key={tier} className={`rounded-xl p-3 border ${c.bg} ${c.border} text-center`}>
              <div className={`text-xl font-bold ${c.text}`}>{totalByTier(tier)}</div>
              <div className="text-xs text-white/40">{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Category tabs + drop zones */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {CATEGORIES.map(cat => {
          const count = traits.filter(t => t.category === cat).length;
          const isActive = activeCategory === cat;
          const isDrop = dragOver === cat;
          return (
            <div key={cat}
              onClick={() => setActiveCategory(cat)}
              onDragOver={e => handleDragOver(e, cat)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, cat)}
              className={`rounded-xl p-3 border cursor-pointer transition-all text-center select-none
                ${isDrop ? "bg-violet-600/30 border-violet-400 scale-105" : isActive ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/8"}
              `}
            >
              <div className="text-xl mb-1">{CATEGORY_ICONS[cat]}</div>
              <div className="text-xs font-medium capitalize">{cat}</div>
              <div className="text-xs text-white/30 mt-0.5">{count} traits</div>
              {isDrop && <div className="text-xs text-violet-300 mt-1 font-medium">Drop here</div>}
            </div>
          );
        })}
      </div>

      {/* Drop hint */}
      <div className="mb-4 p-3 rounded-xl border border-dashed border-white/15 text-center text-xs text-white/30">
        Drag a folder of images from your computer onto any category above to import artwork
      </div>

      {/* Trait list for active category */}
      <div className="space-y-2">
        {categoryTraits.length === 0 ? (
          <div className="py-10 text-center text-white/20 text-sm">
            No traits yet for <span className="capitalize">{activeCategory}</span> — drag images above to add
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-2 px-2 text-xs text-white/30 mb-1">
              <span className="col-span-1">Preview</span>
              <span className="col-span-4">Display Name</span>
              <span className="col-span-4">File</span>
              <span className="col-span-2">Tier Unlock</span>
              <span className="col-span-1"></span>
            </div>
            {categoryTraits.map(trait => {
              const c = TIER_COLORS[trait.tier as TierLevel];
              return (
                <div key={trait.id} className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl border ${c.bg} ${c.border} transition-all`}>
                  {/* Image preview */}
                  <div className="col-span-1">
                    <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                      <img
                        src={`/traits/${trait.category}/${trait.imageFile}`}
                        alt={trait.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  </div>
                  {/* Name editor */}
                  <div className="col-span-4">
                    <input
                      value={trait.name}
                      onChange={e => setTraitName(trait.id, e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400 transition-colors"
                    />
                  </div>
                  {/* Filename */}
                  <div className="col-span-4">
                    <span className="text-xs text-white/40 font-mono truncate block">{trait.imageFile}</span>
                  </div>
                  {/* Tier selector */}
                  <div className="col-span-2">
                    <select
                      value={trait.tier}
                      onChange={e => setTraitTier(trait.id, Number(e.target.value) as TierLevel)}
                      className={`w-full bg-black/30 border ${c.border} rounded-lg px-2 py-1 text-sm ${c.text} focus:outline-none cursor-pointer`}
                    >
                      {tiers.map(t => (
                        <option key={t.level} value={t.level}>
                          T{t.level} — {t.label} {t.level > 1 ? `($${t.minDonation/100}+)` : "(All)"}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 text-right">
                    <button onClick={() => removeTrait(trait.id)}
                      className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none">
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {traits.length > 0 && (
        <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-white/30">{traits.length} total traits across all categories</span>
          <button onClick={saveTraits} disabled={saving}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
            {saving ? "Saving…" : "Save All Traits"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Batch Mint
// ═══════════════════════════════════════════════════════════════════════════════
function BatchMint() {
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [progress, setProgress] = useState<MintProgress | null>(null);
  const [minting, setMinting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const abortRef = useRef(false);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    const res = await fetch("/api/collection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch_mint_preview" }),
    });
    const data = await res.json();
    setPreview(data);
    setLoadingPreview(false);
  }, []);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  async function startBatchMint() {
    if (!preview || minting) return;
    abortRef.current = false;
    setMinting(true);
    setProgress({
      total: preview.eligible.length, done: 0, failed: 0,
      log: preview.eligible.map(m => ({ name: `${m.teamName} / ${m.memberName}`, status: "pending" })),
    });

    for (let i = 0; i < preview.eligible.length; i++) {
      if (abortRef.current) break;
      const item = preview.eligible[i];

      setProgress(prev => prev ? {
        ...prev,
        log: prev.log.map((l, idx) => idx === i ? { ...l, status: "pending" } : l),
      } : prev);

      try {
        const res = await fetch("/api/mint", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mint",
            teamId: item.teamId,
            memberId: item.memberId,
            walletAddress: item.walletAddress,
          }),
        });
        const data = await res.json();

        setProgress(prev => prev ? {
          ...prev,
          done: data.success ? prev.done + 1 : prev.done,
          failed: data.success ? prev.failed : prev.failed + 1,
          log: prev.log.map((l, idx) => idx === i
            ? { ...l, status: data.success ? "ok" : "err", msg: data.success ? `#${data.serialNumber}` : data.error }
            : l),
        } : prev);
      } catch (err) {
        setProgress(prev => prev ? {
          ...prev, failed: prev.failed + 1,
          log: prev.log.map((l, idx) => idx === i ? { ...l, status: "err", msg: "Network error" } : l),
        } : prev);
      }

      // Small delay between mints — avoids Hedera rate limits
      await new Promise(r => setTimeout(r, 800));
    }

    setMinting(false);
    loadPreview();
  }

  const pct = progress ? Math.round(((progress.done + progress.failed) / progress.total) * 100) : 0;

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <SectionHeader step={4} title="Batch Mint NFTs"
        subtitle="Mint NFTs for all eligible team members at once. Only members with a registered wallet and no existing NFT are included." />

      {loadingPreview ? (
        <div className="py-8 text-center text-white/30 text-sm animate-pulse">Checking mint eligibility…</div>
      ) : preview && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{preview.eligible.length}</div>
              <div className="text-xs text-emerald-300/70 mt-1">Ready to mint</div>
            </div>
            <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{preview.missingWallet.length}</div>
              <div className="text-xs text-amber-300/70 mt-1">Missing wallet</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-slate-400">{preview.alreadyMinted.length}</div>
              <div className="text-xs text-slate-400/70 mt-1">Already minted</div>
            </div>
          </div>

          {/* Eligible list */}
          {preview.eligible.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2.5 border-b border-white/10 text-xs text-white/40 grid grid-cols-12 gap-2">
                <span className="col-span-3">Team</span>
                <span className="col-span-3">Member</span>
                <span className="col-span-2">Tier</span>
                <span className="col-span-4">Wallet</span>
              </div>
              <div className="divide-y divide-white/5 max-h-56 overflow-y-auto">
                {preview.eligible.map((item, i) => {
                  const c = TIER_COLORS[item.tier];
                  const logItem = progress?.log[i];
                  return (
                    <div key={item.memberId} className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center text-sm">
                      <span className="col-span-3 text-white/70 truncate">{item.teamName}</span>
                      <span className="col-span-3 font-medium truncate">{item.memberName}</span>
                      <span className={`col-span-2 text-xs font-medium ${c.text}`}>
                        {DEFAULT_TIERS[item.tier-1].label}
                      </span>
                      <span className="col-span-3 text-xs font-mono text-white/40 truncate">{item.walletAddress}</span>
                      <span className="col-span-1 text-right">
                        {logItem?.status === "ok" && <span className="text-emerald-400 text-base">✓</span>}
                        {logItem?.status === "err" && <span className="text-red-400 text-base" title={logItem.msg}>✗</span>}
                        {logItem?.status === "pending" && minting && i === (progress?.done ?? 0) + (progress?.failed ?? 0) && (
                          <span className="inline-block w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin" />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Missing wallet warnings */}
          {preview.missingWallet.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
              <div className="text-xs font-medium text-amber-300 mb-2">⚠ Members without wallets (excluded from mint)</div>
              <div className="flex flex-wrap gap-2">
                {preview.missingWallet.map((m, i) => (
                  <span key={i} className="text-xs bg-amber-900/40 text-amber-300/70 px-2 py-0.5 rounded-full">
                    {m.teamName} / {m.memberName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar during minting */}
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/50">
                <span>{progress.done} minted · {progress.failed} failed · {progress.total - progress.done - progress.failed} remaining</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 rounded-full"
                  style={{ width: `${pct}%` }} />
              </div>
              {progress.failed > 0 && (
                <div className="text-xs text-red-400">
                  {progress.failed} mint{progress.failed !== 1 ? "s" : ""} failed — check wallet addresses and Hedera credentials
                </div>
              )}
            </div>
          )}

          {/* Confirm & Mint */}
          {preview.eligible.length > 0 && !minting && (!progress || progress.done + progress.failed < progress.total) && (
            <div className="pt-2 space-y-3">
              {!confirmed ? (
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-xl p-4 flex items-start gap-3">
                  <input type="checkbox" id="confirm-mint" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5 accent-violet-500 cursor-pointer w-4 h-4" />
                  <label htmlFor="confirm-mint" className="text-sm text-violet-300/80 cursor-pointer">
                    I confirm the Hedera token ID is set, all wallet addresses are correct, and I want to mint
                    <strong className="text-violet-200"> {preview.eligible.length} NFT{preview.eligible.length !== 1 ? "s" : ""}</strong> on-chain.
                    This cannot be undone.
                  </label>
                </div>
              ) : null}
              <button
                onClick={startBatchMint}
                disabled={!confirmed || minting}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-semibold transition-all shadow-lg shadow-violet-900/40"
              >
                Mint {preview.eligible.length} NFT{preview.eligible.length !== 1 ? "s" : ""} on Hedera ✦
              </button>
            </div>
          )}

          {minting && (
            <button onClick={() => { abortRef.current = true; }}
              className="w-full py-3 border border-red-700/50 text-red-400 hover:bg-red-900/20 rounded-xl text-sm transition-colors">
              Stop Minting After Current
            </button>
          )}

          {progress && !minting && progress.done + progress.failed >= progress.total && (
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 text-center">
              <div className="text-lg font-semibold text-emerald-300">
                ✓ Batch complete — {progress.done} minted
                {progress.failed > 0 && `, ${progress.failed} failed`}
              </div>
              <button onClick={() => { setProgress(null); setConfirmed(false); loadPreview(); }}
                className="mt-2 text-xs text-white/40 hover:text-white/60 transition-colors">
                Refresh list
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CollectionPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white font-['DM_Sans',sans-serif]">
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <a href="/admin" className="text-white/40 hover:text-white/70 text-sm transition-colors">← Admin</a>
        <div className="w-px h-4 bg-white/10" />
        <h1 className="font-semibold text-sm">NFT Collection Setup</h1>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Collection Setup</h1>
          <p className="text-white/40 text-sm">Configure your Hedera token, set donation tier thresholds, manage trait artwork, and mint NFTs.</p>
        </div>

        <CollectionSetup />
        <TierEditor />
        <TraitEditor />
        <BatchMint />
      </div>
    </div>
  );
}
