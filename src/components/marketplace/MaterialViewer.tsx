import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace, type MaterialType } from '@/hooks/useMarketplace';
import { Badge } from '@/components/ui/badge';

interface Props {
  materialId: string | null;
  onClose: () => void;
}

function buildEmbedUrl(type: MaterialType, raw: string): string | null {
  try {
    const u = new URL(raw);
    if (type === 'drive') {
      const m = raw.match(/\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
      return raw;
    }
    if (type === 'youtube') {
      let id = '';
      if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
      else id = u.searchParams.get('v') || '';
      if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
      return raw;
    }
    if (type === 'github') {
      // GitHub blocks embedding via X-Frame-Options. Use HTMLPreview proxy for raw display where possible.
      return null;
    }
    if (type === 'pdf') return `${raw}#toolbar=0&navpanes=0&view=FitH`;
    return raw;
  } catch {
    return null;
  }
}

export function MaterialViewer({ materialId, onClose }: Props) {
  const { profile, user } = useAuth();
  const { accessMaterial } = useMarketplace();
  const [data, setData] = useState<{ source_url: string; material_type: MaterialType; title: string; expires_at: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!materialId) {
      setData(null);
      setError(null);
      return;
    }
    setData(null);
    setError(null);
    accessMaterial(materialId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [materialId]);

  useEffect(() => {
    if (!data) return;
    const block = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'u'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'printscreen') e.preventDefault();
    };
    const ctx = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('keydown', block);
    const el = containerRef.current;
    el?.addEventListener('contextmenu', ctx);
    return () => {
      window.removeEventListener('keydown', block);
      el?.removeEventListener('contextmenu', ctx);
    };
  }, [data]);

  // Auto-close on expiry
  useEffect(() => {
    if (!data?.expires_at) return;
    const ms = new Date(data.expires_at).getTime() - Date.now();
    if (ms <= 0) { onClose(); return; }
    const t = setTimeout(onClose, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [data?.expires_at, onClose]);

  const embed = useMemo(
    () => (data ? buildEmbedUrl(data.material_type, data.source_url) : null),
    [data],
  );

  const watermark = `${profile?.full_name || 'User'} · ${user?.email || ''}`;

  return (
    <Dialog open={!!materialId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            {data?.title || 'Loading…'}
          </DialogTitle>
          {data?.expires_at && (
            <Badge variant="outline" className="text-[10px]">
              <Clock className="w-3 h-3 mr-1" />
              Expires {new Date(data.expires_at).toLocaleString()}
            </Badge>
          )}
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden select-none"
          style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {error && (
            <div className="p-6 text-sm text-destructive">{error}</div>
          )}
          {!data && !error && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Verifying access…
            </div>
          )}
          {data && (
            <>
              {embed ? (
                <iframe
                  src={embed}
                  title={data.title}
                  className="w-full h-full bg-background"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="p-6 text-sm text-muted-foreground">
                  This material's source ({data.material_type}) cannot be securely embedded inline.
                  Ask the uploader to provide a Google Drive or PDF mirror so it can be opened
                  inside the app.
                </div>
              )}
              {/* Watermark overlay */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.07]"
                aria-hidden
              >
                <div
                  className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 rotate-[-30deg] grid"
                  style={{
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gridAutoRows: '120px',
                  }}
                >
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div key={i} className="text-[11px] font-semibold text-foreground whitespace-nowrap">
                      {watermark}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="px-4 py-2 border-t text-[11px] text-muted-foreground bg-muted/30">
          Downloads, copy, print and right-click are disabled. Access is logged.
        </div>
      </DialogContent>
    </Dialog>
  );
}
