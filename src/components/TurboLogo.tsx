import React from 'react';
import type { Language } from '../game/types';

export const GoldCoinIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <circle cx="16" cy="16" r="14" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2.5" />
    <circle cx="16" cy="16" r="9.5" fill="#FACC15" stroke="#D97706" strokeWidth="1.5" />
    <path d="M16 9.5L18.5 14.2L22 16L18.5 17.8L16 22.5L13.5 17.8L10 16L13.5 14.2Z" fill="#FEF9C3" />
  </svg>
);

export const StarIcon: React.FC<{ filled: boolean; className?: string }> = ({
  filled,
  className = 'w-5 h-5',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M12 2.2l2.92 6.1 6.72.88-4.92 4.65 1.24 6.67L12 17.25 6.04 20.5l1.24-6.67L2.36 9.18l6.72-.88L12 2.2z"
      fill={filled ? '#FACC15' : 'rgba(148, 163, 184, 0.3)'}
      stroke={filled ? '#F59E0B' : 'rgba(148, 163, 184, 0.45)'}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const TurboLogo: React.FC<{ lang: Language; compact?: boolean }> = ({
  lang,
  compact = false,
}) => {
  return (
    <div className="flex flex-col items-center select-none">
      <svg
        viewBox="0 0 420 116"
        className={compact ? 'w-52 sm:w-64 h-auto' : 'w-72 sm:w-96 md:w-[420px] h-auto'}
        role="img"
        aria-label={lang === 'fa' ? 'جاده توربو' : 'Turbo Road'}
      >
        <defs>
          <linearGradient id="trGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FACC15" />
            <stop offset="52%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <linearGradient id="trGradAccent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        {/* Speed streak ribbons */}
        <path d="M18 46 L76 46 L66 56 L8 56 Z" fill="#38BDF8" />
        <path d="M32 62 L72 62 L64 70 L24 70 Z" fill="#FACC15" />
        <path d="M346 46 L404 46 L394 56 L336 56 Z" fill="#38BDF8" />
        <path d="M342 62 L386 62 L378 70 L334 70 Z" fill="#F97316" />

        {/* Emblem badge backdrop */}
        <path
          d="M84 18 L348 18 L332 94 L68 94 Z"
          fill="#0F172A"
          stroke="#38BDF8"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M90 24 L340 24 L326 88 L76 88 Z"
          fill="none"
          stroke="url(#trGradAccent)"
          strokeWidth="2.5"
        />

        {/* Top checkered bar */}
        <g transform="translate(150, 10)">
          <rect x="0" y="0" width="120" height="14" rx="4" fill="#0F172A" stroke="#FACC15" strokeWidth="2" />
          <rect x="6" y="3" width="14" height="8" fill="#FACC15" />
          <rect x="34" y="3" width="14" height="8" fill="#FACC15" />
          <rect x="62" y="3" width="14" height="8" fill="#FACC15" />
          <rect x="90" y="3" width="14" height="8" fill="#FACC15" />
        </g>

        {/* Main Wordmark */}
        <text
          x="208"
          y={lang === 'fa' ? '70' : '69'}
          textAnchor="middle"
          fill="url(#trGradMain)"
          stroke="#070B14"
          strokeWidth="6"
          paintOrder="stroke"
          style={{
            fontFamily: lang === 'fa' ? 'Lalezar, Vazirmatn, sans-serif' : '"Racing Sans One", Oxanium, sans-serif',
            fontSize: lang === 'fa' ? '48px' : '44px',
            fontWeight: 400,
            letterSpacing: lang === 'fa' ? '0.5px' : '2.5px',
          }}
        >
          {lang === 'fa' ? 'جاده توربو' : 'TURBO ROAD'}
        </text>

        {/* Sub ribbon */}
        <rect x="118" y="88" width="184" height="22" rx="6" fill="url(#trGradAccent)" />
        <text
          x="210"
          y="103"
          textAnchor="middle"
          fill="#FFFFFF"
          style={{
            fontFamily: lang === 'fa' ? 'Vazirmatn, sans-serif' : 'Oxanium, sans-serif',
            fontSize: '11.5px',
            fontWeight: 800,
            letterSpacing: lang === 'fa' ? '0px' : '1.4px',
          }}
        >
          {lang === 'fa' ? 'مسابقه سه‌بعدی حرفه‌ای' : 'CINEMATIC 3D RACING'}
        </text>
      </svg>
    </div>
  );
};
