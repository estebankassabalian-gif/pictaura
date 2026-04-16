import type { SVGProps } from "react";

type LogoVariant = "full" | "horizontal" | "mark";
type LogoTone = "ink" | "cream";

interface LogoProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  variant?: LogoVariant;
  size?: number;
  tone?: LogoTone;
  wordmarkColor?: string;
}

export default function Logo({
  variant = "horizontal",
  size = 36,
  tone = "ink",
  wordmarkColor,
  className,
  ...rest
}: LogoProps) {
  const stroke = tone === "cream" ? "#FFFBF5" : "#0A1028";
  const pupil = tone === "cream" ? "#FFFBF5" : "#0A1028";
  const word = wordmarkColor ?? (tone === "cream" ? "#FFFBF5" : "#0A1028");
  const rayNavy = tone === "cream" ? "#FFFBF5" : "#031D68";

  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 88 64"
        width={(size * 88) / 64}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Pictaura"
        role="img"
        {...rest}
      >
        <Mark stroke={stroke} pupil={pupil} rayNavy={rayNavy} />
      </svg>
    );
  }

  // Horizontal / full : mark + wordmark side by side
  return (
    <svg
      viewBox="0 0 260 72"
      width={(size * 260) / 72}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pictaura"
      role="img"
      {...rest}
    >
      <g transform="translate(0, 4)">
        <Mark stroke={stroke} pupil={pupil} rayNavy={rayNavy} />
      </g>
      <text
        x="102"
        y="50"
        fontFamily="var(--font-display), 'Archivo Black', 'Archivo', system-ui, sans-serif"
        fontSize="38"
        fontWeight="900"
        letterSpacing="-0.5"
        fill={word}
      >
        Pictaura
      </text>
    </svg>
  );
}

function Mark({
  stroke,
  pupil,
  rayNavy,
}: {
  stroke: string;
  pupil: string;
  rayNavy: string;
}) {
  return (
    <g>
      <path
        d="M 8 32 L 40 10"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 8 32 L 40 54"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 40 10 Q 52 32 40 54"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <ellipse cx="42" cy="32" rx="9" ry="14" fill={pupil} />
      <line
        x1="46"
        y1="14"
        x2="74"
        y2="4"
        stroke={rayNavy}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="52"
        y1="32"
        x2="84"
        y2="32"
        stroke="#FFC529"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="46"
        y1="50"
        x2="74"
        y2="60"
        stroke="#F87005"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </g>
  );
}
