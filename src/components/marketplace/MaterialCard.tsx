import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Coins, Eye, Star, Edit, Trash2, Sparkles, Pause, Play, RefreshCw,
  FileText, Video, Github, Link2, Image as ImageIcon, HardDrive, Lock, Unlock, ShoppingCart,
  ExternalLink, MessageSquarePlus,
} from 'lucide-react';
import type { MarketplaceMaterial } from '@/hooks/useMarketplace';
import { RentalCountdown } from './RentalCountdown';

interface Props {
  material: MarketplaceMaterial;
  isOwner?: boolean;
  hasAccess?: boolean;
  rentalExpiresAt?: string;
  onOpen: () => void;
  onOpenExternal?: () => void;
  onRent?: () => void;
  onExtend?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePause?: () => void;
  onReview?: () => void;
}

const TYPE_META: Record<string, { Icon: any; gradient: string; text: string }> = {
  pdf:     { Icon: FileText,   gradient: 'from-rose-500/15 to-rose-600/5',     text: 'text-rose-600' },
  drive:   { Icon: HardDrive,  gradient: 'from-sky-500/15 to-blue-600/5',      text: 'text-sky-600' },
  youtube: { Icon: Video,      gradient: 'from-red-500/15 to-red-600/5',       text: 'text-red-600' },
  github:  { Icon: Github,     gradient: 'from-slate-500/15 to-slate-700/5',   text: 'text-slate-700' },
  url:     { Icon: Link2,      gradient: 'from-indigo-500/15 to-indigo-600/5', text: 'text-indigo-600' },
  image:   { Icon: ImageIcon,  gradient: 'from-purple-500/15 to-purple-600/5', text: 'text-purple-600' },
};

export function MaterialCard({
  material, isOwner, hasAccess, rentalExpiresAt,
  onOpen, onOpenExternal, onRent, onExtend, onEdit, onDelete, onTogglePause, onReview,
}: Props) {
  const featured = material.featured_until && new Date(material.featured_until) > new Date();
  const avg = material.rating_count ? (material.rating_sum / material.rating_count).toFixed(1) : null;
  const expired = rentalExpiresAt ? new Date(rentalExpiresAt).getTime() <= Date.now() : false;
  const accessible = hasAccess && !expired;
  const meta = TYPE_META[material.material_type] || TYPE_META.url;
  const TypeIcon = meta.Icon;
  const isPaused = material.status === 'paused';

  return (
    <Card className="group relative overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-200">
      {/* Header banner */}
      <div className={`relative h-20 bg-gradient-to-br ${meta.gradient} border-b border-border/40`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <TypeIcon className={`w-9 h-9 ${meta.text} opacity-60`} />
        </div>
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge variant="secondary" className={`text-[9px] uppercase font-bold tracking-wide ${meta.text} bg-background/80 backdrop-blur`}>
            {material.material_type}
          </Badge>
          {featured && (
            <Badge className="text-[9px] gap-0.5 bg-amber-500 text-white border-0">
              <Sparkles className="w-2.5 h-2.5" /> Featured
            </Badge>
          )}
          {isOwner && isPaused && (
            <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-700 border-0">Paused</Badge>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/95 text-white text-[11px] font-bold shadow-sm">
            <Coins className="w-3 h-3" />
            {material.price_per_day}
            <span className="text-[9px] font-medium opacity-90">/d</span>
          </div>
        </div>
        {accessible && !isOwner && (
          <div className="absolute bottom-2 right-2">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wide shadow-sm">
              <Unlock className="w-2.5 h-2.5" /> Active
            </div>
          </div>
        )}
        {!accessible && !isOwner && rentalExpiresAt && (
          <div className="absolute bottom-2 right-2">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive text-white text-[9px] font-bold uppercase tracking-wide shadow-sm">
              <Lock className="w-2.5 h-2.5" /> Expired
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2.5">
        <div>
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1">{material.title}</h3>
          {material.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{material.description}</p>
          )}
        </div>

        {(material.domain || material.keywords?.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {material.domain && (
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-medium">
                {material.domain}
              </Badge>
            )}
            {material.keywords?.slice(0, 3).map((k) => (
              <Badge key={k} variant="outline" className="text-[9px] py-0 px-1.5 h-4 text-muted-foreground font-normal">
                #{k}
              </Badge>
            ))}
          </div>
        )}

        {/* Rental status */}
        {rentalExpiresAt && (
          <div className={`rounded-md border px-2.5 py-1.5 ${expired ? 'bg-destructive/5 border-destructive/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}>
            <RentalCountdown expiresAt={rentalExpiresAt} />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border/40 pt-2">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />{material.view_count}
          </span>
          <span className="flex items-center gap-1">
            <ShoppingCart className="w-3 h-3" />{material.purchase_count}
          </span>
          {avg && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />{avg}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {isOwner ? (
            <>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onOpen}>
                <Eye className="w-3.5 h-3.5 mr-1" /> Preview
              </Button>
              {onTogglePause && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onTogglePause} title={isPaused ? 'Resume' : 'Pause'}>
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEdit} title="Edit">
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : accessible ? (
            <>
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={onOpen}>
                <Unlock className="w-3.5 h-3.5 mr-1" /> Open Material
              </Button>
              {onExtend && (
                <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={onExtend} title="Extend rental">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={onRent}>
              <Coins className="w-3.5 h-3.5" />
              {expired ? 'Rent again' : 'Rent now'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
