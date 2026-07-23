"use client";

import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function StatCard({
  label,
  value,
  icon,
  index = 0,
}: {
  label: string;
  value: string;
  // Élément déjà rendu (ex: <ImageIcon className="..." />), PAS une référence
  // de composant : un Server Component ne peut pas passer une fonction/
  // référence de composant à un Client Component ("use client") — seul un
  // élément React déjà instancié traverse la frontière serveur→client.
  icon: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: index * 0.08 }}
      whileHover={{ y: -3 }}
      className="bg-white rounded-2xl border border-ink/10 p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="mb-3">{icon}</div>
      <div className="text-3xl font-display tracking-tight text-ink">{value}</div>
      <div className="text-sm text-ink-muted mt-1">{label}</div>
    </motion.div>
  );
}
