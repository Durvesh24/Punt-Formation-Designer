import { getPuntDimensions } from './sizes';
import type { PuntData, PuntColor } from '../store/types';

export interface ExportOptions {
  layout: 'side-by-side' | 'stacked';
  lightBg: 'water' | 'slate' | 'white';
  includeHeader: boolean;
  themeName: string;
  shapeName: string;
}

export const resolveGlowColor = (c: PuntColor | undefined): string => {
  switch (c) {
    case 'red':    return '#ef4444';
    case 'yellow': return '#eab308';
    case 'green':  return '#22c55e';
    case 'off': default: return 'transparent';
  }
};

/** Compute the bounding box encompassing all punts with their rotations and dimensions */
export const getShapeBounds = (punts: PuntData[], padding = 65) => {
  if (punts.length === 0) {
    return {
      minX: -200, maxX: 200, minY: -150, maxY: 150,
      width: 400, height: 300,
      frameX: -260, frameY: -210,
      frameW: 520, frameH: 420,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  punts.forEach((p) => {
    const dims = getPuntDimensions(p.number);
    const hw = dims.length / 2;
    const hh = dims.width / 2;
    const rad = (p.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 4 corners of the rotated boat
    const corners = [
      { x: hw, y: hh },
      { x: -hw, y: hh },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
    ];

    corners.forEach((c) => {
      const rx = p.x + c.x * cos - c.y * sin;
      const ry = p.y + c.x * sin + c.y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    });
  });

  const width = Math.max(maxX - minX, 120);
  const height = Math.max(maxY - minY, 100);

  let frameW = width + padding * 2;
  let frameH = height + padding * 2;

  // Minimum dimensions to look well-proportioned
  const minFrameW = 380;
  const minFrameH = 260;
  if (frameW < minFrameW) {
    const diff = minFrameW - frameW;
    minX -= diff / 2;
    maxX += diff / 2;
    frameW = minFrameW;
  }
  if (frameH < minFrameH) {
    const diff = minFrameH - frameH;
    minY -= diff / 2;
    maxY += diff / 2;
    frameH = minFrameH;
  }

  const frameX = minX - padding;
  const frameY = minY - padding;

  return { minX, maxX, minY, maxY, width, height, frameX, frameY, frameW, frameH };
};

/** Helper to draw a rounded rectangle on a 2D canvas */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number]
) {
  let tl = 0, tr = 0, br = 0, bl = 0;
  if (typeof r === 'number') {
    tl = tr = br = bl = r;
  } else if (Array.isArray(r)) {
    [tl, tr, br, bl] = r;
  }

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/** Render a single punt onto the canvas */
function drawPunt(
  ctx: CanvasRenderingContext2D,
  punt: PuntData,
  mode: 'light' | 'dark'
) {
  const dims = getPuntDimensions(punt.number);
  const w = dims.length;
  const h = dims.width;
  const r = 6;
  const isDark = mode === 'dark';

  const colorFront = punt.colorFront ?? 'off';
  const colorBack = punt.colorBack ?? 'off';
  const frontGlow = resolveGlowColor(colorFront);
  const backGlow = resolveGlowColor(colorBack);
  const isAnchor = punt.number === 4;

  ctx.save();
  ctx.translate(punt.x, punt.y);
  ctx.rotate((punt.rotation * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  const sameColor = colorFront === colorBack;

  if (isDark) {
    // ── DARK MODE RENDERING ──
    if (sameColor) {
      const glow = frontGlow;
      const isLit = glow !== 'transparent';

      if (isLit) {
        // Glowing halo
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, 0, 0, w, h, r);
        ctx.fill();
        ctx.restore();

        // Solid hull with neon rim
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, 0, 0, w, h, r);
        ctx.fill();

        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        // Unlit boat in dark water: subtle dark rim
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, 0, 0, w, h, r);
        ctx.fill();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    } else {
      // Split halves: Back half (left)
      const bGlow = backGlow;
      const bLit = bGlow !== 'transparent';
      const halfW = w / 2 + 1;

      if (bLit) {
        ctx.save();
        ctx.shadowColor = bGlow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, 0, 0, halfW, h, [r, 0, 0, r]);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, 0, 0, halfW, h, [r, 0, 0, r]);
        ctx.fill();
        ctx.strokeStyle = bGlow;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, 0, 0, halfW, h, [r, 0, 0, r]);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Front half (right)
      const fGlow = frontGlow;
      const fLit = fGlow !== 'transparent';

      if (fLit) {
        ctx.save();
        ctx.shadowColor = fGlow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, w / 2 - 1, 0, halfW, h, [0, r, r, 0]);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, w / 2 - 1, 0, halfW, h, [0, r, r, 0]);
        ctx.fill();
        ctx.strokeStyle = fGlow;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#000000';
        drawRoundRect(ctx, w / 2 - 1, 0, halfW, h, [0, r, r, 0]);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    const isBackLit = (punt.colorBack ?? 'off') !== 'off';
    const isFrontLit = (punt.colorFront ?? 'off') !== 'off';
    const isNumberOnBack = isBackLit && !isFrontLit;
    const anchorX = isNumberOnBack ? (3 * w) / 4 : w / 4;

    // Anchor symbol in Dark Mode (on opposite side of number)
    if (isAnchor) {
      drawAnchorIcon(ctx, anchorX, h / 2, '#fbbf24', true);
    }
  } else {
    // ── LIGHT MODE RENDERING ──
    if (sameColor) {
      const glow = frontGlow;
      const isLit = glow !== 'transparent';

      ctx.fillStyle = '#020617';
      drawRoundRect(ctx, 0, 0, w, h, r);
      ctx.fill();

      if (isLit) {
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      const halfW = w / 2 + 1;

      // Back half
      ctx.fillStyle = '#020617';
      drawRoundRect(ctx, 0, 0, halfW, h, [r, 0, 0, r]);
      ctx.fill();

      if (backGlow !== 'transparent') {
        ctx.save();
        ctx.shadowColor = backGlow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = backGlow;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Front half
      ctx.fillStyle = '#020617';
      drawRoundRect(ctx, w / 2 - 1, 0, halfW, h, [0, r, r, 0]);
      ctx.fill();

      if (frontGlow !== 'transparent') {
        ctx.save();
        ctx.shadowColor = frontGlow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = frontGlow;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    const isBackLit = (punt.colorBack ?? 'off') !== 'off';
    const isFrontLit = (punt.colorFront ?? 'off') !== 'off';
    const isNumberOnBack = isBackLit && !isFrontLit;
    const numX = isNumberOnBack ? w / 4 : (3 * w) / 4;
    const anchorX = isNumberOnBack ? (3 * w) / 4 : w / 4;

    // Numbers & Anchor in Light Mode (Numbers on front / colored side, Anchor on opposite side)
    if (isAnchor) {
      drawAnchorIcon(ctx, anchorX, h / 2, '#fbbf24', false);
      ctx.font = 'bold 12px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4', numX, h / 2);
    } else {
      ctx.font = 'bold 12px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(punt.number), numX, h / 2);
    }
  }

  ctx.restore();
}

/** Draw the anchor icon */
function drawAnchorIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  withGlow: boolean
) {
  ctx.save();
  if (withGlow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Circle at top
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 2.2, 0, Math.PI * 2);
  ctx.stroke();

  // Vertical shank
  ctx.beginPath();
  ctx.moveTo(cx, cy - 2.8);
  ctx.lineTo(cx, cy + 5);
  ctx.stroke();

  // Crossbar
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, cy - 0.5);
  ctx.lineTo(cx + 3.5, cy - 0.5);
  ctx.stroke();

  // Curved flukes
  ctx.beginPath();
  ctx.arc(cx, cy - 0.5, 5.5, 0.2 * Math.PI, 0.8 * Math.PI, false);
  ctx.stroke();

  ctx.restore();
}

/** Render a full single view (Light or Dark) onto a standalone canvas */
export function renderSingleModeCanvas(
  punts: PuntData[],
  mode: 'light' | 'dark',
  bounds: ReturnType<typeof getShapeBounds>,
  lightBg: 'water' | 'slate' | 'white' = 'water',
  pixelRatio = 2
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bounds.frameW * pixelRatio);
  canvas.height = Math.round(bounds.frameH * pixelRatio);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(pixelRatio, pixelRatio);

  const isDark = mode === 'dark';

  // 1. Water background
  let bg = '#000000';
  if (!isDark) {
    bg = lightBg === 'water' ? '#c2cdd6' : lightBg === 'slate' ? '#f1f5f9' : '#ffffff';
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, bounds.frameW, bounds.frameH);

  // 2. Subtle water grid dots
  const dotColor = isDark ? '#1e2433' : lightBg === 'white' ? '#e2e8f0' : '#94a3b8';
  ctx.fillStyle = dotColor;
  const gridStep = 40;
  const startX = Math.floor(bounds.frameX / gridStep) * gridStep;
  const startY = Math.floor(bounds.frameY / gridStep) * gridStep;
  for (let gx = startX; gx <= bounds.frameX + bounds.frameW; gx += gridStep) {
    for (let gy = startY; gy <= bounds.frameY + bounds.frameH; gy += gridStep) {
      const px = gx - bounds.frameX;
      const py = gy - bounds.frameY;
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Shift context to shape coordinate space
  ctx.save();
  ctx.translate(-bounds.frameX, -bounds.frameY);

  // 4. Draw all punts
  punts.forEach((p) => {
    drawPunt(ctx, p, mode);
  });

  ctx.restore();

  return canvas;
}

/**
 * Render the master composite image adjusting both Light and Dark mode photos into ONE file.
 * Returns an HTMLCanvasElement rendered at high resolution (2x).
 */
export function renderCombinedDualModeCanvas(
  punts: PuntData[],
  options: ExportOptions
): HTMLCanvasElement {
  const bounds = getShapeBounds(punts);
  const pixelRatio = 2; // High resolution retina output

  // Render individual photos (both using the EXACT same framing)
  const lightCanvas = renderSingleModeCanvas(punts, 'light', bounds, options.lightBg, pixelRatio);
  const darkCanvas = renderSingleModeCanvas(punts, 'dark', bounds, options.lightBg, pixelRatio);

  const isSideBySide = options.layout === 'side-by-side';

  // Layout metrics (in CSS pixels, will be scaled by pixelRatio)
  const outerMargin = 28;
  const panelGap = 20;
  const headerHeight = options.includeHeader ? 76 : 0;
  const panelHeaderHeight = 42;
  const footerHeight = 36;
  const panelCornerRadius = 14;

  const photoW = bounds.frameW;
  const photoH = bounds.frameH;

  const panelW = photoW;
  const panelH = panelHeaderHeight + photoH;

  let totalW = 0;
  let totalH = 0;

  if (isSideBySide) {
    totalW = outerMargin * 2 + panelW * 2 + panelGap;
    totalH = outerMargin * 2 + headerHeight + panelH + footerHeight;
  } else {
    totalW = outerMargin * 2 + panelW;
    totalH = outerMargin * 2 + headerHeight + panelH * 2 + panelGap + footerHeight;
  }

  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = Math.round(totalW * pixelRatio);
  masterCanvas.height = Math.round(totalH * pixelRatio);

  const ctx = masterCanvas.getContext('2d')!;
  ctx.scale(pixelRatio, pixelRatio);

  // ── 1. Master Poster Card Background ──
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, totalW, totalH);

  // Subtle background gradient
  const grad = ctx.createLinearGradient(0, 0, totalW, totalH);
  grad.addColorStop(0, 'rgba(30, 41, 59, 0.45)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, totalW, totalH);

  // Outer border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 0.75, 0.75, totalW - 1.5, totalH - 1.5, 0);
  ctx.stroke();

  let curY = outerMargin;

  // ── 2. Top Header Bar (if enabled) ──
  if (options.includeHeader) {
    const headerW = totalW - outerMargin * 2;
    const headerX = outerMargin;

    // Title & Subtitle
    ctx.font = '900 20px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const displayTitle = options.shapeName
      ? `${options.themeName} — ${options.shapeName}`
      : options.themeName || 'Punt Formation';
    ctx.fillText(displayTitle, headerX, curY);

    ctx.font = '600 12px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `Dual-Mode Visualizer  •  ${punts.length} Punts  •  Day Plan & Night Glow Comparison`,
      headerX,
      curY + 28
    );

    // Right-aligned pill badge
    const badgeText = `${punts.length} BOATS`;
    ctx.font = '800 11px Inter, system-ui, -apple-system, sans-serif';
    const textMetrics = ctx.measureText(badgeText);
    const badgeW = textMetrics.width + 20;
    const badgeH = 26;
    const badgeX = headerX + headerW - badgeW;
    const badgeY = curY + 4;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#60a5fa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // Separator line
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headerX, curY + 60);
    ctx.lineTo(headerX + headerW, curY + 60);
    ctx.stroke();

    curY += headerHeight;
  }

  // ── 3. Helper to draw a photo panel (Light or Dark) ──
  const drawPanel = (
    panelX: number,
    panelY: number,
    title: string,
    badgeBg: string,
    badgeBorder: string,
    badgeTextColor: string,
    dotColor: string,
    subtitle: string,
    sourceCanvas: HTMLCanvasElement
  ) => {
    // Panel card box
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, panelX, panelY, panelW, panelH, panelCornerRadius);
    ctx.fill();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Panel Header row
    ctx.save();
    // Pill Badge
    ctx.font = '800 11px Inter, system-ui, -apple-system, sans-serif';
    const bTextMetrics = ctx.measureText(title);
    const bW = bTextMetrics.width + 26;
    const bH = 24;
    const bX = panelX + 12;
    const bY = panelY + 9;

    ctx.fillStyle = badgeBg;
    drawRoundRect(ctx, bX, bY, bW, bH, 12);
    ctx.fill();
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Badge dot
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(bX + 11, bY + bH / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Badge label
    ctx.fillStyle = badgeTextColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, bX + 20, bY + bH / 2);

    // Subtitle description on the right
    ctx.font = '600 11px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(subtitle, panelX + panelW - 14, panelY + panelHeaderHeight / 2);

    ctx.restore();

    // Draw the rendered photo canvas
    // Need to clip photo inside rounded container bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, panelY + panelHeaderHeight, photoW, photoH);
    ctx.clip();

    ctx.drawImage(
      sourceCanvas,
      0, 0, sourceCanvas.width, sourceCanvas.height,
      panelX, panelY + panelHeaderHeight, photoW, photoH
    );
    ctx.restore();

    // Inner divider line between panel header and photo
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX, panelY + panelHeaderHeight);
    ctx.lineTo(panelX + panelW, panelY + panelHeaderHeight);
    ctx.stroke();
  };

  // ── 4. Position and Draw the Two Panels ──
  if (isSideBySide) {
    const leftX = outerMargin;
    const rightX = outerMargin + panelW + panelGap;

    // Light Panel (Left)
    drawPanel(
      leftX,
      curY,
      'DAY · LIGHT MODE',
      'rgba(245, 158, 11, 0.15)',
      'rgba(245, 158, 11, 0.35)',
      '#fbbf24',
      '#f59e0b',
      'Boat Numbers & Setup',
      lightCanvas
    );

    // Dark Panel (Right)
    drawPanel(
      rightX,
      curY,
      'NIGHT · DARK MODE',
      'rgba(99, 102, 241, 0.15)',
      'rgba(99, 102, 241, 0.35)',
      '#818cf8',
      '#6366f1',
      'Water Visualizer & Glow',
      darkCanvas
    );

    curY += panelH;
  } else {
    // Stacked Vertically
    const panelX = outerMargin;

    // Light Panel (Top)
    drawPanel(
      panelX,
      curY,
      'DAY · LIGHT MODE',
      'rgba(245, 158, 11, 0.15)',
      'rgba(245, 158, 11, 0.35)',
      '#fbbf24',
      '#f59e0b',
      'Boat Numbers & Setup',
      lightCanvas
    );
    curY += panelH + panelGap;

    // Dark Panel (Bottom)
    drawPanel(
      panelX,
      curY,
      'NIGHT · DARK MODE',
      'rgba(99, 102, 241, 0.15)',
      'rgba(99, 102, 241, 0.35)',
      '#818cf8',
      '#6366f1',
      'Water Visualizer & Glow',
      darkCanvas
    );
    curY += panelH;
  }

  // ── 5. Footer Line ──
  curY += 12;
  const footerX = outerMargin;
  const footerW = totalW - outerMargin * 2;

  ctx.font = '600 10px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Punt Formation Designer  •  Night Water Visualizer', footerX, curY);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  ctx.textAlign = 'right';
  ctx.fillText(`Exported: ${dateStr}`, footerX + footerW, curY);

  return masterCanvas;
}

/** Trigger download of a canvas as PNG */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 'image/png');
}
