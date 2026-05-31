export type PuntColor = 'red' | 'yellow' | 'green' | 'off';

export interface PuntData {
  id: string;
  number: number;
  x: number;
  y: number;
  rotation: number;
  color: PuntColor;
  colorFront: PuntColor;
  colorBack: PuntColor;
}

export interface Formation {
  id: string;
  name: string;
  createdBy?: string;
  punts: PuntData[];
  scenes: Scene[];
  createdAt: number;
}

export interface Scene {
  id: string;
  name: string;
  duration: number;
  punts: PuntData[];
}

/** A Theme is a named project. It owns all the shapes (scenes) made in its workspace. */
export interface Theme {
  id: string;
  name: string;
  createdAt: number;
  shapes: Scene[];          // shapes (punt formations) built inside this theme
  currentPunts: PuntData[]; // last workspace punt state
  formations?: Formation[]; // theme-specific custom presets/layout library
}

