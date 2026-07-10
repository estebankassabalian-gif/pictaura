import archiver from "archiver";
import { getSignedDownloadUrl } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { Readable, PassThrough } from "stream";

/**
 * Génère un ZIP des photos traitées pour un job.
 * @returns ReadableStream du ZIP (à streamer directement en réponse HTTP)
 */
export async function generateJobZip(
  jobId: string,
  userId: string
): Promise<{ stream: PassThrough; filename: string }> {
  // Vérifier que le job appartient à l'utilisateur
  const job = await prisma.processingJob.findFirst({
    where: { id: jobId, userId },
    include: {
      photos: {
        where: {
          status: JobStatus.COMPLETED,
          processedKey: { not: null },
        },
      },
    },
  });

  if (!job) throw new Error("Job non trouvé");
  if (job.photos.length === 0) throw new Error("Aucune photo traitée disponible");

  const archive = archiver("zip", { zlib: { level: 6 } });
  const passThrough = new PassThrough();

  archive.pipe(passThrough);

  // Générer un CSV SEO si des métadonnées sont disponibles
  const hasSeo = job.photos.some((p) => p.seoAltText || p.seoFileName);
  if (hasSeo) {
    // Sanitize a CSV cell: escape quotes and prevent formula injection
    const csvCell = (val: string) => {
      const safe = (val ?? "").replace(/"/g, "'");
      return /^[=+\-@\t\r]/.test(safe) ? `"'${safe}"` : `"${safe}"`;
    };

    const csvLines = [
      "original_filename,seo_filename,alt_text,description,meta_title,keywords,score,score_report",
      ...job.photos.map((p) => {
        // Dé-sérialiser les keywords JSON si nécessaire
        let keywordsDisplay = "";
        try {
          const kw = p.seoKeywords ? JSON.parse(p.seoKeywords) : [];
          keywordsDisplay = Array.isArray(kw) ? kw.join(", ") : String(p.seoKeywords ?? "");
        } catch {
          keywordsDisplay = p.seoKeywords ?? "";
        }

        return [
          csvCell(p.fileName),
          csvCell(p.seoFileName ?? ""),
          csvCell(p.seoAltText ?? ""),
          csvCell(p.seoDescription ?? ""),
          csvCell(p.seoMetaTitle ?? ""),
          csvCell(keywordsDisplay),
          p.photoScore ?? "",
          csvCell(p.photoScoreReport ?? ""),
        ].join(",");
      }),
    ];
    archive.append(csvLines.join("\n"), { name: "seo_metadata.csv" });

    // Ajouter les hashtags Instagram dans un fichier séparé
    const hasHashtags = job.photos.some((p) => p.seoHashtags);
    if (hasHashtags && job.preset === "INSTAGRAM") {
      const hashtagLines = job.photos
        .filter((p) => p.seoHashtags)
        .map((p) => `# ${p.seoFileName ?? p.fileName}\n${p.seoHashtags}\n`)
        .join("\n");
      archive.append(hashtagLines, { name: "instagram_hashtags.txt" });
    }

    // Ajouter les JSON-LD dans un fichier séparé (Shopify / Immobilier)
    const hasSchemas = job.photos.some((p) => p.seoSchemaJson);
    if (hasSchemas) {
      const schemas = job.photos
        .filter((p) => p.seoSchemaJson)
        .map((p) => {
          try {
            // Valider que c'est du JSON valide + re-sérialiser pour échapper tout contenu dangereux
            const parsed = JSON.parse(p.seoSchemaJson!);
            // Échapper </script> pour éviter injection HTML si le fichier est chargé dans un browser
            return JSON.stringify(parsed, null, 2).replace(/<\/script>/gi, "<\\/script>");
          } catch {
            // En cas d'échec du parse, ne pas inclure ce schéma
            return null;
          }
        });

      const validSchemas = schemas.filter(Boolean) as string[];
      const schemaContent = `<!-- Collez chaque script dans le <head> de votre page produit Shopify / fiche immo -->
<!-- Documentation : https://schema.org -->

${validSchemas.map((s, i) => `<!-- Photo ${i + 1} -->
<script type="application/ld+json">
${s}
</script>`).join("\n\n")}
`;
      archive.append(schemaContent, { name: "schema_jsonld.html" });
    }
  }

  // Télécharger et ajouter chaque photo au ZIP
  for (let i = 0; i < job.photos.length; i++) {
    const photo = job.photos[i];
    if (!photo.processedKey) continue;

    try {
      const signedUrl = await getSignedDownloadUrl(photo.processedKey);
      const response = await fetch(signedUrl);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      // Utiliser le nom SEO si disponible, sinon générer un nom descriptif
      const rawName = photo.seoFileName ?? `${job.preset.toLowerCase()}-photo-${String(i + 1).padStart(2, "0")}`;
      // Sanitize: caractères safe seulement, pas de path traversal, extension forcée en .jpg
      const sanitized = rawName
        .replace(/\.[^.]+$/, "") // retirer l'extension existante
        .replace(/[^a-zA-Z0-9._-]/g, "-") // caractères sûrs uniquement
        .replace(/\.{2,}/g, "-") // pas de ..
        .slice(0, 80);
      const zipFileName = `${sanitized || `photo-${String(i + 1).padStart(2, "0")}`}.jpg`;

      archive.append(buffer, { name: zipFileName });
    } catch (e) {
      console.error(`Erreur ajout photo ${photo.id} au ZIP:`, e);
    }
  }

  // Ajouter un fichier README
  const readmeContent = `Pictaura — Pack optimisé
=====================
Preset : ${job.preset}
Photos : ${job.photos.length}
Généré le : ${new Date().toLocaleDateString("fr-FR")}

${hasSeo ? "Le fichier seo_metadata.csv contient les alt text et noms de fichiers SEO à utiliser sur votre plateforme." : ""}

Merci d'utiliser Pictaura !
https://pictaura.app
`;
  archive.append(readmeContent, { name: "README.txt" });

  archive.finalize();

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `pictaura_${job.preset.toLowerCase()}_${dateStr}.zip`;

  return { stream: passThrough, filename };
}
