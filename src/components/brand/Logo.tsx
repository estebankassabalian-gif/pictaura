import type { SVGProps } from "react";

type LogoVariant = "full" | "mark";

interface LogoProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  variant?: LogoVariant;
  size?: number;
  blue?: string;
  orange?: string;
  wordmarkColor?: string;
}

export default function Logo({
  variant = "full",
  size = 32,
  blue = "#031D68",
  orange = "#f87005",
  wordmarkColor = "currentColor",
  className,
  ...rest
}: LogoProps) {
  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Pictaura"
        role="img"
        {...rest}
      >
        <Mark blue={blue} orange={orange} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 240 64"
      width={size * 3.75}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pictaura"
      role="img"
      {...rest}
    >
      <Mark blue={blue} orange={orange} />
      <text
        x="76"
        y="44"
        fontFamily="var(--font-display), 'Bricolage Grotesque', sans-serif"
        fontSize="34"
        fontWeight="700"
        letterSpacing="-0.02em"
        fill={wordmarkColor}
      >
        Pictaura
      </text>
    </svg>
  );
}

function Mark({ blue, orange }: { blue: string; orange: string }) {
  return (
    <g>
      <circle cx="32" cy="32" r="28" fill="none" stroke={blue} strokeWidth="4" />
      <circle cx="32" cy="32" r="11" fill={blue} />
      <circle cx="36" cy="28" r="3.5" fill="#ffffff" />
      <path
        d="M18 44 L10 32 L18 20"
        fill="none"
        stroke={orange}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M46 20 L54 32 L46 44 M44 44 L50 32 L44 20"
        fill="none"
        stroke={orange}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
