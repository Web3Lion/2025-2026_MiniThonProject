"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true); setError("");
    const res  = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await res.json();
    setLoading(false);
    if (data.success) router.push("/admin");
    else setError("Incorrect password");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4" style={{fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">M</div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-white/40 text-sm mt-1">Minthon NFT Fundraiser</p>
        </div>
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Admin Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-violet-500 text-white placeholder-white/20 transition-colors"/>
          </div>
          {error && <div className="text-sm text-red-400 text-center bg-red-900/20 border border-red-700/30 rounded-xl p-3">{error}</div>}
          <button onClick={handleLogin} disabled={!password || loading}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-30 rounded-xl font-medium text-white transition-all">
            {loading ? "Checking…" : "Enter Dashboard"}
          </button>
        </div>
        <p className="text-center text-xs text-white/20 mt-4">Set password via ADMIN_PASSWORD environment variable</p>
      </div>
    </div>
  );
}
