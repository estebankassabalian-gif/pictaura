import { retouchPhoto, canaryImageCall } from "@/lib/gemini";
import { env } from "@/config/env";
import type { ImageEditArgs, ImageEditProvider, ImageEditResult } from "./types";

/**
 * Provider Gemini — enveloppe le chemin existant (retouchPhoto), qui porte déjà
 * retries, timeouts progressifs, budget 5 min et instrumentation monitoring.
 * Comportement métier strictement identique à l'avant-couche-provider.
 */
export class GeminiProvider implements ImageEditProvider {
  readonly name = "gemini";

  isConfigured(): boolean {
    return Boolean(env.GOOGLE_AI_KEY);
  }

  modelLabel(): string {
    return "gemini-3.1-flash-image-preview";
  }

  async editImage(args: ImageEditArgs): Promise<ImageEditResult> {
    if (args.kind === "canary") {
      // Sonde : un seul appel sans retries (instrumenté kind 'canary').
      // Le buffer n'est pas exploité par le canary — latence/succès suffisent.
      await canaryImageCall(args.imageBase64, args.timeoutMs ?? 45_000);
      return { buffer: Buffer.alloc(0), model: this.modelLabel() };
    }
    const buffer = await retouchPhoto(args.imageBase64, args.instruction, args.systemPrompt);
    return { buffer, model: this.modelLabel() };
  }
}
