import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Eye, Star, Edit, Trash2, Sparkles } from 'lucide-react';
import type { MarketplaceMaterial } from '@/hooks/useMarketplace';

interface Props {
  material: MarketplaceMaterial;
  isOwner?: boolean;
  hasAccess?: boolean;
  onOpen: () => void;
  onRent?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/10 text-red-600',
  drive: 'bg-blue-500/10 text-blue-600',
  youtube: 'bg-red-600/10 text-red-700',
  github: 'bg-gray-500/10 text-gray-700',
  url: 'bg-slate-500/10 text-slate-700',
  image: 'bg-purple-500/10 text-purple-700',
};

export function MaterialCard({ material, isOwner, hasAccess, onOpen, onRent, onEdit, onDelete }: Props) {
  const featured = material.featured_until && new Date(material.featured_until) > new Date();
  const avg = material.rating_count ? (material.rating_sum / material.rating_count).toFixed(1) : null;
  return (
    <Card className="p-4 flex flex-col gap-3 glass-card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={TYPE_COLORS[material.material_type] + ' text-[10px] capitalize'} variant="secondary">
              {material.material_type}
            </Badge>
            {featured && (
              <Badge variant="default" className="text-[10px] gap-1">
                <Sparkles className="w-3 h-3" /> Featured
              </Badge>
            )}
            {material.domain && (
              <Badge variant="outline" className="text-[10px]">{material.domain}</Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold mt-2 line-clamp-2">{material.title}</h3>
          {material.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{material.description}</p>
          )}
        </div>
      </div>
      {material.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {material.keywords.slice(0, 5).map((k) => (
            <Badge key={k} variant="outline" className="text-[9px]">#{k}</Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />{material.view_count}
        </span>
        <span>{material.purchase_count} rentals</span>
        {avg && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" />{avg}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-1 font-bold text-yellow-600">
          <Coins className="w-4 h-4" />
          {material.price_per_day}<span className="text-[10px] font-normal text-muted-foreground">/day</span>
        </div>
        <div className="flex gap-1">
          {isOwner ? (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}><Edit className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              <Button size="sm" variant="outline" onClick={onOpen}>Preview</Button>
            </>
          ) : hasAccess ? (
            <Button size="sm" onClick={onOpen}>Open</Button>
          ) : (
            <Button size="sm" onClick={onRent}>Rent</Button>
          )}
        </div>
      </div>
    </Card>
  );
}
