"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface BeforeAfterHeroProps {
  imageUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeFilter?: string;
  afterFilter?: string;
}

export default function BeforeAfterHero({
  imageUrl,
  beforeLabel = "AVANT",
  afterLabel = "APRÈS",
  beforeFilter = "grayscale(25%) brightness(0.82) contrast(0.88) saturate(0.7)",
  afterFilter = "brightness(1.12) saturate(1.35) contrast(1.06)",
}: BeforeAfterHeroProps) {
  const [position, setPosition] = useState(42);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
    setHasInteracted(true);
  }, []);

  // Mouse events sur le container entier
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    getPosition(e.clientX);
  }, [getPosition]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    getPosition(e.clientX);
  }, [isDragging, getPosition]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    getPosition(e.touches[0].clientX);
  }, [getPosition]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    getPosition(e.touches[0].clientX);
  }, [getPosition]);

  const onTouchEnd = useCallback(() => setIsDragging(false), []);

  // Libérer si la souris sort de la fenêtre
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-2xl select-none shadow-2xl"
      style={{ cursor: isDragging ? "col-resize" : "ew-resize" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Après (fond complet) ──────────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Photo après optimisation Pictaura"
        className="w-full h-full object-cover pointer-events-none"
        style={{ filter: afterFilter }}
        draggable={false}
      />

      {/* ── Avant (clipé à gauche) ────────────────────────────── */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Photo avant optimisation"
          className="w-full h-full object-cover"
          style={{ filter: beforeFilter }}
          draggable={false}
        />
        <div className="absolute top-4 left-4 bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-widest backdrop-blur-sm">
          {beforeLabel}
        </div>
      </div>

      {/* ── Label APRÈS ────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 bg-brand-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-widest backdrop-blur-sm pointer-events-none">
        {afterLabel}
      </div>

      {/* ── Diviseur ───────────────────────────────────────────── */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none"
        style={{ left: `${position}%` }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center border-2 border-brand-300 pointer-events-none">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-brand-600" fill="currentColor">
            <path d="M8.5 5L3 12l5.5 7V5zm7 0v14l5.5-7L15.5 5z" />
          </svg>
        </div>
      </div>

      {/* ── Hint (disparaît après interaction) ─────────────────── */}
      {!hasInteracted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-4 py-2 rounded-full pointer-events-none backdrop-blur-sm font-medium whitespace-nowrap">
          ← Glissez pour comparer →
        </div>
      )}
    </div>
  );
}
