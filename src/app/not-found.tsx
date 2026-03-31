import Link from "next/link";

export const metadata = { title: "Page introuvable | Pictaura" };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-extrabold text-brand-500/20 mb-4 select-none">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Page introuvable</h1>
        <p className="text-zinc-500 mb-8">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="btn-primary px-6 py-3 rounded-xl font-semibold"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/dashboard"
            className="border border-white/10 text-zinc-300 px-6 py-3 rounded-xl font-semibold hover:bg-white/5 transition-colors"
          >
            Mon dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
