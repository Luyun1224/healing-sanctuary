import { useEffect, useState } from 'react';

/**
 * 輕量 hash 路由：GitHub Pages 為靜態主機，使用 #/path 不需伺服器改寫設定。
 * 路由表見 App.tsx。
 */
const readPath = () => window.location.hash.replace(/^#/, '') || '/';

export function navigate(path: string) {
  if (readPath() === path) return;
  window.location.hash = path;
}

export function useHashPath() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const onChange = () => {
      setPath(readPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/** 依樣式比對路徑，例如 matchPath('/skill/:id', '/skill/wound-suturing') → { id: 'wound-suturing' } */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
