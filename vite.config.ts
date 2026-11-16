import { defineConfig } from 'vite';
import { offlineShell } from './scripts/pwa-build.mjs';
export default defineConfig({ base: '/night-city-vault-community/', plugins:[offlineShell()], build: { sourcemap: false, modulePreload: { polyfill: false } } });
