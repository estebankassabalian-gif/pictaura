import { RetouchePage } from "@/components/retouche/RetouchePage";

export const metadata = {
  title: "Retouche E-commerce — Pictaura",
  description: "Photos produit premium pour votre boutique en ligne.",
};

export default function ShopifyPage() {
  return <RetouchePage agentKey="SHOPIFY" />;
}
