import { getPuntDimensions } from './sizes';

export interface Box {
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
  rotation: number; // in degrees
}

interface Vector2D {
  x: number;
  y: number;
}

// Get the 4 corners of a rotated box
function getCorners(box: Box): Vector2D[] {
  const { x, y, width, height, rotation } = box;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const halfW = width / 2;
  const halfH = height / 2;

  const localCorners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];

  return localCorners.map((corner) => ({
    x: x + corner.x * cos - corner.y * sin,
    y: y + corner.x * sin + corner.y * cos,
  }));
}

// Get perpendicular axes for SAT
function getAxes(corners: Vector2D[]): Vector2D[] {
  const axes: Vector2D[] = [];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    // Normal (perpendicular) vector
    const normal = { x: -edge.y, y: edge.x };
    // Normalize normal vector
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    axes.push({ x: normal.x / length, y: normal.y / length });
  }
  return axes;
}

// Project corners onto an axis
function project(corners: Vector2D[], axis: Vector2D): { min: number; max: number } {
  let min = corners[0].x * axis.x + corners[0].y * axis.y;
  let max = min;
  for (let i = 1; i < corners.length; i++) {
    const projection = corners[i].x * axis.x + corners[i].y * axis.y;
    if (projection < min) min = projection;
    if (projection > max) max = projection;
  }
  return { min, max };
}

// Check if two boxes overlap using Separating Axis Theorem (SAT)
export function checkOverlap(boxA: Box, boxB: Box): boolean {
  const cornersA = getCorners(boxA);
  const cornersB = getCorners(boxB);

  const axes = [...getAxes(cornersA), ...getAxes(cornersB)];

  for (const axis of axes) {
    const projA = project(cornersA, axis);
    const projB = project(cornersB, axis);

    // If there is a gap, they do not overlap
    if (projA.max < projB.min || projB.max < projA.min) {
      return false;
    }
  }

  return true;
}

// Calculate the Minimum Translation Vector (MTV) to push boxA out of boxB
export function getCollisionMTV(boxA: Box, boxB: Box): Vector2D | null {
  const cornersA = getCorners(boxA);
  const cornersB = getCorners(boxB);

  const axes = [...getAxes(cornersA), ...getAxes(cornersB)];
  let minOverlap = Infinity;
  let minAxis: Vector2D = { x: 0, y: 0 };

  for (const axis of axes) {
    const projA = project(cornersA, axis);
    const projB = project(cornersB, axis);

    // If there is a gap, they do not overlap
    if (projA.max < projB.min || projB.max < projA.min) {
      return null;
    }

    const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      minAxis = axis;
    }
  }

  // Ensure MTV points from B to A (to push A out of B)
  const vectorBA = { x: boxA.x - boxB.x, y: boxA.y - boxB.y };
  const dot = vectorBA.x * minAxis.x + vectorBA.y * minAxis.y;
  if (dot < 0) {
    minAxis.x = -minAxis.x;
    minAxis.y = -minAxis.y;
  }

  // Add a minute extra push back (0.05 px) to avoid floating point precision overlap remaining
  const epsilon = 0.05;

  return {
    x: minAxis.x * (minOverlap + epsilon),
    y: minAxis.y * (minOverlap + epsilon),
  };
}

// Check if a boat at a proposed position overlaps with any other boats
export function hasOverlapWithOthers(
  targetId: string,
  proposed: { x: number; y: number; rotation: number; number: number },
  allBoats: { id: string; number: number; x: number; y: number; rotation: number }[]
): boolean {
  const targetDims = getPuntDimensions(proposed.number);
  const boxA: Box = {
    x: proposed.x,
    y: proposed.y,
    width: targetDims.length,
    height: targetDims.width,
    rotation: proposed.rotation,
  };

  for (const boat of allBoats) {
    if (boat.id === targetId) continue;

    const boatDims = getPuntDimensions(boat.number);
    const boxB: Box = {
      x: boat.x,
      y: boat.y,
      width: boatDims.length,
      height: boatDims.width,
      rotation: boat.rotation,
    };

    if (checkOverlap(boxA, boxB)) {
      return true;
    }
  }

  return false;
}

// Resolve collisions by nudging the proposed boat perfectly edge-to-edge
// using the Minimum Translation Vector (MTV)
export function resolveCollisionsEdgeToEdge(
  targetId: string,
  proposed: { x: number; y: number; rotation: number; number: number },
  allBoats: { id: string; number: number; x: number; y: number; rotation: number }[]
): { x: number; y: number; resolved: boolean } {
  let currentPos = { x: proposed.x, y: proposed.y };
  let resolved = false;

  const targetDims = getPuntDimensions(proposed.number);

  // Max 4 iterations to handle multi-object corner pinning/sliding
  for (let iter = 0; iter < 4; iter++) {
    let collisionDetected = false;
    const boxA: Box = {
      x: currentPos.x,
      y: currentPos.y,
      width: targetDims.length,
      height: targetDims.width,
      rotation: proposed.rotation,
    };

    for (const boat of allBoats) {
      if (boat.id === targetId) continue;

      const boatDims = getPuntDimensions(boat.number);
      const boxB: Box = {
        x: boat.x,
        y: boat.y,
        width: boatDims.length,
        height: boatDims.width,
        rotation: boat.rotation,
      };

      const mtv = getCollisionMTV(boxA, boxB);
      if (mtv) {
        // Push currentPos out of collision
        currentPos.x += mtv.x;
        currentPos.y += mtv.y;
        collisionDetected = true;
        resolved = true;
        break; // Break and re-check with new pos in next iteration
      }
    }

    if (!collisionDetected) {
      // Clean exit: No more collisions!
      break;
    }
  }

  return {
    x: Math.round(currentPos.x),
    y: Math.round(currentPos.y),
    resolved,
  };
}
