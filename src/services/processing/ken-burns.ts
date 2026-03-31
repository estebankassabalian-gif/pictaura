import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";

// Utiliser le binaire FFmpeg inclus dans le package
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export type KenBurnsStyle =
  | "zoom-in"      // Zoom avant progressif (le plus courant)
  | "zoom-out"     // Zoom arrière → révèle l'ensemble
  | "pan-right"    // Panoramique droite
  | "pan-left"     // Panoramique gauche
  | "diagonal";    // Zoom + légère diagonale (le plus dynamique)

interface KenBurnsOptions {
  style?: KenBurnsStyle;
  duration?: number;   // Secondes (défaut: 4)
  fps?: number;        // Images/seconde (défaut: 30)
  filter?: string;     // Filtre Instagram à appliquer avant Ken Burns
}

/**
 * Convertit une photo en MP4 Reel Instagram (1080×1920 — format 9:16).
 *
 * Effet Ken Burns : zoom lent + légère animation → transforme n'importe quelle
 * photo en contenu vidéo professionnel, prêt à poster en Reel.
 *
 * Pourquoi c'est puissant :
 * - Les Reels ont 3-5x plus de reach que les photos statiques (algo Instagram 2025)
 * - Le mouvement capte l'attention avant la couleur (biais cognitif #1)
 * - Même un zoom de 5% sur 4 secondes est perçu comme "vivant" par le cerveau
 * - Durée courte (4s) = loop infini = temps de visionnage élevé = boost algo
 *
 * @returns Buffer MP4 prêt à poster en Reel Instagram
 */
export async function generateKenBurnsReel(
  inputBuffer: Buffer,
  options: KenBurnsOptions = {}
): Promise<Buffer> {
  const {
    style = "zoom-in",
    duration = 4,
    fps = 30,
    filter = "cinematic",
  } = options;

  const totalFrames = duration * fps;
  const workDir = join(tmpdir(), `kenburns-${uuidv4()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // ── Étape 1 : Préparer l'image source ────────────────────
    // Format Stories : 1080×1920 (9:16)
    const TARGET_W = 1080;
    const TARGET_H = 1920;
    // Image source plus grande pour permettre le zoom/pan sans perte
    const SOURCE_W = Math.round(TARGET_W * 1.15);
    const SOURCE_H = Math.round(TARGET_H * 1.15);

    // Appliquer le filtre couleur avant les frames
    let sourceBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(SOURCE_W, SOURCE_H, { fit: "cover", position: "attention" })
      .toBuffer();

    // Filtre couleur optionnel
    if (filter === "cinematic") {
      sourceBuffer = await sharp(sourceBuffer)
        .recomb([
          [1.08,  0.02, -0.05],
          [0.00,  1.02,  0.02],
          [-0.05, 0.05,  1.02],
        ])
        .modulate({ brightness: 1.02, saturation: 1.15 })
        .linear(1.10, -12)
        .toBuffer();
    } else if (filter === "warm") {
      sourceBuffer = await sharp(sourceBuffer)
        .recomb([[1.06, 0.02, 0.00], [0.00, 1.01, 0.00], [-0.04, 0.00, 0.94]])
        .modulate({ brightness: 1.04, saturation: 1.18 })
        .toBuffer();
    }

    // ── Étape 2 : Générer les frames ─────────────────────────
    const frameFiles: string[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const progress = i / (totalFrames - 1); // 0 → 1

      let extractX: number;
      let extractY: number;
      let extractW: number;
      let extractH: number;

      switch (style) {
        case "zoom-in": {
          // Zoom avant : commence grand, finit sur TARGET
          const scale = 1.0 + (1 - progress) * 0.15; // 1.15 → 1.0
          extractW = Math.round(TARGET_W * scale);
          extractH = Math.round(TARGET_H * scale);
          extractX = Math.round((SOURCE_W - extractW) / 2);
          extractY = Math.round((SOURCE_H - extractH) / 2);
          break;
        }
        case "zoom-out": {
          // Zoom arrière : commence sur TARGET, finit grand
          const scale = 1.0 + progress * 0.15; // 1.0 → 1.15
          extractW = Math.round(TARGET_W * scale);
          extractH = Math.round(TARGET_H * scale);
          extractX = Math.round((SOURCE_W - extractW) / 2);
          extractY = Math.round((SOURCE_H - extractH) / 2);
          break;
        }
        case "pan-right": {
          // Pan droite + léger zoom
          const scale = 1.0 + progress * 0.05;
          extractW = Math.round(TARGET_W * scale);
          extractH = Math.round(TARGET_H * scale);
          extractX = Math.round(progress * (SOURCE_W - extractW));
          extractY = Math.round((SOURCE_H - extractH) / 2);
          break;
        }
        case "pan-left": {
          const scale = 1.0 + progress * 0.05;
          extractW = Math.round(TARGET_W * scale);
          extractH = Math.round(TARGET_H * scale);
          extractX = Math.round((1 - progress) * (SOURCE_W - extractW));
          extractY = Math.round((SOURCE_H - extractH) / 2);
          break;
        }
        case "diagonal":
        default: {
          // Diagonal : zoom + pan diagonal (le plus dynamique)
          const scale = 1.0 + (1 - progress) * 0.12;
          extractW = Math.round(TARGET_W * scale);
          extractH = Math.round(TARGET_H * scale);
          extractX = Math.round(progress * 0.5 * (SOURCE_W - extractW));
          extractY = Math.round(progress * 0.3 * (SOURCE_H - extractH));
          break;
        }
      }

      // Clamp pour éviter les débordements
      extractX = Math.max(0, Math.min(extractX, SOURCE_W - extractW));
      extractY = Math.max(0, Math.min(extractY, SOURCE_H - extractH));
      extractW = Math.min(extractW, SOURCE_W - extractX);
      extractH = Math.min(extractH, SOURCE_H - extractY);

      // Générer la frame
      const frameBuffer = await sharp(sourceBuffer)
        .extract({ left: extractX, top: extractY, width: extractW, height: extractH })
        .resize(TARGET_W, TARGET_H)
        .jpeg({ quality: 90 })
        .toBuffer();

      const framePath = join(workDir, `frame_${String(i).padStart(5, "0")}.jpg`);
      await writeFile(framePath, frameBuffer);
      frameFiles.push(framePath);
    }

    // ── Étape 3 : Encoder en MP4 avec FFmpeg ─────────────────
    const outputPath = join(workDir, "reel.mp4");

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(join(workDir, "frame_%05d.jpg"))
        .inputOptions([`-r ${fps}`])
        .videoCodec("libx264")
        .outputOptions([
          "-pix_fmt yuv420p",      // Compatibilité universelle
          "-crf 20",               // Qualité élevée (0=lossless, 51=pire)
          `-r ${fps}`,
          "-movflags +faststart",  // Lecture streaming immédiate
          "-preset fast",
          "-vf scale=1080:1920",   // S'assurer du format 1080×1920
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    // Lire le fichier MP4 généré
    const { readFile } = await import("fs/promises");
    const mp4Buffer = await readFile(outputPath);
    return mp4Buffer;

  } finally {
    // Nettoyer les fichiers temporaires
    try { await rm(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
