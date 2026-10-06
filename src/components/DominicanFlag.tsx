import React from 'react';

interface DominicanFlagProps {
  className?: string;
  delayMs?: number;
}

export const DominicanFlag: React.FC<DominicanFlagProps> = ({ className = 'w-10 h-7', delayMs = 0 }) => {
  return (
    <div
      className={`inline-flex items-center select-none pointer-events-none ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <div className="w-1 h-full bg-amber-300 rounded-full shadow-sm shrink-0" />
      <svg
        viewBox="0 0 48 32"
        className="w-full h-full rounded-r-sm shadow-md animate-flag-wave border border-white/20"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <rect x="0" y="0" width="20" height="13" fill="#002D62" />
        <rect x="28" y="0" width="20" height="13" fill="#CE1126" />
        <rect x="0" y="19" width="20" height="13" fill="#CE1126" />
        <rect x="28" y="19" width="20" height="13" fill="#002D62" />
        <rect x="20" y="0" width="8" height="32" fill="#FFFFFF" />
        <rect x="0" y="13" width="48" height="6" fill="#FFFFFF" />
        <circle cx="24" cy="16" r="2.8" fill="#15803d" />
        <path d="M22.5 16 L25.5 16 M24 14.5 L24 17.5" stroke="#eab308" strokeWidth="0.9" />
      </svg>
    </div>
  );
};
