import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace, type MaterialType } from '@/hooks/useMarketplace';
import { Badge } from '@/components/ui/badge';

interface Props {
  materialId: string | null;
  onClose: () => void;
}

// Returns an inline-embeddable URL for any source. For sites that block iframes
// (e.g. github.com) we still provide a URL but the load may fail — the UI shows
// a friendly fallback when that happens.
function buildEmbedUrl(type: MaterialType, raw: string): string {
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
      // Try the file viewer if it's a blob link, else use the repo as-is (may be blocked)
      const blob = raw.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/);
      if (blob) {
        return `https://htmlpreview.github.io/?https://github.com/${blob[1]}/${blob[2]}/blob/${blob[3]}/${blob[4]}`;
      }
      return raw;
    }
    if (type === 'pdf') return `${raw}#toolbar=0&navpanes=0&view=FitH`;
    return raw;
  } catch {
    return raw;
  }
}

export function MaterialViewer({ materialId, onClose }: Props) {
  const { profile, user } = useAuth();
  const { accessMaterial, openExternal } = useMarketplace();
  const [data, setData] = useState<{
    source_url: string;
    material_type: MaterialType;
    title: string;
    expires_at: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!materialId) {
      setData(null);
      setError(null);
      setIframeFailed(false);
      return;
    }
    setData(null);
    setError(null);
    setIframeFailed(false);
    accessMaterial(materialId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [materialId]);

  // Detect iframe-blocked types and surface fallback proactively
  useEffect(() => {
    if (!data) return;
    if (data.material_type === 'github') {
      // GitHub repo URLs almost always X-Frame-Deny; show fallback by default,
      // but still try to load (blob URLs route via htmlpreview which works).
      const isRepoOnly = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(data.source_url);
      if (isRepoOnly) setIframeFailed(true);
    }
    // Heuristic timeout: if iframe never reports load in 6s, show fallback option
    const timeout = setTimeout(() => setIframeFailed((v) => v), 6000);
    return () => clearTimeout(timeout);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const block = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'u'].includes(k)) e.preventDefault();
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

  const handleOpenExternal = async () => {
    if (!materialId) return;
    try { await openExternal(materialId); } catch (e: any) { setError(e.message); }
  };

  return (
    <Dialog open={!!materialId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
            <span className="truncate">{data?.title || 'Loading…'}</span>
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {data?.expires_at && (
              <Badge variant="outline" className="text-[10px]">
                <Clock className="w-3 h-3 mr-1" />
                Expires {new Date(data.expires_at).toLocaleString()}
              </Badge>
            )}
            {data && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleOpenExternal}>
                <ExternalLink className="w-3.5 h-3.5" />
                Open in new tab
              </Button>
            )}
          </div>
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
              <iframe
                src={embed!}
                title={data.title}
                className="w-full h-full bg-background"
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
                referrerPolicy="no-referrer"
                onLoad={() => setIframeFailed(false)}
                onError={() => setIframeFailed(true)}
              />

              {iframeFailed && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8">
                  <div className="max-w-md text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 mx-auto flex items-center justify-center">
                      <AlertTriangle className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold mb-1">This source can't be embedded</h3>
                      <p className="text-sm text-muted-foreground">
                        The host blocks inline previews (common for GitHub repos and some dashboards).
                        Open it in a new tab — your access is verified.
                      </p>
                    </div>
                    <Button onClick={handleOpenExternal} className="gap-1.5">
                      <ExternalLink className="w-4 h-4" /> Open in new tab
                    </Button>
                  </div>
                </div>
              )}

              {/* Watermark overlay */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.07]"
                aria-hidden
              >
                <div
                  className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 rotate-[-30deg] grid"
                  style={{ gridTemplateColumns: 'repeat(6, 1fr)', gridAutoRows: '120px' }}
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
        <div className="px-4 py-2 border-t text-[11px] text-muted-foreground bg-muted/30 flex items-center justify-between">
          <span>Inside-app view: downloads, copy, print and right-click are disabled. Access is logged.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
