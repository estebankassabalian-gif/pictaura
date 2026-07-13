/**
 * Carte "preuve SEO" — mockup terminal EXIF affichant des données 100% RÉELLES
 * générées par Pictaura sur la photo villa (Draguignan, Var) déjà utilisée en
 * hero. Aucune valeur ici n'est inventée : capturées via le vrai chemin
 * generatePhotoSEO() → fal any-llm/vision, preset IMMOBILIER.
 * Partagée entre la landing (#seo) et /agences pour ne pas dupliquer/dériver.
 */
export default function SeoProofCard() {
  return (
    <div className="rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
      <div className="bg-ink/90 border-b border-white/10 px-5 py-3 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="text-[11px] text-cream/60 font-mono ml-3">
          exterieur-moderne-piscine-draguignan.jpg — EXIF
        </span>
      </div>
      <div className="bg-ink/95 p-6 font-mono text-[12px] leading-relaxed text-cream/90">
        <div>
          <span className="text-sun">alt</span>:{" "}
          <span className="text-cream/85">
            &quot;Espace extérieur moderne avec piscine et terrasse aménagée,
            plein jour Draguignan.&quot;
          </span>
        </div>
        <div className="mt-2">
          <span className="text-sun">title</span>:{" "}
          <span className="text-cream/85">
            &quot;Piscine &amp; Terrasse Moderne — Draguignan&quot;
          </span>
        </div>
        <div className="mt-2">
          <span className="text-sun">description</span>:{" "}
          <span className="text-cream/85">
            &quot;Profitez du soleil du Var dans cet espace extérieur moderne
            avec piscine à débordement et terrasse aménagée...&quot;
          </span>
        </div>
        <div className="mt-2">
          <span className="text-sun">keywords</span>:{" "}
          <span className="text-cream/85">
            espace-exterieur, moderne, piscine, terrasse, villa, vacances
          </span>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <span className="text-sun">@context</span>:{" "}
          <span className="text-cream/60">https://schema.org</span>
        </div>
        <div>
          <span className="text-sun">@type</span>:{" "}
          <span className="text-cream/85">&quot;RealEstateListing&quot;</span>
        </div>
        <div>
          <span className="text-sun">address</span>:{" "}
          <span className="text-cream/85">Draguignan, Var, FR</span>
        </div>
      </div>
    </div>
  );
}
