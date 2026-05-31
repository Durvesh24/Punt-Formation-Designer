import React, { useRef } from 'react';
import { Rect, Text, Group, Circle, Line, Path } from 'react-konva';
import type { PuntData, PuntColor } from '../store/types';
import { useEditorStore } from '../store/useEditorStore';
import { useFormationStore } from '../store/useFormationStore';
import { resolveCollisionsEdgeToEdge } from '../utils/collision';
import { getPuntDimensions } from '../utils/sizes';
import Konva from 'konva';

interface PuntNodeProps {
  punt: PuntData;
  isSelected: boolean;
  showLabels: boolean;
  showOutlines: boolean;
  draggable?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onChange: (newAttrs: Partial<PuntData>) => void;
}

export const PuntNode: React.FC<PuntNodeProps> = ({
  punt,
  isSelected,
  showLabels,
  showOutlines,
  draggable = true,
  onSelect,
  onChange,
}) => {
  const shapeRef = useRef<Konva.Group>(null);
  const dragStartPos = useRef({ x: 0, y: 0, rotation: 0 });
  // Prevents the parent Group's drag handlers from firing while a rotation dot is being dragged
  const isRotating = useRef(false);
  // Stores the positions computed during rotation so onDragEnd doesn't need to read from Konva nodes
  const lastGroupPositions = useRef<{ [id: string]: { x: number; y: number; rotation: number } }>({});
  const startDragState = useRef<{
    x: number;
    y: number;
    rotation: number;
    mouseAngleOffset: number;
    groupData?: {
      [id: string]: {
        startX: number;
        startY: number;
        startRot: number;
        radius: number;
        startAlpha: number;
      };
    };
  }>({ x: 0, y: 0, rotation: 0, mouseAngleOffset: 0 });

  const { theme, selectedIds, snapToGrid } = useEditorStore();
  const isDark = theme === 'dark';
  const isAnchor = punt.number === 4;

  // Maps a PuntColor to its bright glow/stroke color (outline-only, no fill)
  const resolveGlowColor = (c: PuntColor | undefined): string => {
    switch (c) {
      case 'red':    return '#ef4444';
      case 'yellow': return '#eab308';
      case 'green':  return '#22c55e';
      case 'off': default: return 'transparent';
    }
  };

  const backGlow  = resolveGlowColor(punt.colorBack  ?? 'off');
  const frontGlow = resolveGlowColor(punt.colorFront ?? 'off');
  const textColor = '#ffffff';

  // Calculate dynamic dimensions (each boat number has a unique length!)
  const dims = getPuntDimensions(punt.number);
  const PUNT_WIDTH = dims.length;
  const PUNT_HEIGHT = dims.width;

  const drawX = punt.x;
  const drawY = punt.y;
  const offsetX = PUNT_WIDTH / 2;
  const offsetY = PUNT_HEIGHT / 2;

  // Handle dot hover cursors
  const handleDotMouseEnter = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'crosshair';
    const circle = e.target as Konva.Circle;
    circle.radius(6);
    circle.getLayer()?.batchDraw();
  };

  const handleDotMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
    const circle = e.target as Konva.Circle;
    circle.radius(4.5);
    circle.getLayer()?.batchDraw();
  };

  return (
    <Group
      name="punt-group"
      id={punt.id}
      ref={shapeRef}
      x={drawX}
      y={drawY}
      rotation={punt.rotation}
      draggable={draggable}
      onClick={onSelect}
      onTap={(e) => onSelect(e as any)}
      onDragStart={(e) => {
        if (isRotating.current) { e.target.stopDrag?.(); return; }
        dragStartPos.current = { x: drawX, y: drawY, rotation: punt.rotation };
        e.target.moveToTop();
      }}
      onDragMove={(e) => {
        if (isRotating.current) return;
        let proposedX = e.target.x();
        let proposedY = e.target.y();
        
        if (snapToGrid) {
          proposedX = Math.round(proposedX / 20) * 20;
          proposedY = Math.round(proposedY / 20) * 20;
          e.target.x(proposedX);
          e.target.y(proposedY);
        }

        // Set active drag state in store so guidelines can render!
        useEditorStore.getState().setActiveDragPunt({
          id: punt.id,
          x: proposedX,
          y: proposedY,
        });

        if (isSelected && selectedIds.length > 1) {
          const dx = proposedX - dragStartPos.current.x;
          const dy = proposedY - dragStartPos.current.y;
          
          const stage = e.target.getStage();
          if (stage) {
            selectedIds.forEach((id) => {
              if (id === punt.id) return; // Skip currently dragged node
              
              const node = stage.findOne(`#${id}`) as Konva.Group;
              if (node) {
                const original = useFormationStore.getState().punts.find(p => p.id === id);
                if (original) {
                  let nx = original.x + dx;
                  let ny = original.y + dy;
                  if (snapToGrid) {
                    nx = Math.round(nx / 20) * 20;
                    ny = Math.round(ny / 20) * 20;
                  }
                  node.x(nx);
                  node.y(ny);
                }
              }
            });
            e.target.getLayer()?.batchDraw();
          }
        }
      }}
      onDragEnd={(e) => {
        if (isRotating.current) return;
        useEditorStore.getState().setActiveDragPunt(null);

        let newPivotX = Math.round(e.target.x());
        let newPivotY = Math.round(e.target.y());
        
        if (snapToGrid) {
          newPivotX = Math.round(newPivotX / 20) * 20;
          newPivotY = Math.round(newPivotY / 20) * 20;
        }

        const dx = newPivotX - dragStartPos.current.x;
        const dy = newPivotY - dragStartPos.current.y;
        
        const allBoats = useFormationStore.getState().punts;
        
        if (isSelected && selectedIds.length > 1) {
          // Group drag snapping
          const otherBoats = allBoats.filter(b => !selectedIds.includes(b.id));
          
          // Nudge the main dragged boat first
          const proposedMain = { x: punt.x + dx, y: punt.y + dy, rotation: punt.rotation, number: punt.number };
          const resolved = resolveCollisionsEdgeToEdge(punt.id, proposedMain, otherBoats);
          
          const snappedDx = resolved.x - punt.x;
          const snappedDy = resolved.y - punt.y;
          
          const proposedUpdates: { [id: string]: { x: number; y: number } } = {};
          
          selectedIds.forEach((id) => {
            const b = allBoats.find(p => p.id === id);
            if (b) {
              let nx = b.x + snappedDx;
              let ny = b.y + snappedDy;
              if (snapToGrid) {
                nx = Math.round(nx / 20) * 20;
                ny = Math.round(ny / 20) * 20;
              }
              proposedUpdates[id] = { x: nx, y: ny };
            }
          });
          
          // Commit coordinates to store
          selectedIds.forEach((id) => {
            const prop = proposedUpdates[id];
            if (prop) {
              useFormationStore.getState().updatePunt(id, prop);
            }
          });
          useFormationStore.getState().commitHistory();
          
          // Update visual group nodes
          selectedIds.forEach((id) => {
            const node = e.target.getStage()?.findOne(`#${id}`) as Konva.Group;
            const updated = proposedUpdates[id];
            if (node && updated) {
              node.x(updated.x);
              node.y(updated.y);
            }
          });
          e.target.getLayer()?.batchDraw();
          
        } else {
          // Single drag snapping
          const proposed = { x: punt.x + dx, y: punt.y + dy, rotation: punt.rotation, number: punt.number };
          const resolved = resolveCollisionsEdgeToEdge(punt.id, proposed, allBoats);
          
          let finalX = resolved.x;
          let finalY = resolved.y;
          if (snapToGrid) {
            finalX = Math.round(finalX / 20) * 20;
            finalY = Math.round(finalY / 20) * 20;
          }

          onChange({
            x: finalX,
            y: finalY,
          });
          
          e.target.x(finalX);
          e.target.y(finalY);
          e.target.getLayer()?.batchDraw();
        }
      }}
      offsetX={offsetX}
      offsetY={offsetY}
    >
      {/* ── Boat body: glow outline, no middle seam ── */}
      {(punt.colorFront ?? 'off') === (punt.colorBack ?? 'off') ? (
        /* Same colour both sides → single rect, zero inner seam */
        <Rect
          width={PUNT_WIDTH}
          height={PUNT_HEIGHT}
          fill="#000000"
          cornerRadius={6}
          shadowEnabled={showOutlines && frontGlow !== 'transparent'}
          shadowColor={frontGlow}
          shadowBlur={isDark ? 16 : 8}
          shadowOpacity={isDark ? 0.9 : 0.55}
        />
      ) : (
        /* Different colours → two halves, shadow-only (no stroke = no inner line) */
        <>
          <Rect
            x={0} y={0}
            width={PUNT_WIDTH / 2 + 1} height={PUNT_HEIGHT}
            fill="#000000"
            cornerRadius={[6, 0, 0, 6]}
            shadowEnabled={showOutlines && backGlow !== 'transparent'}
            shadowColor={backGlow}
            shadowBlur={isDark ? 16 : 8}
            shadowOpacity={isDark ? 0.9 : 0.55}
          />
          <Rect
            x={PUNT_WIDTH / 2 - 1} y={0}
            width={PUNT_WIDTH / 2 + 1} height={PUNT_HEIGHT}
            fill="#000000"
            cornerRadius={[0, 6, 6, 0]}
            shadowEnabled={showOutlines && frontGlow !== 'transparent'}
            shadowColor={frontGlow}
            shadowBlur={isDark ? 16 : 8}
            shadowOpacity={isDark ? 0.9 : 0.55}
          />
        </>
      )}
      {/* Selection ring only — no fallback outline for unlit punts */}
      <Rect
        width={PUNT_WIDTH}
        height={PUNT_HEIGHT}
        fill="transparent"
        stroke={isSelected ? '#60a5fa' : 'transparent'}
        strokeWidth={isSelected ? 3 : 0}
        cornerRadius={6}
        listening={false}
      />
      {showLabels && (
        isAnchor ? (
          <Group x={0} y={0} width={PUNT_WIDTH} height={PUNT_HEIGHT}>
            {/* Anchor symbol — always visible in both modes */}
            <Group x={PUNT_WIDTH / 2 - 18} y={PUNT_HEIGHT / 2 - 8} width={14} height={16}>
              <Circle x={7} y={3} radius={2} stroke="#fbbf24" strokeWidth={1.8} />
              <Line points={[7, 5, 7, 13]} stroke="#fbbf24" strokeWidth={1.8} lineCap="round" />
              <Line points={[4, 8, 10, 8]} stroke="#fbbf24" strokeWidth={1.8} lineCap="round" />
              <Path data="M 1 8 A 6 6 0 0 0 13 8" stroke="#fbbf24" strokeWidth={1.8} fill="none" lineCap="round" />
            </Group>
            {/* Digit label — only in light mode */}
            {!isDark && (
              <Text
                text="4"
                x={PUNT_WIDTH / 2 + 4}
                y={PUNT_HEIGHT / 2 - 7}
                fill="#ffffff"
                fontSize={13}
                fontStyle="bold"
              />
            )}
          </Group>
        ) : (
          /* Number label — only in light mode */
          !isDark && (
            <Text
              text={`${punt.number}`}
              width={PUNT_WIDTH}
              height={PUNT_HEIGHT}
              align="center"
              verticalAlign="middle"
              fill={textColor}
              fontSize={13}
              fontStyle="bold"
            />
          )
        )
      )}

      {/* Dynamic 3 Direct Rotation Dots (stern, center, bow) */}
      {isSelected && (
        <>
          {/* 1. Left Dot (Stern Pivot Handle) - Rotates around Right Tip */}
          <Circle
            x={12}
            y={PUNT_HEIGHT / 2}
            radius={4.5}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={2}
            shadowColor="#3b82f6"
            shadowBlur={4}
            shadowOpacity={0.6}
            draggable={true}
            onMouseEnter={handleDotMouseEnter}
            onMouseLeave={handleDotMouseLeave}
            onDragStart={(e) => {
              e.cancelBubble = true;
              isRotating.current = true;
              lastGroupPositions.current = {};
              const layer = e.target.getLayer();
              const pointer = layer?.getRelativePointerPosition();
              
              if (pointer) {
                const isGroup = selectedIds.length > 1;

                if (isGroup) {
                  // --- GROUP MODE: always rotate around the centroid ---
                  const selectedBoats = selectedIds
                    .map(id => useFormationStore.getState().punts.find(p => p.id === id))
                    .filter((b): b is typeof b & NonNullable<typeof b> => Boolean(b)) as (typeof punt)[];
                  const centroidX = selectedBoats.reduce((s, b) => s + b.x, 0) / selectedBoats.length;
                  const centroidY = selectedBoats.reduce((s, b) => s + b.y, 0) / selectedBoats.length;
                  const initialMouseAngle = Math.atan2(pointer.y - centroidY, pointer.x - centroidX) * 180 / Math.PI;
                  startDragState.current = {
                    x: centroidX, y: centroidY,
                    rotation: 0,
                    mouseAngleOffset: -initialMouseAngle,
                  };
                  const gData: typeof startDragState.current.groupData = {};
                  selectedIds.forEach((id) => {
                    const b = useFormationStore.getState().punts.find(p => p.id === id);
                    if (b) {
                      const dx = b.x - centroidX;
                      const dy = b.y - centroidY;
                      gData[id] = {
                        startX: b.x, startY: b.y, startRot: b.rotation,
                        radius: Math.sqrt(dx * dx + dy * dy),
                        startAlpha: Math.atan2(dy, dx) * 180 / Math.PI,
                      };
                    }
                  });
                  startDragState.current.groupData = gData;
                } else {
                  // --- SINGLE MODE: rotate around the right tip (stern handle) ---
                  const currentRad = (punt.rotation * Math.PI) / 180;
                  const rightTip = {
                    x: punt.x + (PUNT_WIDTH / 2) * Math.cos(currentRad),
                    y: punt.y + (PUNT_WIDTH / 2) * Math.sin(currentRad),
                  };
                  startDragState.current = {
                    x: rightTip.x, y: rightTip.y,
                    rotation: punt.rotation,
                    mouseAngleOffset: 0,
                  };
                }
              }
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const stage = e.target.getStage();
              const pointer = e.target.getLayer()?.getRelativePointerPosition();
              
              if (pointer) {
                const start = startDragState.current;
                const isGroup = selectedIds.length > 1;

                if (isGroup && stage) {
                  // GROUP MODE: rotate around centroid using unified angle formula
                  const currentMouseAngle = Math.atan2(pointer.y - start.y, pointer.x - start.x) * 180 / Math.PI;
                  let newRotDeg = (currentMouseAngle + start.mouseAngleOffset + 360) % 360;
                  if (snapToGrid) newRotDeg = Math.round(newRotDeg / 15) * 15;
                  const deltaRot = newRotDeg - start.rotation;

                  selectedIds.forEach((id) => {
                    const bData = start.groupData?.[id];
                    if (bData) {
                      const newAlphaRad = ((bData.startAlpha + deltaRot) * Math.PI) / 180;
                      let px = start.x + bData.radius * Math.cos(newAlphaRad);
                      let py = start.y + bData.radius * Math.sin(newAlphaRad);
                      let pr = (bData.startRot + deltaRot + 360) % 360;
                      if (snapToGrid) {
                        px = Math.round(px / 20) * 20;
                        py = Math.round(py / 20) * 20;
                        pr = Math.round(pr / 15) * 15;
                      }
                      const node = stage.findOne(`#${id}`) as Konva.Group;
                      if (node) {
                        node.x(px); node.y(py); node.rotation(pr);
                        lastGroupPositions.current[id] = { x: px, y: py, rotation: pr };
                      }
                    }
                  });
                  e.target.getLayer()?.batchDraw();
                } else {
                  // SINGLE MODE: rotate around right tip
                  const rightTip = startDragState.current;
                  const newRotRad = Math.atan2(rightTip.y - pointer.y, rightTip.x - pointer.x);
                  let newRotDeg = (newRotRad * 180) / Math.PI;
                  newRotDeg = (newRotDeg + 360) % 360;
                  if (snapToGrid) newRotDeg = Math.round(newRotDeg / 15) * 15;

                  const newCenterX = rightTip.x - (PUNT_WIDTH / 2) * Math.cos(newRotRad);
                  const newCenterY = rightTip.y - (PUNT_WIDTH / 2) * Math.sin(newRotRad);
                  const proposed = { x: newCenterX, y: newCenterY, rotation: newRotDeg, number: punt.number };
                  const allBoats = useFormationStore.getState().punts;
                  const resolved = resolveCollisionsEdgeToEdge(punt.id, proposed, allBoats);
                  let fx = resolved.x, fy = resolved.y;
                  if (snapToGrid) { fx = Math.round(fx / 20) * 20; fy = Math.round(fy / 20) * 20; }
                  onChange({ x: fx, y: fy, rotation: Math.round(newRotDeg) });
                }
              }
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              isRotating.current = false;
              e.target.x(12);
              e.target.y(PUNT_HEIGHT / 2);
              e.target.getLayer()?.batchDraw();

              if (selectedIds.length > 1) {
                Object.entries(lastGroupPositions.current).forEach(([id, pos]) => {
                  useFormationStore.getState().updatePunt(id, {
                    x: Math.round(pos.x),
                    y: Math.round(pos.y),
                    rotation: Math.round(pos.rotation)
                  });
                });
                useFormationStore.getState().commitHistory();
              } else {
                useFormationStore.getState().commitHistory();
              }
            }}
          />

          {/* 2. Center Dot (Center Pivot Handle) - Rotates around center */}
          <Circle
            x={PUNT_WIDTH / 2}
            y={PUNT_HEIGHT / 2}
            radius={4.5}
            fill="#ffffff"
            stroke="#10b981"
            strokeWidth={2}
            shadowColor="#10b981"
            shadowBlur={4}
            shadowOpacity={0.6}
            draggable={true}
            onMouseEnter={handleDotMouseEnter}
            onMouseLeave={handleDotMouseLeave}
            onDragStart={(e) => {
              e.cancelBubble = true;
              isRotating.current = true;
              lastGroupPositions.current = {};
              const layer = e.target.getLayer();
              const pointer = layer?.getRelativePointerPosition();
              
              if (pointer) {
                const isGroup = selectedIds.length > 1;

                if (isGroup) {
                  // --- GROUP MODE: always rotate around the centroid ---
                  const selectedBoats = selectedIds
                    .map(id => useFormationStore.getState().punts.find(p => p.id === id))
                    .filter((b): b is typeof b & NonNullable<typeof b> => Boolean(b)) as (typeof punt)[];
                  const centroidX = selectedBoats.reduce((s, b) => s + b.x, 0) / selectedBoats.length;
                  const centroidY = selectedBoats.reduce((s, b) => s + b.y, 0) / selectedBoats.length;
                  const initialMouseAngle = Math.atan2(pointer.y - centroidY, pointer.x - centroidX) * 180 / Math.PI;
                  startDragState.current = {
                    x: centroidX, y: centroidY,
                    rotation: 0,
                    mouseAngleOffset: -initialMouseAngle,
                  };
                  const gData: typeof startDragState.current.groupData = {};
                  selectedIds.forEach((id) => {
                    const b = useFormationStore.getState().punts.find(p => p.id === id);
                    if (b) {
                      const dx = b.x - centroidX;
                      const dy = b.y - centroidY;
                      gData[id] = {
                        startX: b.x, startY: b.y, startRot: b.rotation,
                        radius: Math.sqrt(dx * dx + dy * dy),
                        startAlpha: Math.atan2(dy, dx) * 180 / Math.PI,
                      };
                    }
                  });
                  startDragState.current.groupData = gData;
                } else {
                  // --- SINGLE MODE: rotate around this punt's center ---
                  const initialMouseAngle = Math.atan2(pointer.y - punt.y, pointer.x - punt.x) * 180 / Math.PI;
                  startDragState.current = {
                    x: punt.x, y: punt.y,
                    rotation: punt.rotation,
                    mouseAngleOffset: punt.rotation - initialMouseAngle,
                  };
                }
              }
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const stage = e.target.getStage();
              const pointer = e.target.getLayer()?.getRelativePointerPosition();
              
              if (pointer) {
                const start = startDragState.current;
                const currentMouseAngle = Math.atan2(pointer.y - start.y, pointer.x - start.x) * 180 / Math.PI;
                let newRotDeg = currentMouseAngle + start.mouseAngleOffset;
                newRotDeg = (newRotDeg + 360) % 360;
                
                if (snapToGrid) {
                  newRotDeg = Math.round(newRotDeg / 15) * 15;
                }

                const deltaRot = newRotDeg - startDragState.current.rotation;
                const isGroup = selectedIds.length > 1;

                if (isGroup && stage) {
                  selectedIds.forEach((id) => {
                    const bData = startDragState.current.groupData?.[id];
                    if (bData) {
                      const newAlphaRad = ((bData.startAlpha + deltaRot) * Math.PI) / 180;
                      let px = start.x + bData.radius * Math.cos(newAlphaRad);
                      let py = start.y + bData.radius * Math.sin(newAlphaRad);
                      let pr = (bData.startRot + deltaRot + 360) % 360;
                      
                      if (snapToGrid) {
                        px = Math.round(px / 20) * 20;
                        py = Math.round(py / 20) * 20;
                        pr = Math.round(pr / 15) * 15;
                      }

                      const node = stage.findOne(`#${id}`) as Konva.Group;
                      if (node) {
                        node.x(px);
                        node.y(py);
                        node.rotation(pr);
                        lastGroupPositions.current[id] = { x: px, y: py, rotation: pr };
                      }
                    }
                  });
                  e.target.getLayer()?.batchDraw();
                } else {
                  const proposed = {
                    x: start.x,
                    y: start.y,
                    rotation: newRotDeg,
                    number: punt.number
                  };
                  
                  const allBoats = useFormationStore.getState().punts;
                  const resolved = resolveCollisionsEdgeToEdge(punt.id, proposed, allBoats);
                  
                  let fx = resolved.x;
                  let fy = resolved.y;
                  if (snapToGrid) {
                    fx = Math.round(fx / 20) * 20;
                    fy = Math.round(fy / 20) * 20;
                  }

                  onChange({
                    x: fx,
                    y: fy,
                    rotation: Math.round(newRotDeg)
                  });
                }
              }
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              isRotating.current = false;
              e.target.x(PUNT_WIDTH / 2);
              e.target.y(PUNT_HEIGHT / 2);
              e.target.getLayer()?.batchDraw();

              if (selectedIds.length > 1) {
                Object.entries(lastGroupPositions.current).forEach(([id, pos]) => {
                  useFormationStore.getState().updatePunt(id, {
                    x: Math.round(pos.x),
                    y: Math.round(pos.y),
                    rotation: Math.round(pos.rotation)
                  });
                });
                useFormationStore.getState().commitHistory();
              } else {
                useFormationStore.getState().commitHistory();
              }
            }}
          />

          {/* 3. Right Dot (Bow Pivot Handle) - Rotates around Left Tip */}
          <Circle
            x={PUNT_WIDTH - 12}
            y={PUNT_HEIGHT / 2}
            radius={4.5}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={2}
            shadowColor="#3b82f6"
            shadowBlur={4}
            shadowOpacity={0.6}
            draggable={true}
            onMouseEnter={handleDotMouseEnter}
            onMouseLeave={handleDotMouseLeave}
            onDragStart={(e) => {
              e.cancelBubble = true;
              isRotating.current = true;
              lastGroupPositions.current = {};
              const layer = e.target.getLayer();
              const pointer = layer?.getRelativePointerPosition();
              
              if (pointer) {
                const isGroup = selectedIds.length > 1;

                if (isGroup) {
                  // --- GROUP MODE: always rotate around the centroid ---
                  const selectedBoats = selectedIds
                    .map(id => useFormationStore.getState().punts.find(p => p.id === id))
                    .filter((b): b is typeof b & NonNullable<typeof b> => Boolean(b)) as (typeof punt)[];
                  const centroidX = selectedBoats.reduce((s, b) => s + b.x, 0) / selectedBoats.length;
                  const centroidY = selectedBoats.reduce((s, b) => s + b.y, 0) / selectedBoats.length;
                  const initialMouseAngle = Math.atan2(pointer.y - centroidY, pointer.x - centroidX) * 180 / Math.PI;
                  startDragState.current = {
                    x: centroidX, y: centroidY,
                    rotation: 0,
                    mouseAngleOffset: -initialMouseAngle,
                  };
                  const gData: typeof startDragState.current.groupData = {};
                  selectedIds.forEach((id) => {
                    const b = useFormationStore.getState().punts.find(p => p.id === id);
                    if (b) {
                      const dx = b.x - centroidX;
                      const dy = b.y - centroidY;
                      gData[id] = {
                        startX: b.x, startY: b.y, startRot: b.rotation,
                        radius: Math.sqrt(dx * dx + dy * dy),
                        startAlpha: Math.atan2(dy, dx) * 180 / Math.PI,
                      };
                    }
                  });
                  startDragState.current.groupData = gData;
                } else {
                  // --- SINGLE MODE: rotate around the left tip (bow handle) ---
                  const currentRad = (punt.rotation * Math.PI) / 180;
                  const leftTip = {
                    x: punt.x - (PUNT_WIDTH / 2) * Math.cos(currentRad),
                    y: punt.y - (PUNT_WIDTH / 2) * Math.sin(currentRad),
                  };
                  startDragState.current = {
                    x: leftTip.x, y: leftTip.y,
                    rotation: punt.rotation,
                    mouseAngleOffset: 0,
                  };
                }
              }
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const stage = e.target.getStage();
              const pointer = e.target.getLayer()?.getRelativePointerPosition();
              
              if (pointer) {
                const start = startDragState.current;
                const isGroup = selectedIds.length > 1;

                if (isGroup && stage) {
                  // GROUP MODE: rotate around centroid using unified angle formula
                  const currentMouseAngle = Math.atan2(pointer.y - start.y, pointer.x - start.x) * 180 / Math.PI;
                  let newRotDeg = (currentMouseAngle + start.mouseAngleOffset + 360) % 360;
                  if (snapToGrid) newRotDeg = Math.round(newRotDeg / 15) * 15;
                  const deltaRot = newRotDeg - start.rotation;

                  selectedIds.forEach((id) => {
                    const bData = start.groupData?.[id];
                    if (bData) {
                      const newAlphaRad = ((bData.startAlpha + deltaRot) * Math.PI) / 180;
                      let px = start.x + bData.radius * Math.cos(newAlphaRad);
                      let py = start.y + bData.radius * Math.sin(newAlphaRad);
                      let pr = (bData.startRot + deltaRot + 360) % 360;
                      if (snapToGrid) {
                        px = Math.round(px / 20) * 20;
                        py = Math.round(py / 20) * 20;
                        pr = Math.round(pr / 15) * 15;
                      }
                      const node = stage.findOne(`#${id}`) as Konva.Group;
                      if (node) {
                        node.x(px); node.y(py); node.rotation(pr);
                        lastGroupPositions.current[id] = { x: px, y: py, rotation: pr };
                      }
                    }
                  });
                  e.target.getLayer()?.batchDraw();
                } else {
                  // SINGLE MODE: rotate around left tip
                  const leftTip = startDragState.current;
                  const newRotRad = Math.atan2(pointer.y - leftTip.y, pointer.x - leftTip.x);
                  let newRotDeg = (newRotRad * 180) / Math.PI;
                  newRotDeg = (newRotDeg + 360) % 360;
                  if (snapToGrid) newRotDeg = Math.round(newRotDeg / 15) * 15;

                  const newCenterX = leftTip.x + (PUNT_WIDTH / 2) * Math.cos(newRotRad);
                  const newCenterY = leftTip.y + (PUNT_WIDTH / 2) * Math.sin(newRotRad);
                  const proposed = { x: newCenterX, y: newCenterY, rotation: newRotDeg, number: punt.number };
                  const allBoats = useFormationStore.getState().punts;
                  const resolved = resolveCollisionsEdgeToEdge(punt.id, proposed, allBoats);
                  let fx = resolved.x, fy = resolved.y;
                  if (snapToGrid) { fx = Math.round(fx / 20) * 20; fy = Math.round(fy / 20) * 20; }
                  onChange({ x: fx, y: fy, rotation: Math.round(newRotDeg) });
                }
              }
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              isRotating.current = false;
              e.target.x(PUNT_WIDTH - 12);
              e.target.y(PUNT_HEIGHT / 2);
              e.target.getLayer()?.batchDraw();

              if (selectedIds.length > 1) {
                Object.entries(lastGroupPositions.current).forEach(([id, pos]) => {
                  useFormationStore.getState().updatePunt(id, {
                    x: Math.round(pos.x),
                    y: Math.round(pos.y),
                    rotation: Math.round(pos.rotation)
                  });
                });
                useFormationStore.getState().commitHistory();
              } else {
                useFormationStore.getState().commitHistory();
              }
            }}
          />
        </>
      )}
    </Group>
  );
};
