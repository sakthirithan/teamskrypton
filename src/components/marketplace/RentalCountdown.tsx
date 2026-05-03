import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  expiresAt: string;
  compact?: boolean;
}

function diff(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const expired = ms <= 0;
  const abs = Math.max(0, ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  return { expired, days, hours, minutes, seconds, ms: abs };
}

export function RentalCountdown({ expiresAt, compact }: Props) {
  const [t, setT] = useState(() => diff(expiresAt));

  useEffect(() => {
    const id = setInterval(() => setT(diff(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (t.expired) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
        <AlertTriangle className="w-3.5 h-3.5" /> Expired — rent again
      </div>
    );
  }

  const urgent = t.ms < 6 * 3600 * 1000; // <6h
  const warn = t.ms < 24 * 3600 * 1000; // <24h
  const cls = urgent
    ? 'text-destructive'
    : warn
    ? 'text-amber-600'
    : 'text-emerald-600';
  const Icon = urgent ? AlertTriangle : warn ? Clock : CheckCircle2;

  const label =
    t.days > 0
      ? `${t.days}d ${t.hours}h ${t.minutes}m`
      : t.hours > 0
      ? `${t.hours}h ${t.minutes}m ${String(t.seconds).padStart(2, '0')}s`
      : `${t.minutes}m ${String(t.seconds).padStart(2, '0')}s`;

  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {compact ? label : <span>Access ends in <span className="tabular-nums">{label}</span></span>}
    </div>
  );
}
