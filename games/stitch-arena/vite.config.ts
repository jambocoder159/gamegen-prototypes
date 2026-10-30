import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' so the built ZIP works from any sub-path (platform standard 5.2)
export default defineConfig({ base: './', plugins: [react()], build: { outDir: 'dist', assetsInlineLimit: 0 } });
