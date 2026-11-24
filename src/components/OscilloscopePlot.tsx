import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { downloadCanvasPng, downloadCsv } from '../dsp/exportUtils';

export interface PlotSeries {
  label: string;
  x: Float64Array | number[];
  y: Float64Array | number[];
  colorDark: string;
  colorLight?: string;
  lineWidth?: number;
  dashed?: boolean;
  fillUnder?: boolean;
  showPoints?: boolean;
}

export interface VerticalMarker {
  x: number;
  label: string;
  colorDark?: string;
  colorLight?: string;
  dashed?: boolean;
}

export interface ShadedRegion {
  xStart: number;
  xEnd: number;
  label: string;
  fillDark: string;
  fillLight: string;
  textDark: string;
  textLight: string;
}

interface OscilloscopePlotProps {
  title: string;
  subtitle?: string;
  series: PlotSeries[];
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  initialXRange?: [number, number];
  yRange?: [number, number];
  markers?: VerticalMarker[];
  shadedRegions?: ShadedRegion[];
  height?: number;
  isDark: boolean;
  exportFilename: string;
  headerRight?: React.ReactNode;
}

function niceTickStep(span: number, targetTicks: number): number {
  if (span <= 0 || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(2, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice = 1;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return nice * mag;
}

function formatAxisTick(val: number, step: number): string {
  if (Math.abs(val) < step * 1e-4) return '0';
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step)) + (step < 1 ? 1 : 0)));
  return Number(val.toFixed(decimals)).toString();
}

function findNearestIndex(arr: Float64Array | number[], target: number): number {
  const n = arr.length;
  if (n === 0) return -1;
  if (target <= arr[0]) return 0;
  if (target >= arr[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = arr[mid];
    if (v === target) return mid;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  if (lo >= n) return n - 1;
  if (lo <= 0) return 0;
  return Math.abs(arr[lo] - target) < Math.abs(arr[lo - 1] - target) ? lo : lo - 1;
}

export const OscilloscopePlot: React.FC<OscilloscopePlotProps> = ({
  title,
  subtitle,
  series,
  xLabel,
  yLabel,
  xUnit = '',
  yUnit = '',
  initialXRange,
  yRange,
  markers = [],
  shadedRegions = [],
  height = 240,
  isDark,
  exportFilename,
  headerRight,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(640);

  // Full X domain across all series
  const fullXDomain = useMemo<[number, number]>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      if (s.x.length > 0) {
        if (s.x[0] < min) min = s.x[0];
        if (s.x[s.x.length - 1] > max) max = s.x[s.x.length - 1];
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return [0, 1];
    }
    return [min, max];
  }, [series]);

  const defaultRange = useMemo<[number, number]>(() => {
    if (initialXRange) {
      return [
        Math.max(fullXDomain[0], initialXRange[0]),
        Math.min(fullXDomain[1], initialXRange[1]),
      ];
    }
    return fullXDomain;
  }, [fullXDomain, initialXRange]);

  const [xRange, setXRange] = useState<[number, number]>(defaultRange);
  const [isCustomZoom, setIsCustomZoom] = useState(false);

  // Keep range synced when defaultRange changes unless user zoomed manually
  const prevDefaultRef = useRef<[number, number]>(defaultRange);
  useEffect(() => {
    const prev = prevDefaultRef.current;
    if (
      Math.abs(prev[0] - defaultRange[0]) > 1e-6 ||
      Math.abs(prev[1] - defaultRange[1]) > 1e-6
    ) {
      prevDefaultRef.current = defaultRange;
      setXRange(defaultRange);
      setIsCustomZoom(false);
    }
  }, [defaultRange]);

  // Hover & drag-zoom state
  const [hoverInfo, setHoverInfo] = useState<{
    xVal: number;
    pixelX: number;
    pixelY: number;
    values: { label: string; y: number; color: string }[];
  } | null>(null);

  const [dragSelection, setDragSelection] = useState<{
    startPx: number;
    currPx: number;
  } | null>(null);

  // Observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 120) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padLeft = 58;
  const padRight = 18;
  const padTop = 22;
  const padBottom = 38;
  const plotW = Math.max(100, containerWidth - padLeft - padRight);
  const plotH = Math.max(80, height - padTop - padBottom);

  // Compute Y domain inside current X window
  const yDomain = useMemo<[number, number]>(() => {
    if (yRange) return yRange;
    let min = Infinity;
    let max = -Infinity;
    const [x0, x1] = xRange;
    for (const s of series) {
      const len = s.x.length;
      if (len === 0) continue;
      const startIdx = Math.max(0, findNearestIndex(s.x, x0) - 1);
      const endIdx = Math.min(len - 1, findNearestIndex(s.x, x1) + 1);
      for (let i = startIdx; i <= endIdx; i++) {
        const v = s.y[i];
        if (Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
    if (Math.abs(max - min) < 1e-6) {
      return [min - 1, max + 1];
    }
    const pad = (max - min) * 0.12;
    return [min - pad, max + pad];
  }, [series, xRange, yRange]);

  const toPixelX = useCallback(
    (xVal: number) => {
      const span = Math.max(1e-9, xRange[1] - xRange[0]);
      return padLeft + ((xVal - xRange[0]) / span) * plotW;
    },
    [xRange, plotW]
  );

  const toPixelY = useCallback(
    (yVal: number) => {
      const span = Math.max(1e-9, yDomain[1] - yDomain[0]);
      return padTop + plotH - ((yVal - yDomain[0]) / span) * plotH;
    },
    [yDomain, plotH]
  );

  const fromPixelX = useCallback(
    (px: number) => {
      const t = Math.max(0, Math.min(1, (px - padLeft) / plotW));
      return xRange[0] + t * (xRange[1] - xRange[0]);
    },
    [xRange, plotW]
  );

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(containerWidth * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Theme tokens
    const bgCanvas = isDark ? '#0B0F17' : '#FFFFFF';
    const bgPlot = isDark ? '#080B12' : '#F8FAFC';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.42)' : 'rgba(203, 213, 225, 0.85)';
    const zeroLineColor = isDark ? 'rgba(100, 116, 139, 0.55)' : 'rgba(148, 163, 184, 0.9)';
    const borderColor = isDark ? '#1E293B' : '#CBD5E1';
    const tickTextColor = isDark ? '#94A3B8' : '#475569';
    const axisLabelColor = isDark ? '#CBD5E1' : '#334155';

    // Fill background (essential for crisp PNG export)
    ctx.fillStyle = bgCanvas;
    ctx.fillRect(0, 0, containerWidth, height);

    // Plot interior
    ctx.fillStyle = bgPlot;
    ctx.fillRect(padLeft, padTop, plotW, plotH);

    // Shaded regions inside plot clip
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    for (const region of shadedRegions) {
      const rx1 = toPixelX(Math.min(region.xStart, region.xEnd));
      const rx2 = toPixelX(Math.max(region.xStart, region.xEnd));
      if (rx2 < padLeft || rx1 > padLeft + plotW) continue;
      const clampedX1 = Math.max(padLeft, rx1);
      const clampedX2 = Math.min(padLeft + plotW, rx2);
      ctx.fillStyle = isDark ? region.fillDark : region.fillLight;
      ctx.fillRect(clampedX1, padTop, Math.max(1, clampedX2 - clampedX1), plotH);

      if (clampedX2 - clampedX1 > 44) {
        ctx.fillStyle = isDark ? region.textDark : region.textLight;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(region.label, (clampedX1 + clampedX2) * 0.5, padTop + 14);
      }
    }

    // Grid lines
    const xStep = niceTickStep(xRange[1] - xRange[0], Math.max(4, Math.floor(plotW / 95)));
    const yStep = niceTickStep(yDomain[1] - yDomain[0], Math.max(3, Math.floor(plotH / 46)));

    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;

    const firstX = Math.ceil(xRange[0] / xStep) * xStep;
    for (let xv = firstX; xv <= xRange[1] + xStep * 1e-6; xv += xStep) {
      const px = Math.round(toPixelX(xv)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
      ctx.stroke();
    }

    const firstY = Math.ceil(yDomain[0] / yStep) * yStep;
    for (let yv = firstY; yv <= yDomain[1] + yStep * 1e-6; yv += yStep) {
      const py = Math.round(toPixelY(yv)) + 0.5;
      ctx.strokeStyle = Math.abs(yv) < yStep * 1e-4 ? zeroLineColor : gridColor;
      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(padLeft + plotW, py);
      ctx.stroke();
    }

    // Vertical markers
    for (const m of markers) {
      if (m.x < xRange[0] || m.x > xRange[1]) continue;
      const mx = Math.round(toPixelX(m.x)) + 0.5;
      const mColor = isDark
        ? m.colorDark ?? 'rgba(248, 113, 113, 0.8)'
        : m.colorLight ?? 'rgba(220, 38, 38, 0.85)';
      ctx.save();
      ctx.strokeStyle = mColor;
      ctx.lineWidth = 1.2;
      if (m.dashed !== false) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, padTop);
      ctx.lineTo(mx, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = mColor;
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.textAlign = mx > padLeft + plotW - 70 ? 'right' : 'left';
      ctx.fillText(m.label, mx > padLeft + plotW - 70 ? mx - 4 : mx + 4, padTop + 12);
      ctx.restore();
    }

    // Plot series
    for (const s of series) {
      const len = s.x.length;
      if (len === 0) continue;
      const startIdx = Math.max(0, findNearestIndex(s.x, xRange[0]) - 1);
      const endIdx = Math.min(len - 1, findNearestIndex(s.x, xRange[1]) + 1);
      const traceColor = isDark ? s.colorDark : s.colorLight ?? s.colorDark;

      ctx.save();
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = s.lineWidth ?? 1.6;
      if (s.dashed) ctx.setLineDash([5, 4]);

      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const px = toPixelX(s.x[i]);
        const py = toPixelY(s.y[i]);
        if (i === startIdx) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      if (s.fillUnder && endIdx > startIdx) {
        const baseY = Math.min(padTop + plotH, Math.max(padTop, toPixelY(yDomain[0])));
        ctx.lineTo(toPixelX(s.x[endIdx]), baseY);
        ctx.lineTo(toPixelX(s.x[startIdx]), baseY);
        ctx.closePath();
        ctx.fillStyle = traceColor + (isDark ? '22' : '18');
        ctx.fill();
      }

      if (s.showPoints) {
        ctx.setLineDash([]);
        ctx.fillStyle = traceColor;
        for (let i = startIdx; i <= endIdx; i++) {
          const px = toPixelX(s.x[i]);
          const py = toPixelY(s.y[i]);
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Drag zoom highlight
    if (dragSelection) {
      const dx1 = Math.min(dragSelection.startPx, dragSelection.currPx);
      const dx2 = Math.max(dragSelection.startPx, dragSelection.currPx);
      ctx.fillStyle = isDark ? 'rgba(34, 211, 238, 0.14)' : 'rgba(8, 145, 178, 0.14)';
      ctx.fillRect(dx1, padTop, dx2 - dx1, plotH);
      ctx.strokeStyle = isDark ? '#22D3EE' : '#0891B2';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx1, padTop, dx2 - dx1, plotH);
    }

    // Crosshair hover line
    if (hoverInfo) {
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(226, 232, 240, 0.45)' : 'rgba(51, 65, 85, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverInfo.pixelX, padTop);
      ctx.lineTo(hoverInfo.pixelX, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const v of hoverInfo.values) {
        const py = toPixelY(v.y);
        if (py >= padTop && py <= padTop + plotH) {
          ctx.fillStyle = v.color;
          ctx.beginPath();
          ctx.arc(hoverInfo.pixelX, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore(); // End plot clip

    // Plot border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft + 0.5, padTop + 0.5, plotW, plotH);

    // Axis ticks & labels
    ctx.fillStyle = tickTextColor;
    ctx.font = '400 10.5px "IBM Plex Mono", monospace';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let xv = firstX; xv <= xRange[1] + xStep * 1e-6; xv += xStep) {
      const px = toPixelX(xv);
      if (px >= padLeft - 4 && px <= padLeft + plotW + 4) {
        ctx.fillText(formatAxisTick(xv, xStep), px, padTop + plotH + 6);
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let yv = firstY; yv <= yDomain[1] + yStep * 1e-6; yv += yStep) {
      const py = toPixelY(yv);
      if (py >= padTop - 2 && py <= padTop + plotH + 2) {
        ctx.fillText(formatAxisTick(yv, yStep), padLeft - 7, py);
      }
    }

    // X-axis label
    ctx.fillStyle = axisLabelColor;
    ctx.font = '500 11px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xLabel, padLeft + plotW * 0.5, height - 3);

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(14, padTop + plotH * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [
    containerWidth,
    height,
    isDark,
    series,
    markers,
    shadedRegions,
    xRange,
    yDomain,
    xLabel,
    yLabel,
    plotW,
    plotH,
    toPixelX,
    toPixelY,
    hoverInfo,
    dragSelection,
  ]);

  // Pointer handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (dragSelection) {
      setDragSelection({
        ...dragSelection,
        currPx: Math.max(padLeft, Math.min(padLeft + plotW, px)),
      });
    }

    if (px < padLeft || px > padLeft + plotW || py < padTop || py > padTop + plotH) {
      setHoverInfo(null);
      return;
    }

    const xVal = fromPixelX(px);
    const values = series.map((s) => {
      const idx = findNearestIndex(s.x, xVal);
      return {
        label: s.label,
        y: idx >= 0 ? s.y[idx] : 0,
        color: isDark ? s.colorDark : s.colorLight ?? s.colorDark,
      };
    });
    setHoverInfo({ xVal, pixelX: px, pixelY: py, values });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px >= padLeft && px <= padLeft + plotW) {
      setDragSelection({ startPx: px, currPx: px });
    }
  };

  const handleMouseUp = () => {
    if (!dragSelection) return;
    const dx = Math.abs(dragSelection.currPx - dragSelection.startPx);
    if (dx > 12) {
      const a = fromPixelX(Math.min(dragSelection.startPx, dragSelection.currPx));
      const b = fromPixelX(Math.max(dragSelection.startPx, dragSelection.currPx));
      if (b - a > 1e-6) {
        setXRange([a, b]);
        setIsCustomZoom(true);
      }
    }
    setDragSelection(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < padLeft || px > padLeft + plotW) return;
    e.preventDefault();

    const anchor = fromPixelX(px);
    const factor = e.deltaY < 0 ? 0.72 : 1.38;
    const newMin = Math.max(fullXDomain[0], anchor - (anchor - xRange[0]) * factor);
    const newMax = Math.min(fullXDomain[1], anchor + (xRange[1] - anchor) * factor);
    if (newMax - newMin > (fullXDomain[1] - fullXDomain[0]) * 0.002) {
      setXRange([newMin, newMax]);
      setIsCustomZoom(true);
    }
  };

  const zoomBy = (factor: number) => {
    const center = (xRange[0] + xRange[1]) * 0.5;
    const half = (xRange[1] - xRange[0]) * 0.5 * factor;
    const newMin = Math.max(fullXDomain[0], center - half);
    const newMax = Math.min(fullXDomain[1], center + half);
    if (newMax - newMin > (fullXDomain[1] - fullXDomain[0]) * 0.002) {
      setXRange([newMin, newMax]);
      setIsCustomZoom(true);
    }
  };

  const resetZoom = () => {
    setXRange(defaultRange);
    setIsCustomZoom(false);
  };

  const handleExportCsv = () => {
    if (series.length === 0 || series[0].x.length === 0) return;
    const base = series[0];
    const startIdx = Math.max(0, findNearestIndex(base.x, xRange[0]));
    const endIdx = Math.min(base.x.length - 1, findNearestIndex(base.x, xRange[1]));

    const headers = [xLabel, ...series.map((s) => `${s.label} (${yUnit || yLabel})`)];
    const rows: (number | string)[][] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const xv = base.x[i];
      const row: number[] = [Number(xv.toFixed(6))];
      for (const s of series) {
        const idx = i < s.y.length && Math.abs(s.x[i] - xv) < 1e-6 ? i : findNearestIndex(s.x, xv);
        row.push(idx >= 0 ? Number(s.y[idx].toFixed(6)) : 0);
      }
      rows.push(row);
    }
    downloadCsv(exportFilename, headers, rows);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] rounded-md overflow-hidden">
      {/* Instrument header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0F1420]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h3>
            {subtitle && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
                · {subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          <div className="flex items-center border border-slate-200 dark:border-slate-700/80 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => zoomBy(0.6)}
              title="Zoom in X-axis"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1.6)}
              title="Zoom out X-axis"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border-l border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {isCustomZoom && (
              <button
                type="button"
                onClick={resetZoom}
                title="Reset zoom"
                className="p-1.5 text-cyan-700 dark:text-cyan-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 border-l border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => downloadCanvasPng(canvasRef.current, exportFilename)}
            title="Download plot as PNG image"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Export visible data as CSV"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3 h-3" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Legend & live crosshair readout strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 text-[11px] border-b border-slate-100 dark:border-slate-800/70 bg-white dark:bg-[#0B0F17]">
        <div className="flex flex-wrap items-center gap-4">
          {series.map((s) => {
            const c = isDark ? s.colorDark : s.colorLight ?? s.colorDark;
            return (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3.5 h-0.5"
                  style={{
                    backgroundColor: s.dashed ? 'transparent' : c,
                    borderTop: s.dashed ? `2px dashed ${c}` : undefined,
                  }}
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
          {hoverInfo ? (
            <div className="flex flex-wrap items-center gap-3">
              <span>
                x: <strong className="text-slate-900 dark:text-slate-100">{hoverInfo.xVal.toFixed(3)}</strong>
                {xUnit ? ` ${xUnit}` : ''}
              </span>
              {hoverInfo.values.map((v) => (
                <span key={v.label}>
                  <span style={{ color: v.color }}>{v.label}:</span>{' '}
                  <strong className="text-slate-900 dark:text-slate-100">{v.y.toFixed(3)}</strong>
                  {yUnit ? ` ${yUnit}` : ''}
                </span>
              ))}
            </div>
          ) : (
            <span>Drag across trace to zoom · Hover to probe coordinates</span>
          )}
        </div>
      </div>

      {/* High-DPI Canvas */}
      <div ref={containerRef} className="w-full select-none">
        <canvas
          ref={canvasRef}
          style={{ width: `${containerWidth}px`, height: `${height}px` }}
          className="block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoverInfo(null);
            setDragSelection(null);
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
};
