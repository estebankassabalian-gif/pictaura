import { classifyImageError } from "@/services/monitoring/image-metrics";

/**
 * Traduit le motif technique d'un échec photo (ProcessedPhoto.failReason) en
 * message compréhensible pour le client, et dit si une relance a un sens.
 *
 * failReason contient le message brut du provider (corps HTTP de fal, etc.) :
 * il ne sort JAMAIS tel quel vers le navigateur. Seul le résultat de cette
 * fonction est exposé par l'API.
 */
export type FailHint = { hint: string; retryable: boolean };

export function failHintFor(failReason: string | null | undefined): FailHint {
  // Pas de motif : photo marquée en échec par la récupération des lots
  // interrompus (redémarrage serveur, traitement bloqué).
  if (!failReason) {
    return {
      hint: "Le traitement a été interrompu avant la fin. Vous pouvez relancer cette photo.",
      retryable: true,
    };
  }

  // Consigne refusée par le garde-fou anti-injection : relancer à l'identique
  // produirait le même refus.
  if (failReason.startsWith("Instruction refusée")) {
    return {
      hint: "La consigne de retouche associée à cette photo a été refusée. Relancez le lot avec une autre consigne.",
      retryable: false,
    };
  }

  if (failReason.includes("Impossible de telecharger l'original")) {
    return {
      hint: "La photo envoyée n'a pas pu être relue. Vous pouvez la relancer, ou la renvoyer si l'échec se reproduit.",
      retryable: true,
    };
  }

  switch (classifyImageError(new Error(failReason))) {
    case "content_policy":
      return {
        hint: "Le filtre automatique du moteur de retouche a bloqué cette photo. Ces blocages sont souvent des faux positifs : vous pouvez la relancer.",
        retryable: true,
      };
    case "no_output":
      return {
        hint: "Le moteur de retouche n'a pas réussi à produire de résultat pour cette photo. Vous pouvez la relancer.",
        retryable: true,
      };
    case "timeout":
      return {
        hint: "Le traitement de cette photo a pris trop de temps. Vous pouvez la relancer.",
        retryable: true,
      };
    case "429":
    case "concurrency":
    case "quota":
      return {
        hint: "Le service de retouche était momentanément saturé. Réessayez dans quelques minutes.",
        retryable: true,
      };
    default:
      return {
        hint: "Une erreur inattendue a interrompu le traitement de cette photo. Vous pouvez la relancer.",
        retryable: true,
      };
  }
}
