import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the production bundle loads correctly when Electron opens
// it via file:// (an absolute /assets/foo.js would 404 against the file root).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
});
