"use client";
import { useState, useEffect, useRef, DragEvent, useCallback } from "react";
import { TraitOption, TierLevel, TraitCategory, LayerDefinition, Tier } from "@/types";
import { DEFAULT_TIERS, DEFAULT_LAYERS, formatDollars } from "@/lib/tierConfig";
import { parseTraitFilename, fileToDataUrl, compositeNFT, LayerImage } from "@/lib/compositor";
import { HederaNetwork } from "@/lib/hederaClient";
import { useWalletCredentials } from "@/lib/useWalletCredentials";
import { THEMES, AppTheme, THEME_STORAGE_KEY } from "@/lib/themes";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TokenConfig { name:string;symbol:string;maxSupply:number;royaltyPercent:number;royaltyCollector:string;royaltyFallbackHbar:number;keys:{admin:boolean;supply:boolean;freeze:boolean;wipe:boolean;kyc:boolean}; }
interface EnrichedTrait extends TraitOption { imageData:string; }
interface BatchItem { teamId:string;teamName:string;tier:TierLevel;memberId:string;memberName:string;walletAddress:string; }
interface BatchPreview { eligible:BatchItem[];missingWallet:{teamName:string;memberName:string}[];alreadyMinted:{teamName:string;memberName:string;serial:number}[]; }
interface MintLog { name:string;status:"pending"|"running"|"ok"|"err";msg?:string; }
interface StudentWallet { studentName:string;accountId:string;privateKey:string;publicKey:string;mnemonic:string;network:string; }

// ─── Theme helper ─────────────────────────────────────────────────────────────
function hashScanTokenUrl(tokenId:string,network:HederaNetwork){return `https://hashscan.io/${network}/token/${tokenId}`;}
const TIER_COLORS:Record<TierLevel,{bg:string;border:string;text:string;dot:string}>={1:{bg:"bg-slate-900/60",border:"border-slate-600/50",text:"text-slate-300",dot:"bg-slate-400"},2:{bg:"bg-blue-900/40",border:"border-blue-600/50",text:"text-blue-300",dot:"bg-blue-400"},3:{bg:"bg-emerald-900/40",border:"border-emerald-600/50",text:"text-emerald-300",dot:"bg-emerald-400"},4:{bg:"bg-purple-900/40",border:"border-purple-600/50",text:"text-purple-300",dot:"bg-purple-400"},5:{bg:"bg-amber-900/40",border:"border-amber-600/50",text:"text-amber-300",dot:"bg-amber-400"}};

// ─── Shared UI components ──────────────────────────────────────────────────────
function SectionHeader({step,title,subtitle}:{step:number;title:string;subtitle:string}){return(<div className="flex items-start gap-4 mb-6"><div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0 mt-0.5">{step}</div><div><h2 className="font-semibold" style={{color:"var(--text-primary)"}}>{title}</h2><p className="text-xs mt-0.5" style={{color:"var(--text-faint)"}}>{subtitle}</p></div></div>);}
function Flash({msg}:{msg:{type:"ok"|"err"|"warn";text:string}|null}){if(!msg)return null;const cls=msg.type==="ok"?"bg-emerald-900/50 text-emerald-300 border-emerald-700/40":msg.type==="warn"?"bg-amber-900/50 text-amber-300 border-amber-700/40":"bg-red-900/50 text-red-300 border-red-700/40";return <div className={`px-4 py-2.5 rounded-lg text-sm mb-4 border ${cls}`}>{msg.text}</div>;}
function useFlash(){const[msg,setMsg]=useState<{type:"ok"|"err"|"warn";text:string}|null>(null);const flash=useCallback((type:"ok"|"err"|"warn",text:string)=>{setMsg({type,text});setTimeout(()=>setMsg(null),5000);},[]);return{msg,flash};}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Wallet
// ═══════════════════════════════════════════════════════════════════════════════
function WalletKeyManager({onReady}:{onReady:(r:boolean)=>void}){
  const w=useWalletCredentials();
  const[showKey,setShowKey]=useState(false);
  const{msg,flash}=useFlash();
  useEffect(()=>{onReady(w.isReady);},[w.isReady,onReady]);
  async function handleSave(){const r=await w.saveToStorage();if(r.success)flash("ok",w.useEncryption?"🔒 Key encrypted & saved":"Saved (unencrypted)");else flash("err",r.error??"Save failed");}

  if(w.storageState==="locked")return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={1} title="Hedera Wallet Credentials" subtitle="Encrypted credentials found. Enter password to unlock."/>
      <div className="max-w-sm mx-auto space-y-4 py-4">
        <div className="text-center"><div className="text-5xl mb-2">🔒</div><div className="text-sm" style={{color:"var(--text-muted)"}}>Account: <span className="font-mono">{w.accountId}</span> · {w.network}</div></div>
        <input type="password" value={w.unlockPassword} onChange={e=>w.setUnlockPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&w.unlock()} placeholder="Encryption password"
          className="w-full rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/>
        {w.unlockError&&<div className="text-sm text-red-400 text-center bg-red-900/20 border border-red-700/30 rounded-xl p-3">{w.unlockError}</div>}
        <button onClick={w.unlock} disabled={!w.unlockPassword||w.unlocking} className="w-full py-3 rounded-xl font-medium text-white transition-all disabled:opacity-40" style={{background:"var(--accent-grad)"}}>
          {w.unlocking?"Decrypting…":"Unlock 🔓"}</button>
        <button onClick={w.clearCredentials} className="w-full py-2 text-xs text-red-400/60 hover:text-red-400">Forget saved credentials</button>
      </div>
    </div>
  );

  const strength=w.encPasswordStrength;
  const barWidths=["w-1/5","w-2/5","w-3/5","w-4/5","w-full"];
  return(
    <div className="rounded-2xl border p-6 space-y-4" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={1} title="Hedera Wallet Credentials" subtitle="Your private key signs all transactions. Never sent to any server."/>
      <div className="flex gap-3 rounded-xl p-4 text-sm" style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)"}}>
        <span className="text-amber-400 text-lg shrink-0">⚠</span>
        <div className="text-amber-200/80"><strong className="text-amber-300">Security:</strong> Never paste your mainnet key on a shared computer.</div>
      </div>
      {w.storageState==="unlocked"&&<div className="flex items-center gap-2 p-3 rounded-xl" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}><span className="text-emerald-400">🔓</span><span className="text-sm text-emerald-300">Unlocked from encrypted storage</span></div>}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-xs mb-1.5 block" style={{color:"var(--text-muted)"}}>Network</label>
          <div className="flex rounded-xl overflow-hidden" style={{border:"1px solid var(--border)"}}>
            {(["testnet","mainnet"] as HederaNetwork[]).map(n=><button key={n} onClick={()=>w.setNetwork(n)} className="flex-1 py-2.5 text-sm font-medium capitalize transition-all" style={{background:w.network===n?"var(--accent)":"var(--bg-card)",color:w.network===n?"white":"var(--text-muted)"}}>{n}</button>)}
          </div></div>
        <div><label className="text-xs mb-1.5 block" style={{color:"var(--text-muted)"}}>Account ID</label>
          <input value={w.accountId} onChange={e=>w.setAccountId(e.target.value)} placeholder="0.0.12345"
            className="w-full rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/></div>
      </div>
      <div><label className="text-xs mb-1.5 flex items-center justify-between" style={{color:"var(--text-muted)"}}>
        <span>Private Key</span>
        {w.validating&&<span className="animate-pulse">Validating…</span>}
        {!w.validating&&w.keyValid===true&&<span className="text-emerald-400">✓ Valid</span>}
        {!w.validating&&w.keyValid===false&&<span className="text-red-400">✗ {w.keyError}</span>}
      </label>
        <div className="relative">
          <input type={showKey?"text":"password"} value={w.privateKey} onChange={e=>w.setPrivateKey(e.target.value)} placeholder="Paste Hedera private key (DER or hex)"
            className="w-full rounded-xl px-4 py-2.5 text-sm font-mono pr-20 focus:outline-none" style={{background:"var(--bg-card)",border:`1px solid ${w.keyValid===true?"rgb(16,185,129)":w.keyValid===false?"rgb(239,68,68)":"var(--border)"}`,color:"var(--text-primary)"}}/>
          <button onClick={()=>setShowKey(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1" style={{color:"var(--text-faint)"}}>{showKey?"Hide":"Show"}</button>
        </div>
      </div>
      <div className="border-t pt-4 space-y-3" style={{borderColor:"var(--border)"}}>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={w.remember} onChange={e=>w.setRemember(e.target.checked)} className="w-4 h-4 accent-violet-500"/>
            <span className="text-sm" style={{color:"var(--text-primary)"}}>Remember in this browser</span>
          </label>
          {(w.accountId||w.privateKey)&&<button onClick={w.clearCredentials} className="text-xs text-red-400/60 hover:text-red-400">Clear &amp; forget</button>}
        </div>
        {w.remember&&<div className="rounded-xl border p-4 space-y-3" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={w.useEncryption} onChange={e=>w.setUseEncryption(e.target.checked)} className="w-4 h-4 accent-violet-500"/>
            <div><span className="text-sm font-medium" style={{color:"var(--text-primary)"}}>🔒 Encrypt with password (AES-256-GCM)</span>
              <div className="text-xs mt-0.5" style={{color:"var(--text-faint)"}}>Industry-standard encryption — PBKDF2 key derivation</div></div>
          </label>
          {w.useEncryption&&<div className="space-y-3 pl-7">
            <div><label className="text-xs mb-1 flex items-center justify-between" style={{color:"var(--text-muted)"}}>
              <span>Encryption Password</span>{strength&&<span className={strength.color}>{strength.label}</span>}
            </label>
              <input type="password" value={w.encPassword} onChange={e=>w.setEncPassword(e.target.value)} placeholder="Choose a strong password"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/>
              {strength&&<div className="mt-1.5"><div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.1)"}}><div className={`h-full ${strength.barColor} ${barWidths[strength.score]} transition-all rounded-full`}/></div>
                {strength.suggestions[0]&&<div className="text-xs mt-1" style={{color:"var(--text-faint)"}}>{strength.suggestions[0]}</div>}</div>}
            </div>
            <div><label className="text-xs mb-1 flex items-center justify-between" style={{color:"var(--text-muted)"}}>
              <span>Confirm</span>{w.encPassword&&w.encPasswordConfirm&&(w.passwordsMatch?<span className="text-emerald-400">✓ Match</span>:<span className="text-red-400">✗ No match</span>)}
            </label>
              <input type="password" value={w.encPasswordConfirm} onChange={e=>w.setEncPasswordConfirm(e.target.value)} placeholder="Re-enter password"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{background:"var(--bg-card)",border:`1px solid ${w.encPasswordConfirm?(w.passwordsMatch?"rgb(16,185,129)":"rgb(239,68,68)"):"var(--border)"}`,color:"var(--text-primary)"}}/>
            </div>
            <p className="text-xs rounded-lg p-2" style={{background:"rgba(0,0,0,0.2)",color:"var(--text-faint)"}}>⚠ Forgotten password = must re-paste key. There is no recovery.</p>
          </div>}
          {!w.useEncryption&&<div className="pl-7 p-3 text-xs text-red-300 rounded-lg" style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)"}}>⚠ Private key stored in plaintext. Only do this on a personal device.</div>}
          <Flash msg={msg}/>
          <button onClick={handleSave} disabled={w.saving||(w.useEncryption&&!w.canSaveEncrypted)} className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-30 transition-all" style={{background:"var(--accent-grad)"}}>
            {w.saving?"Encrypting…":w.useEncryption?"🔒 Encrypt & Save":"Save to Browser"}</button>
        </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Layer Setup
// ═══════════════════════════════════════════════════════════════════════════════
function LayerSetup(){
  const[layers,setLayers]=useState<LayerDefinition[]>(DEFAULT_LAYERS);
  const[saving,setSaving]=useState(false);
  const{msg,flash}=useFlash();

  useEffect(()=>{fetch("/api/collection").then(r=>r.json()).then(d=>{if(d.layers?.length)setLayers(d.layers);});},[]);

  function addLayer(){const maxOrder=Math.max(0,...layers.map(l=>l.order));setLayers(p=>[...p,{id:`layer-${Date.now()}`,name:`Layer ${maxOrder+1}`,order:maxOrder+1,required:false}]);}
  function removeLayer(id:string){setLayers(p=>p.filter(l=>l.id!==id));}
  function updateLayer(id:string,field:keyof LayerDefinition,val:unknown){setLayers(p=>p.map(l=>l.id===id?{...l,[field]:val}:l));}
  function moveUp(idx:number){if(idx===0)return;const a=[...layers];[a[idx-1],a[idx]]=[a[idx],a[idx-1]];a.forEach((l,i)=>l.order=i+1);setLayers(a);}
  function moveDown(idx:number){if(idx===layers.length-1)return;const a=[...layers];[a[idx],a[idx+1]]=[a[idx+1],a[idx]];a.forEach((l,i)=>l.order=i+1);setLayers(a);}

  async function save(){
    setSaving(true);
    const sorted=layers.map((l,i)=>({...l,order:i+1}));
    const res=await fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_layers",layers:sorted})});
    const data=await res.json();
    setSaving(false);
    if(data.success){setLayers(sorted);flash("ok","Layer order saved");}else flash("err","Save failed");
  }

  return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={2} title="Layer Definitions" subtitle="Define and name your NFT layers before uploading artwork. Order = bottom to top. Each layer = one trait category."/>
      <Flash msg={msg}/>
      <div className="space-y-2 mb-4">
        <div className="grid grid-cols-12 gap-2 px-2 text-xs mb-1" style={{color:"var(--text-faint)"}}>
          <span className="col-span-1">Order</span><span className="col-span-5">Layer Name</span><span className="col-span-2">Required</span><span className="col-span-2">Move</span><span className="col-span-2">Remove</span>
        </div>
        {layers.map((layer,idx)=>(
          <div key={layer.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl border" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
            <div className="col-span-1 text-center text-sm font-mono font-bold" style={{color:"var(--text-muted)"}}>{idx+1}</div>
            <div className="col-span-5">
              <input value={layer.name} onChange={e=>updateLayer(layer.id,"name",e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{background:"rgba(0,0,0,0.2)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/>
            </div>
            <div className="col-span-2 flex justify-center">
              <input type="checkbox" checked={layer.required} onChange={e=>updateLayer(layer.id,"required",e.target.checked)} className="w-4 h-4 accent-violet-500"/>
            </div>
            <div className="col-span-2 flex gap-1">
              <button onClick={()=>moveUp(idx)} disabled={idx===0} className="px-2 py-1 rounded text-xs disabled:opacity-20" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-muted)"}}>↑</button>
              <button onClick={()=>moveDown(idx)} disabled={idx===layers.length-1} className="px-2 py-1 rounded text-xs disabled:opacity-20" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-muted)"}}>↓</button>
            </div>
            <div className="col-span-2">
              <button onClick={()=>removeLayer(layer.id)} className="text-red-400/50 hover:text-red-400 text-lg leading-none">×</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={addLayer} className="px-4 py-2 rounded-xl text-sm border transition-all" style={{background:"var(--bg-card)",borderColor:"var(--border)",color:"var(--text-muted)"}}>+ Add Layer</button>
        <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-all" style={{background:"var(--accent)"}}>
          {saving?"Saving…":"Save Layer Order"}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Token Creation
// ═══════════════════════════════════════════════════════════════════════════════
function TokenCreator({walletReady,getCredentials,network}:{walletReady:boolean;getCredentials:()=>import("@/lib/hederaClient").WalletCredentials|null;network:HederaNetwork;}){
  const[cfg,setCfg]=useState<TokenConfig>({name:"Minthon 2025 — Cure Kids Cancer",symbol:"MNTH25",maxSupply:500,royaltyPercent:5,royaltyCollector:"",royaltyFallbackHbar:1,keys:{admin:true,supply:true,freeze:true,wipe:true,kyc:false}});
  const[creating,setCreating]=useState(false);
  const[tokenId,setTokenId]=useState<string|null>(null);
  const{msg,flash}=useFlash();

  useEffect(()=>{fetch("/api/collection").then(r=>r.json()).then(d=>{if(d.tokenId)setTokenId(d.tokenId);if(d.collectionName)setCfg(p=>({...p,name:d.collectionName}));});},[]);

  const upd=(k:keyof TokenConfig,v:unknown)=>setCfg(p=>({...p,[k]:v}));
  const updKey=(k:keyof TokenConfig["keys"],v:boolean)=>setCfg(p=>({...p,keys:{...p.keys,[k]:v}}));

  async function handleCreate(){
    const creds=getCredentials();
    if(!creds){flash("err","Complete wallet credentials first");return;}
    if(!cfg.name.trim()||!cfg.symbol.trim()){flash("err","Name and symbol required");return;}
    if(cfg.royaltyPercent>0&&!cfg.royaltyCollector.trim()){flash("err","Charity wallet address required for royalties");return;}
    setCreating(true);
    const res=await fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create_token",credentials:{accountId:creds.accountId,privateKey:creds.privateKey,network:creds.network},tokenConfig:{name:cfg.name,symbol:cfg.symbol,maxSupply:cfg.maxSupply,royaltyPercent:cfg.royaltyPercent,royaltyCollectorId:cfg.royaltyCollector,royaltyFallbackHbar:cfg.royaltyFallbackHbar,keys:cfg.keys}})});
    const data=await res.json();
    setCreating(false);
    if(data.success&&data.tokenId){setTokenId(data.tokenId);flash("ok",`✓ Collection created! Token: ${data.tokenId}`);}
    else flash("err",data.error??"Token creation failed");
  }

  const KEYS:[{key:keyof TokenConfig["keys"];label:string;desc:string;required?:boolean}] = [{key:"supply",label:"Supply Key",desc:"Required to mint NFTs",required:true},{key:"admin",label:"Admin Key",desc:"Update or delete token"},{key:"freeze",label:"Freeze Key",desc:"Freeze wallets"},{key:"wipe",label:"Wipe Key",desc:"Remove tokens from wallet"},{key:"kyc",label:"KYC Key",desc:"Require wallet approval"}] as any;

  return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={3} title="Create NFT Collection Token" subtitle="Creates the Hedera HTS token. Do this once before any minting."/>
      {!walletReady&&<div className="mb-4 p-4 rounded-xl text-sm text-center" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-faint)"}}>Complete Step 1 to enable token creation</div>}
      <Flash msg={msg}/>
      {tokenId&&<div className="mb-4 p-4 rounded-xl flex items-center justify-between" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
        <div><div className="text-xs text-emerald-400/70 mb-0.5">Active Collection</div><div className="font-mono text-emerald-300 font-semibold">{tokenId}</div></div>
        <a href={hashScanTokenUrl(tokenId,network)} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300">View on HashScan ↗</a>
      </div>}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[{label:"Collection Name",val:cfg.name,key:"name",ph:"Minthon 2025…"},{label:"Token Symbol",val:cfg.symbol,key:"symbol",ph:"MNTH25",mono:true}].map(f=>(
          <div key={f.key}><label className="text-xs mb-1.5 block" style={{color:"var(--text-muted)"}}>{f.label}</label>
            <input value={f.val} onChange={e=>upd(f.key as keyof TokenConfig,(f.key==="symbol"?e.target.value.toUpperCase():e.target.value))} placeholder={f.ph}
              className={`w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none ${f.mono?"font-mono":""}`} style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/></div>
        ))}
        <div><label className="text-xs mb-1.5 block" style={{color:"var(--text-muted)"}}>Maximum Supply</label>
          <input type="number" min="1" value={cfg.maxSupply} onChange={e=>upd("maxSupply",parseInt(e.target.value)||1)}
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/>
          <p className="text-xs mt-1" style={{color:"var(--text-faint)"}}>Hard cap — can never be increased</p></div>
        <div><label className="text-xs mb-1.5 block" style={{color:"var(--text-muted)"}}>Royalty %</label>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" step="0.5" value={cfg.royaltyPercent} onChange={e=>upd("royaltyPercent",parseFloat(e.target.value)||0)}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/>
            <span className="text-sm" style={{color:"var(--text-muted)"}}>%</span>
          </div></div>
      </div>
      <div className="mb-4"><label className="text-xs mb-1.5 block" style={{color:"var(--text-muted)"}}>Charity Wallet (royalty recipient)</label>
        <input value={cfg.royaltyCollector} onChange={e=>upd("royaltyCollector",e.target.value)} placeholder="0.0.XXXXX — charity's Hedera account"
          className="w-full rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/></div>
      <div className="mb-5"><div className="text-xs mb-2" style={{color:"var(--text-muted)"}}>Token Keys <span style={{color:"var(--text-faint)"}}>(all use your private key)</span></div>
        <div className="grid grid-cols-2 gap-2">
          {KEYS.map(({key,label,desc,required})=>(
            <label key={key} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all" style={{background:cfg.keys[key as keyof typeof cfg.keys]?"rgba(124,58,237,0.15)":"var(--bg-card)",borderColor:cfg.keys[key as keyof typeof cfg.keys]?"rgba(124,58,237,0.4)":"var(--border)"}}>
              <input type="checkbox" checked={cfg.keys[key as keyof typeof cfg.keys]} disabled={required} onChange={e=>updKey(key as keyof typeof cfg.keys,e.target.checked)} className="mt-0.5 w-4 h-4 accent-violet-500"/>
              <div><div className="text-sm font-medium" style={{color:"var(--text-primary)"}}>{label}{required&&<span className="text-violet-400 ml-1 text-xs">required</span>}</div>
              <div className="text-xs mt-0.5" style={{color:"var(--text-faint)"}}>{desc}</div></div>
            </label>
          ))}
        </div>
      </div>
      <button onClick={handleCreate} disabled={!walletReady||creating} className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-30 transition-all" style={{background:"var(--accent-grad)"}}>
        {creating?<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>Creating…</span>:tokenId?"Re-create Collection":"Create NFT Collection on Hedera ✦"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Trait Artwork + Preview
// ═══════════════════════════════════════════════════════════════════════════════
function TraitEditor({onTraitsChange}:{onTraitsChange:(t:EnrichedTrait[])=>void}){
  const[traits,setTraits]=useState<EnrichedTrait[]>([]);
  const[layers,setLayers]=useState<LayerDefinition[]>(DEFAULT_LAYERS);
  const[tiers,setTiers]=useState<Tier[]>(DEFAULT_TIERS);
  const[activeLayer,setActiveLayer]=useState<string>("");
  const[dragOver,setDragOver]=useState<string|null>(null);
  const[previewImg,setPreviewImg]=useState<string|null>(null);
  const[compositing,setCompositing]=useState(false);
  const[saving,setSaving]=useState(false);
  const{msg,flash}=useFlash();

  useEffect(()=>{
    fetch("/api/collection").then(r=>r.json()).then(d=>{
      if(d.tiers?.length)setTiers(d.tiers);
      const l=d.layers?.length?d.layers:DEFAULT_LAYERS;
      setLayers(l);setActiveLayer(l[0]?.id??"");
      if(d.traitPool?.length)setTraits(d.traitPool.map((t:TraitOption)=>({...t,imageData:""})));
    });
  },[]);
  useEffect(()=>{onTraitsChange(traits);},[traits,onTraitsChange]);

  async function handleDrop(e:DragEvent,layerId:string){
    e.preventDefault();setDragOver(null);
    const layerDef=layers.find(l=>l.id===layerId);if(!layerDef)return;
    const catName=layerDef.name.toLowerCase();
    const files=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/"));
    if(!files.length){flash("err","No image files — drop PNG/JPG images");return;}
    const newTraits:EnrichedTrait[]=[];
    for(const file of files){
      const{displayName,tier}=parseTraitFilename(file.name);
      const imageData=await fileToDataUrl(file);
      const existing=traits.find(t=>t.category===catName&&t.imageFile===file.name);
      if(existing)newTraits.push({...existing,imageData});
      else newTraits.push({id:`${catName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,name:displayName,category:catName,tier:tier as TierLevel,imageFile:file.name,weight:10,imageData});
    }
    setTraits(prev=>{const merged=[...prev];for(const nt of newTraits){const idx=merged.findIndex(t=>t.id===nt.id);if(idx>=0)merged[idx]=nt;else merged.push(nt);}return merged;});
    const byTier=newTraits.reduce((a,t)=>({...a,[t.tier]:(a[t.tier as keyof typeof a]||0)+1}),{} as Record<number,number>);
    flash("ok",`${files.length} images loaded for ${layerDef.name} (${Object.entries(byTier).map(([t,n])=>`${n}×T${t}`).join(", ")})`);
  }

  async function handlePreview(){
    const loadedLayers=layers.sort((a,b)=>a.order-b.order);
    const layerImages:LayerImage[]=[];
    for(const layer of loadedLayers){
      const catName=layer.name.toLowerCase();
      const loaded=traits.filter(t=>t.category===catName&&t.imageData);
      if(!loaded.length)continue;
      const pick=loaded[Math.floor(Math.random()*loaded.length)];
      layerImages.push({category:catName,layerOrder:layer.order,traitName:pick.name,imageFile:pick.imageFile,imageData:pick.imageData});
    }
    if(!layerImages.length){flash("warn","Drop images onto layers first");return;}
    setCompositing(true);
    try{setPreviewImg(await compositeNFT(layerImages));}
    catch(err){flash("err","Compositor error: "+(err instanceof Error?err.message:"unknown"));}
    setCompositing(false);
  }

  async function saveTraits(){
    setSaving(true);
    const serializable=traits.map(({imageData:_,...rest})=>rest);
    const res=await fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_traits",traits:serializable})});
    const data=await res.json();setSaving(false);
    if(data.success)flash("ok",`${data.count} trait definitions saved`);else flash("err","Save failed");
  }

  const activeLayerDef=layers.find(l=>l.id===activeLayer);
  const catTraits=activeLayerDef?traits.filter(t=>t.category===activeLayerDef.name.toLowerCase()):[];
  const totalByTier=(tier:TierLevel)=>traits.filter(t=>t.tier===tier).length;

  return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={4} title="Trait Artwork & NFT Preview"
        subtitle="Drop images onto each layer. Name files with #N suffix (item#2.png = Tier 2). Preview composites real-time from your uploaded images."/>
      <Flash msg={msg}/>

      {/* Naming guide */}
      <div className="mb-5 p-4 rounded-xl border" style={{background:"rgba(0,0,0,0.2)",borderColor:"var(--border)"}}>
        <div className="text-xs font-medium mb-2" style={{color:"var(--text-muted)"}}>📁 Filename → Tier: add #N suffix</div>
        <div className="grid grid-cols-5 gap-2 text-xs font-mono">
          {([1,2,3,4,5] as TierLevel[]).map(n=>{const c=TIER_COLORS[n];return(
            <div key={n} className={`p-2 rounded-lg border ${c.bg} ${c.border}`}>
              <div className={`font-bold ${c.text}`}>#{n} = {DEFAULT_TIERS[n-1].label}</div>
              <div className="text-white/30 break-all mt-0.5">item#{n}.png</div>
            </div>);
          })}
        </div>
        <p className="text-xs mt-2" style={{color:"var(--text-faint)"}}>No suffix = defaults to #1. The #N is stripped from the display name automatically.</p>
      </div>

      {/* Tier counts */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {([1,2,3,4,5] as TierLevel[]).map(tier=>{const c=TIER_COLORS[tier];return(
          <div key={tier} className={`rounded-xl p-3 border ${c.bg} ${c.border} text-center`}>
            <div className={`text-2xl font-bold ${c.text}`}>{totalByTier(tier)}</div>
            <div className="text-xs text-white/40">{DEFAULT_TIERS[tier-1].label}</div>
          </div>);})}
      </div>

      {/* Layer drop zones */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {layers.sort((a,b)=>a.order-b.order).map(layer=>{
          const catName=layer.name.toLowerCase();
          const count=traits.filter(t=>t.category===catName).length;
          const loaded=traits.filter(t=>t.category===catName&&t.imageData).length;
          return(
            <div key={layer.id} onClick={()=>setActiveLayer(layer.id)}
              onDragOver={e=>{e.preventDefault();setDragOver(layer.id);}}
              onDragLeave={()=>setDragOver(null)}
              onDrop={e=>handleDrop(e,layer.id)}
              className="rounded-xl p-3 cursor-pointer transition-all text-center select-none border"
              style={{background:dragOver===layer.id?"rgba(124,58,237,0.3)":activeLayer===layer.id?"var(--bg-card-hover)":"var(--bg-card)",borderColor:dragOver===layer.id?"var(--border-accent)":activeLayer===layer.id?"var(--border-accent)":"var(--border)",transform:dragOver===layer.id?"scale(1.05)":"scale(1)"}}>
              <div className="text-xs font-medium leading-tight" style={{color:"var(--text-primary)"}}>{layer.order}. {layer.name}</div>
              {count>0?<div className="text-xs text-emerald-400 mt-0.5">{loaded}/{count} loaded</div>:<div className="text-xs mt-0.5" style={{color:"var(--text-faint)"}}>drop here</div>}
              {dragOver===layer.id&&<div className="text-xs text-violet-300 mt-1 font-medium">↓ Drop!</div>}
            </div>);
        })}
      </div>

      {/* Active layer traits */}
      <div className="space-y-1.5 mb-5 min-h-24">
        {catTraits.length===0?(
          <div className="py-8 text-center rounded-xl" style={{border:"1px dashed var(--border)",color:"var(--text-faint)"}}>
            Drop <strong>{activeLayerDef?.name??""}</strong> images above
            <div className="text-xs mt-1">sky#1.png · aurora#3.png · cosmicvoid#5.png</div>
          </div>
        ):(
          <>
            <div className="grid grid-cols-12 gap-2 px-2 text-xs mb-1" style={{color:"var(--text-faint)"}}>
              <span className="col-span-1">Img</span><span className="col-span-4">Name</span><span className="col-span-4">File</span><span className="col-span-2">Tier</span><span className="col-span-1"/>
            </div>
            {catTraits.map(trait=>{const c=TIER_COLORS[trait.tier as TierLevel];return(
              <div key={trait.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border ${c.bg} ${c.border}`}>
                <div className="col-span-1"><div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                  {trait.imageData?<img src={trait.imageData} alt={trait.name} className="w-full h-full object-cover"/>:<span className="text-white/20 text-xs">—</span>}</div></div>
                <div className="col-span-4"><input value={trait.name} onChange={e=>setTraits(p=>p.map(t=>t.id===trait.id?{...t,name:e.target.value}:t))} className="w-full rounded-lg px-2 py-1 text-sm focus:outline-none bg-black/20 border border-white/10" style={{color:"var(--text-primary)"}}/></div>
                <div className="col-span-4"><span className="text-xs font-mono truncate block" style={{color:"var(--text-faint)"}}>{trait.imageFile}</span></div>
                <div className="col-span-2">
                  <select value={trait.tier} onChange={e=>setTraits(p=>p.map(t=>t.id===trait.id?{...t,tier:Number(e.target.value) as TierLevel}:t))} className={`w-full rounded-lg px-2 py-1 text-xs ${c.text} focus:outline-none cursor-pointer bg-black/30 border ${c.border}`}>
                    {tiers.map(t=><option key={t.level} value={t.level}>T{t.level} {t.label}{t.level>1?` ($${t.minDonation/100}+)`:" (All)"}</option>)}
                  </select></div>
                <div className="col-span-1 text-right"><button onClick={()=>setTraits(p=>p.filter(t=>t.id!==trait.id))} className="text-white/20 hover:text-red-400 text-lg">×</button></div>
              </div>);})}
          </>
        )}
      </div>

      {/* Preview + save */}
      <div className="flex items-start gap-4 pt-4 border-t" style={{borderColor:"var(--border)"}}>
        <div className="flex-1 space-y-2">
          <button onClick={handlePreview} disabled={compositing||traits.filter(t=>t.imageData).length===0}
            className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-30 transition-all" style={{background:"var(--bg-card)",borderColor:"var(--border)",color:"var(--text-primary)"}}>
            {compositing?"Compositing…":"🎨 Preview Random NFT Composite"}</button>
          <p className="text-xs" style={{color:"var(--text-faint)"}}>Stacks one random trait per layer in order — shows final 1000×1000 result from your actual images</p>
          {previewImg&&<button onClick={handlePreview} disabled={compositing} className="px-3 py-1.5 rounded-lg text-xs border disabled:opacity-30" style={{background:"var(--bg-card)",borderColor:"var(--border)",color:"var(--text-muted)"}}>🔀 Reshuffle</button>}
          {traits.length>0&&<button onClick={saveTraits} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 block mt-2" style={{background:"var(--accent)"}}>
            {saving?"Saving…":`Save ${traits.length} Trait Definitions`}</button>}
        </div>
        {previewImg&&(
          <div className="shrink-0 text-center">
            <img src={previewImg} alt="NFT preview" className="w-40 h-40 rounded-xl border-2 object-cover shadow-xl" style={{borderColor:"var(--border-accent)"}}/>
            <div className="text-xs mt-1" style={{color:"var(--text-faint)"}}>1000×1000 composite</div>
            <a href={previewImg} download="nft-preview.png" className="text-xs text-violet-400 hover:text-violet-300 mt-0.5 inline-block">Download ↓</a>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Tier Configuration
// ═══════════════════════════════════════════════════════════════════════════════
function TierConfig(){
  const[tiers,setTiers]=useState<Tier[]>(DEFAULT_TIERS);
  const[saving,setSaving]=useState(false);
  const{msg,flash}=useFlash();
  useEffect(()=>{fetch("/api/collection").then(r=>r.json()).then(d=>{if(d.tiers?.length)setTiers(d.tiers);});},[]);

  function updateDollar(level:TierLevel,dollars:string){const cents=Math.round(parseFloat(dollars||"0")*100);setTiers(p=>p.map(t=>t.level===level?{...t,minDonation:cents}:t));}

  async function save(){
    setSaving(true);
    const res=await fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update_tiers",tiers})});
    const data=await res.json();setSaving(false);
    if(data.success)flash("ok","Tier thresholds saved — team tiers recalculated");else flash("err",data.error??"Save failed");
  }

  const max=tiers[tiers.length-1].minDonation*1.3||100000;
  return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={5} title="Donation Tier Thresholds" subtitle="Set the minimum donation (USD) that unlocks each rarity tier. Changes recalculate all team tiers instantly."/>
      <Flash msg={msg}/>
      <div className="space-y-3 mb-5">
        {tiers.map(tier=>{const c=TIER_COLORS[tier.level as TierLevel];return(
          <div key={tier.level} className={`flex items-center gap-4 p-4 rounded-xl border ${c.bg} ${c.border}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`}/>
            <div className="w-28 shrink-0"><div className={`text-sm font-semibold ${c.text}`}>{tier.label}</div><div className="text-xs text-white/30">Tier {tier.level}</div></div>
            <div className="flex-1 text-xs text-white/40">{tier.description}</div>
            {tier.level===1?<div className="w-40 text-right text-sm text-white/40 italic">Everyone starts here</div>:(
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-white/50 text-sm">$</span>
                <input type="number" min="1" step="5" value={tier.minDonation/100} onChange={e=>updateDollar(tier.level as TierLevel,e.target.value)}
                  className={`w-28 rounded-lg px-3 py-1.5 text-sm font-mono text-right focus:outline-none bg-black/30 border ${c.border}`} style={{color:"var(--text-primary)"}}/>
                <span className="text-xs text-white/30">min</span>
              </div>)}
          </div>);})}
      </div>
      <div className="mb-4">
        <div className="text-xs mb-2" style={{color:"var(--text-faint)"}}>Visual spread</div>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden">
          {tiers.map((tier,i)=>{const next=tiers[i+1];const w=next?((next.minDonation-tier.minDonation)/max)*100:((max-tier.minDonation)/max)*100;const cols=["bg-slate-500","bg-blue-500","bg-emerald-500","bg-purple-500","bg-amber-500"];return<div key={tier.level} style={{width:`${w}%`}} className={`${cols[i]} transition-all`}/>;})}</div>
        <div className="flex justify-between text-xs mt-1" style={{color:"var(--text-faint)"}}><span>$0</span>{tiers.slice(1).map(t=><span key={t.level}>{formatDollars(t.minDonation)}</span>)}</div>
      </div>
      <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{background:"var(--accent)"}}>
        {saving?"Saving…":"Save Tier Thresholds"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Student Wallet Generator
// ═══════════════════════════════════════════════════════════════════════════════
function WalletGenerator({getCredentials,network}:{getCredentials:()=>import("@/lib/hederaClient").WalletCredentials|null;network:HederaNetwork;}){
  const[csvContent,setCsvContent]=useState("");
  const[generating,setGenerating]=useState(false);
  const[wallets,setWallets]=useState<StudentWallet[]>([]);
  const[failed,setFailed]=useState<{name:string;error:string}[]>([]);
  const[progress,setProgress]=useState<{current:number;total:number}|null>(null);
  const{msg,flash}=useFlash();
  const fileRef=useRef<HTMLInputElement>(null);

  function handleFileUpload(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=ev=>setCsvContent(ev.target?.result as string);reader.readAsText(file);
  }

  async function handleGenerate(){
    const creds=getCredentials();
    if(!creds){flash("err","Complete wallet credentials in Step 1 first");return;}
    if(!csvContent.trim()){flash("err","Upload or paste a CSV with student names");return;}
    setGenerating(true);setWallets([]);setFailed([]);
    const res=await fetch("/api/wallets",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"generate",csvContent,credentials:{payerAccountId:creds.accountId,payerPrivateKey:creds.privateKey,network}})});
    const data=await res.json();
    setGenerating(false);
    if(data.success){setWallets(data.wallets??[]);setFailed(data.failed??[]);flash("ok",`${data.count} wallets created${data.failed?.length?` (${data.failed.length} failed)`:""}`);
    }else flash("err",data.error??"Wallet generation failed");
  }

  function downloadCSV(){
    const header="Student Name,Account ID,Private Key,Public Key,Mnemonic,Network";
    const rows=wallets.map(w=>[w.studentName,w.accountId,w.privateKey,w.publicKey,`"${w.mnemonic}"`,w.network].join(","));
    const blob=new Blob([[header,...rows].join("\n")],{type:"text/csv"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="student-wallets.csv";a.click();
  }

  async function printWalletCards(){
    const win=window.open("","_blank");if(!win)return;
    const networkLabel=network.toUpperCase();
    const cards=wallets.map(w=>`
      <div class="card">
        <div class="header">
          <div class="logo">M</div>
          <div><div class="title">Minthon NFT Wallet</div><div class="network ${network}">${networkLabel} NETWORK</div></div>
        </div>
        <div class="name">${w.studentName}</div>
        <div class="field"><span class="label">Account ID:</span><span class="value mono">${w.accountId}</span></div>
        <div class="field"><span class="label">Mnemonic Phrase:</span></div>
        <div class="mnemonic">${w.mnemonic}</div>
        <div class="instructions">
          <strong>Setup your wallet:</strong><br/>
          1. Download HashPack at <strong>hashpack.app</strong><br/>
          2. Choose "Import Existing Wallet"<br/>
          3. Select "${networkLabel}" network<br/>
          4. Enter the mnemonic phrase above<br/>
          5. Your Account ID: <strong>${w.accountId}</strong>
        </div>
        <div class="footer">Keep this card safe — your mnemonic is your wallet password</div>
      </div>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Student Wallet Cards</title><style>
      @media print{@page{margin:0.5cm}body{margin:0}}
      body{font-family:Arial,sans-serif;background:#f5f5f5;padding:20px}
      .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:900px;margin:0 auto}
      .card{background:white;border-radius:12px;padding:16px;border:2px solid #e5e7eb;break-inside:avoid;page-break-inside:avoid}
      .header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
      .logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#c026d3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px}
      .title{font-weight:bold;font-size:15px;color:#111}
      .network{font-size:11px;font-weight:bold;padding:2px 8px;border-radius:20px;display:inline-block;margin-top:2px}
      .network.testnet{background:#fef3c7;color:#92400e}
      .network.mainnet{background:#d1fae5;color:#065f46}
      .name{font-size:18px;font-weight:bold;color:#111;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e5e7eb}
      .field{display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;font-size:12px}
      .label{color:#6b7280;white-space:nowrap;min-width:80px}
      .value{color:#111;font-weight:500}.mono{font-family:monospace;font-size:11px}
      .mnemonic{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-family:monospace;font-size:11px;color:#374151;margin:6px 0 10px;line-height:1.6;word-break:break-word}
      .instructions{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;font-size:11px;color:#1e40af;margin-bottom:10px;line-height:1.7}
      .footer{font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px}
    </style></head><body><div class="cards">${cards}</div><script>window.onload=()=>{window.print();}</script></body></html>`);
    win.document.close();
  }

  const nameCount=csvContent.trim().split("\n").filter(l=>l.trim()&&!l.toLowerCase().startsWith("name")&&!l.toLowerCase().startsWith("student")).length;

  return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={6} title="Student Wallet Generator" subtitle="Upload a CSV of student names to create Hedera wallets for your entire class at once. Generates printable cards with HashPack setup instructions."/>
      <Flash msg={msg}/>

      <div className="mb-4 p-4 rounded-xl border" style={{background:"rgba(0,0,0,0.15)",borderColor:"var(--border)"}}>
        <div className="text-xs font-medium mb-2" style={{color:"var(--text-muted)"}}>CSV Format (one name per line)</div>
        <pre className="text-xs font-mono" style={{color:"var(--text-faint)"}}>{"Student Name\nAlice Johnson\nBob Smith\nCarla Reyes"}</pre>
        <p className="text-xs mt-2" style={{color:"var(--text-faint)"}}>Header row optional. Each row = one Hedera account created with 1 HBAR starting balance (deducted from your wallet).</p>
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex gap-2">
          <button onClick={()=>fileRef.current?.click()} className="px-4 py-2.5 rounded-xl text-sm border flex-1 text-center transition-all" style={{background:"var(--bg-card)",borderColor:"var(--border)",color:"var(--text-primary)"}}>
            📂 Upload CSV File</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload}/>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{color:"var(--text-muted)"}}>Or paste names directly</label>
          <textarea value={csvContent} onChange={e=>setCsvContent(e.target.value)} rows={4}
            placeholder={"Alice Johnson\nBob Smith\nCarla Reyes\n..."}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none" style={{background:"rgba(0,0,0,0.2)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/>
          {nameCount>0&&<p className="text-xs mt-1 text-emerald-400">{nameCount} students detected — will create {nameCount} Hedera accounts</p>}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={generating||!csvContent.trim()}
        className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-30 mb-4 transition-all" style={{background:"var(--accent-grad)"}}>
        {generating?<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>Creating wallets on Hedera…</span>:`Create ${nameCount||""} Student Wallets on Hedera ✦`}
      </button>

      {failed.length>0&&<div className="mb-4 p-3 rounded-xl text-xs" style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)"}}>
        <div className="text-red-400 font-medium mb-1">Failed ({failed.length}):</div>
        {failed.map((f,i)=><div key={i} className="text-red-300/70">{f.name}: {f.error}</div>)}
      </div>}

      {wallets.length>0&&(
        <div className="space-y-3">
          <div className="text-sm font-medium text-emerald-400">✓ {wallets.length} wallets created successfully</div>
          <div className="rounded-xl border overflow-hidden" style={{borderColor:"var(--border)"}}>
            <div className="px-4 py-2 border-b grid grid-cols-12 gap-2 text-xs" style={{background:"rgba(255,255,255,0.05)",borderColor:"var(--border)",color:"var(--text-faint)"}}>
              <span className="col-span-4">Student</span><span className="col-span-4">Account ID</span><span className="col-span-4">Network</span>
            </div>
            <div className="divide-y max-h-48 overflow-y-auto" style={{borderColor:"var(--border)"}}>
              {wallets.map((w,i)=><div key={i} className="px-4 py-2 grid grid-cols-12 gap-2 text-sm">
                <span className="col-span-4 font-medium" style={{color:"var(--text-primary)"}}>{w.studentName}</span>
                <span className="col-span-4 font-mono text-xs text-emerald-400">{w.accountId}</span>
                <span className={`col-span-4 text-xs font-medium ${w.network==="mainnet"?"text-emerald-400":"text-amber-400"}`}>{w.network.toUpperCase()}</span>
              </div>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={downloadCSV} className="py-3 rounded-xl text-sm font-medium border transition-all" style={{background:"var(--bg-card)",borderColor:"var(--border)",color:"var(--text-primary)"}}>
              📥 Download CSV (with keys)</button>
            <button onClick={printWalletCards} className="py-3 rounded-xl text-sm font-medium text-white transition-all" style={{background:"var(--accent)"}}>
              🖨️ Print Wallet Cards (PDF)</button>
          </div>
          <div className="text-xs p-3 rounded-xl" style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",color:"rgba(245,158,11,0.9)"}}>
            ⚠ The CSV contains private keys. Store it securely and only share individual cards with each student. Never share the full CSV.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Batch Mint
// ═══════════════════════════════════════════════════════════════════════════════
function BatchMint({walletReady,getCredentials,traits,network}:{walletReady:boolean;getCredentials:()=>import("@/lib/hederaClient").WalletCredentials|null;traits:EnrichedTrait[];network:HederaNetwork;}){
  const[pinataKey,setPinataKey]=useState("");
  const[pinataSecret,setPinataSecret]=useState("");
  const[preview,setPreview]=useState<BatchPreview|null>(null);
  const[loadingPreview,setLoadingPreview]=useState(false);
  const[log,setLog]=useState<MintLog[]>([]);
  const[progress,setProgress]=useState({done:0,failed:0,total:0});
  const[minting,setMinting]=useState(false);
  const[confirmed,setConfirmed]=useState(false);
  const[tokenId,setTokenId]=useState("");
  const[collectionName,setCollectionName]=useState("Minthon 2025");
  const[layers,setLayers]=useState<LayerDefinition[]>(DEFAULT_LAYERS);
  const abortRef=useRef(false);
  const{msg,flash}=useFlash();

  useEffect(()=>{
    fetch("/api/collection").then(r=>r.json()).then(d=>{
      if(d.tokenId)setTokenId(d.tokenId);
      if(d.collectionName)setCollectionName(d.collectionName);
      if(d.layers?.length)setLayers(d.layers);
    });
    doLoadPreview();
  },[]);

  async function doLoadPreview(){
    setLoadingPreview(true);
    const res=await fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"batch_mint_preview"})});
    setPreview(await res.json());setLoadingPreview(false);
  }

  async function startMint(){
    if(!preview||minting)return;
    const creds=getCredentials();
    if(!creds||!tokenId||!pinataKey||!pinataSecret){flash("err","Wallet, token ID, and Pinata credentials all required");return;}
    abortRef.current=false;setMinting(true);
    const total=preview.eligible.length;
    setProgress({done:0,failed:0,total});
    setLog(preview.eligible.map(m=>({name:`${m.teamName} / ${m.memberName}`,status:"pending"})));
    const{generateTraits}=await import("@/lib/traitEngine");
    const store=await fetch("/api/collection").then(r=>r.json());
    const traitPool=store.traitPool??[];
    const sortedLayers=[...(store.layers??layers)].sort((a:LayerDefinition,b:LayerDefinition)=>a.order-b.order);
    const categories=sortedLayers.map((l:LayerDefinition)=>l.name.toLowerCase());

    for(let i=0;i<preview.eligible.length;i++){
      if(abortRef.current)break;
      const item=preview.eligible[i];
      setLog(p=>p.map((l,idx)=>idx===i?{...l,status:"running"}:l));
      try{
        const genTraits=generateTraits(traitPool,categories,item.tier);
        const layerImages:LayerImage[]=[];
        for(const[,trait] of Object.entries(genTraits)){
          const loaded=traits.find(t=>t.category===trait.category&&(t.name===trait.name||t.imageFile===trait.imageFile)&&t.imageData);
          if(loaded)layerImages.push({category:trait.category,layerOrder:layers.find(l=>l.name.toLowerCase()===trait.category)?.order??99,traitName:trait.name,imageFile:trait.imageFile,imageData:loaded.imageData});
        }
        let compositeImage:string|undefined;
        if(layerImages.length>0)compositeImage=await compositeNFT(layerImages);
        const res=await fetch("/api/mint",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"batch_mint",teamId:item.teamId,memberId:item.memberId,walletAddress:item.walletAddress,compositeImage,pinataApiKey:pinataKey,pinataApiSecret:pinataSecret,credentials:{accountId:creds.accountId,privateKey:creds.privateKey,network:creds.network}})});
        const data=await res.json();
        if(!data.success)throw new Error(data.error??"Mint failed");
        setProgress(p=>({...p,done:p.done+1}));
        setLog(p=>p.map((l,idx)=>idx===i?{...l,status:"ok",msg:`Serial #${data.serialNumber}`}:l));
      }catch(err){
        setProgress(p=>({...p,failed:p.failed+1}));
        setLog(p=>p.map((l,idx)=>idx===i?{...l,status:"err",msg:err instanceof Error?err.message:"Unknown error"}:l));
      }
      await new Promise(r=>setTimeout(r,1200));
    }
    setMinting(false);doLoadPreview();
  }

  const pct=progress.total>0?Math.round(((progress.done+progress.failed)/progress.total)*100):0;
  const loadedCount=traits.filter(t=>t.imageData).length;
  const allReady=walletReady&&Boolean(tokenId)&&Boolean(pinataKey)&&Boolean(pinataSecret);

  return(
    <div className="rounded-2xl border p-6" style={{background:"var(--bg-card)",borderColor:"var(--border)"}}>
      <SectionHeader step={7} title="Batch Mint NFTs" subtitle="Composites each student's NFT, uploads to IPFS, mints on Hedera, and transfers to their wallet. One click for your entire class."/>
      <Flash msg={msg}/>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[{ok:walletReady,label:"Wallet ready"},{ok:Boolean(tokenId),label:"Token ID set"},{ok:loadedCount>0,label:`${loadedCount} trait images`},{ok:Boolean(pinataKey),label:"Pinata keys"}].map((item,i)=>(
          <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border text-xs" style={{background:item.ok?"rgba(16,185,129,0.1)":"var(--bg-card)",borderColor:item.ok?"rgba(16,185,129,0.4)":"var(--border)",color:item.ok?"rgb(52,211,153)":"var(--text-faint)"}}>
            <span>{item.ok?"✓":"○"}</span><span>{item.label}</span>
          </div>))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div><label className="text-xs mb-1 block" style={{color:"var(--text-muted)"}}>Pinata API Key</label>
          <input type="password" value={pinataKey} onChange={e=>setPinataKey(e.target.value)} placeholder="From pinata.cloud"
            className="w-full rounded-xl px-3 py-2 text-sm font-mono focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/></div>
        <div><label className="text-xs mb-1 block" style={{color:"var(--text-muted)"}}>Pinata API Secret</label>
          <input type="password" value={pinataSecret} onChange={e=>setPinataSecret(e.target.value)} placeholder="From pinata.cloud"
            className="w-full rounded-xl px-3 py-2 text-sm font-mono focus:outline-none" style={{background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--text-primary)"}}/></div>
      </div>

      {loadingPreview?<div className="py-8 text-center text-sm animate-pulse" style={{color:"var(--text-faint)"}}>Checking eligibility…</div>
      :preview&&(<div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[{n:preview.eligible.length,label:"Ready to mint",color:"rgba(16,185,129,0.1)",border:"rgba(16,185,129,0.3)",text:"rgb(52,211,153)"},
            {n:preview.missingWallet.length,label:"Missing wallet",color:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.3)",text:"rgb(251,191,36)"},
            {n:preview.alreadyMinted.length,label:"Already minted",color:"rgba(255,255,255,0.03)",border:"var(--border)",text:"var(--text-muted)"}].map((s,i)=>(
            <div key={i} className="rounded-xl p-4 text-center border" style={{background:s.color,borderColor:s.border}}>
              <div className="text-3xl font-bold" style={{color:s.text}}>{s.n}</div>
              <div className="text-xs mt-1" style={{color:"var(--text-faint)"}}>{s.label}</div>
            </div>))}
        </div>

        {preview.eligible.length>0&&<div className="rounded-xl border overflow-hidden" style={{borderColor:"var(--border)"}}>
          <div className="px-4 py-2 border-b grid grid-cols-12 gap-2 text-xs" style={{background:"rgba(255,255,255,0.05)",borderColor:"var(--border)",color:"var(--text-faint)"}}>
            <span className="col-span-3">Team</span><span className="col-span-3">Member</span><span className="col-span-2">Tier</span><span className="col-span-3">Wallet</span><span className="col-span-1">Status</span>
          </div>
          <div className="divide-y max-h-56 overflow-y-auto" style={{borderColor:"var(--border)"}}>
            {preview.eligible.map((item,i)=>{const c=TIER_COLORS[item.tier];const l=log[i];return(
              <div key={item.memberId} className="px-4 py-2 grid grid-cols-12 gap-2 items-center text-sm">
                <span className="col-span-3 truncate" style={{color:"var(--text-muted)"}}>{item.teamName}</span>
                <span className="col-span-3 font-medium truncate" style={{color:"var(--text-primary)"}}>{item.memberName}</span>
                <span className={`col-span-2 text-xs font-medium ${c.text}`}>{DEFAULT_TIERS[item.tier-1].label}</span>
                <span className="col-span-3 text-xs font-mono truncate" style={{color:"var(--text-faint)"}}>{item.walletAddress}</span>
                <span className="col-span-1 text-right text-sm">
                  {l?.status==="ok"&&<span className="text-emerald-400" title={l.msg}>✓</span>}
                  {l?.status==="err"&&<span className="text-red-400" title={l.msg}>✗</span>}
                  {l?.status==="running"&&<span className="inline-block w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin"/>}
                </span>
              </div>);})}
          </div>
        </div>}

        {log.length>0&&<div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{color:"var(--text-faint)"}}>
            <span>{progress.done} minted · {progress.failed} failed · {progress.total-progress.done-progress.failed} remaining</span><span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.1)"}}>
            <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:"var(--accent-grad)"}}/></div>
        </div>}

        {preview.eligible.length>0&&!minting&&progress.done+progress.failed<progress.total&&<div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer" style={{background:"rgba(124,58,237,0.1)",borderColor:"rgba(124,58,237,0.3)"}}>
            <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-violet-500"/>
            <span className="text-sm" style={{color:"rgba(196,181,253,0.8)"}}>
              I confirm wallet, token ID, trait images, and Pinata keys are correct. Ready to composite and mint <strong style={{color:"rgb(196,181,253)"}}>{preview.eligible.length} NFT{preview.eligible.length!==1?"s":""}</strong> on <strong style={{color:"rgb(196,181,253)"}}>{network}</strong>. Cannot be undone.
            </span>
          </label>
          <button onClick={startMint} disabled={!confirmed||!allReady}
            className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-30 transition-all shadow-lg" style={{background:"var(--accent-grad)"}}>
            Composite &amp; Mint {preview.eligible.length} NFT{preview.eligible.length!==1?"s":""} on Hedera ✦</button>
        </div>}

        {minting&&<button onClick={()=>{abortRef.current=true;}} className="w-full py-3 rounded-xl text-sm border text-red-400 hover:bg-red-900/20 transition-colors" style={{borderColor:"rgba(239,68,68,0.5)"}}>Stop After Current Mint</button>}

        {!minting&&progress.total>0&&progress.done+progress.failed>=progress.total&&<div className="rounded-xl p-4 text-center" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.4)"}}>
          <div className="text-lg font-semibold text-emerald-300">✓ Batch complete — {progress.done} minted{progress.failed>0?`, ${progress.failed} failed`:""}</div>
          {tokenId&&<a href={hashScanTokenUrl(tokenId,network)} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-block transition-colors">View collection on HashScan ↗</a>}
        </div>}
      </div>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CollectionPage(){
  const wallet=useWalletCredentials();
  const[walletReady,setWalletReady]=useState(false);
  const[traits,setTraits]=useState<EnrichedTrait[]>([]);
  const[theme,setTheme]=useState<AppTheme>("dark-violet");
  const[tab,setTab]=useState<"collection"|"tiers"|"wallets">("collection");
  const router=useRef<{push:(p:string)=>void}|null>(null);

  useEffect(()=>{
    const saved=localStorage.getItem(THEME_STORAGE_KEY) as AppTheme|null;
    if(saved&&THEMES.find(t=>t.id===saved))setTheme(saved);
  },[]);

  function changeTheme(t:AppTheme){setTheme(t);localStorage.setItem(THEME_STORAGE_KEY,t);}

  const themeCfg=THEMES.find(t=>t.id===theme)??THEMES[0];
  const themeStyle=Object.entries(themeCfg.vars).reduce((acc,[k,v])=>({...acc,[k]:v}),{}) as React.CSSProperties;

  async function handleLogout(){await fetch("/api/auth",{method:"DELETE"});window.location.href="/admin/login";}

  return(
    <div style={{...themeStyle,minHeight:"100vh",background:"var(--bg-primary)",color:"var(--text-primary)",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-4" style={{borderBottom:"1px solid var(--border)"}}>
        <a href="/admin" className="text-sm transition-colors hover:opacity-80" style={{color:"var(--text-faint)"}}>← Admin</a>
        <div className="w-px h-4" style={{background:"var(--border)"}}/>
        <h1 className="font-semibold text-sm" style={{color:"var(--text-primary)"}}>NFT Collection Setup</h1>
        <div className="ml-auto flex items-center gap-3">
          {/* Theme switcher */}
          <div className="flex items-center gap-1">
            {THEMES.map(t=>(
              <button key={t.id} onClick={()=>changeTheme(t.id)} title={t.label}
                className={`w-6 h-6 rounded-full border-2 transition-all ${theme===t.id?"scale-110":"opacity-60 hover:opacity-90"}`}
                style={{borderColor:theme===t.id?"var(--border-accent)":"transparent"}}>
                <div className={`w-full h-full rounded-full ${t.preview}`}/>
              </button>
            ))}
          </div>
          <div className="w-px h-4" style={{background:"var(--border)"}}/>
          {walletReady
            ?<><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/><span className="text-xs" style={{color:"rgb(52,211,153)"}}>Wallet ready · {wallet.network}</span></>
            :<span className="text-xs" style={{color:"var(--text-faint)"}}>No wallet</span>}
          <button onClick={handleLogout} className="text-xs px-3 py-1 rounded-lg border transition-all" style={{borderColor:"var(--border)",color:"var(--text-faint)"}}>Logout</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4" style={{borderBottom:"1px solid var(--border)"}}>
        {[{id:"collection",label:"Collection & Traits"},{id:"tiers",label:"Donation Tiers"},{id:"wallets",label:"Student Wallets"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
            className="px-4 py-2.5 text-sm transition-all rounded-t-lg -mb-px border-b-2"
            style={{color:tab===t.id?"var(--text-primary)":"var(--text-faint)",borderBottomColor:tab===t.id?"var(--accent)":"transparent",background:tab===t.id?"var(--bg-card)":"transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {tab==="collection"&&<>
          <WalletKeyManager onReady={setWalletReady}/>
          <LayerSetup/>
          <TokenCreator walletReady={walletReady} getCredentials={wallet.getCredentials} network={wallet.network}/>
          <TraitEditor onTraitsChange={setTraits}/>
          <BatchMint walletReady={walletReady} getCredentials={wallet.getCredentials} traits={traits} network={wallet.network}/>
        </>}
        {tab==="tiers"&&<TierConfig/>}
        {tab==="wallets"&&<WalletGenerator getCredentials={wallet.getCredentials} network={wallet.network}/>}
      </div>
    </div>
  );
}
