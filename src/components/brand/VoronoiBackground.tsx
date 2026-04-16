type Intensity = "hero" | "subtle";

interface Props {
  intensity?: Intensity;
  className?: string;
}

export default function VoronoiBackground({ intensity = "hero", className = "" }: Props) {
  const isSubtle = intensity === "subtle";

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 12% 92%, rgba(255, 178, 74, 0.55), transparent 62%),
            radial-gradient(ellipse 70% 60% at 88% 8%, rgba(11, 46, 140, 0.55), transparent 62%),
            linear-gradient(
              to top right,
              #FFB24A 0%,
              #F87005 22%,
              #8A3A12 45%,
              #143A9A 58%,
              #0B2E8C 80%,
              #031D68 100%
            )
          `,
        }}
      />

      {isSubtle && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(255, 251, 245, 0.4)" }}
        />
      )}
    </div>
  );
}
