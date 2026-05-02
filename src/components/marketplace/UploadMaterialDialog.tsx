import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Coins } from 'lucide-react';
import { detectMaterialType, useMarketplace, type MarketplaceMaterial } from '@/hooks/useMarketplace';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: MarketplaceMaterial | null;
}

export function UploadMaterialDialog({ open, onOpenChange, editing }: Props) {
  const { createMaterial, updateMaterial, suggestMeta } = useMarketplace();
  const { toast } = useToast();
  const [url, setUrl] = useState(editing?.['source_url' as never] as any || '');
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [keywords, setKeywords] = useState((editing?.keywords || []).join(', '));
  const [pricePerDay, setPricePerDay] = useState(editing?.price_per_day ?? 5);
  const [maxDays, setMaxDays] = useState(editing?.max_days ?? 30);
  const [domain, setDomain] = useState(editing?.domain || '');
  const [discount7, setDiscount7] = useState(editing?.discount_pct_7d ?? 10);
  const [discount30, setDiscount30] = useState(editing?.discount_pct_30d ?? 25);
  const [aiLoading, setAiLoading] = useState(false);

  const detected = url ? detectMaterialType(url) : null;

  const aiAssist = async () => {
    if (!url) return;
    setAiLoading(true);
    try {
      const r = await suggestMeta(url);
      if (r.title) setTitle(r.title);
      if (r.description) setDescription(r.description);
      if (r.keywords?.length) setKeywords(r.keywords.join(', '));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'AI failed', description: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    if (!url || !title) return;
    const payload = {
      source_url: url,
      title,
      description,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      domain: domain || null,
      price_per_day: Math.max(0, Math.floor(Number(pricePerDay) || 0)),
      max_days: Math.max(1, Math.floor(Number(maxDays) || 1)),
      discount_pct_7d: Math.min(80, Math.max(0, Math.floor(Number(discount7) || 0))),
      discount_pct_30d: Math.min(80, Math.max(0, Math.floor(Number(discount30) || 0))),
      material_type: detectMaterialType(url),
    } as any;
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
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" disabled={!!editing} />
              <Button type="button" variant="outline" onClick={aiAssist} disabled={!url || aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
            {detected && (
              <Badge variant="secondary" className="mt-1 text-[10px]">Detected: {detected}</Badge>
            )}
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div>
            <Label>Keywords (comma separated)</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="dsa, graph, leetcode" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Domain</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="dsa, web, ml…" />
            </div>
            <div>
              <Label>Price (GP / day)</Label>
              <Input type="number" min={0} value={pricePerDay} onChange={(e) => setPricePerDay(Number(e.target.value))} />
            </div>
            <div>
              <Label>Max days</Label>
              <Input type="number" min={1} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} />
            </div>
            <div>
              <Label>Discount 7d (%)</Label>
              <Input type="number" min={0} max={80} value={discount7} onChange={(e) => setDiscount7(Number(e.target.value))} />
            </div>
            <div>
              <Label>Discount 30d (%)</Label>
              <Input type="number" min={0} max={80} value={discount30} onChange={(e) => setDiscount30(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!url || !title || createMaterial.isPending || updateMaterial.isPending}
          >
            {editing ? 'Save changes' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
