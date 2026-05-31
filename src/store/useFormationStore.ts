import { create } from 'zustand';
import type { PuntData, Formation } from './types';
import { v4 as uuidv4 } from 'uuid';
import { getPresetCoordinates } from '../utils/presets';
import type { PresetType } from '../utils/presets';
// Lazy import to avoid circular deps – accessed at call time via getState()
import { useTimelineStore } from './useTimelineStore';

const generateInitialPunts = (): PuntData[] => {
  const punts: PuntData[] = [];
  const rows = 4;
  const cols = 4;
  const spacingX = 160;
  const spacingY = 80;
  const startX = -((cols - 1) * spacingX) / 2;
  const startY = -((rows - 1) * spacingY) / 2;

  let count = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      punts.push({
        id: uuidv4(),
        number: count++,
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        rotation: 0,
        color: 'off',
        colorFront: 'off',
        colorBack: 'off',
      });
    }
  }
  return punts;
};

// Local storage keys
const FORMATIONS_KEY = 'punt_designer_formations';
const DRAFT_KEY = 'punt_designer_draft_punts';

const loadSavedFormations = (): Formation[] => {
  try {
    const data = localStorage.getItem(FORMATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load formations', e);
    return [];
  }
};

const loadDraftPunts = (): PuntData[] | null => {
  try {
    const data = localStorage.getItem(DRAFT_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load draft', e);
    return null;
  }
};

interface FormationState {
  punts: PuntData[];
  history: PuntData[][];
  historyIndex: number;
  savedFormations: Formation[];
  
  // Basic operations
  setPunts: (punts: PuntData[]) => void;
  updatePunt: (id: string, data: Partial<PuntData>) => void;
  updatePunts: (ids: string[], data: Partial<PuntData>) => void;
  updatePuntsData: (updates: { id: string; data: Partial<PuntData> }[]) => void;
  resetPunts: () => void;
  clearAllPunts: () => void;
  addPuntByNumber: (number: number) => void;
  removePunts: (ids: string[]) => void;
  centerPunts: () => void;
  randomizePunts: () => void;
  applyPreset: (type: PresetType) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  commitHistory: () => void;
  
  // Library operations
  saveFormation: (name: string, createdBy?: string) => void;
  overwriteFormation: (id: string) => void;
  deleteFormation: (id: string) => void;
  loadFormation: (id: string) => void;
  duplicateFormation: (id: string) => void;
  renameFormation: (id: string, name: string) => void;
  loadFormations: (formations: Formation[]) => void;
}

export const useFormationStore = create<FormationState>((set, get) => {
  const initialPunts = loadDraftPunts() || generateInitialPunts();
  const savedFormations = loadSavedFormations();

  const saveDraft = (punts: PuntData[]) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(punts));
  };

  return {
    punts: initialPunts,
    history: [JSON.parse(JSON.stringify(initialPunts))],
    historyIndex: 0,
    savedFormations,

    commitHistory: () => {
      const { punts, history, historyIndex } = get();
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(punts)));
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
      saveDraft(punts);
    },

    setPunts: (newPunts) => {
      set({ punts: newPunts });
      get().commitHistory();
    },

    updatePunt: (id, data) => {
      set((state) => {
        const nextPunts = state.punts.map(p => p.id === id ? { ...p, ...data } : p);
        saveDraft(nextPunts);
        return { punts: nextPunts };
      });
    },

    updatePunts: (ids, data) => {
      set((state) => {
        const nextPunts = state.punts.map(p => ids.includes(p.id) ? { ...p, ...data } : p);
        saveDraft(nextPunts);
        return { punts: nextPunts };
      });
      get().commitHistory();
    },

    updatePuntsData: (updates) => {
      set((state) => {
        const nextPunts = state.punts.map((p) => {
          const up = updates.find((u) => u.id === p.id);
          return up ? { ...p, ...up.data } : p;
        });
        saveDraft(nextPunts);
        return { punts: nextPunts };
      });
    },

    resetPunts: () => {
      const initial = generateInitialPunts();
      set({ punts: initial });
      get().commitHistory();
    },

    clearAllPunts: () => {
      set({ punts: [] });
      get().commitHistory();
    },

    addPuntByNumber: (num) => {
      const exists = get().punts.some(p => p.number === num);
      if (exists) return;
      
      const newPunt: PuntData = {
        id: uuidv4(),
        number: num,
        x: 0,
        y: 0,
        rotation: 0,
        color: 'off',
        colorFront: 'off',
        colorBack: 'off',
      };
      set((state) => ({ punts: [...state.punts, newPunt] }));
      get().commitHistory();
    },

    removePunts: (ids) => {
      set((state) => ({ punts: state.punts.filter(p => !ids.includes(p.id)) }));
      get().commitHistory();
    },

    centerPunts: () => {
      const punts = get().punts;
      if (punts.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      punts.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      
      const centered = punts.map(p => ({ ...p, x: p.x - cx, y: p.y - cy }));
      set({ punts: centered });
      get().commitHistory();
    },

    randomizePunts: () => {
      const randomized = get().punts.map(p => ({
        ...p,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        rotation: Math.round(Math.random() * 360)
      }));
      set({ punts: randomized });
      get().commitHistory();
    },

    applyPreset: (type) => {
      const coords = getPresetCoordinates(type);
      const newPunts = Array.from({ length: 16 }, (_, i) => {
        const num = i + 1;
        const existing = get().punts.find(p => p.number === num);
        return {
          id: existing?.id || uuidv4(),
          number: num,
          x: coords[i].x,
          y: coords[i].y,
          rotation: coords[i].rotation,
          color: existing?.color || 'off',
          colorFront: existing?.colorFront || 'off',
          colorBack: existing?.colorBack || 'off',
        };
      });
      set({ punts: newPunts });
      get().commitHistory();
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex > 0) {
        const prevPunts = JSON.parse(JSON.stringify(history[historyIndex - 1]));
        set({
          historyIndex: historyIndex - 1,
          punts: prevPunts
        });
        saveDraft(prevPunts);
      }
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex < history.length - 1) {
        const nextPunts = JSON.parse(JSON.stringify(history[historyIndex + 1]));
        set({
          historyIndex: historyIndex + 1,
          punts: nextPunts
        });
        saveDraft(nextPunts);
      }
    },

    saveFormation: (name, createdBy) => {
      const { punts, savedFormations } = get();
      // Also capture the current timeline scenes
      const scenes = useTimelineStore.getState().scenes;
      const newFormation: Formation = {
        id: uuidv4(),
        name,
        createdBy: createdBy || undefined,
        punts: JSON.parse(JSON.stringify(punts)),
        scenes: JSON.parse(JSON.stringify(scenes)),
        createdAt: Date.now()
      };
      const updated = [...savedFormations, newFormation];
      set({ savedFormations: updated });
      localStorage.setItem(FORMATIONS_KEY, JSON.stringify(updated));
    },

    overwriteFormation: (id) => {
      const { punts, savedFormations } = get();
      const scenes = useTimelineStore.getState().scenes;
      const updated = savedFormations.map(f => {
        if (f.id === id) {
          return {
            ...f,
            punts: JSON.parse(JSON.stringify(punts)),
            scenes: JSON.parse(JSON.stringify(scenes)),
            createdAt: Date.now()
          };
        }
        return f;
      });
      set({ savedFormations: updated });
      localStorage.setItem(FORMATIONS_KEY, JSON.stringify(updated));
    },

    deleteFormation: (id) => {
      const { savedFormations } = get();
      const updated = savedFormations.filter(f => f.id !== id);
      set({ savedFormations: updated });
      localStorage.setItem(FORMATIONS_KEY, JSON.stringify(updated));
    },

    loadFormation: (id) => {
      const { savedFormations } = get();
      const target = savedFormations.find(f => f.id === id);
      if (target) {
        // Restore punts
        set({ punts: JSON.parse(JSON.stringify(target.punts)) });
        get().commitHistory();
        // Restore timeline scenes (graceful fallback for old saves without scenes)
        const savedScenes = target.scenes ?? [];
        const firstId = savedScenes.length > 0 ? savedScenes[0].id : null;
        useTimelineStore.getState().loadScenes(savedScenes, firstId);
      }
    },

    duplicateFormation: (id) => {
      const { savedFormations } = get();
      const target = savedFormations.find(f => f.id === id);
      if (target) {
        const copy: Formation = {
          id: uuidv4(),
          name: `${target.name} (Copy)`,
          punts: JSON.parse(JSON.stringify(target.punts)),
          createdAt: Date.now()
        };
        const updated = [...savedFormations, copy];
        set({ savedFormations: updated });
        localStorage.setItem(FORMATIONS_KEY, JSON.stringify(updated));
      }
    },

    renameFormation: (id, name) => {
      const { savedFormations } = get();
      const updated = savedFormations.map(f => f.id === id ? { ...f, name } : f);
      set({ savedFormations: updated });
      localStorage.setItem(FORMATIONS_KEY, JSON.stringify(updated));
    },

    loadFormations: (formations) => {
      const copied = JSON.parse(JSON.stringify(formations)) as Formation[];
      set({ savedFormations: copied });
    }
  };
});
