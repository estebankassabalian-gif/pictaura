import { v4 as uuidv4 } from "uuid";
import {
  uploadToR2,
  getSignedDownloadUrl,
  deleteFromR2,
  buildOriginalKey,
  buildProcessedKey,
  buildInpaintingKey,
} from "@/lib/r2";
import { MAX_FILE_SIZE_BYTES, ALLOWED_IMAGE_TYPES } from "@/config/plans";

// Add uuid to package.json dependencies
// "uuid": "^9.0.0"

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Vérifie les magic bytes d'un buffer image.
 * Empêche l'upload de fichiers malveillants renommés en .jpg/.png.
 */
function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  // WebP: RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "image/webp";
  // HEIF/HEIC: ....ftyp at offset 4
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "image/heic";
  return null;
}

/**
 * Valide un fichier image avant l'upload.
 * - Vérifie le MIME type déclaré
 * - Vérifie les magic bytes (empêche les fichiers malveillants renommés)
 * - Vérifie la taille
 */
export function validateImageFile(
  buffer: Buffer,
  mimeType: string,
  _fileName: string
): void {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as AllowedImageType)) {
    throw new Error(`Type de fichier non supporté: ${mimeType}`);
  }

  // Magic bytes validation — le contenu réel doit correspondre au type déclaré
  const detectedMime = detectMimeFromMagicBytes(buffer);
  if (!detectedMime) {
    throw new Error("Fichier invalide : impossible de détecter le type d'image");
  }
  // HEIF/HEIC both map to "image/heic" from magic bytes
  const normalizedDeclared = mimeType === "image/heif" ? "image/heic" : mimeType;
  const normalizedDetected = detectedMime === "image/heif" ? "image/heic" : detectedMime;
  // JPEG variants (image/jpg → image/jpeg)
  const normalizeMime = (m: string) => m === "image/jpg" ? "image/jpeg" : m;
  if (normalizeMime(normalizedDeclared) !== normalizeMime(normalizedDetected)) {
    throw new Error("Le contenu du fichier ne correspond pas au type déclaré");
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} Mo)`);
  }
}

/** Re-export magic bytes detection for use in API routes */
export { detectMimeFromMagicBytes };

/**
 * Upload un fichier original et retourne sa clé R2.
 */
export async function uploadOriginalPhoto(
  buffer: Buffer,
  mimeType: string,
  originalFileName: string,
  userId: string,
  jobId: string
): Promise<{ key: string; uuid: string }> {
  const ext = getExtensionFromMime(mimeType);
  const photoUuid = uuidv4();
  const key = buildOriginalKey(userId, jobId, photoUuid, ext);

  await uploadToR2(key, buffer, mimeType);
  return { key, uuid: photoUuid };
}

/**
 * Upload un fichier traité (toujours JPEG) et retourne sa clé R2.
 */
export async function uploadProcessedPhoto(
  buffer: Buffer,
  userId: string,
  jobId: string,
  photoUuid: string
): Promise<string> {
  const key = buildProcessedKey(userId, jobId, photoUuid);
  await uploadToR2(key, buffer, "image/jpeg");
  return key;
}

/**
 * Upload le résultat d'inpainting et retourne sa clé R2.
 */
export async function uploadInpaintingResult(
  buffer: Buffer,
  userId: string,
  inpaintingJobId: string
): Promise<string> {
  const key = buildInpaintingKey(userId, inpaintingJobId);
  await uploadToR2(key, buffer, "image/jpeg");
  return key;
}

/**
 * Génère une URL signée fraîche pour un fichier R2.
 * Toujours appeler cette fonction — ne jamais stocker l'URL.
 */
export async function getFreshSignedUrl(key: string): Promise<string> {
  return getSignedDownloadUrl(key);
}

/**
 * Supprime les fichiers d'un job (original + processed) de R2.
 * Utilisé pour le nettoyage après 30 jours.
 */
export async function deleteJobFiles(keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) => deleteFromR2(key)));
}

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[mimeType] ?? "jpg";
}
