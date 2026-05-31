export type PresetType = 'octagon_star';

export const getPresetCoordinates = (type: PresetType): { x: number; y: number; rotation: number }[] => {
  const points: { x: number; y: number; rotation: number }[] = [];
  const numPunts = 16;

  if (type === 'octagon_star') {
    // Punts 1 to 8: 8-pointed star in the center
    // All 8 boats are placed radially, pointing outwards.
    // Their outer tips align perfectly at radius 160px.
    // Since P1, P3-P8 have length 140px, their center radius is 160 - 70 = 90px.
    // P2 has length 130px, so its center radius is 160 - 65 = 95px.
    const starOuterR = 160;
    for (let i = 0; i < 8; i++) {
      const angleDeg = i * 45;
      const angleRad = (angleDeg * Math.PI) / 180;
      
      const length = i === 1 ? 130 : 140; // P2 (index 1) is 130px, others are 140px
      const centerR = starOuterR - length / 2;
      
      points.push({
        x: centerR * Math.cos(angleRad),
        y: centerR * Math.sin(angleRad),
        rotation: angleDeg, // Pointing outwards radially
      });
    }

    // Punts 9 to 16: Outer octagon joining the outer tips of the star
    // The outer tips are at radius 160px at angles 0, 45, 90, ..., 315.
    // The 8 outer boats bridge these tips, placed at mid-angles (22.5, 67.5, ...)
    // and a radius of 160 * cos(22.5 deg) = 147.8px.
    // They are rotated tangentially (angle + 90 deg) to form a perfectly closed octagon.
    const midAngleOffset = 22.5;
    const octagonR = starOuterR * Math.cos((midAngleOffset * Math.PI) / 180); // ~147.82 px
    for (let i = 0; i < 8; i++) {
      const angleDeg = i * 45 + midAngleOffset;
      const angleRad = (angleDeg * Math.PI) / 180;
      
      points.push({
        x: octagonR * Math.cos(angleRad),
        y: octagonR * Math.sin(angleRad),
        rotation: angleDeg + 90, // Tangent to form the octagon edge
      });
    }
  }

  // Fallback if needed
  while (points.length < numPunts) {
    points.push({ x: 0, y: 0, rotation: 0 });
  }

  return points.slice(0, numPunts);
};

