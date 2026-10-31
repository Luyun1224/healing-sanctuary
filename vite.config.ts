import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 專案頁面位於 https://luyun1224.github.io/healing-sanctuary/
// 開發、預覽、正式建置皆使用相同 base path（本機開發網址為 http://localhost:5173/healing-sanctuary/）。
export default defineConfig(() => ({
  base: '/healing-sanctuary/',
  plugins: [react()],
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
}));
