import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Mobile pull-to-refresh for a scrollable container.
 * Only engages when the container is already at the top and no chat is active,
 * so normal scrolling (page, Messenger, Calendar) is never blocked.
 */
export function usePullToRefresh(ref: React.RefObject<HTMLElement>, enabled = true) {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;

    const onStart = (e: TouchEvent) => {
      if (document.body.dataset.activeChat === 'true') return;
      if (el.scrollTop > 0 || e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || el.scrollTop > 0) {
        active.current = false;
        setPull(0);
        return;
      }
      setPull(Math.min(MAX_PULL, delta * 0.5));
    };

    const onEnd = async () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      const shouldRefresh = pull >= THRESHOLD * 0.5;
      setPull(0);
      if (!shouldRefresh || refreshing) return;
      setRefreshing(true);
      try {
        await queryClient.invalidateQueries();
      } finally {
        setTimeout(() => setRefreshing(false), 400);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref, enabled, pull, refreshing, queryClient]);

  return { pull, refreshing };
}
