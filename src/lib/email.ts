import { Resend } from "resend";
import { env } from "@/config/env";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

const FROM = () => env.RESEND_FROM_EMAIL ?? "noreply@pictaura.app";
const APP_URL = () => env.NEXT_PUBLIC_APP_URL ?? "https://pictaura.app";

/**
 * Envoie un email de notification quand le traitement est terminé.
 */
export async function sendJobCompletedEmail({
  to,
  userName,
  preset,
  photoCount,
  jobId,
  successCount,
  failedCount,
}: {
  to: string;
  userName: string;
  preset: string;
  photoCount: number;
  jobId: string;
  successCount: number;
  failedCount: number;
}): Promise<void> {
  const presetLabels: Record<string, string> = {
    AIRBNB: "Immobilier",
    IMMOBILIER: "Immobilier",
    INSTAGRAM: "Réseaux sociaux",
    SHOPIFY: "E-commerce",
  };

  const presetLabel = presetLabels[preset] ?? preset;
  const resultsUrl = `${APP_URL()}/results/${jobId}`;
  const allOk = failedCount === 0;

  await getResend().emails.send({
    from: `Pictaura <${FROM()}>`,
    to,
    subject: allOk
      ? `✅ Vos ${photoCount} photo(s) ${presetLabel} sont prêtes !`
      : `⚠️ Traitement ${presetLabel} terminé (${successCount}/${photoCount} réussies)`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #0284c7; padding: 32px 32px 24px;">
      <p style="color: white; font-size: 22px; font-weight: 700; margin: 0;">Pictaura</p>
      <p style="color: #bae6fd; font-size: 13px; margin: 4px 0 0;">Retouche photo IA</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h1 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 8px;">
        ${allOk ? "✅ Vos photos sont prêtes !" : "⚠️ Traitement terminé"}
      </h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
        Bonjour ${userName.split(" ")[0]},
      </p>

      <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Plateforme</td>
            <td style="color: #111827; font-size: 13px; font-weight: 600; text-align: right;">${presetLabel}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Photos réussies</td>
            <td style="color: #16a34a; font-size: 13px; font-weight: 600; text-align: right;">${successCount} / ${photoCount}</td>
          </tr>
          ${failedCount > 0 ? `
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Crédits remboursés</td>
            <td style="color: #dc2626; font-size: 13px; font-weight: 600; text-align: right;">${failedCount} crédit(s)</td>
          </tr>` : ""}
        </table>
      </div>

      <a href="${resultsUrl}" style="display: block; background: #0284c7; color: white; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 15px;">
        Voir mes photos →
      </a>

      <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; text-align: center;">
        Téléchargez votre pack optimisé avec les noms de fichiers SEO inclus.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #f3f4f6; padding: 16px 32px; text-align: center;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        Pictaura · <a href="${APP_URL()}" style="color: #9ca3af;">pictaura.app</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

/**
 * Envoie un email de réinitialisation de mot de passe.
 */
export async function sendPasswordResetEmail({
  to,
  token,
}: {
  to: string;
  token: string;
}): Promise<void> {
  const resetUrl = `${APP_URL()}/reset-password?token=${token}`;

  await getResend().emails.send({
    from: `Pictaura <${FROM()}>`,
    to,
    subject: "Réinitialisez votre mot de passe Pictaura",
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #0f0f1a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(248,112,5,0.15);">
    <div style="background: linear-gradient(135deg, #031D68 0%, #f87005 100%); padding: 32px 32px 28px;">
      <p style="color: white; font-size: 24px; font-weight: 800; margin: 0;">Pictaura</p>
    </div>
    <div style="padding: 32px;">
      <h1 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 12px;">Mot de passe oublié ?</h1>
      <p style="color: #a1a1aa; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.
      </p>
      <a href="${resetUrl}" style="display: block; background: linear-gradient(135deg, #031D68 0%, #f87005 100%); color: white; text-decoration: none; text-align: center; padding: 15px 24px; border-radius: 12px; font-weight: 700; font-size: 15px;">
        Réinitialiser mon mot de passe
      </a>
      <p style="color: #3f3f46; font-size: 12px; margin: 24px 0 0; text-align: center;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      </p>
    </div>
    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding: 16px 32px; text-align: center;">
      <p style="color: #3f3f46; font-size: 11px; margin: 0;">Pictaura · <a href="${APP_URL()}" style="color: #3f3f46; text-decoration: none;">pictaura.app</a></p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

/**
 * Envoie un email de confirmation quand l'utilisateur demande la résiliation.
 * L'accès reste actif jusqu'à `endsAt`.
 */
export async function sendSubscriptionCancellationScheduledEmail({
  to,
  userName,
  endsAt,
}: {
  to: string;
  userName: string;
  endsAt: Date;
}): Promise<void> {
  const firstName = userName.split(" ")[0];
  const endsAtFr = endsAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const billingUrl = `${APP_URL()}/billing`;

  await getResend().emails.send({
    from: `Pictaura <${FROM()}>`,
    to,
    subject: `Votre résiliation est enregistrée — accès jusqu'au ${endsAtFr}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #0f0f1a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(248,112,5,0.15);">
    <div style="background: linear-gradient(135deg, #031D68 0%, #f87005 100%); padding: 32px 32px 28px;">
      <p style="color: white; font-size: 24px; font-weight: 800; margin: 0;">Pictaura</p>
    </div>
    <div style="padding: 32px;">
      <h1 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 12px;">Résiliation enregistrée</h1>
      <p style="color: #a1a1aa; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
        Bonjour ${firstName},<br><br>
        Votre demande de résiliation est bien prise en compte. Vous conservez l'intégralité des fonctionnalités Premium jusqu'au <strong style="color: #f87005;">${endsAtFr}</strong>, date à laquelle votre abonnement prendra fin automatiquement.
      </p>

      <div style="background: rgba(248,112,5,0.08); border: 1px solid rgba(248,112,5,0.2); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
        <p style="color: #ffa94d; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px;">Accès actif jusqu'au</p>
        <p style="color: #f87005; font-size: 20px; font-weight: 700; margin: 0;">${endsAtFr}</p>
      </div>

      <p style="color: #a1a1aa; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Les crédits restants sur votre compte ne seront pas supprimés — vous pouvez continuer à les utiliser jusqu'à épuisement.
      </p>

      <a href="${billingUrl}" style="display: block; background: linear-gradient(135deg, #031D68 0%, #f87005 100%); color: white; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 14px;">
        Gérer mon abonnement
      </a>

      <p style="color: #52525b; font-size: 12px; margin: 20px 0 0; text-align: center; line-height: 1.5;">
        Vous avez changé d'avis ? Vous pouvez réactiver votre abonnement depuis l'espace de facturation avant la date de fin.
      </p>
    </div>
    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding: 16px 32px; text-align: center;">
      <p style="color: #3f3f46; font-size: 11px; margin: 0;">Pictaura · <a href="${APP_URL()}" style="color: #3f3f46; text-decoration: none;">pictaura.app</a></p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

/**
 * Envoie un email quand l'abonnement prend effectivement fin (après la période en cours).
 */
export async function sendSubscriptionEndedEmail({
  to,
  userName,
  remainingCredits,
}: {
  to: string;
  userName: string;
  remainingCredits: number;
}): Promise<void> {
  const firstName = userName.split(" ")[0];
  const billingUrl = `${APP_URL()}/billing`;

  await getResend().emails.send({
    from: `Pictaura <${FROM()}>`,
    to,
    subject: "Votre abonnement Pictaura est terminé",
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #0f0f1a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(248,112,5,0.15);">
    <div style="background: linear-gradient(135deg, #031D68 0%, #f87005 100%); padding: 32px 32px 28px;">
      <p style="color: white; font-size: 24px; font-weight: 800; margin: 0;">Pictaura</p>
    </div>
    <div style="padding: 32px;">
      <h1 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 12px;">À bientôt, ${firstName}</h1>
      <p style="color: #a1a1aa; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Votre abonnement Pictaura a pris fin aujourd'hui. Merci d'avoir fait confiance à notre plateforme pour optimiser vos photos.
      </p>

      ${
        remainingCredits > 0
          ? `<div style="background: rgba(248,112,5,0.08); border: 1px solid rgba(248,112,5,0.2); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <p style="color: #f87005; font-size: 36px; font-weight: 900; margin: 0; line-height: 1;">${remainingCredits}</p>
        <p style="color: #ffa94d; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 6px 0 0;">crédits encore disponibles</p>
      </div>
      <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 24px; line-height: 1.6;">
        Vos crédits restants ne sont pas perdus — vous pouvez continuer à les utiliser à tout moment.
      </p>`
          : `<p style="color: #a1a1aa; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Votre solde de crédits est à zéro. Pour reprendre la retouche, il vous suffit de réactiver un abonnement.
      </p>`
      }

      <a href="${billingUrl}" style="display: block; background: linear-gradient(135deg, #031D68 0%, #f87005 100%); color: white; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 14px;">
        Reprendre un abonnement
      </a>

      <p style="color: #52525b; font-size: 12px; margin: 20px 0 0; text-align: center; line-height: 1.5;">
        Un retour à nous faire sur votre expérience ? Répondez simplement à cet email, nous lisons tout.
      </p>
    </div>
    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding: 16px 32px; text-align: center;">
      <p style="color: #3f3f46; font-size: 11px; margin: 0;">Pictaura · <a href="${APP_URL()}" style="color: #3f3f46; text-decoration: none;">pictaura.app</a></p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

/**
 * Envoie un email de bienvenue après la création d'un compte.
 */
export async function sendWelcomeEmail({
  to,
  userName,
}: {
  to: string;
  userName: string;
}): Promise<void> {
  const firstName = userName.split(" ")[0];
  const dashboardUrl = `${APP_URL()}/dashboard`;

  await getResend().emails.send({
    from: `Pictaura <${FROM()}>`,
    to,
    subject: "Bienvenue sur Pictaura — vos 5 crédits vous attendent",
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #0f0f1a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(248,112,5,0.15);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #031D68 0%, #f87005 100%); padding: 32px 32px 28px;">
      <p style="color: white; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Pictaura</p>
      <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 4px 0 0;">Retouche photo par intelligence artificielle</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 8px;">
        Bienvenue, ${firstName}
      </h1>
      <p style="color: #a1a1aa; font-size: 14px; margin: 0 0 28px; line-height: 1.6;">
        Votre compte est activé. Nous avons crédité votre espace de <strong style="color: #f87005;">5 crédits offerts</strong> pour découvrir la plateforme sans engagement.
      </p>

      <!-- Credits box -->
      <div style="background: rgba(248,112,5,0.08); border: 1px solid rgba(248,112,5,0.2); border-radius: 12px; padding: 20px; margin-bottom: 28px; text-align: center;">
        <p style="color: #f87005; font-size: 42px; font-weight: 900; margin: 0; line-height: 1;">5</p>
        <p style="color: #ffa94d; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 4px 0 0;">crédits disponibles</p>
      </div>

      <!-- Tools -->
      <p style="color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">Outils disponibles</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <a href="${APP_URL()}/immobilier" style="text-decoration: none; color: #e4e4e7; font-size: 14px; font-weight: 500;">
              → Immobilier &amp; Airbnb
            </a>
            <p style="color: #52525b; font-size: 12px; margin: 2px 0 0;">Optimisation pour annonces et locations courte durée</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <a href="${APP_URL()}/instagram" style="text-decoration: none; color: #e4e4e7; font-size: 14px; font-weight: 500;">
              → Réseaux sociaux (Instagram, TikTok)
            </a>
            <p style="color: #52525b; font-size: 12px; margin: 2px 0 0;">Contenus visuels prêts à publier, stories et posts</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0;">
            <a href="${APP_URL()}/shopify" style="text-decoration: none; color: #e4e4e7; font-size: 14px; font-weight: 500;">
              → E-commerce (Shopify, Vinted, Etsy, Leboncoin)
            </a>
            <p style="color: #52525b; font-size: 12px; margin: 2px 0 0;">Visuels produits professionnels pour boutique en ligne</p>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <a href="${dashboardUrl}" style="display: block; background: linear-gradient(135deg, #031D68 0%, #f87005 100%); color: white; text-decoration: none; text-align: center; padding: 15px 24px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: -0.2px;">
        Commencer maintenant →
      </a>

      <p style="color: #3f3f46; font-size: 12px; margin: 20px 0 0; text-align: center; line-height: 1.5;">
        Chaque crédit traite une photo. Les crédits non utilisés restent disponibles sans limite de durée.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding: 16px 32px; text-align: center;">
      <p style="color: #3f3f46; font-size: 11px; margin: 0;">
        Pictaura · <a href="${APP_URL()}" style="color: #3f3f46; text-decoration: none;">pictaura.app</a>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}
