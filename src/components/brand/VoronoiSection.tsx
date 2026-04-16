import type { ReactNode } from "react";
import VoronoiBackground from "./VoronoiBackground";

interface Props {
  children: ReactNode;
  intensity?: "hero" | "subtle";
  className?: string;
  /** Add a dark scrim to push background contrast under the content */
  scrim?: boolean;
}

export default function VoronoiSection({
  children,
  intensity = "hero",
  className = "",
  scrim = true,
}: Props) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <VoronoiBackground intensity={intensity} />
      {scrim && (
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 55%, rgba(3,29,104,0.15), rgba(3,29,104,0.35))",
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
