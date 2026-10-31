import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 專案頁面位於 https://luyun1224.github.io/healing-sanctuary/
// 正式建置使用絕對 base path；本機開發仍使用根目錄。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/healing-sanctuary/' : '/',
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
