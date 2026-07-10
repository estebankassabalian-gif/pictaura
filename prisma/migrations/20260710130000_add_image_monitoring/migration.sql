-- Monitoring du chemin image (MONITORING_SPEC) : evenements d'appels + cooldown alertes
CREATE TABLE "image_call_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "model" TEXT NOT NULL,
    "estCostCents" INTEGER,

    CONSTRAINT "image_call_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_call_events_createdAt_idx" ON "image_call_events"("createdAt");
CREATE INDEX "image_call_events_kind_createdAt_idx" ON "image_call_events"("kind", "createdAt");

CREATE TABLE "alert_states" (
    "key" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_states_pkey" PRIMARY KEY ("key")
);

-- Support client : motif d'echec par photo
ALTER TABLE "processed_photos" ADD COLUMN "failReason" TEXT;
