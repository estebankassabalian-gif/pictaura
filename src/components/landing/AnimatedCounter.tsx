"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string;     // "30s" / "98%" / "4"
  label: string;
  duration?: number; // ms
}

function parseValue(v: string): { num: number; suffix: string } {
  const match = v.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { num: 0, suffix: v };
  return { num: parseFloat(match[1]), suffix: match[2] };
}

export default function AnimatedCounter({ value, label, duration = 1800 }: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState("0");
  const started = useRef(false);
  const { num, suffix } = parseValue(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(eased * num * 10) / 10;
            setDisplay(Number.isInteger(num) ? String(Math.round(current)) : current.toFixed(1));
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(Number.isInteger(num) ? String(num) : num.toFixed(1));
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [num, duration]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-extrabold text-brand-600 tabular-nums">
        {display}{suffix}
      </div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}
