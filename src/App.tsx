import { Suspense, lazy } from 'react';
import { getScene } from './config/scenes';
import { matchPath, navigate, useHashPath } from './router';

/**
 * 路由表（Hash Router，適用 GitHub Pages 靜態主機）
 *  #/                 山谷入口
 *  #/create/:scene    建立角色（temple | church）
 *  #/world/:scene     進入 3D 世界
 */
const HomePage = lazy(() => import('./pages/HomePage'));
const CreatePage = lazy(() => import('./pages/CreatePage'));
const WorldPage = lazy(() => import('./pages/WorldPage'));

function Loading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#dfe9dc] text-sm font-medium text-forest">
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      正在走進山林…
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">這條山路還沒有開通</p>
      <button type="button" className="btn-primary" onClick={() => navigate('/')}>
        回到山谷入口
      </button>
    </div>
  );
}

export default function App() {
  const path = useHashPath();
  const create = matchPath('/create/:scene', path);
  const world = matchPath('/world/:scene', path);
  let page = <HomePage />;
  if (create || world) {
    const s = getScene((create ?? world)!.scene);
    if (!s || s.id === 'taoist') page = <NotFound />;
    else page = create ? <CreatePage key={`c-${s.id}`} scene={s.id} /> : <WorldPage key={`w-${s.id}`} scene={s.id} />;
  } else if (path !== '/') {
    page = <NotFound />;
  }
  return <Suspense fallback={<Loading />}>{page}</Suspense>;
}
