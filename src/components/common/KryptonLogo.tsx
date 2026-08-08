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
      {/* Icon Image with Aspect Ratio Preservation */}
      <div
        className="relative shrink-0 rounded-xl overflow-hidden shadow-sm transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      >
        <img
          src="/icons/icon-512x512.png"
          alt="Teams Krypton Logo"
          className="w-full h-full object-contain rounded-xl"
          onError={(e) => {
            // Fallback to SVG if PNG fails to load on any platform
            const target = e.currentTarget;
            if (!target.dataset.fallback) {
              target.dataset.fallback = 'true';
              target.src = '/icons/icon-512x512.svg';
            }
          }}
        />
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
