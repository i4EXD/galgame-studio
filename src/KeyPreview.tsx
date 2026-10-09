/* 立绘抠图实时预览（编辑器里到处都用得到） */
import { useEffect, useState } from 'react';
import { keyOutPreview } from './assets';
import type { Expression } from './types';

export function KeyPreview({ src, expression, className, width }: {
  src: string;
  expression: Pick<Expression, 'keyOut' | 'keyColor' | 'tolerance' | 'edgeOnly'>;
  className?: string;
  width?: number;
}) {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    setUrl(src);
    if (expression.keyOut === false) return undefined;
    let alive = true;
    // 拖动容差滑块时防抖，避免每一帧都跑一遍整图像素
    const timer = window.setTimeout(() => {
      void keyOutPreview(src, expression.keyColor || '#ff00ff', expression.tolerance ?? 110, !!expression.edgeOnly)
        .then(result => { if (alive) setUrl(result); });
    }, 240);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [src, expression.keyOut, expression.keyColor, expression.tolerance, expression.edgeOnly]);
  return <img className={className} src={url} alt="" width={width} draggable={false} />;
}
