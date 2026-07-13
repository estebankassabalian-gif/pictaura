"use client";

import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function StatCard({
  label,
  value,
  icon: Icon,
  index = 0,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
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
      <Icon className="w-6 h-6 text-accent mb-3" />
      <div className="text-3xl font-display tracking-tight text-ink">{value}</div>
      <div className="text-sm text-ink-muted mt-1">{label}</div>
    </motion.div>
  );
}
