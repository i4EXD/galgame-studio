import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './player/runtime.js';   // 播放器运行时（挂到 window.GalPlayer），预览与导出共用同一份实现
import './editor.css';
import './mobile/mobile.css';
import App from './App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
