import { defineConfig, type Plugin } from 'vite';

// Game code refers to art as root-relative strings such as '/assets/battle/x.png'.
// Vite's `base` setting doesn't rewrite strings, so a build for a subpath (GitHub Pages
// serves this repo at /aldenhold/) rewrites them here. Local dev and tests use '/' and
// are unchanged.
const base = process.env.BASE_PATH ?? '/';

function rewriteAssetPaths(): Plugin {
  return {
    name: 'rewrite-asset-paths',
    apply: 'build',
    renderChunk(code) {
      if (base === '/') return null;
      return { code: code.replace(/(["'`])\/assets\//g, `$1${base}assets/`), map: null };
    },
  };
}

export default defineConfig({ base, plugins: [rewriteAssetPaths()] });
