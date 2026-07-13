import { PgBoss } from "pg-boss";
import { processJob } from "@/services/processing/pipeline";

const QUEUE_PROCESS_JOB = "process-job";

/**
 * File persistante (pg-boss, stockée dans Postgres) pour le lancement du
 * pipeline de retouche. Remplace l'ancien pattern `processJob(jobId).catch(...)`
 * fire-and-forget : ce dernier fonctionne tant que le process Node reste en
 * vie, mais si le container meurt (crash, redeploy Coolify) dans la fenêtre
 * entre la création du job et l'exécution de cette promesse, le lancement du
 * traitement est perdu — le job reste PENDING jusqu'à ce que job-recovery.ts
 * le détecte (8 min) et rembourse. Avec pg-boss, le message "traite ce job"
 * est écrit en DB avant même de retourner : il survit à n'importe quel crash
 * et sera repris par le PROCHAIN worker qui démarre (même après un redeploy).
 *
 * Ce que ça NE couvre PAS : un job déjà en cours (status PROCESSING) dont le
 * worker meurt en plein milieu. `processJob()` n'accepte de démarrer qu'un
 * job PENDING (claim atomique) — un retry pg-boss sur un job déjà PROCESSING
 * est donc un no-op silencieux et sûr. job-recovery.ts (sweep d'inactivité
 * 8 min + ledger de remboursement idempotent, cf. refundJobCredits) reste
 * seul responsable de ce cas, exactement comme avant. Une vraie reprise d'un
 * traitement interrompu en plein vol est un chantier plus lourd (nécessite un
 * mécanisme de bail/heartbeat par photo) — hors scope ici.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pictauraBoss: PgBoss | undefined;
  // eslint-disable-next-line no-var
  var __pictauraBossReady: Promise<PgBoss> | undefined;
}

async function getBoss(): Promise<PgBoss> {
  if (globalThis.__pictauraBoss) return globalThis.__pictauraBoss;
  if (globalThis.__pictauraBossReady) return globalThis.__pictauraBossReady;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant — impossible de démarrer pg-boss");
  }

  const boss = new PgBoss({ connectionString });
  boss.on("error", (err) => console.error("pg-boss error:", err));

  globalThis.__pictauraBossReady = (async () => {
    await boss.start();
    // policy "stately" + singletonKey=jobId : au plus UN message (en file ou
    // actif) par job à la fois. Le pipeline est déclenché deux fois côté app
    // (eager start dès la 1ère photo uploadée + filet de sécurité en fin
    // d'upload) — cette policy évite un doublon de message sans avoir à
    // coder la déduplication nous-mêmes.
    await boss.createQueue(QUEUE_PROCESS_JOB, {
      policy: "stately",
      retryLimit: 2,
      retryDelay: 10,
      // Grande marge au-delà du pire cas réaliste (gros lot, retries inclus)
      // pour ne pas faire échouer côté pg-boss un job qui travaille toujours
      // légitimement.
      expireInSeconds: 30 * 60,
    });
    globalThis.__pictauraBoss = boss;
    return boss;
  })();

  return globalThis.__pictauraBossReady;
}

/**
 * Enregistre le worker qui exécute réellement le pipeline. À appeler une
 * seule fois au boot (cf. instrumentation.ts).
 */
export async function startJobWorker(): Promise<void> {
  const boss = await getBoss();
  await boss.work<{ jobId: string }>(
    QUEUE_PROCESS_JOB,
    { batchSize: 1 },
    async ([job]) => {
      await processJob(job.data.jobId);
    }
  );
  console.log("Worker pg-boss actif sur la file 'process-job'");
}

/**
 * Publie durablement une demande de traitement pour ce job. Persistée dans
 * Postgres avant de retourner — jamais perdue même si le container meurt
 * juste après cet appel.
 */
export async function enqueueProcessJob(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUE_PROCESS_JOB, { jobId }, { singletonKey: jobId });
}
