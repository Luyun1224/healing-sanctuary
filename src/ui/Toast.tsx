import { useEffect } from 'react';
import { useWorld, worldStore } from '../world/worldStore';

export function Toast() {
  const toast = useWorld((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => {
      if (worldStore.get().toast?.id === toast.id) worldStore.set({ toast: null });
    }, 5200);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div key={toast.id} className="pointer-events-none absolute left-1/2 top-20 z-30 w-[min(90vw,420px)] -translate-x-1/2 animate-fade-up text-center" role="status" aria-live="polite">
      <div className="glass px-5 py-3">
        {toast.sub && <p className="mb-1 text-xs font-medium text-forest/80">{toast.sub}</p>}
        <p className="text-base font-bold leading-relaxed text-stone-700">{toast.text}</p>
      </div>
    </div>
  );
}
