"use client";

import { useState, useEffect, useCallback } from "react";
import { useHashPack } from "@/lib/useHashPack";
import { Team, TeamMember, TierLevel } from "@/types";
import { DEFAULT_TIERS, formatDollars } from "@/lib/tierConfig";

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_LABELS: Record<TierLevel, string> = { 1:"Common",2:"Uncommon",3:"Rare",4:"Epic",5:"Legendary" };
const TIER_COLORS: Record<TierLevel, string> = {
  1:"from-slate-600 to-slate-800",2:"from-blue-600 to-blue-900",
  3:"from-emerald-500 to-emerald-900",4:"from-purple-600 to-purple-900",5:"from-amber-500 to-yellow-700"
};
const TIER_GLOW: Record<TierLevel, string> = {
  1:"shadow-slate-500/20",2:"shadow-blue-500/30",
  3:"shadow-emerald-500/40",4:"shadow-purple-500/50",5:"shadow-amber-500/60"
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({current}:{current:number}){
  const steps=["Connect Wallet","Verify Identity","Preview NFT","Claim!"];
  return(
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label,i)=>{
        const n=i+1;
        const done=n<current;const active=n===current;
        return(
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-all ${active?"text-white":done?"text-emerald-400":"text-white/30"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${done?"bg-emerald-500 text-white":active?"bg-violet-600 text-white border-2 border-violet-400":"bg-white/10 text-white/30"}`}>
                {done?"✓":n}
              </div>
              <span className="hidden sm:block">{label}</span>
            </div>
            {i<steps.length-1&&<div className={`w-8 h-px transition-all ${done?"bg-emerald-500":active?"bg-violet-500/50":"bg-white/10"}`}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── NFT trait card ───────────────────────────────────────────────────────────
function TraitCard({traitType,value,tier}:{traitType:string;value:string;tier:TierLevel}){
  const badges:Record<TierLevel,string>={1:"bg-slate-700 text-slate-200",2:"bg-blue-800 text-blue-200",3:"bg-emerald-800 text-emerald-200",4:"bg-purple-800 text-purple-200",5:"bg-amber-700 text-amber-100"};
  return(
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="text-xs text-white/40 mb-1">{traitType}</div>
      <div className="font-semibold text-sm text-white">{value}</div>
      <span className={`mt-1.5 inline-block text-xs px-2 py-0.5 rounded-full ${badges[tier]}`}>{TIER_LABELS[tier]}</span>
    </div>
  );
}

// ─── Confetti burst ───────────────────────────────────────────────────────────
function Confetti(){
  const colors=["bg-violet-500","bg-fuchsia-500","bg-amber-400","bg-emerald-400","bg-blue-400","bg-pink-400"];
  return(
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({length:40}).map((_,i)=>(
        <div key={i} className={`absolute w-2 h-2 rounded-sm ${colors[i%colors.length]} opacity-0`}
          style={{left:`${Math.random()*100}%`,top:"-10px",
            animation:`fall ${1.5+Math.random()*2}s ease-in ${Math.random()*0.8}s forwards`}}/>
      ))}
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MINT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function MintPage(){
  // Detect network from store (fallback testnet)
  const[appNetwork,setAppNetwork]=useState<"testnet"|"mainnet">("testnet");
  useEffect(()=>{fetch("/api/collection").then(r=>r.json()).then(d=>{/* network from store */}).catch(()=>{});});

  const hashpack=useHashPack(appNetwork);

  const[step,setStep]=useState(1);
  const[team,setTeam]=useState<Team|null>(null);
  const[member,setMember]=useState<TeamMember|null>(null);
  const[preview,setPreview]=useState<{attributes:Array<{trait_type:string;value:string;rarity_tier:TierLevel}>;rarityScore:number;tier:TierLevel}|null>(null);
  const[minting,setMinting]=useState(false);
  const[minted,setMinted]=useState<{serialNumber:number;transactionId:string;imageUri:string;tierName:string;rarityScore:number}|null>(null);
  const[error,setError]=useState<string|null>(null);
  const[showConfetti,setShowConfetti]=useState(false);

  // ── Step 1 → 2: After wallet connected, look up student ───────────────────
  useEffect(()=>{
    if(hashpack.connectionState==="connected"&&hashpack.accountId&&step===1){
      lookupWallet(hashpack.accountId);
    }
  },[hashpack.connectionState,hashpack.accountId]);

  async function lookupWallet(accountId:string){
    setError(null);
    try{
      const res=await fetch("/api/mint",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"lookup_wallet",walletAddress:accountId})});
      const data=await res.json();

      if(!data.team){
        setError("Your wallet isn't registered for this event yet. Ask your teacher to add your wallet address.");
        return;
      }

      setTeam(data.team);
      setMember(data.member);

      if(data.member?.mintedNFT){
        setMinted({
          serialNumber:  data.member.mintedNFT.serialNumber,
          transactionId: data.member.mintedNFT.transactionId,
          imageUri:      data.member.mintedNFT.metadata?.image??"",
          tierName:      TIER_LABELS[data.team.currentTier as TierLevel]??"Common",
          rarityScore:   0,
        });
        setStep(4);
        return;
      }

      // Load NFT preview
      const prevRes=await fetch("/api/mint",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"preview",teamId:data.team.id})});
      const prevData=await prevRes.json();
      if(prevData.attributes) setPreview({attributes:prevData.attributes,rarityScore:prevData.rarityScore,tier:prevData.tier});

      setStep(2);
    }catch(err){
      setError("Could not verify your wallet. Please try again.");
    }
  }

  // ── Step 3: Show preview ───────────────────────────────────────────────────
  function proceedToPreview(){setStep(3);}

  // ── Step 4: Mint ───────────────────────────────────────────────────────────
  async function handleMint(){
    if(!team||!member||!hashpack.accountId)return;
    setMinting(true);setError(null);

    try{
      const res=await fetch("/api/mint",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"mint",
          teamId:      team.id,
          memberId:    member.id,
          walletAddress:hashpack.accountId,
          // Note: credentials come from the server's stored token —
          // for student self-mint we need the admin to have set them up.
          // Pinata keys also from env on server.
        })});
      const data=await res.json();

      if(!data.success){
        setError(data.error??"Mint failed — please ask your teacher for help.");
        setMinting(false);
        return;
      }

      setMinted({
        serialNumber:  data.serialNumber,
        transactionId: data.transactionId,
        imageUri:      data.imageUri??"",
        tierName:      data.tierName??"Common",
        rarityScore:   data.rarityScore??0,
      });
      setStep(4);
      setShowConfetti(true);
      setTimeout(()=>setShowConfetti(false),4000);
    }catch(err){
      setError("Network error — please try again.");
    }
    setMinting(false);
  }

  const tierLevel = (team?.currentTier??1) as TierLevel;
  const tierCfg   = DEFAULT_TIERS[tierLevel-1];

  return(
    <div className="min-h-screen bg-gray-950 text-white" style={{fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      {showConfetti&&<Confetti/>}

      {/* Header */}
      <div className="text-center pt-12 pb-6 px-4">
        <div className="inline-flex items-center gap-2 bg-violet-900/30 border border-violet-500/30 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-5">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"/>
          Minthon — Pediatric Cancer Fundraiser
        </div>
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent mb-3">
          Claim Your NFT
        </h1>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Connect your HashPack wallet to verify your identity and claim the NFT your team earned.
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-16">
        <Steps current={step}/>

        {/* Error banner */}
        {error&&(
          <div className="mb-5 p-4 rounded-xl flex items-start gap-3 text-sm" style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)"}}>
            <span className="text-red-400 text-lg shrink-0">✗</span>
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* ── STEP 1: Connect HashPack ─────────────────────────────────────── */}
        {step===1&&(
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">🔐</div>
              <h2 className="font-semibold text-lg">Connect Your HashPack Wallet</h2>
              <p className="text-sm text-white/50">We'll verify your identity automatically using your wallet address.</p>
            </div>

            {hashpack.connectionState==="connected"?(
              <div className="p-4 rounded-xl text-center" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
                <div className="text-emerald-400 font-semibold">✓ Connected</div>
                <div className="font-mono text-sm text-white/70 mt-1">{hashpack.accountId}</div>
                <div className="text-xs text-white/40 mt-0.5">{hashpack.network} · Looking up your account…</div>
              </div>
            ):hashpack.connectionState==="connecting"?(
              <div className="p-4 rounded-xl text-center" style={{background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.3)"}}>
                <div className="flex items-center justify-center gap-2 text-violet-300">
                  <span className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin"/>
                  Waiting for HashPack…
                </div>
                <p className="text-xs text-white/40 mt-2">Check your HashPack extension for a connection request</p>
              </div>
            ):hashpack.connectionState==="not_installed"?(
              <div className="space-y-3">
                <div className="p-4 rounded-xl text-center" style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)"}}>
                  <div className="text-amber-400 font-medium">HashPack not detected</div>
                  <p className="text-xs text-white/50 mt-1">You need the HashPack browser extension to connect your wallet.</p>
                </div>
                <a href="https://www.hashpack.app/download" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-white transition-all"
                  style={{background:"linear-gradient(135deg,#7c3aed,#c026d3)"}}>
                  📥 Download HashPack
                </a>
                <p className="text-center text-xs text-white/30">After installing, refresh this page and try again.</p>
              </div>
            ):(
              <div className="space-y-3">
                <button
                  onClick={hashpack.connect}
                  className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all relative overflow-hidden"
                  style={{
                    background:"linear-gradient(135deg,#7c3aed,#c026d3)",
                    boxShadow:"0 4px 0 #4c1d95, 0 8px 24px rgba(124,58,237,0.4)",
                  }}
                  onMouseDown={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(3px)";(e.currentTarget as HTMLElement).style.boxShadow="0 1px 0 #4c1d95";}}
                  onMouseUp={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 0 #4c1d95, 0 8px 24px rgba(124,58,237,0.4)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 0 #4c1d95, 0 8px 24px rgba(124,58,237,0.4)";}}
                >
                  🔗 Connect HashPack Wallet
                </button>
                {!hashpack.isInstalled&&(
                  <p className="text-center text-xs text-white/30">
                    Don't have HashPack?{" "}
                    <a href="https://www.hashpack.app/download" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">Download it here →</a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Verify identity ──────────────────────────────────────── */}
        {step===2&&team&&member&&(
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">👋</div>
                <h2 className="font-semibold text-xl">Welcome, {member.name}!</h2>
                <p className="text-white/50 text-sm mt-1">We found your account. Is this you?</p>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                  <span className="text-sm text-white/60">Team</span>
                  <span className="font-semibold">{team.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                  <span className="text-sm text-white/60">Donations Raised</span>
                  <span className="font-semibold text-emerald-400">{formatDollars(team.donationTotal)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{background:`rgba(124,58,237,0.15)`,border:"1px solid rgba(124,58,237,0.3)"}}>
                  <span className="text-sm text-white/60">NFT Tier Earned</span>
                  <span className={`font-bold bg-gradient-to-r ${TIER_COLORS[tierLevel]} bg-clip-text text-transparent`}>
                    ✦ {TIER_LABELS[tierLevel]}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                  <span className="text-sm text-white/60">Wallet</span>
                  <span className="font-mono text-xs text-white/70">{hashpack.accountId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>{hashpack.disconnect();setStep(1);setTeam(null);setMember(null);setError(null);}}
                  className="py-3 rounded-xl text-sm border transition-all" style={{borderColor:"rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)"}}>
                  Not me
                </button>
                <button onClick={proceedToPreview}
                  className="py-3 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{background:"linear-gradient(135deg,#7c3aed,#c026d3)",boxShadow:"0 3px 0 #4c1d95"}}>
                  That's me! →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: NFT Preview ──────────────────────────────────────────── */}
        {step===3&&team&&preview&&(
          <div className="space-y-4">
            {/* NFT card */}
            <div className={`rounded-2xl overflow-hidden shadow-2xl ${TIER_GLOW[tierLevel]}`}
              style={{border:"2px solid rgba(124,58,237,0.4)"}}>
              {/* Image area */}
              <div className={`aspect-square bg-gradient-to-br ${TIER_COLORS[tierLevel]} flex items-center justify-center relative`}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)]"/>
                <div className="text-center z-10 p-6">
                  <div className="text-6xl mb-3">
                    {tierLevel===5?"⭐":tierLevel===4?"💜":tierLevel===3?"💚":tierLevel===2?"🔵":"⚪"}
                  </div>
                  <div className="text-white/60 text-sm">Your NFT image will appear here</div>
                  <div className="text-white/30 text-xs mt-1">Generated when minted on Hedera</div>
                </div>
              </div>

              {/* Metadata */}
              <div className="p-5 bg-gray-900/90">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-bold text-lg">{team.name}</div>
                    <div className={`text-sm font-semibold bg-gradient-to-r ${TIER_COLORS[tierLevel]} bg-clip-text text-transparent`}>
                      ✦ {TIER_LABELS[tierLevel]} Tier
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-violet-400">{preview.rarityScore}</div>
                    <div className="text-xs text-white/40">rarity score</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {preview.attributes.map(attr=>(
                    <TraitCard key={attr.trait_type} traitType={attr.trait_type} value={attr.value} tier={attr.rarity_tier??1}/>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl text-sm text-center text-violet-300/80" style={{background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)"}}>
              This is a preview — final traits are generated randomly at mint time and may vary slightly.
            </div>

            <button onClick={handleMint} disabled={minting}
              className="w-full py-4 rounded-xl font-black text-white text-xl transition-all relative"
              style={{
                background: minting?"rgba(100,40,200,0.5)":"linear-gradient(135deg,#7c3aed,#c026d3)",
                boxShadow: minting?"none":"0 4px 0 #4c1d95, 0 8px 32px rgba(124,58,237,0.5)",
                cursor: minting?"wait":"pointer",
              }}
              onMouseDown={e=>{if(!minting){(e.currentTarget as HTMLElement).style.transform="translateY(3px)";(e.currentTarget as HTMLElement).style.boxShadow="0 1px 0 #4c1d95";}}}
              onMouseUp={e=>{if(!minting){(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 0 #4c1d95, 0 8px 32px rgba(124,58,237,0.5)";}}}
              onMouseLeave={e=>{if(!minting){(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 0 #4c1d95, 0 8px 32px rgba(124,58,237,0.5)";}}}
            >
              {minting?(
                <span className="flex items-center justify-center gap-3">
                  <span className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                  Minting on Hedera…
                </span>
              ):"🚀 Mint My NFT on Hedera ✦"}
            </button>
          </div>
        )}

        {/* ── STEP 4: Minted! ──────────────────────────────────────────────── */}
        {step===4&&minted&&(
          <div className="space-y-5 text-center">
            <div className="py-6">
              <div className="text-7xl mb-4 animate-bounce">🎉</div>
              <h2 className="text-3xl font-black mb-2">NFT Minted!</h2>
              <p className="text-white/50 text-sm max-w-xs mx-auto">
                Your NFT is now permanently on the Hedera blockchain. Open HashPack to see it in your wallet!
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/10 p-5 text-left space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/50">Serial Number</span>
                <span className="font-mono font-bold text-violet-300">#{minted.serialNumber}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/50">Rarity</span>
                <span className="font-bold">{minted.tierName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/50">Transaction</span>
                <span className="font-mono text-xs text-white/40 truncate max-w-40">{minted.transactionId}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <a href={`https://hashscan.io/testnet/transaction/${minted.transactionId}`}
                target="_blank" rel="noopener noreferrer"
                className="block py-3 rounded-xl text-sm font-medium transition-all"
                style={{background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.4)",color:"rgb(196,181,253)"}}>
                🔍 View on HashScan Explorer →
              </a>
              <div className="p-4 rounded-xl text-sm text-emerald-300/80" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
                <strong>🦊 Find your NFT in HashPack:</strong><br/>
                Open HashPack → Collectibles tab → look for the Minthon collection
              </div>
            </div>

            <p className="text-xs text-white/25 mt-4">
              Thank you for helping children with cancer. Your fundraising made a real difference. 💜
            </p>
          </div>
        )}
      </div>
    </div>
  );
}