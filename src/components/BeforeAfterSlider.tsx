"use client";

import { useRef, useState, useCallback } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  alt?: string;
}

export function BeforeAfterSlider({ beforeUrl, afterUrl, alt = "" }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50); // 0-100
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const onMouseDown = () => {
    dragging.current = true;
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onMouseUp = () => {
    dragging.current = false;
  };

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none cursor-col-resize"
      style={{ aspectRatio: "3/2" }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
    >
      {/* Image APRÈS (fond complet) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={`Après — ${alt}`}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Image AVANT (clippée à gauche du slider) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={`Avant — ${alt}`}
          className="absolute inset-0 h-full object-cover pointer-events-none"
          style={{ width: containerRef.current?.getBoundingClientRect().width ?? "100%" }}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Ligne de séparation */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      />

      {/* Poignée drag */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center cursor-col-resize z-10 border-2 border-gray-200"
        style={{ left: `${position}%` }}
        onMouseDown={onMouseDown}
        onTouchStart={() => { dragging.current = true; }}
        onTouchEnd={() => { dragging.current = false; }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7 5L3 10L7 15M13 5L17 10L13 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded-md pointer-events-none">
        AVANT
      </span>
      <span className="absolute top-3 right-3 bg-brand-600/80 text-white text-xs font-semibold px-2 py-1 rounded-md pointer-events-none">
        APRÈS
      </span>
    </div>
  );
}
