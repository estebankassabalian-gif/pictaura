/**
 * Monitoring du chemin image (MONITORING_SPEC — Phase 1).
 *
 * Détecte une panne du modèle IMAGE avant les clients : la panne de juin
 * (429 quota Gemini pendant 15 jours) était invisible car le health check ne
 * testait que le modèle texte.
 *
 * Principes non négociables :
 * - Le monitoring ne casse JAMAIS le flux client : tout est fire-and-forget,
 *   chaque écriture/alerte est avalée par un try/catch.
 * - Zéro nouvelle infra : Postgres existant + bot Telegram.
 *
 * Config (process.env, toutes optionnelles avec défauts sains) :
 *   ALERT_ERROR_RATE_THRESHOLD  % de photos clients perdues déclenchant l'alerte (défaut 30)
 *   ALERT_PHOTO_WINDOW_MIN      fenêtre de comptage des photos (défaut 15 min)
 *   ALERT_MIN_LOST_PHOTOS       plancher avant toute alerte (défaut 2)
 *   ALERT_BURST_LOST_PHOTOS     nb de photos perdues alertant quel que soit le % (défaut 5)
 *   ALERT_WINDOW_MIN            fenêtre héritée (tentatives) — conservée pour compat
 *   ALERT_COOLDOWN_MIN          anti-spam par type d'alerte (défaut 15 min)
 *   BUDGET_DAILY_CENTS          seuil budget API/jour (défaut 500 = 5 €)
 *   IMAGE_COST_CENTS            coût estimé d'un appel image réussi (défaut 4)
 */
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { sendTelegramAlert } from "@/lib/telegram";

export type ImageErrorCode =
  | "429"
  | "concurrency"
  | "quota"
  | "timeout"
  | "content_policy"
  | "no_output"
  | "other";

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

const CFG = () => ({
  errorRatePct: num(process.env.ALERT_ERROR_RATE_THRESHOLD, 30),
  windowMin: num(process.env.ALERT_WINDOW_MIN, 5),
  // Fenêtre et seuils de la règle B, qui compte des PHOTOS livrées/perdues :
  // plus longue que la fenêtre de tentatives, une photo prenant ~15-30 s.
  photoWindowMin: num(process.env.ALERT_PHOTO_WINDOW_MIN, 15),
  minLostPhotos: num(process.env.ALERT_MIN_LOST_PHOTOS, 2),
  burstLostPhotos: num(process.env.ALERT_BURST_LOST_PHOTOS, 5),
  cooldownMin: num(process.env.ALERT_COOLDOWN_MIN, 15),
  budgetDailyCents: num(process.env.BUDGET_DAILY_CENTS, 500),
  imageCostCents: num(process.env.IMAGE_COST_CENTS, 4),
});

/** Refus propre à UNE photo (filtre ou génération ratée), pas une panne du
 *  provider : ne doit ni ouvrir le circuit breaker, ni être retenté à l'identique. */
export function isPhotoSpecificRejection(code: ImageErrorCode): boolean {
  return code === "content_policy" || code === "no_output";
}

/** Retire les data-URI (base64 d'image) qu'un message d'erreur peut réécrire. */
export function sanitizeErrorMessage(message: string, max = 300): string {
  return message.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]*/gi, "data:<image>").slice(0, max);
}

/** Classe une erreur d'appel image pour les règles d'alerte. */
export function classifyImageError(err: unknown): ImageErrorCode {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  // 429 de fal pour dépassement de la limite de requêtes SIMULTANÉES du
  // compte : un embouteillage, pas un quota ni une facturation. Testé avant
  // "429" pour ne pas envoyer l'opérateur vérifier une facturation saine.
  if (msg.includes("concurrent_requests_limit") || msg.includes("concurrent requests")) return "concurrency";
  if (msg.includes("429")) return "429";
  if (msg.includes("quota") || msg.includes("exceeded") || msg.includes("billing")) return "quota";
  if (msg.includes("timeout") || msg.includes("abort")) return "timeout";
  if (msg.includes("content_policy") || msg.includes("content policy") || msg.includes("flagged"))
    return "content_policy";
  // Le 422 générique de fal ("did not generate the expected output") était
  // jusqu'ici rangé sous content_policy. Ce sont deux causes distinctes — un
  // refus du filtre de sécurité d'un côté, une génération ratée de l'autre —
  // et les confondre a rendu l'incident du 2026-09-16 indiagnosticable.
  if (msg.includes("did not generate the expected output")) return "no_output";
  return "other";
}

/**
 * Enregistre un appel image (réel ou canary) + déclenche les règles d'alerte.
 * Fire-and-forget : l'appelant n'attend rien, aucune erreur ne remonte.
 */
export function recordImageCall(e: {
  kind: "real" | "canary";
  success: boolean;
  latencyMs: number;
  model: string;
  errorCode?: ImageErrorCode;
  /** Message brut de l'erreur — assaini et tronqué avant stockage */
  errorMessage?: string;
  /** Coût spécifique (ex: upscale ~1 ct) — défaut IMAGE_COST_CENTS */
  costCents?: number;
}): void {
  void (async () => {
    try {
      const cfg = CFG();
      await prisma.imageCallEvent.create({
        data: {
          kind: e.kind,
          success: e.success,
          latencyMs: e.latencyMs,
          model: e.model,
          errorCode: e.errorCode ?? null,
          errorMessage: e.errorMessage ? sanitizeErrorMessage(e.errorMessage) : null,
          estCostCents: e.success ? e.costCents ?? cfg.imageCostCents : null,
        },
      });
      if (e.success) {
        await maybeAlertBudget();
      } else if (e.kind === "real") {
        await maybeAlertOnError(e.errorCode ?? "other", e.model);
      }
      // Les échecs canary sont alertés par le runner canary (règle latence incluse)
    } catch {
      /* le monitoring ne casse jamais le flux */
    }
  })();
}

/**
 * Envoie une alerte Telegram avec cooldown anti-spam par clé.
 * Le cooldown est arbitré par la DB (updateMany conditionnel) : deux process
 * concurrents ne peuvent pas envoyer la même alerte en double.
 */
export async function alertWithCooldown(
  key: "quota" | "concurrency" | "error_rate" | "budget" | "canary" | "breaker",
  cooldownMin: number,
  text: string
): Promise<void> {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - cooldownMin * 60_000);
    const existing = await prisma.alertState.findUnique({ where: { key } });
    if (existing) {
      const updated = await prisma.alertState.updateMany({
        where: { key, lastSentAt: { lt: cutoff } },
        data: { lastSentAt: now },
      });
      if (updated.count === 0) return; // en cooldown
    } else {
      const created = await prisma.alertState
        .create({ data: { key, lastSentAt: now } })
        .catch(() => null); // course : un autre process l'a créée → cooldown
      if (!created) return;
    }
    await sendTelegramAlert(text);
  } catch {
    /* jamais de throw */
  }
}

/** Règles A (quota/429 immédiat) + B (taux d'échec anormal). */
async function maybeAlertOnError(code: ImageErrorCode, model: string): Promise<void> {
  const cfg = CFG();

  if (code === "429" || code === "quota") {
    await alertWithCooldown(
      "quota",
      cfg.cooldownMin,
      `🚨 PICTAURA — ${code.toUpperCase()} sur le modèle image (${model}).\nLes retouches clients échouent probablement EN CE MOMENT.\n→ Vérifier quota / facturation du provider.`
    );
  }

  if (code === "concurrency") {
    await alertWithCooldown(
      "concurrency",
      cfg.cooldownMin,
      `🚦 PICTAURA — limite de requêtes simultanées fal atteinte (${model}).\nCe n'est PAS un problème de crédits : le plafond interne FAL_MAX_CONCURRENCY (${process.env.FAL_MAX_CONCURRENCY ?? "6 par défaut"}) dépasse la limite réelle du compte, ou fal l'a abaissée.\n→ Comparer avec fal.ai/dashboard/usage-billing/concurrency et baisser FAL_MAX_CONCURRENCY dans Coolify.`
    );
  }

  await maybeAlertOnPhotoLoss(code);
}

/**
 * Règle B — part des PHOTOS CLIENTS perdues.
 *
 * Elle comptait les TENTATIVES : une photo qui épuise ses essais avant d'être
 * rattrapée (instruction seule, puis modèle de secours) écrit plusieurs lignes
 * d'échec, et une seule photo difficile suffisait à franchir les 30 %. Résultat
 * observé les 2026-09-16, 09-17 et 09-23 : alertes « taux d'échec anormal »
 * alors que TOUTES les photos avaient été livrées et aucun crédit perdu.
 *
 * Une alerte doit signaler ce que le client subit. On compte donc les photos
 * réellement perdues (ProcessedPhoto.FAILED = crédit remboursé, rien livré)
 * face aux photos livrées. Les pannes de provider restent couvertes en amont,
 * immédiatement, par les règles quota / 429 / concurrence et par le canary.
 */
async function maybeAlertOnPhotoLoss(code: ImageErrorCode): Promise<void> {
  const cfg = CFG();
  const since = new Date(Date.now() - cfg.photoWindowMin * 60_000);
  const [lost, delivered] = await Promise.all([
    prisma.processedPhoto.count({ where: { status: JobStatus.FAILED, updatedAt: { gte: since } } }),
    prisma.processedPhoto.count({ where: { status: JobStatus.COMPLETED, updatedAt: { gte: since } } }),
  ]);

  // Une photo perdue isolée arrive (photo illisible, consigne refusée) : ce
  // n'est pas un incident, et réveiller l'opérateur pour ça use l'alerte.
  if (lost < cfg.minLostPhotos) return;

  const total = lost + delivered;
  const ratioBreached = total > 0 && (lost * 100) / total > cfg.errorRatePct;
  if (!ratioBreached && lost < cfg.burstLostPhotos) return;

  await alertWithCooldown(
    "error_rate",
    cfg.cooldownMin,
    `⚠️ PICTAURA — ${lost} photo(s) CLIENT perdue(s) sur ${total} traitée(s) en ${cfg.photoWindowMin} min (dernier code : ${code}).
` +
      `Crédits remboursés automatiquement, mais ces clients repartent sans leurs photos.
` +
      `→ Détail des causes : https://pictaura.app/api/health/image`
  );
}

/** Règle C : budget API image journalier. Alerte au plus 1×/24 h. */
async function maybeAlertBudget(): Promise<void> {
  const cfg = CFG();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const agg = await prisma.imageCallEvent.aggregate({
    _sum: { estCostCents: true },
    where: { createdAt: { gte: startOfDay } },
  });
  const cents = agg._sum.estCostCents ?? 0;
  if (cents >= cfg.budgetDailyCents) {
    await alertWithCooldown(
      "budget",
      24 * 60,
      `💸 PICTAURA — budget API image du jour atteint : ${(cents / 100).toFixed(2)} € (seuil ${(cfg.budgetDailyCents / 100).toFixed(2)} €).`
    );
  }
}

/** Snapshot pour /api/health/image (+ uptime monitor externe). */
export async function getImageHealthSnapshot(): Promise<{
  lastCanaryAt: string | null;
  lastCanaryOk: boolean | null;
  calls1h: number;
  errorRate1h: number | null;
  budgetTodayCents: number;
  /** Echecs reels de la derniere heure par code. Sans ca, une alerte "taux
   *  d'echec anormal" ne dit pas QUOI reparer : quota, timeout et rejet de
   *  contenu appellent trois actions opposees. Diagnostiquer imposait
   *  jusqu'ici un acces direct au Postgres de prod. */
  errorsByCode1h: Record<string, number>;
  /** Derniers echecs reels (24 h), pour distinguer une rafale de retries sur
   *  UNE photo (3 tentatives = 3 lignes) d'une panne diffuse sur tout le
   *  trafic. Aucune donnee client. */
  recentFailures: Array<{ at: string; code: string; model: string; latencyMs: number; message: string | null }>;
  /** Photos clients livrées / perdues sur 1 h — la seule mesure qui dit ce que
   *  le client subit. Les tentatives rattrapées par un filet n'y figurent pas. */
  photos1h: { delivered: number; lost: number };
}> {
  const hourAgo = new Date(Date.now() - 3_600_000);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [lastCanary, total1h, fails1h, budgetAgg, delivered1h, lost1h, byCode, lastFails] =
    await Promise.all([
    prisma.imageCallEvent.findFirst({
      where: { kind: "canary" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, success: true },
    }),
    prisma.imageCallEvent.count({ where: { kind: "real", createdAt: { gte: hourAgo } } }),
    prisma.imageCallEvent.count({
      where: { kind: "real", success: false, createdAt: { gte: hourAgo } },
    }),
    prisma.imageCallEvent.aggregate({
      _sum: { estCostCents: true },
      where: { createdAt: { gte: startOfDay } },
    }),
    prisma.processedPhoto.count({
      where: { status: JobStatus.COMPLETED, updatedAt: { gte: hourAgo } },
    }),
    prisma.processedPhoto.count({
      where: { status: JobStatus.FAILED, updatedAt: { gte: hourAgo } },
    }),
    // Les deux requetes de diagnostic sont increvables : /api/health/image est
    // surveille par l'uptime monitor externe ET sert a diagnostiquer les
    // pannes. Un detail de diagnostic qui echoue ne doit jamais faire passer
    // la sonde de sante en 503 ni masquer les chiffres essentiels au-dessus.
    prisma.imageCallEvent
      .groupBy({
        by: ["errorCode"],
        _count: { _all: true },
        where: { kind: "real", success: false, createdAt: { gte: hourAgo } },
      })
      .catch(() => [] as Array<{ errorCode: string | null; _count: { _all: number } }>),
    prisma.imageCallEvent
      .findMany({
        where: {
          kind: "real",
          success: false,
          createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { createdAt: true, errorCode: true, errorMessage: true, model: true, latencyMs: true },
      })
      .catch(
        () =>
          [] as Array<{
            createdAt: Date;
            errorCode: string | null;
            errorMessage: string | null;
            model: string;
            latencyMs: number;
          }>
      ),
  ]);

  return {
    lastCanaryAt: lastCanary?.createdAt.toISOString() ?? null,
    lastCanaryOk: lastCanary?.success ?? null,
    calls1h: total1h,
    errorRate1h: total1h > 0 ? Math.round((fails1h / total1h) * 100) / 100 : null,
    budgetTodayCents: budgetAgg._sum.estCostCents ?? 0,
    photos1h: { delivered: delivered1h, lost: lost1h },
    errorsByCode1h: Object.fromEntries(
      byCode.map((r) => [r.errorCode ?? "unknown", r._count._all])
    ),
    recentFailures: lastFails.map((f) => ({
      at: f.createdAt.toISOString(),
      code: f.errorCode ?? "unknown",
      model: f.model,
      latencyMs: f.latencyMs,
      // Endpoint public : extrait court, déjà assaini au stockage
      message: f.errorMessage ? f.errorMessage.slice(0, 160) : null,
    })),
  };
}
