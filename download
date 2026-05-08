import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 font-['DM_Sans',sans-serif]">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-2xl font-bold mx-auto mb-8">
          M
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
          Minthon
        </h1>
        <p className="text-white/50 mb-12 leading-relaxed">
          Fundraise for children with pediatric cancer. 
          The more your team raises, the rarer your NFT on the Hedera blockchain.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/mint"
            className="bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-2xl p-6 text-left transition-all group"
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold mb-1">Students</div>
            <div className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
              Claim your fundraising NFT
            </div>
          </Link>

          <Link
            href="/admin"
            className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 text-left transition-all group"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold mb-1">Admin</div>
            <div className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
              Manage teams &amp; donations
            </div>
          </Link>
        </div>

        <div className="mt-12 flex items-center gap-6 justify-center text-xs text-white/25">
          <span>Built on Hedera</span>
          <span>·</span>
          <span>HIP-412 NFT Standard</span>
          <span>·</span>
          <span>IPFS Storage</span>
        </div>
      </div>
    </div>
  );
}
