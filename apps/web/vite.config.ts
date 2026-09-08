import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  envDir: '../..',
  server: {
    port: Number(loadEnv(mode, '../..').VITE_PORT || 5173),
    strictPort: true,
  },
}));
