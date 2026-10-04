import React, { useState, useEffect, useRef } from 'react';
import type { PuntData } from '../store/types';
import { 
  renderCombinedDualModeCanvas, 
  downloadCanvasAsPng, 
  type ExportOptions 
} from '../utils/shapeExport';
import { 
  Download, X, Copy, Check, Columns2, Rows2, 
  Sparkles, Loader2 
} from 'lucide-react';

interface ExportShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  punts: PuntData[];
  themeName: string;
  shapeName: string;
}

export const ExportShapeModal: React.FC<ExportShapeModalProps> = ({
  isOpen,
  onClose,
  punts,
  themeName,
  shapeName,
}) => {
  const [layout, setLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [lightBg, setLightBg] = useState<'water' | 'slate' | 'white'>('water');
  const [includeHeader, setIncludeHeader] = useState(true);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Re-generate preview whenever options change
  useEffect(() => {
    if (!isOpen || punts.length === 0) return;

    setIsGenerating(true);

    const timer = setTimeout(() => {
      try {
        const options: ExportOptions = {
          layout,
          lightBg,
          includeHeader,
          themeName: themeName || 'Punt Designer',
          shapeName: shapeName || 'Custom Shape',
        };

        const canvas = renderCombinedDualModeCanvas(punts, options);
        canvasRef.current = canvas;
        setImageDimensions({ width: canvas.width, height: canvas.height });

        const url = canvas.toDataURL('image/png');
        setPreviewUrl(url);
      } catch (err) {
        console.error('Failed to generate export canvas', err);
      } finally {
        setIsGenerating(false);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, punts, layout, lightBg, includeHeader, themeName, shapeName]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !isDownloading) {
        handleDownload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDownloading]);

  if (!isOpen) return null;

  const getExportFilename = () => {
    const safeTheme = (themeName || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const safeShape = (shapeName || 'shape').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${safeTheme}-${safeShape}-dual-mode.png`;
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    setIsDownloading(true);
    try {
      const filename = getExportFilename();
      downloadCanvasAsPng(canvasRef.current, filename);
      setTimeout(() => {
        setIsDownloading(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Download failed', err);
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2200);
        } catch {
          // Fallback if clipboard item write fails
          alert('Unable to copy directly to clipboard in this browser. Please use "Download Image".');
        }
      }, 'image/png');
    } catch (e) {
      console.error('Clipboard copy error', e);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                Download Shape (Dual Mode)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Light + Dark Combined
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Adjusts both Light and Dark mode photos of the shape into one high-resolution file.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Adjustment Controls Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Layout Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Layout:
            </span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setLayout('side-by-side')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  layout === 'side-by-side'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns2 size={13} />
                <span>Side-by-Side</span>
              </button>
              <button
                onClick={() => setLayout('stacked')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  layout === 'stacked'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Rows2 size={13} />
                <span>Stacked</span>
              </button>
            </div>
          </div>

          {/* Light Mode Water Background Style */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Day Water:
            </span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setLightBg('water')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  lightBg === 'water'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Editor day water background (#c2cdd6)"
              >
                Day Water
              </button>
              <button
                onClick={() => setLightBg('slate')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  lightBg === 'slate'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Soft slate background (#f1f5f9)"
              >
                Soft Slate
              </button>
              <button
                onClick={() => setLightBg('white')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  lightBg === 'white'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Clean pure white background (#ffffff)"
              >
                Pure White
              </button>
            </div>
          </div>

          {/* Include Header / Title Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold hover:text-white">
            <input
              type="checkbox"
              checked={includeHeader}
              onChange={(e) => setIncludeHeader(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950 cursor-pointer"
            />
            <span className="text-[11px]">Include Title & Details Banner</span>
          </label>
        </div>

        {/* 3. Center Preview Area */}
        <div className="flex-1 overflow-auto p-6 bg-slate-950/70 flex items-center justify-center min-h-[300px]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-2.5 text-slate-400">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
              <span className="text-xs font-semibold">Composing dual-mode shape...</span>
            </div>
          ) : previewUrl ? (
            <div className="relative group max-h-[50vh] flex flex-col items-center">
              <img
                src={previewUrl}
                alt="Dual-mode shape export preview"
                className="max-h-[48vh] max-w-full rounded-xl object-contain shadow-2xl border border-slate-800"
              />
              {imageDimensions && (
                <div className="mt-2 text-[10px] font-mono text-slate-500 font-semibold">
                  {imageDimensions.width} × {imageDimensions.height} px · 2× Retina Resolution · PNG
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              No shape preview available.
            </div>
          )}
        </div>

        {/* 4. Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles size={13} className="text-emerald-400" />
            <span>Adjusted with identical framing and scale in both photos</span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Copy to clipboard */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors border border-slate-700 active:scale-95"
              title="Copy image to clipboard"
            >
              {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{isCopied ? 'Copied!' : 'Copy Image'}</span>
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors"
            >
              Cancel
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading || !previewUrl}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-50 border border-emerald-500/80"
            >
              {isDownloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
