"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PRESET_LABELS } from "@/config/plans";
import { Preset } from "@prisma/client";
import { getStatusBadgeClasses, getStatusLabel } from "@/config/agents";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export type JobRow = {
  id: string;
  preset: string;
  status: string;
  createdAtIso: string;
  photoCount: number;
};

export function RecentJobsTable({ jobs }: { jobs: JobRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-ink/10 overflow-x-auto shadow-sm">
      <table className="w-full text-sm min-w-[500px]">
        <thead className="bg-cream-2 border-b border-ink/10">
          <tr>
            <th className="text-left px-4 md:px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Plateforme</th>
            <th className="text-left px-4 md:px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Photos</th>
            <th className="text-left px-4 md:px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Statut</th>
            <th className="text-left px-4 md:px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs hidden sm:table-cell">Date</th>
            <th className="px-4 md:px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {jobs.map((job, i) => (
            <motion.tr
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
              className="hover:bg-cream/60 transition-colors"
            >
              <td className="px-4 md:px-6 py-3 md:py-4 font-semibold text-ink">
                {PRESET_LABELS[job.preset as Preset]}
              </td>
              <td className="px-4 md:px-6 py-3 md:py-4 text-ink-muted">
                {job.photoCount} photo(s)
              </td>
              <td className="px-4 md:px-6 py-3 md:py-4">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(job.status)}`}>
                  {getStatusLabel(job.status)}
                </span>
              </td>
              <td className="px-4 md:px-6 py-3 md:py-4 text-ink-muted hidden sm:table-cell">
                {new Date(job.createdAtIso).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                {(job.status === "COMPLETED" || job.status === "PROCESSING" || job.status === "PENDING") && (
                  <Link
                    href={`/results/${job.id}`}
                    className="group text-accent font-semibold hover:underline flex items-center gap-1 justify-end"
                  >
                    Voir <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
