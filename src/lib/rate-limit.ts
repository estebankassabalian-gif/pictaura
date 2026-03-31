/**
 * Rate limiter in-memory simple.
 * Sufficient pour un déploiement single-instance.
 * Remplacer par Redis (upstash-ratelimit) pour multi-instance.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/**
 * @param key      Identifiant unique (ex: "register:127.0.0.1")
 * @param limit    Nombre max de requêtes dans la fenêtre
 * @param windowMs Fenêtre en millisecondes
 * @returns true si la requête est autorisée, false si rate-limitée
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
