import { memo } from 'react';

interface KryptonLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  subtext?: string;
}

export const KryptonLogo = memo(function KryptonLogo({
  className = 'w-8 h-8',
  size = 32,
  showText = false,
  subtext,
}: KryptonLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 shrink-0 select-none ${className}`}>
      {/* High-Performance Instant SVG Branding Emblem */}
      <div
        className="relative shrink-0 rounded-xl overflow-hidden shadow-md transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 512 512"
          className="w-full h-full object-contain rounded-xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="tk-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.25" />
            </filter>
          </defs>
          {/* Rounded Shield Outer */}
          <rect width="512" height="512" rx="112" fill="url(#tk-logo-grad)" />
          {/* Subtle Gloss Line */}
          <path
            d="M 0,0 L 512,0 L 512,180 Q 256,260 0,180 Z"
            fill="#ffffff"
            fillOpacity="0.08"
          />
          {/* TK Emblem Text */}
          <text
            x="256"
            y="325"
            fontFamily="Outfit, system-ui, -apple-system, sans-serif"
            fontSize="260"
            fontWeight="900"
            letterSpacing="-12"
            fill="#ffffff"
            textAnchor="middle"
            filter="url(#shadow)"
          >
            TK
          </text>
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold tracking-tight text-foreground font-display truncate">
            Teams Krypton
          </span>
          {subtext && (
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide truncate">
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
