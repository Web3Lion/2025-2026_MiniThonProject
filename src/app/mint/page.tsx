"use client";

import { useState, useEffect, useCallback } from "react";
import { useHashPack } from "@/lib/useHashPack";
import { TierLevel } from "@/types";
import { DEFAULT_TIERS, formatDollars } from "@/lib/tierConfig";

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_LABELS: Record<TierLevel,string> = {1:"Common",2:"Uncommon",3:"Rare",4:"Epic",5:"Legendary"};
const TIER_GRAD:  Record<TierLevel,string>  = {
  1:"from-slate-600 to-slate-900", 2:"from-blue-600 to-blue-900",
  3:"from-emerald-500 to-emerald-900", 4:"from-purple-600 to-purple-900", 5:"from-amber-500 to-yellow-800"
};
const TIER_ICON:  Record<TierLevel,string>  = {1:"⚪",2:"🔵",3:"💚",4:"💜",5:"⭐"};
const TIER_BADGE: Record<TierLevel,string>  = {
  1:"bg-slate-700 text-slate-200", 2:"bg-blue-800 text-blue-200",
  3:"bg-emerald-800 text-emerald-200", 4:"bg-purple-800 text-purple-200", 5:"bg-amber-700 text-amber-100"
};

// ─── Steps ────────────────────────────────────────────────────────────────────
function Steps({current}:{current:number}){
  const steps=["Connect Wallet","Your NFT","Claim!"];
  return(
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label,i)=>{
        const n=i+1; const done=n<current; const active=n===current;
        return(
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${active?"text-white":done?"text-emerald-400":"text-white/30"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${done?"bg-emerald-500 text-white":active?"bg-violet-600 text-white border-2 border-violet-400":"bg-white/10 text-white/30"}`}>
                {done?"✓":n}
              </div>
              <span className="hidden sm:block">{label}</span>
            </div>
            {i<steps.length-1&&<div className={`w-8 h-px ${done?"bg-emerald-500":active?"bg-violet-500/50":"bg-white/10"}`}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti(){
  const colors=["bg-violet-500","bg-fuchsia-500","bg-amber-400","bg-emerald-400","bg-blue-400","bg-pink-400"];
  return(
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({length:50}).map((_,i)=>(
        <div key={i} className={`absolute w-2 h-2 rounded-sm ${colors[i%colors.length]}`}
          style={{left:`${Math.random()*100}%`,top:"-10px",opacity:0,
            animation:`fall ${1.5+Math.random()*2}s ease-in ${Math.random()*1}s forwards`}}/>
      ))}
      <style>{`@keyframes fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({
  memberName, teamName, tier, attributes, rarityScore, imageUri, claimed
}:{
  memberName:string; teamName:string; tier:TierLevel;
  attributes:Array<{trait_type:string;value:string;rarity_tier?:TierLevel}>;
  rarityScore:number; imageUri?:string; claimed?:boolean;
}){
  return(
    <div className={`rounded-2xl overflow-hidden shadow-2xl`} style={{border:"2px solid rgba(124,58,237,0.5)"}}>
      {/* Image / gradient header */}
      <div className={`aspect-square bg-gradient-to-br ${TIER_GRAD[tier]} relative flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse at center,rgba(255,255,255,0.1) 0%,transparent 65%)"}}/>
        {imageUri && imageUri !== "ipfs://placeholder" ? (
          <img src={imageUri.replace("ipfs://","https://ipfs.io/ipfs/")} alt="NFT" className="w-full h-full object-cover absolute inset-0"/>
        ) : (
          <div className="relative z-10 text-center px-6">
            <div className="text-7xl mb-3">{TIER_ICON[tier]}</div>
            <div className="font-black text-white text-xl">{memberName}</div>
            <div className="text-white/60 text-sm mt-1">{TIER_LABELS[tier]} Tier</div>
          </div>
        )}
        {claimed && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold"
            style={{background:"rgba(16,185,129,0.9)",color:"white"}}>✓ Claimed</div>
        )}
        <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold"
          style={{background:"rgba(0,0,0,0.6)",color:"white",border:"1px solid rgba(255,255,255,0.2)"}}>
          ✦ {rarityScore}/100
        </div>
      </div>

      {/* Metadata */}
      <div className="p-5 bg-gray-900/95">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-black text-xl text-white">{memberName}</div>
            <div className="text-sm text-white/50">{teamName}</div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${TIER_BADGE[tier]}`}>
            {TIER_ICON[tier]} {TIER_LABELS[tier]}
          </span>
        </div>
        {attributes.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {attributes.map(attr=>(
              <div key={attr.trait_type} className="rounded-xl p-2.5" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div className="text-xs mb-0.5 text-white/35">{attr.trait_type}</div>
                <div className="text-xs font-semibold text-white truncate">{attr.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function MintPage(){
  const [appNetwork, setAppNetwork] = useState<"testnet"|"mainnet">("testnet");
  const [hasServerCreds, setHasServerCreds] = useState(false);

  useEffect(()=>{
    fetch("/api/admin-credentials")
      .then(r=>r.json())
      .then(d=>{
        setAppNetwork(d.network??"testnet");
        setHasServerCreds(d.hasServerCreds??false);
      })
      .catch(()=>{});
  },[]);

  const hashpack = useHashPack(appNetwork);

  const [step,         setStep]         = useState(1);
  const [memberName,   setMemberName]   = useState("");
  const [teamName,     setTeamName]     = useState("");
  const [tier,         setTier]         = useState<TierLevel>(1);
  const [attributes,   setAttributes]   = useState<Array<{trait_type:string;value:string;rarity_tier?:TierLevel}>>([]);
  const [rarityScore,  setRarityScore]  = useState(0);
  const [imageUri,     setImageUri]     = useState<string|undefined>();
  const [serialNumber, setSerialNumber] = useState<number|null>(null);
  const [claimTxId,    setClaimTxId]   = useState<string|null>(null);
  const [claiming,     setClaiming]     = useState(false);
  const [claimed,      setClaimed]      = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error,        setError]        = useState<string|null>(null);
  const [nftStatus,    setNftStatus]    = useState<"preminted"|"claimed"|null>(null);

  // When wallet connects, look up the student
  useEffect(()=>{
    if(hashpack.connectionState==="connected" && hashpack.accountId && step===1){
      lookupStudent(hashpack.accountId);
    }
  },[hashpack.connectionState, hashpack.accountId]);

  async function lookupStudent(accountId: string){
    setError(null);
    try{
      const res  = await fetch("/api/mint",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"lookup_wallet",walletAddress:accountId})});
      const data = await res.json();

      if(!data.team || !data.member){
        setError("Your wallet isn't registered for this event yet. Ask your teacher to add your wallet address.");
        return;
      }

      setMemberName(data.member.name);
      setTeamName(data.team.name);
      setTier(data.team.currentTier as TierLevel);
      setNftStatus(data.nftStatus);

      if(data.member.mintedNFT){
        const nft = data.member.mintedNFT;
        setSerialNumber(nft.serialNumber);
        setImageUri(nft.imageUri);
        setRarityScore(nft.metadata?.properties?.rarityScore ?? 0);
        setAttributes(nft.metadata?.attributes ?? []);

        if(nft.status === "claimed"){
          setClaimed(true);
          setClaimTxId(nft.claimTransactionId ?? nft.transactionId);
        }
      }

      setStep(2);
    }catch(err){
      setError("Could not look up your account. Please try again.");
    }
  }

  async function handleClaim(){
    if(!hashpack.accountId) return;
    setClaiming(true);
    setError(null);

    try{
      // Claim via server — treasury credentials are in .env.local, never client-side
      const res  = await fetch("/api/claim",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({walletAddress:hashpack.accountId})});
      const data = await res.json();

      if(!data.success){
        setError(data.error ?? "Claim failed — ask your teacher for help");
        setClaiming(false);
        return;
      }

      setSerialNumber(data.serialNumber);
      setClaimTxId(data.claimTransactionId);
      setClaimed(true);
      setNftStatus("claimed");
      setStep(3);
      setShowConfetti(true);
      setTimeout(()=>setShowConfetti(false),5000);
    }catch(err){
      setError("Network error — please try again");
    }
    setClaiming(false);
  }

  return(
    <div className="min-h-screen bg-gray-950 text-white" style={{fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      {showConfetti && <Confetti/>}

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
          Connect your HashPack wallet — your NFT has already been minted by your teacher and is waiting for you.
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-16">
        <Steps current={step}/>

        {/* Error */}
        {error&&(
          <div className="mb-5 p-4 rounded-xl flex items-start gap-3 text-sm"
            style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)"}}>
            <span className="text-red-400 text-lg shrink-0">✗</span>
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* ── STEP 1: Connect ───────────────────────────────────────────────── */}
        {step===1&&(
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-5xl">🔐</div>
              <h2 className="font-semibold text-lg">Connect Your HashPack Wallet</h2>
              <p className="text-sm text-white/50">Your NFT was pre-minted by your teacher. Connect to see it and claim it to your wallet.</p>
            </div>

            {!hasServerCreds&&(
              <div className="p-3 rounded-xl text-xs text-center" style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",color:"rgba(245,158,11,0.9)"}}>
                ⚠ Treasury credentials not configured — teacher needs to add HEDERA_TREASURY_ID and HEDERA_TREASURY_KEY to .env.local
              </div>
            )}

            {hashpack.connectionState==="connecting"?(
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
                  <p className="text-xs text-white/50 mt-1">Install the HashPack browser extension to claim your NFT.</p>
                </div>
                <a href="https://www.hashpack.app/download" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-white"
                  style={{background:"linear-gradient(135deg,#7c3aed,#c026d3)"}}>
                  📥 Download HashPack
                </a>
                <p className="text-center text-xs text-white/30">After installing, refresh this page and try again.</p>
              </div>
            ):(
              <button onClick={hashpack.connect}
                className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all"
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
            )}

            {!hashpack.isInstalled&&hashpack.connectionState==="idle"&&(
              <p className="text-center text-xs text-white/30">
                Don't have HashPack?{" "}
                <a href="https://www.hashpack.app/download" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">Download it here →</a>
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: Show NFT + Claim button ───────────────────────────────── */}
        {step===2&&(
          <div className="space-y-4">
            {/* Wallet confirmed */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
              <span className="text-emerald-400">✓</span>
              <span className="text-sm text-emerald-300">Connected: <span className="font-mono">{hashpack.accountId}</span></span>
              <button onClick={()=>{hashpack.disconnect();setStep(1);setError(null);}} className="ml-auto text-xs text-white/30 hover:text-white/60">Disconnect</button>
            </div>

            {/* NFT status */}
            {nftStatus===null&&(
              <div className="p-5 rounded-2xl text-center" style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)"}}>
                <div className="text-4xl mb-3">⏳</div>
                <h2 className="font-semibold text-lg text-amber-300">NFT Not Ready Yet</h2>
                <p className="text-sm text-white/50 mt-2">
                  Hey {memberName}! Your teacher hasn't minted your NFT yet.<br/>
                  Ask them to go to the Admin → Mint tab and mint your NFT.
                </p>
                <div className="mt-4 p-3 rounded-xl text-sm" style={{background:"rgba(0,0,0,0.3)",color:"rgba(255,255,255,0.5)"}}>
                  Team: <strong className="text-white">{teamName}</strong> · Tier: <strong className="text-white">{TIER_LABELS[tier]}</strong>
                </div>
              </div>
            )}

            {nftStatus==="preminted"&&(
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">Your NFT is ready, {memberName}! 🎉</div>
                  <div className="text-sm text-white/50">Click Claim to transfer it to your HashPack wallet</div>
                </div>

                <NFTCard
                  memberName={memberName} teamName={teamName} tier={tier}
                  attributes={attributes} rarityScore={rarityScore} imageUri={imageUri}
                />

                <button onClick={handleClaim} disabled={claiming||!hasServerCreds}
                  className="w-full py-4 rounded-xl font-black text-white text-xl disabled:opacity-30 transition-all"
                  style={{
                    background:claiming?"rgba(100,40,200,0.5)":"linear-gradient(135deg,#7c3aed,#c026d3)",
                    boxShadow:claiming?"none":"0 4px 0 #4c1d95, 0 8px 32px rgba(124,58,237,0.5)",
                    cursor:claiming?"wait":"pointer",
                  }}
                  onMouseDown={e=>{if(!claiming){(e.currentTarget as HTMLElement).style.transform="translateY(3px)";(e.currentTarget as HTMLElement).style.boxShadow="0 1px 0 #4c1d95";}}}
                  onMouseUp={e=>{if(!claiming){(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 0 #4c1d95, 0 8px 32px rgba(124,58,237,0.5)";}}}
                  onMouseLeave={e=>{if(!claiming){(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 0 #4c1d95, 0 8px 32px rgba(124,58,237,0.5)";}}}
                >
                  {claiming?(
                    <span className="flex items-center justify-center gap-3">
                      <span className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                      Claiming — sending to your wallet…
                    </span>
                  ):"🎁 Claim My NFT →"}
                </button>

                <p className="text-center text-xs text-white/30">
                  This transfers the NFT directly to your HashPack wallet. One click — done.
                </p>
              </>
            )}

            {nftStatus==="claimed"&&(
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">Already claimed! 🎉</div>
                  <div className="text-sm text-white/50">This NFT is already in your HashPack wallet</div>
                </div>
                <NFTCard
                  memberName={memberName} teamName={teamName} tier={tier}
                  attributes={attributes} rarityScore={rarityScore} imageUri={imageUri} claimed
                />
                {claimTxId&&(
                  <a href={`https://hashscan.io/${appNetwork}/transaction/${claimTxId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block text-center py-3 rounded-xl text-sm font-medium transition-all"
                    style={{background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",color:"rgb(196,181,253)"}}>
                    🔍 View on HashScan →
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Claimed! ──────────────────────────────────────────────── */}
        {step===3&&(
          <div className="space-y-5 text-center">
            <div className="py-4">
              <div className="text-7xl mb-4 animate-bounce">🎉</div>
              <h2 className="text-3xl font-black mb-2">It's yours!</h2>
              <p className="text-white/50 text-sm max-w-xs mx-auto">
                Your NFT is now in your HashPack wallet. Open HashPack → Collectibles to see it.
              </p>
            </div>

            <NFTCard
              memberName={memberName} teamName={teamName} tier={tier}
              attributes={attributes} rarityScore={rarityScore} imageUri={imageUri} claimed
            />

            <div className="space-y-3">
              {claimTxId&&(
                <a href={`https://hashscan.io/${appNetwork}/transaction/${claimTxId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="block py-3 rounded-xl text-sm font-medium transition-all"
                  style={{background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.4)",color:"rgb(196,181,253)"}}>
                  🔍 View Transaction on HashScan →
                </a>
              )}
              <div className="p-4 rounded-xl text-sm text-left" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
                <strong className="text-emerald-300">Find your NFT in HashPack:</strong>
                <ol className="mt-2 space-y-1 text-white/60 list-decimal list-inside">
                  <li>Open HashPack extension</li>
                  <li>Click the <strong className="text-white">Collectibles</strong> tab</li>
                  <li>Look for the <strong className="text-white">Minthon</strong> collection</li>
                </ol>
              </div>
              <p className="text-xs text-white/25">
                Serial #{serialNumber} · Thank you for helping children with cancer. 💜
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}