import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Coins, Eye, Star, Edit, Trash2, Sparkles, Pause, Play, RefreshCw,
  FileText, Video, Github, Link2, Image as ImageIcon, HardDrive, Lock, Unlock, ShoppingCart,
  ExternalLink, MessageSquarePlus, Heart, Flame, Zap,
} from 'lucide-react';
import type { MarketplaceMaterial } from '@/hooks/useMarketplace';
import { RentalCountdown } from './RentalCountdown';
import { cn } from '@/lib/utils';

interface Props {
  material: MarketplaceMaterial;
  isOwner?: boolean;
  hasAccess?: boolean;
  rentalExpiresAt?: string;
  trendingCount?: number;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
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
  material, isOwner, hasAccess, rentalExpiresAt, trendingCount, isWishlisted,
  onToggleWishlist, onOpen, onOpenExternal, onRent, onExtend, onEdit, onDelete, onTogglePause, onReview,
}: Props) {
  const featured = material.featured_until && new Date(material.featured_until) > new Date();
  const avg = material.rating_count ? (material.rating_sum / material.rating_count).toFixed(1) : null;
  const expired = rentalExpiresAt ? new Date(rentalExpiresAt).getTime() <= Date.now() : false;
  const accessible = hasAccess && !expired;
  const meta = TYPE_META[material.material_type] || TYPE_META.url;
  const TypeIcon = meta.Icon;
  const isPaused = material.status === 'paused';
  const ageHrs = (Date.now() - +new Date(material.created_at)) / 36e5;
  const isNew = ageHrs < 72;
  const trending = (trendingCount ?? 0) >= 3;
  const bestDiscount = Math.max(material.discount_pct_7d || 0, material.discount_pct_30d || 0);

  return (
    <Card className="group relative overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
      {/* Header / cover */}
      <div className={cn(
        'relative h-28 border-b border-border/40 overflow-hidden',
        material.thumbnail_url ? 'bg-muted' : `bg-gradient-to-br ${meta.gradient}`,
      )}>
        {material.thumbnail_url ? (
          <img
            src={material.thumbnail_url}
            alt={material.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <TypeIcon className={`w-10 h-10 ${meta.text} opacity-60`} />
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap max-w-[70%]">
          <Badge variant="secondary" className={`text-[9px] uppercase font-bold tracking-wide ${meta.text} bg-background/90 backdrop-blur`}>
            <TypeIcon className="w-2.5 h-2.5 mr-0.5" />
            {material.material_type}
          </Badge>
          {featured && (
            <Badge className="text-[9px] gap-0.5 bg-amber-500 text-white border-0">
              <Sparkles className="w-2.5 h-2.5" /> Featured
            </Badge>
          )}
          {trending && (
            <Badge className="text-[9px] gap-0.5 bg-orange-500 text-white border-0">
              <Flame className="w-2.5 h-2.5" /> Trending
            </Badge>
          )}
          {isNew && !trending && (
            <Badge className="text-[9px] gap-0.5 bg-emerald-500 text-white border-0">
              <Zap className="w-2.5 h-2.5" /> New
            </Badge>
          )}
          {isOwner && isPaused && (
            <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-700 border-0">Paused</Badge>
          )}
        </div>

        {/* Price chip */}
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/95 text-white text-[11px] font-bold shadow-md">
            <Coins className="w-3 h-3" />
            {material.price_per_day}
            <span className="text-[9px] font-medium opacity-90">/d</span>
          </div>
        </div>

        {/* Wishlist heart (renters only) */}
        {!isOwner && onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
            className={cn(
              'absolute bottom-2 left-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur transition-all',
              isWishlisted ? 'bg-rose-500 text-white' : 'bg-background/80 text-muted-foreground hover:text-rose-500',
            )}
            title={isWishlisted ? 'Saved' : 'Save for later'}
          >
            <Heart className={cn('w-3.5 h-3.5', isWishlisted && 'fill-current')} />
          </button>
        )}

        {/* Discount ribbon */}
        {bestDiscount > 0 && !isOwner && (
          <div className="absolute -left-7 top-3 -rotate-45 bg-rose-500 text-white text-[9px] font-bold px-8 py-0.5 shadow-md uppercase tracking-wider">
            Save {bestDiscount}%
          </div>
        )}

        {/* Access pill */}
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

        {trending && trendingCount && (
          <p className="text-[10px] font-medium text-orange-600 flex items-center gap-1">
            <Flame className="w-3 h-3" /> {trendingCount} rented this week
          </p>
        )}

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
            <span className="flex items-center gap-1 ml-auto font-medium text-foreground">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />{avg}
              <span className="text-muted-foreground font-normal">({material.rating_count})</span>
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOwner ? (
            <div className="flex items-center gap-1.5 flex-wrap w-full" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
                <Eye className="w-3.5 h-3.5 mr-1" /> Preview
              </Button>
              {onOpenExternal && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onOpenExternal(); }} title="Open in new tab">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
              {onTogglePause && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onTogglePause(); }} title={isPaused ? 'Resume' : 'Pause'}>
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </Button>
              )}
              {onEdit && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ) : accessible ? (
            <>
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={onOpen}>
                <Unlock className="w-3.5 h-3.5 mr-1" /> Open in app
              </Button>
              {onOpenExternal && (
                <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={onOpenExternal} title="Open in new tab">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
              {onReview && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onReview} title="Leave a review">
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </Button>
              )}
              {onExtend && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onExtend} title="Extend rental">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={onRent}>
              <Coins className="w-3.5 h-3.5" />
              {expired ? 'Rent again' : `Rent from ${material.price_per_day} GP`}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
