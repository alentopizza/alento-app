export default function Loading() {
  return (
    <main className="min-h-screen bg-[#090909] px-4 pb-28 pt-6 text-white">
      <div className="mx-auto max-w-[860px] animate-pulse space-y-3">
        <div className="h-24 rounded-[26px] border border-white/10 bg-white/[0.04]" />
        <div className="h-40 rounded-[22px] border border-white/10 bg-white/[0.035]" />
        <div className="h-24 rounded-[22px] border border-white/10 bg-white/[0.03]" />
      </div>
    </main>
  );
}
