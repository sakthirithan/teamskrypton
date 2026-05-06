import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Coins, ImagePlus, X } from 'lucide-react';
import { detectMaterialType, useMarketplace, type MarketplaceMaterial } from '@/hooks/useMarketplace';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: MarketplaceMaterial | null;
}

const BLANK = {
  url: '',
  title: '',
  description: '',
  keywords: '',
  pricePerDay: 5,
  maxDays: 30,
  domain: '',
  discount7: 10,
  discount30: 25,
  thumbnailUrl: '' as string | null | '',
};

function ytThumb(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) id = u.searchParams.get('v');
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch { return null; }
}

async function downscaleToWebp(file: File, maxW = 800): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  return await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/webp', 0.85));
}

export function UploadMaterialDialog({ open, onOpenChange, editing }: Props) {
  const { createMaterial, updateMaterial, suggestMeta } = useMarketplace();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [s, setS] = useState(BLANK);
  const [aiLoading, setAiLoading] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);

  // Reset state every time the dialog opens (or target row changes).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setS({
        url: (editing as any).source_url ?? '',
        title: editing.title ?? '',
        description: editing.description ?? '',
        keywords: (editing.keywords ?? []).join(', '),
        pricePerDay: editing.price_per_day ?? 5,
        maxDays: editing.max_days ?? 30,
        domain: editing.domain ?? '',
        discount7: editing.discount_pct_7d ?? 0,
        discount30: editing.discount_pct_30d ?? 0,
        thumbnailUrl: editing.thumbnail_url ?? '',
      });
    } else {
      setS(BLANK);
    }
  }, [open, editing?.id]);

  const detected = s.url ? detectMaterialType(s.url) : null;

  const aiAssist = async () => {
    if (!s.url) return;
    setAiLoading(true);
    try {
      const r = await suggestMeta(s.url);
      setS((p) => ({
        ...p,
        title: r.title || p.title,
        description: r.description || p.description,
        keywords: r.keywords?.length ? r.keywords.join(', ') : p.keywords,
        thumbnailUrl: p.thumbnailUrl || ytThumb(s.url) || p.thumbnailUrl,
      }));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'AI failed', description: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  const onPickThumb = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Please choose an image' });
      return;
    }
    setThumbUploading(true);
    try {
      const blob = await downscaleToWebp(file);
      const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from('marketplace-thumbnails')
        .upload(path, blob, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('marketplace-thumbnails').getPublicUrl(path);
      setS((p) => ({ ...p, thumbnailUrl: data.publicUrl }));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Thumbnail upload failed', description: e.message });
    } finally {
      setThumbUploading(false);
    }
  };

  const submit = async () => {
    if (!s.url || !s.title) return;
    const payload: any = {
      source_url: s.url,
      title: s.title,
      description: s.description,
      keywords: s.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      domain: s.domain || null,
      price_per_day: Math.max(0, Math.floor(Number(s.pricePerDay) || 0)),
      max_days: Math.max(1, Math.floor(Number(s.maxDays) || 1)),
      discount_pct_7d: Math.min(80, Math.max(0, Math.floor(Number(s.discount7) || 0))),
      discount_pct_30d: Math.min(80, Math.max(0, Math.floor(Number(s.discount30) || 0))),
      material_type: detectMaterialType(s.url),
      thumbnail_url: s.thumbnailUrl || null,
    };
    if (editing) await updateMaterial.mutateAsync({ id: editing.id, ...payload });
    else await createMaterial.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            {editing ? 'Edit material' : 'Upload material'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Material link (PDF, Drive, YouTube, GitHub, URL)</Label>
            <div className="flex gap-2">
              <Input
                value={s.url}
                onChange={(e) => setS((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://…"
                disabled={!!editing}
              />
              <Button type="button" variant="outline" onClick={aiAssist} disabled={!s.url || aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
            {detected && (
              <Badge variant="secondary" className="mt-1 text-[10px]">Detected: {detected}</Badge>
            )}
          </div>

          {/* Thumbnail */}
          <div>
            <Label>Cover thumbnail (optional)</Label>
            <div className="flex gap-3 items-start mt-1">
              <div className="relative w-32 h-20 rounded-md border border-border/60 bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                {s.thumbnailUrl ? (
                  <>
                    <img src={s.thumbnailUrl} alt="thumbnail" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setS((p) => ({ ...p, thumbnailUrl: '' }))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/90 border border-border/60 flex items-center justify-center hover:bg-destructive hover:text-white"
                      title="Remove thumbnail"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickThumb(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={thumbUploading}
                  className="w-full"
                >
                  {thumbUploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 mr-1" />}
                  {s.thumbnailUrl ? 'Change image' : 'Upload image'}
                </Button>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Auto-resized to 800px WebP. A great cover gets 3× more rentals.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={s.title} onChange={(e) => setS((p) => ({ ...p, title: e.target.value }))} maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={s.description} onChange={(e) => setS((p) => ({ ...p, description: e.target.value }))} maxLength={500} />
          </div>
          <div>
            <Label>Keywords (comma separated)</Label>
            <Input value={s.keywords} onChange={(e) => setS((p) => ({ ...p, keywords: e.target.value }))} placeholder="dsa, graph, leetcode" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Domain</Label>
              <Input value={s.domain} onChange={(e) => setS((p) => ({ ...p, domain: e.target.value }))} placeholder="dsa, web, ml…" />
            </div>
            <div>
              <Label>Price (GP / day)</Label>
              <Input type="number" min={0} value={s.pricePerDay} onChange={(e) => setS((p) => ({ ...p, pricePerDay: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Max days</Label>
              <Input type="number" min={1} value={s.maxDays} onChange={(e) => setS((p) => ({ ...p, maxDays: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Discount 7d (%)</Label>
              <Input type="number" min={0} max={80} value={s.discount7} onChange={(e) => setS((p) => ({ ...p, discount7: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Discount 30d (%)</Label>
              <Input type="number" min={0} max={80} value={s.discount30} onChange={(e) => setS((p) => ({ ...p, discount30: Number(e.target.value) }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!s.url || !s.title || createMaterial.isPending || updateMaterial.isPending || thumbUploading}
          >
            {editing ? 'Save changes' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
