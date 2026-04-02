import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/config/env";

let _r2Client: S3Client | null = null;
function getR2Client(): S3Client {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _r2Client;
}
export { getR2Client as getR2 };

const BUCKET = () => env.R2_BUCKET_NAME;
const SIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes

/**
 * Upload un buffer vers R2.
 * @returns La clé R2 du fichier uploadé
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Prevent overwriting — caller should use unique keys (UUID-based)
    })
  );
  return key;
}

/**
 * Génère une URL signée temporaire (15 min) pour accéder à un fichier privé.
 * Toujours régénérer depuis la clé, ne jamais stocker l'URL.
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  return getSignedUrl(getR2Client(), command, {
    expiresIn: SIGNED_URL_EXPIRY_SECONDS,
  });
}

/**
 * Supprime un fichier de R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: key })
  );
}

/**
 * Génère une clé R2 unique pour un fichier original.
 * Format: originals/{userId}/{jobId}/{uuid}.{ext}
 */
export function buildOriginalKey(
  userId: string,
  jobId: string,
  uuid: string,
  ext: string
): string {
  return `originals/${userId}/${jobId}/${uuid}.${ext}`;
}

/**
 * Génère une clé R2 unique pour un fichier traité.
 * Format: processed/{userId}/{jobId}/{uuid}.jpg
 */
export function buildProcessedKey(
  userId: string,
  jobId: string,
  uuid: string
): string {
  return `processed/${userId}/${jobId}/${uuid}.jpg`;
}

/**
 * Génère une clé R2 pour le résultat d'inpainting.
 * Format: inpainting/{userId}/{inpaintingJobId}.jpg
 */
export function buildInpaintingKey(
  userId: string,
  inpaintingJobId: string
): string {
  return `inpainting/${userId}/${inpaintingJobId}.jpg`;
}
