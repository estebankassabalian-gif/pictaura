import { RetouchePage } from "@/components/retouche/RetouchePage";

export const metadata = {
  title: "Retouche Immobilier — Pictaura",
  description: "Optimisez vos photos immobilieres avec l'IA pour vendre plus vite.",
};

export default function ImmobilierPage() {
  return <RetouchePage agentKey="IMMOBILIER" />;
}
