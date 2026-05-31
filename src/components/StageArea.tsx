import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Transformer, Line } from 'react-konva';
import { useFormationStore } from '../store/useFormationStore';
import { useEditorStore } from '../store/useEditorStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { resolveCollisionsEdgeToEdge } from '../utils/collision';
import { PuntNode } from './PuntNode';
import { setGlobalStage } from '../utils/stageRef';
import Konva from 'konva';

export const StageArea: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const groupStartCoords = useRef<{ [id: string]: { x: number; y: number; rotation: number } }>({});
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  
  const punts = useFormationStore((state) => state.punts);
  const updatePunt = useFormationStore((state) => state.updatePunt);
  
  const { 
    selectedIds, setSelectedIds, clearSelection, 
    showLabels, showOutlines, showGrid, theme, tool,
    activeDragPunt
  } = useEditorStore();

  const { scenes, isPlaying, playFromIndex, playToIndex, playbackProgress } = useTimelineStore();

  const [selectionBox, setSelectionBox] = useState<{
    visible: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>({ visible: false, x1: 0, y1: 0, x2: 0, y2: 0 });

  // Register stage globally so Timeline can call stage.draw() during export
  useEffect(() => {
    if (stageRef.current) setGlobalStage(stageRef.current);
    return () => setGlobalStage(null);
  }, []);

  // Dynamically attach selected nodes to the shared Transformer
  useEffect(() => {
    if (transformerRef.current && !isPlaying) {
      const stage = transformerRef.current.getStage();
      if (!stage) return;
      
      const selectedNodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];
      
      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIds, isPlaying]);

  // Calculate animated / display positions
  const displayPunts = React.useMemo(() => {
    if (!isPlaying || scenes.length < 2) return punts;

    const fromScene = scenes[playFromIndex];
    const toScene = scenes[playToIndex];
    const t = playbackProgress;

    if (!fromScene || !toScene) return punts;

    return fromScene.punts.map((p1) => {
      const p2 = toScene.punts.find((p) => p.number === p1.number);
      if (!p2) return p1;

      // Position interpolation
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;

      // Shortest-path rotation interpolation
      let r1 = p1.rotation;
      let r2 = p2.rotation;
      let diff = ((r2 - r1 + 180) % 360) - 180;
      if (diff < -180) diff += 360;
      const rotation = r1 + diff * t;

      // Color transition at mid point
      const color = t < 0.5 ? p1.color : p2.color;

      return {
        ...p1,
        x,
        y,
        rotation,
        color,
      };
    });
  }, [punts, scenes, isPlaying, playFromIndex, playToIndex, playbackProgress]);

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
        setStagePos({
          x: containerRef.current.offsetWidth / 2,
          y: containerRef.current.offsetHeight / 2,
        });
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    newScale = Math.max(0.1, Math.min(newScale, 5));

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPlaying || tool !== 'select') return; // Disable selection box in play or hand tool mode
    
    const isElement = e.target.findAncestor('.punt-group', true);
    const isTransformer = e.target.findAncestor('Transformer', true);
    if (isElement || isTransformer) return;
 
    // Start box selection
    const pos = e.target.getStage()?.getRelativePointerPosition();
    if (pos) {
      setSelectionBox({
        visible: true,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
      });
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!selectionBox.visible || isPlaying || tool !== 'select') return;
    const pos = e.target.getStage()?.getRelativePointerPosition();
    if (pos) {
      setSelectionBox((prev) => ({ ...prev, x2: pos.x, y2: pos.y }));
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!selectionBox.visible || isPlaying || tool !== 'select') return;
    
    const width = Math.abs(selectionBox.x2 - selectionBox.x1);
    const height = Math.abs(selectionBox.y2 - selectionBox.y1);
    
    setSelectionBox((prev) => ({ ...prev, visible: false }));

    if (width < 5 && height < 5) {
      // Simple click, let standard onClick / handlePuntSelect handle selection!
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;

    const box = stage.findOne('.selection-box')?.getClientRect();
    if (!box) return;

    const selected = stage.find('.punt-group').filter((shape) => {
      const shapeBox = shape.getClientRect();
      return Konva.Util.haveIntersection(box, shapeBox);
    });

    const ids = selected.map((s) => s.id());
    setSelectedIds(ids);
  };

  const handlePuntSelect = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPlaying) return;
    const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    const isSelected = selectedIds.includes(id);

    if (!metaPressed && !isSelected) {
      setSelectedIds([id]);
    } else if (metaPressed && isSelected) {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } else if (metaPressed && !isSelected) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const handleExportImage = () => {
    if (stageRef.current) {
      const dataURL = (stageRef.current as any).toDataURL({
        pixelRatio: 2,
        backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `punt-formation-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleTransformStart = () => {
    const stage = transformerRef.current?.getStage();
    if (!stage) return;
    
    const coords: { [id: string]: { x: number; y: number; rotation: number } } = {};
    selectedIds.forEach((id) => {
      const node = stage.findOne(`#${id}`) as Konva.Group;
      if (node) {
        coords[id] = { x: node.x(), y: node.y(), rotation: node.rotation() };
      }
    });
    groupStartCoords.current = coords;
  };

  const handleTransformEnd = () => {
    const stage = transformerRef.current?.getStage();
    if (!stage) return;

    const proposedUpdates: { [id: string]: { x: number; y: number; rotation: number } } = {};

    const currentPunts = useFormationStore.getState().punts;
    const staticBoats = currentPunts.filter(p => !selectedIds.includes(p.id));

    // Resolve rotations and snap overlaps perfectly edge-to-edge!
    for (const id of selectedIds) {
      const node = stage.findOne(`#${id}`) as Konva.Group;
      const b = currentPunts.find(p => p.id === id);
      
      if (node && b) {
        const nodeX = node.x();
        const nodeY = node.y();
        const nodeRot = node.rotation();
        
        const proposedCenter = {
          x: Math.round(nodeX),
          y: Math.round(nodeY),
          rotation: Math.round(nodeRot),
          number: b.number,
        };
        
        // Resolve OBB collisions edge-to-edge
        const resolvedCenter = resolveCollisionsEdgeToEdge(id, proposedCenter, staticBoats);
        
        proposedUpdates[id] = {
          x: resolvedCenter.x,
          y: resolvedCenter.y,
          rotation: proposedCenter.rotation,
        };
        
        node.x(resolvedCenter.x);
        node.y(resolvedCenter.y);
      }
    }

    transformerRef.current?.getLayer()?.batchDraw();

    // Commit snaps to store
    selectedIds.forEach((id) => {
      const prop = proposedUpdates[id];
      if (prop) {
        useFormationStore.getState().updatePunt(id, prop);
      }
    });
    useFormationStore.getState().commitHistory();
  };

  const isDark = theme === 'dark';
  
  const bgStyle = {
    backgroundImage: showGrid 
      ? `radial-gradient(${isDark ? '#262626' : '#9aaab8'} 1px, transparent 1px)` 
      : 'none',
    backgroundSize: '40px 40px',
  };

  // Real-time alignment guidelines (Smart Guides) calculation
  const guideLines: React.ReactNode[] = [];
  if (activeDragPunt && !isPlaying) {
    const threshold = 6;
    const otherPunts = punts.filter(p => p.id !== activeDragPunt.id);
    
    otherPunts.forEach((p) => {
      // Horizontal Guideline (Y-coordinate matches within threshold)
      if (Math.abs(p.y - activeDragPunt.y) < threshold) {
        guideLines.push(
          <Line
            key={`h-guide-${p.id}`}
            points={[-4000, p.y, 4000, p.y]}
            stroke="#10b981" // Premium Emerald Green alignment guide
            strokeWidth={1.5 / stageScale}
            dash={[6, 4]}
            opacity={0.85}
          />
        );
      }
      // Vertical Guideline (X-coordinate matches within threshold)
      if (Math.abs(p.x - activeDragPunt.x) < threshold) {
        guideLines.push(
          <Line
            key={`v-guide-${p.id}`}
            points={[p.x, -4000, p.x, 4000]}
            stroke="#10b981" // Premium Emerald Green alignment guide
            strokeWidth={1.5 / stageScale}
            dash={[6, 4]}
            opacity={0.85}
          />
        );
      }
    });
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden relative transition-colors duration-200"
      style={{ ...bgStyle, backgroundColor: isDark ? '#000000' : '#c2cdd6' }}
    >
      {/* Zoom / Reset Stage HUD */}
      <div className={`absolute bottom-6 right-6 border rounded-lg p-2 flex flex-col gap-2 z-10 text-xs shadow-xl transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-300 shadow-slate-950/50' : 'bg-white border-slate-200 text-slate-700 shadow-slate-200/50'
      }`}>
        <button onClick={() => { setStageScale(1); setStagePos({ x: dimensions.width / 2, y: dimensions.height / 2 }); }} className={`px-2.5 py-1 rounded text-left ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
          Reset Pan & Zoom
        </button>
        <button onClick={handleExportImage} className={`px-2.5 py-1 rounded text-left font-bold text-emerald-500 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
          Export as Image
        </button>
        <div className={`text-center font-bold border-t pt-1 ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          {(stageScale * 100).toFixed(0)}%
        </div>
      </div>

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={tool === 'hand' && !isPlaying}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          if (e.target === e.target.getStage() && !isPlaying) {
            clearSelection();
          }
        }}
        style={{ cursor: tool === 'hand' ? 'grab' : 'default' }}
      >
        <Layer>
          {/* Smart Guides rendered underneath boats */}
          {guideLines}

          {displayPunts.map((punt) => (
            <PuntNode
              key={punt.id}
              punt={punt}
              isSelected={!isPlaying && selectedIds.includes(punt.id)}
              showLabels={showLabels}
              showOutlines={showOutlines}
              draggable={!isPlaying && tool === 'select'}
              onSelect={(e) => handlePuntSelect(punt.id, e)}
              onChange={(newAttrs) => updatePunt(punt.id, newAttrs)}
            />
          ))}
          
          {selectionBox.visible && (
            <Rect
              name="selection-box"
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(59, 130, 246, 0.15)"
              stroke="#3b82f6"
              strokeWidth={1.5 / stageScale}
            />
          )}

          {!isPlaying && selectedIds.length > 0 && (
            <Transformer
              ref={transformerRef}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              resizeEnabled={false}
              rotateEnabled={false}
              anchorSize={8}
              anchorCornerRadius={4}
              borderStroke={isDark ? '#3b82f6' : '#2563eb'}
              anchorStroke={isDark ? '#3b82f6' : '#2563eb'}
              anchorFill="#ffffff"
              onTransformStart={handleTransformStart}
              onTransformEnd={handleTransformEnd}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};
