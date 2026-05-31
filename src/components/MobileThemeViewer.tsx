import React, { useState, useEffect, useRef } from 'react';
import type { PuntData, PuntColor } from '../store/types';
import { useThemeStore } from '../store/useThemeStore';
import { useEditorStore } from '../store/useEditorStore';
import { Stage, Layer, Rect, Circle, Text, Group, Path, Line } from 'react-konva';
import { 
  ChevronLeft, Sun, Moon, Layers, 
  ZoomIn, ZoomOut, Move, Home, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { getPuntDimensions } from '../utils/sizes';

interface MobileThemeViewerProps {
  themeId: string;
  onBack: () => void;
}

export const MobileThemeViewer: React.FC<MobileThemeViewerProps> = ({ themeId, onBack }) => {
  const { themes } = useThemeStore();
  const syncStatus = useEditorStore((s) => s.syncStatus);
  const theme = themes.find(t => t.id === themeId) ?? null;

  const [activeThemeMode, setActiveThemeMode] = useState<'light' | 'dark'>('light');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [stageScale, setStageScale] = useState(0.6); // Scale down slightly to fit mobile screen
  const [stagePos, setStagePos] = useState({ x: window.innerWidth / 2, y: (window.innerHeight - 300) / 2 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight - 280 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    // Initial size check
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!theme) {
    return (
      <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <Layers className="w-12 h-12 text-slate-700 mb-4" />
        <h2 className="text-lg font-black text-white mb-2">Theme not found</h2>
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black text-white"
        >
          <Home size={14} /> Back to Themes
        </button>
      </div>
    );
  }

  const formations = theme.formations ?? [];
  
  // Set default selected shape if not set
  if (!selectedShapeId && formations.length > 0) {
    setSelectedShapeId(formations[0].id);
  }

  const activeShape = formations.find(f => f.id === selectedShapeId) ?? formations[0] ?? null;
  const activePunts = activeShape ? activeShape.punts : [];

  const isDarkTheme = activeThemeMode === 'dark';
  const canvasBg = isDarkTheme ? '#000000' : '#ffffff';
  
  // Render grid background dots
  const renderGridDots = () => {
    const dots = [];
    const spacing = 40;
    const rangeX = 1200;
    const rangeY = 800;
    const dotColor = isDarkTheme ? '#262626' : '#e2e8f0';

    for (let x = -rangeX / 2; x <= rangeX / 2; x += spacing) {
      for (let y = -rangeY / 2; y <= rangeY / 2; y += spacing) {
        dots.push(
          <Circle
            key={`${x}-${y}`}
            x={x}
            y={y}
            radius={1.5}
            fill={dotColor}
            listening={false}
          />
        );
      }
    }
    return dots;
  };

  // Helper to resolve colored glows (matching editor exactly)
  const resolveGlowColor = (c: PuntColor | undefined): string => {
    switch (c) {
      case 'red':    return '#ef4444';
      case 'yellow': return '#eab308';
      case 'green':  return '#22c55e';
      case 'off': default: return 'transparent';
    }
  };

  // Auto-fit function to center and zoom the stage to display the entire shape
  const autoFitShape = (punts: PuntData[]) => {
    if (punts.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    punts.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const shapeWidth = Math.max(maxX - minX, 100);
    const shapeHeight = Math.max(maxY - minY, 100);

    const padX = 80;
    const padY = 80;
    const availW = Math.max(containerSize.width - padX, 100);
    const availH = Math.max(containerSize.height - padY, 100);

    // Calculate best scale to fit the bounding box
    let scale = Math.min(availW / shapeWidth, availH / shapeHeight);
    scale = Math.max(Math.min(scale, 1.2), 0.25); // cap scale limits

    // Calculate stage offset to place geometric center exactly at container center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const stageX = containerSize.width / 2 - centerX * scale;
    const stageY = containerSize.height / 2 - centerY * scale;

    setStageScale(scale);
    setStagePos({ x: stageX, y: stageY });
  };

  // Run autoFit whenever selected shape changes or container is resized
  useEffect(() => {
    if (activePunts.length > 0 && containerSize.width > 0 && containerSize.height > 0) {
      autoFitShape(activePunts);
    }
  }, [selectedShapeId, containerSize.width, containerSize.height]);

  return (
    <div className="w-full flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden select-none" style={{ height: '100dvh' }}>
      
      {/* Mobile Top Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-slate-900 shrink-0 bg-slate-900 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 text-xs font-bold text-slate-400 active:scale-95 transition-all"
        >
          <ChevronLeft size={14} /> Themes
        </button>
        <span className="text-sm font-black tracking-wider uppercase truncate max-w-[150px] bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          {theme.name}
        </span>
        <button
          onClick={() => setActiveThemeMode(isDarkTheme ? 'light' : 'dark')}
          className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-amber-400 hover:text-white transition-colors active:scale-95"
          title="Toggle Day/Night mode"
        >
          {isDarkTheme ? <Sun size={15} /> : <Moon size={15} className="text-slate-400" />}
        </button>
      </header>

      {/* Sync Status Ribbon */}
      <div className="shrink-0 border-b border-slate-800/50 bg-slate-900/50 py-1.5 px-4 text-[10px] font-semibold leading-snug flex items-center justify-between">
        <div className="flex items-center gap-2">
          {syncStatus === 'connected' ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi size={10} />
                Live Sync
              </span>
            </>
          ) : syncStatus === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <RefreshCw size={10} className="animate-spin" />
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <WifiOff size={10} />
              Offline
            </span>
          )}
        </div>
        <span className="text-slate-500">
          📱 Viewer · Open on PC to edit
        </span>
      </div>

      {/* Interactive Water Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden" 
        style={{ backgroundColor: canvasBg }}
      >
        {activePunts.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/60 z-10">
            <Layers className="w-10 h-10 text-slate-700 mb-2" />
            <p className="text-xs text-slate-400 font-bold">No shapes saved inside this theme.</p>
          </div>
        ) : (
          <Stage
            width={containerSize.width}
            height={containerSize.height}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={true}
            onDragEnd={(e) => {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }}
            style={{ cursor: 'grab' }}
          >
            <Layer>
              {/* Background Grid */}
              {renderGridDots()}

              {/* Plotted Boats */}
              {activePunts.map((p) => {
                const dims = getPuntDimensions(p.number);
                const width = dims.length;
                const height = dims.width;
                const isAnchor = p.number === 4;

                const backGlow = resolveGlowColor(p.colorBack || 'off');
                const frontGlow = resolveGlowColor(p.colorFront || 'off');

                return (
                  <Group 
                    key={p.id} 
                    x={p.x} 
                    y={p.y} 
                    rotation={p.rotation} 
                    offsetX={width / 2} 
                    offsetY={height / 2}
                  >
                    {/* Two Halves Overlapping to Eliminate Sub-pixel Seams */}
                    {(p.colorFront || 'off') === (p.colorBack || 'off') ? (
                      <Rect
                        width={width}
                        height={height}
                        fill="#000000"
                        cornerRadius={6}
                        stroke={frontGlow !== 'transparent' ? frontGlow : (isDarkTheme ? '#1e293b' : '#cbd5e1')}
                        strokeWidth={1.5}
                        shadowColor={frontGlow}
                        shadowBlur={isDarkTheme ? 12 : 6}
                        shadowOpacity={0.8}
                      />
                    ) : (
                      <>
                        <Rect
                          x={0} y={0}
                          width={width / 2 + 1} height={height}
                          fill="#000000"
                          cornerRadius={[6, 0, 0, 6]}
                          stroke={backGlow !== 'transparent' ? backGlow : (isDarkTheme ? '#1e293b' : '#cbd5e1')}
                          strokeWidth={1.5}
                          shadowColor={backGlow}
                          shadowBlur={isDarkTheme ? 12 : 6}
                          shadowOpacity={0.8}
                        />
                        <Rect
                          x={width / 2 - 1} y={0}
                          width={width / 2 + 1} height={height}
                          fill="#000000"
                          cornerRadius={[0, 6, 6, 0]}
                          stroke={frontGlow !== 'transparent' ? frontGlow : (isDarkTheme ? '#1e293b' : '#cbd5e1')}
                          strokeWidth={1.5}
                          shadowColor={frontGlow}
                          shadowBlur={isDarkTheme ? 12 : 6}
                          shadowOpacity={0.8}
                        />
                      </>
                    )}

                    {/* Specific Anchor styling outline */}
                    {isAnchor && (
                      <Rect
                        width={width}
                        height={height}
                        fill="transparent"
                        stroke="#fbbf24"
                        strokeWidth={1.8}
                        cornerRadius={6}
                        shadowColor="#fbbf24"
                        shadowBlur={16}
                        shadowOpacity={0.8}
                      />
                    )}

                    {/* Labeled numbers inside boat */}
                    {isAnchor ? (
                      <Group x={0} y={0} width={width} height={height}>
                        {/* Anchor Icon */}
                        <Group x={width / 2 - 18} y={height / 2 - 8} width={14} height={16}>
                          <Circle x={7} y={3} radius={2} stroke="#fbbf24" strokeWidth={1.8} />
                          <Line points={[7, 5, 7, 13]} stroke="#fbbf24" strokeWidth={1.8} lineCap="round" />
                          <Line points={[4, 8, 10, 8]} stroke="#fbbf24" strokeWidth={1.8} lineCap="round" />
                          <Path data="M 1 8 A 6 6 0 0 0 13 8" stroke="#fbbf24" strokeWidth={1.8} fill="none" lineCap="round" />
                        </Group>
                        <Text
                          text="4"
                          x={width / 2 + 4}
                          y={height / 2 - 7}
                          fill="#ffffff"
                          fontSize={11}
                          fontStyle="bold"
                        />
                      </Group>
                    ) : (
                      <Text
                        text={`${p.number}`}
                        width={width}
                        height={height}
                        align="center"
                        verticalAlign="middle"
                        fill="#ffffff"
                        fontSize={11}
                        fontStyle="bold"
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        )}

        {/* Floating Zoom Controls on Stage */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={() => setStageScale(s => Math.min(s + 0.1, 2))}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white transition-all shadow active:scale-95"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => setStageScale(s => Math.max(s - 0.1, 0.2))}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white transition-all shadow active:scale-95"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
        </div>

        {/* Mini Grab Indicator */}
        <div className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 font-bold flex items-center gap-1 z-10">
          <Move size={12} className="text-indigo-400" /> Swipe to Pan
        </div>

      </div>

      {/* Bottom Drawer: Saved Shapes Selector List */}
      <footer className="h-[136px] shrink-0 border-t border-slate-900 bg-slate-900 z-10 flex flex-col p-3 gap-2">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0">
          <Layers size={13} className="text-indigo-400" /> Saved Shapes ({formations.length})
        </h4>

        {formations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-slate-500 font-bold italic leading-relaxed">
              No saved shapes. Open on PC to design a layout!
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto flex gap-3 pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {formations.map((form) => {
              const isSelected = form.id === selectedShapeId;
              const date = new Date(form.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short'
              });

              return (
                <button
                  key={form.id}
                  onClick={() => setSelectedShapeId(form.id)}
                  className={`w-36 h-20 flex-shrink-0 flex flex-col justify-between p-2.5 border rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 w-full">
                    <span className="text-xs font-black truncate max-w-full leading-tight">
                      {form.name}
                    </span>
                    {form.createdBy && (
                      <span className={`text-[10px] font-black uppercase tracking-wider truncate max-w-full ${
                        isSelected ? 'text-indigo-300' : 'text-slate-500'
                      }`}>
                        by {form.createdBy}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-1 w-full">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-900 text-slate-400'
                    }`}>
                      ⚓ {form.punts.length}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {date}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </footer>

    </div>
  );
};
