"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Team, TierLevel } from "@/types";
import { DEFAULT_TIERS, formatDollars } from "@/lib/tierConfig";
import { ThemeProvider, ThemeSwitcher } from "@/components/ThemeProvider";

// ─── NFT Preview Modal ────────────────────────────────────────────────────────
const TIER_GRAD: Record<number,string> = {
  1:"#64748b,#334155", 2:"#3b82f6,#1e3a8a", 3:"#10b981,#064e3b",
  4:"#8b5cf6,#4c1d95", 5:"#f59e0b,#92400e",
};
const TIER_LABEL: Record<number,string> = {1:"Common",2:"Uncommon",3:"Rare",4:"Epic",5:"Legendary"};
const TIER_ICON: Record<number,string> = {1:"⚪",2:"🔵",3:"💚",4:"💜",5:"⭐"};

function NFTPreviewModal({teamId,teamName,tier,onClose}:{teamId:string;teamName:string;tier:TierLevel;onClose:()=>void}){
  const[loading,setLoading]=useState(true);
  const[attributes,setAttributes]=useState<Array<{trait_type:string;value:string;rarity_tier:number;tier_name:string}>>([]);
  const[rarityScore,setRarityScore]=useState(0);
  const[shuffleCount,setShuffleCount]=useState(0);

  useEffect(()=>{
    setLoading(true);
    fetch("/api/mint",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"preview",teamId})})
      .then(r=>r.json())
      .then(d=>{
        if(d.attributes){setAttributes(d.attributes);setRarityScore(d.rarityScore??0);}
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  },[teamId,shuffleCount]);

  const grad=TIER_GRAD[tier]??TIER_GRAD[1];
  const [c1,c2]=grad.split(",");
  const BADGE:Record<number,string>={1:"bg-slate-700 text-slate-200",2:"bg-blue-800 text-blue-200",3:"bg-emerald-800 text-emerald-200",4:"bg-purple-800 text-purple-200",5:"bg-amber-700 text-amber-100"};

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)"}}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}
        style={{border:"2px solid rgba(124,58,237,0.5)",background:"#0f0a1a"}}>

        {/* NFT Image area — generative SVG placeholder */}
        <div className="relative aspect-square flex items-center justify-center overflow-hidden"
          style={{background:`linear-gradient(135deg,${c1},${c2})`}}>
          {/* Decorative radial glow */}
          <div className="absolute inset-0" style={{background:"radial-gradient(ellipse at center,rgba(255,255,255,0.12) 0%,transparent 65%)"}}/>
          {/* Trait layer visualisation */}
          {!loading&&attributes.length>0?(
            <div className="relative z-10 text-center px-6">
              <div className="text-6xl mb-3">{TIER_ICON[tier]}</div>
              <div className="font-black text-white text-2xl mb-1">{teamName}</div>
              <div className="text-white/60 text-sm mb-4">{TIER_LABEL[tier]} Tier NFT</div>
              {/* Mini trait chips */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {attributes.slice(0,6).map(a=>(
                  <span key={a.trait_type} className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{background:"rgba(0,0,0,0.4)",color:"rgba(255,255,255,0.85)",border:"1px solid rgba(255,255,255,0.2)"}}>
                    {a.value}
                  </span>
                ))}
              </div>
            </div>
          ):(
            <div className="relative z-10 text-center">
              {loading
                ?<div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto"/>
                :<div className="text-white/50 text-sm">No traits configured yet</div>}
            </div>
          )}
          {/* Rarity score badge */}
          {!loading&&rarityScore>0&&(
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold"
              style={{background:"rgba(0,0,0,0.6)",color:"white",border:"1px solid rgba(255,255,255,0.2)"}}>
              ✦ {rarityScore}/100
            </div>
          )}
          {/* Serial preview */}
          <div className="absolute bottom-3 left-3 text-xs font-mono" style={{color:"rgba(255,255,255,0.35)"}}>
            Preview — not minted
          </div>
        </div>

        {/* Metadata section */}
        <div className="p-5" style={{background:"rgba(255,255,255,0.03)"}}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-lg text-white">{teamName}</div>
              <div className="text-sm font-semibold" style={{color: tier===5?"#f59e0b":tier===4?"#a78bfa":tier===3?"#34d399":tier===2?"#60a5fa":"#94a3b8"}}>
                {TIER_ICON[tier]} {TIER_LABEL[tier]} Tier
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-violet-400">{rarityScore}</div>
              <div className="text-xs text-white/30">rarity score</div>
            </div>
          </div>

          {/* Trait grid */}
          {loading?(
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6].map(i=><div key={i} className="h-14 rounded-xl animate-pulse" style={{background:"rgba(255,255,255,0.05)"}}/>)}
            </div>
          ):(
            <div className="grid grid-cols-3 gap-2 mb-4">
              {attributes.map(attr=>(
                <div key={attr.trait_type} className="rounded-xl p-2.5" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div className="text-xs mb-1" style={{color:"rgba(255,255,255,0.35)"}}>{attr.trait_type}</div>
                  <div className="text-xs font-semibold text-white truncate">{attr.value}</div>
                  <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded-full ${BADGE[attr.rarity_tier]||BADGE[1]}`}>
                    {attr.tier_name}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={()=>setShuffleCount(s=>s+1)} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border disabled:opacity-30 transition-all"
              style={{background:"rgba(124,58,237,0.15)",borderColor:"rgba(124,58,237,0.4)",color:"rgb(196,181,253)"}}>
              🔀 Shuffle Traits
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)"}}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: TierLevel }) {
  const cfg = DEFAULT_TIERS[tier - 1];
  const colors: Record<TierLevel, string> = {
    1: "bg-slate-100 text-slate-700 border-slate-300",
    2: "bg-blue-100 text-blue-700 border-blue-300",
    3: "bg-emerald-100 text-emerald-700 border-emerald-300",
    4: "bg-purple-100 text-purple-700 border-purple-300",
    5: "bg-amber-100 text-amber-700 border-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[tier]}`}>
      {tier === 5 && "★ "}
      {cfg.label}
    </span>
  );
}

// ─── Progress bar toward next tier ────────────────────────────────────────────
function TierProgress({ total, currentTier }: { total: number; currentTier: TierLevel }) {
  const current = DEFAULT_TIERS[currentTier - 1];
  const next = DEFAULT_TIERS[currentTier] ?? null;
  if (!next) return <div className="text-xs text-amber-600 font-medium">★ Legendary — Max tier reached!</div>;

  const progress = Math.min(100, ((total - current.minDonation) / (next.minDonation - current.minDonation)) * 100);
  const remaining = formatDollars(next.minDonation - total);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatDollars(total)}</span>
        <span>{remaining} to {next.label}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{teamId:string;teamName:string;tier:TierLevel}|null>(null);
  const [tab, setTab] = useState<"teams" | "leaderboard" | "settings">("teams");

  // Form state
  const [newTeamName, setNewTeamName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberWallet, setNewMemberWallet] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [donationDonor, setDonationDonor] = useState("");
  const [donationNote, setDonationNote] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [collectionName, setCollectionName] = useState("Minthon 2025 — Cure Kids Cancer");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    const data = await res.json();
    setTeams(data.teams ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const totalDonations = teams.reduce((s, t) => s + t.donationTotal, 0);
  const sorted = [...teams].sort((a, b) => b.donationTotal - a.donationTotal);
  const expandedTeam = teams.find((t) => t.id === activeTeam) ?? null;

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_team", name: newTeamName }),
    });
    const data = await res.json();
    if (data.team) {
      setNewTeamName("");
      flash("ok", `Team "${data.team.name}" created!`);
      loadTeams();
    } else {
      flash("err", data.error ?? "Failed to create team");
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_team", teamId }),
    });
    if (activeTeam === teamId) setActiveTeam(null);
    flash("ok", "Team deleted");
    loadTeams();
  }

  async function handleAddMember() {
    if (!activeTeam || !newMemberName.trim()) return;
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_member",
        teamId: activeTeam,
        memberName: newMemberName,
        walletAddress: newMemberWallet || undefined,
      }),
    });
    const data = await res.json();
    if (data.member) {
      setNewMemberName("");
      setNewMemberWallet("");
      flash("ok", "Member added");
      loadTeams();
    } else {
      flash("err", data.error ?? "Failed to add member");
    }
  }

  async function handleRecordDonation() {
    if (!activeTeam || !donationAmount) return;
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record",
        teamId: activeTeam,
        amount: donationAmount,
        donor: donationDonor || undefined,
        note: donationNote || undefined,
      }),
    });
    const data = await res.json();
    if (data.entry) {
      setDonationAmount("");
      setDonationDonor("");
      setDonationNote("");
      flash("ok", `Donation of ${formatDollars(data.amountCents)} recorded!`);
      loadTeams();
    } else {
      flash("err", data.error ?? "Failed to record donation");
    }
  }

  async function handleRemoveDonation(teamId: string, entryId: string) {
    await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", teamId, entryId }),
    });
    flash("ok", "Donation removed");
    loadTeams();
  }

  function handlePreviewNFT(teamId: string) {
    const team = teams.find(t => t.id === teamId);
    if(!team) return;
    setPreviewModal({teamId, teamName: team.name, tier: team.currentTier as TierLevel});
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white/60 text-sm animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <div>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-sm font-bold text-white">M</div>
          <div>
            <div className="font-semibold text-sm" style={{color:"var(--text-primary)"}}>Minthon Admin</div>
            <div className="text-xs" style={{color:"var(--text-faint)"}}>Pediatric Cancer Fundraiser</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <ThemeSwitcher />
          <span style={{color:"var(--text-muted)"}}>{teams.length} teams</span>
          <span className="text-emerald-400 font-medium">{formatDollars(totalDonations)} raised</span>
          <button onClick={async()=>{await fetch("/api/auth",{method:"DELETE"});window.location.href="/admin/login";}}
            className="px-3 py-1 rounded-lg border transition-all" style={{borderColor:"var(--border)",color:"var(--text-faint)"}}>
            Logout
          </button>
        </div>
      </header>

      {/* Flash message */}
      {msg && (
        <div className={`mx-6 mt-4 px-4 py-2.5 rounded-lg text-sm ${msg.type === "ok" ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50" : "bg-red-900/50 text-red-300 border border-red-700/50"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between px-6 mt-4">
        <div className="flex gap-1">
          {(["teams", "leaderboard", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm capitalize transition-all ${tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={loadTeams} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
          ↻ Refresh
        </button>
        <Link
          href="/admin/collection"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 rounded-lg text-sm text-violet-300 transition-all"
        >
          <span>🎨</span> NFT Collection Setup
        </Link>
      </div>

      <div className="p-6">
        {/* ── TEAMS TAB ─────────────────────────────────────────────────────── */}
        {tab === "teams" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Team list + create */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                  placeholder="New team name…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleCreateTeam}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
                >
                  + Add
                </button>
              </div>

              {sorted.map((team, rank) => (
                <div
                  key={team.id}
                  onClick={() => setActiveTeam(activeTeam === team.id ? null : team.id)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${activeTeam === team.id ? "bg-white/10 border-violet-500/50" : "bg-white/5 border-white/10 hover:bg-white/8"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30 font-mono w-4">#{rank + 1}</span>
                      <span className="font-medium text-sm">{team.name}</span>
                    </div>
                    <TierBadge tier={team.currentTier as TierLevel} />
                  </div>
                  <TierProgress total={team.donationTotal} currentTier={team.currentTier as TierLevel} />
                  <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                    <span>{team.members.length} member{team.members.length !== 1 ? "s" : ""}</span>
                    <span>{team.donationLog.length} donation{team.donationLog.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}

              {teams.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm">
                  No teams yet. Create one above.
                </div>
              )}
            </div>

            {/* Right: Team detail panel */}
            <div className="lg:col-span-2">
              {expandedTeam ? (
                <div className="space-y-6">
                  {/* Team header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{expandedTeam.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <TierBadge tier={expandedTeam.currentTier as TierLevel} />
                        <span className="text-sm text-white/50">{formatDollars(expandedTeam.donationTotal)} raised</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewNFT(expandedTeam.id)}
                        className="px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 rounded-lg text-xs text-violet-300 transition-all"
                      >
                        Preview NFT
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(expandedTeam.id)}
                        className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-700/30 rounded-lg text-xs text-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Members */}
                  <section className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-white/70 mb-3">Members</h3>
                    <div className="space-y-2 mb-4">
                      {expandedTeam.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div>
                            <div className="text-sm font-medium">{m.name}</div>
                            <div className="text-xs text-white/40 font-mono">
                              {m.walletAddress ?? <span className="text-amber-500/70">no wallet</span>}
                            </div>
                          </div>
                          {m.mintedNFT ? (
                            <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">Minted #{m.mintedNFT.serialNumber}</span>
                          ) : (
                            <span className="text-xs text-white/30">not minted</span>
                          )}
                        </div>
                      ))}
                      {expandedTeam.members.length === 0 && (
                        <div className="text-xs text-white/30 py-2">No members yet</div>
                      )}
                    </div>
                    {/* Add member form */}
                    <div className="flex gap-2">
                      <input
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="Member name"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm placeholder-white/30 focus:outline-none focus:border-violet-500"
                      />
                      <input
                        value={newMemberWallet}
                        onChange={(e) => setNewMemberWallet(e.target.value)}
                        placeholder="0.0.12345"
                        className="w-36 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-violet-500"
                      />
                      <button onClick={handleAddMember} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors">
                        Add
                      </button>
                    </div>
                  </section>

                  {/* Record donation */}
                  <section className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-white/70 mb-3">Record Donation</h3>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                        <input
                          type="number"
                          value={donationAmount}
                          onChange={(e) => setDonationAmount(e.target.value)}
                          placeholder="Amount"
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-3 py-1.5 text-sm placeholder-white/30 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <input
                        value={donationDonor}
                        onChange={(e) => setDonationDonor(e.target.value)}
                        placeholder="Donor name (optional)"
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm placeholder-white/30 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={donationNote}
                        onChange={(e) => setDonationNote(e.target.value)}
                        placeholder="Note (optional)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm placeholder-white/30 focus:outline-none focus:border-violet-500"
                      />
                      <button onClick={handleRecordDonation} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">
                        Record
                      </button>
                    </div>
                  </section>

                  {/* Donation log */}
                  <section className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-white/70 mb-3">Donation Log</h3>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {[...expandedTeam.donationLog].reverse().map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                          <div>
                            <span className="text-sm font-medium text-emerald-400">{formatDollars(entry.amount)}</span>
                            {entry.donor && <span className="text-xs text-white/40 ml-2">from {entry.donor}</span>}
                            {entry.note && <span className="text-xs text-white/30 ml-2 italic">{entry.note}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/30">{new Date(entry.recordedAt).toLocaleDateString()}</span>
                            <button
                              onClick={() => handleRemoveDonation(expandedTeam.id, entry.id)}
                              className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                      {expandedTeam.donationLog.length === 0 && (
                        <div className="text-xs text-white/30 py-2">No donations yet</div>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-white/20 text-sm">
                  ← Select a team to manage
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LEADERBOARD TAB ───────────────────────────────────────────────── */}
        {tab === "leaderboard" && (
          <div className="max-w-2xl space-y-3">
            {sorted.map((team, rank) => (
              <div key={team.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rank === 0 ? "bg-amber-500 text-amber-900" : rank === 1 ? "bg-slate-400 text-slate-900" : rank === 2 ? "bg-orange-700 text-orange-100" : "bg-white/10 text-white/50"}`}>
                  {rank + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{team.name}</span>
                    <TierBadge tier={team.currentTier as TierLevel} />
                  </div>
                  <TierProgress total={team.donationTotal} currentTier={team.currentTier as TierLevel} />
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-400">{formatDollars(team.donationTotal)}</div>
                  <div className="text-xs text-white/40">{team.members.length} members</div>
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div className="text-center py-12 text-white/30">No teams yet</div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ──────────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div className="max-w-lg space-y-6">
            <section className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-4">
              <h3 className="font-medium">Collection Settings</h3>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Collection Name</label>
                <input
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Hedera Token ID (after creation)</label>
                <input
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="0.0.XXXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-violet-500"
                />
              </div>
              <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors">
                Save Settings
              </button>
            </section>

            <section className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
              <h3 className="font-medium">Donation Tier Thresholds</h3>
              {DEFAULT_TIERS.map((tier) => (
                <div key={tier.level} className="flex items-center gap-3">
                  <TierBadge tier={tier.level as TierLevel} />
                  <span className="text-sm text-white/60 flex-1">{tier.description}</span>
                  <span className="text-sm font-mono text-white/70">{tier.level === 1 ? "Any" : `≥ ${formatDollars(tier.minDonation)}`}</span>
                </div>
              ))}
              <p className="text-xs text-white/30">To change thresholds, edit <code className="bg-white/10 px-1 rounded">src/lib/tierConfig.ts</code></p>
            </section>

            <section className="bg-amber-900/20 rounded-xl p-5 border border-amber-700/30 space-y-2">
              <h3 className="font-medium text-amber-300">Environment Variables Required</h3>
              <div className="font-mono text-xs text-white/60 space-y-1">
                {["HEDERA_TREASURY_ID", "HEDERA_TREASURY_KEY", "HEDERA_NETWORK", "PINATA_API_KEY", "PINATA_API_SECRET"].map((v) => (
                  <div key={v} className="flex gap-2">
                    <span className="text-amber-400">{v}</span>
                    <span className="text-white/30">=</span>
                    <span>your_value_here</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40">Add these to your <code className="bg-white/10 px-1 rounded">.env.local</code> file</p>
            </section>
          </div>
        )}
      </div>
    </div>
      {/* NFT Preview Modal */}
      {previewModal&&(
        <NFTPreviewModal
          teamId={previewModal.teamId}
          teamName={previewModal.teamName}
          tier={previewModal.tier}
          onClose={()=>setPreviewModal(null)}
        />
      )}
    </ThemeProvider>
  );
}
