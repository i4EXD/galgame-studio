import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';

// 素材以 dataURL 形式内联后，esbuild 在部分 Windows 环境（受限的 TEMP 目录）清理临时文件会失败并报
// 「Access is denied」。把临时目录固定到项目内的 .tmp/ 可以绕开，且不污染宿主环境。
try {
  const localTmp = path.resolve(import.meta.dirname, '.tmp');
  fs.mkdirSync(localTmp, { recursive: true });
  process.env.TEMP = localTmp;
  process.env.TMP = localTmp;
} catch { /* 忽略：拿不到就按系统默认走 */ }

// 编辑器本身也打包成一个单文件 HTML：双击 dist/index.html 就能用。
// 示例素材在构建期被烘焙成 dataURL（tools/_bake-assets.mjs），所以产物不依赖任何外部文件。
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  server: { port: 5199, strictPort: false, open: false },
});
