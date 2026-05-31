import { create } from 'zustand';
import type { Theme, Scene, PuntData } from './types';
import { v4 as uuidv4 } from 'uuid';

const THEMES_KEY    = 'punt_designer_themes';
const TIMELINE_KEY  = 'punt_designer_timeline';   // old global timeline
const DRAFT_KEY     = 'punt_designer_draft_punts'; // old workspace punts

// ── persistence ────────────────────────────────────────────────────────────

const persist = (themes: Theme[]) => {
  try { localStorage.setItem(THEMES_KEY, JSON.stringify(themes)); } catch { /* */ }
};

// ── one-time migration & recovery: pull existing timeline → Punya Nagari theme ──

const migrateExistingShapes = (themes: Theme[]): Theme[] => {
  // First, clean up any predefined seeded shapes from all themes
  let cleanedThemes = themes.map(t => {
    const nextShapes = t.shapes.filter(s => 
      !s.name.includes('(4x4 Grid)') && 
      !s.name.includes('(Octagon Star)') && 
      !s.name.includes('(Circle Gate)')
    );
    if (nextShapes.length !== t.shapes.length) {
      return { ...t, shapes: nextShapes };
    }
    return t;
  });

  const hadPredefined = themes.some(t => 
    t.shapes.some(s => 
      s.name.includes('(4x4 Grid)') || 
      s.name.includes('(Octagon Star)') || 
      s.name.includes('(Circle Gate)')
    )
  );
  if (hadPredefined) {
    persist(cleanedThemes);
    themes = cleanedThemes;
  }

  const punyaNagari = themes.find(t => t.name === 'Punya Nagari');
  
  // Recovery: If another theme has shapes and "Punya Nagari" has 0 shapes, copy them to Punya Nagari and clean the other theme!
  if (punyaNagari && punyaNagari.shapes.length === 0) {
    const otherThemeWithShapes = themes.find(t => t.name !== 'Punya Nagari' && t.shapes.length > 0);
    if (otherThemeWithShapes) {
      const updated = themes.map(t => {
        if (t.name === 'Punya Nagari') {
          return {
            ...t,
            shapes: JSON.parse(JSON.stringify(otherThemeWithShapes.shapes)),
            currentPunts: JSON.parse(JSON.stringify(otherThemeWithShapes.currentPunts)),
            formations: JSON.parse(JSON.stringify(otherThemeWithShapes.formations ?? [])),
          };
        }
        if (t.id === otherThemeWithShapes.id) {
          // Clear shapes and formations from the other theme so it is clean
          return { ...t, shapes: [], currentPunts: [], formations: [] };
        }
        return t;
      });
      persist(updated);
      return updated;
    }
  }

  // Only migrate if NO theme has shapes yet (first run with new system)
  const anyHasShapes = themes.some(t => t.shapes.length > 0);
  if (anyHasShapes) return themes;

  try {
    const raw = localStorage.getItem(TIMELINE_KEY);
    if (!raw) {
      // If no timeline in storage at all, let's create a clean "Punya Nagari" theme!
      if (themes.length === 0) {
        const newTheme: Theme = {
          id: uuidv4(),
          name: 'Punya Nagari',
          createdAt: Date.now(),
          shapes: [],
          currentPunts: [],
          formations: [],
        };
        const initialThemes = [newTheme];
        persist(initialThemes);
        return initialThemes;
      }
      return themes;
    }
    
    const parsed = JSON.parse(raw);
    let scenes: Scene[] = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    scenes = scenes.filter(s => 
      !s.name.includes('(4x4 Grid)') && 
      !s.name.includes('(Octagon Star)') && 
      !s.name.includes('(Circle Gate)')
    );
    
    // Also grab last workspace punts
    let currentPunts: PuntData[] = [];
    try {
      const draftRaw = localStorage.getItem(DRAFT_KEY);
      if (draftRaw) currentPunts = JSON.parse(draftRaw);
    } catch { /* */ }

    if (themes.length === 0) {
      // Create Punya Nagari theme as the migrated container
      const newTheme: Theme = {
        id: uuidv4(),
        name: 'Punya Nagari',
        createdAt: Date.now(),
        shapes: scenes,
        currentPunts,
        formations: [],
      };
      const initialThemes = [newTheme];
      persist(initialThemes);
      return initialThemes;
    }

    // Otherwise, inject into the first theme and ensure it is named/renamed if empty or generic
    const updated = themes.map((t, i) =>
      i === 0 ? { ...t, name: t.name === 'New Theme' || t.name === 'Untitled' ? 'Punya Nagari' : t.name, shapes: scenes, currentPunts } : t
    );
    persist(updated);
    return updated;
  } catch {
    // If error loading or parsing, create a clean "Punya Nagari" if themes is empty
    if (themes.length === 0) {
      const newTheme: Theme = {
        id: uuidv4(),
        name: 'Punya Nagari',
        createdAt: Date.now(),
        shapes: [],
        currentPunts: [],
        formations: [],
      };
      const initialThemes = [newTheme];
      persist(initialThemes);
      return initialThemes;
    }
    return themes;
  }
};


const loadThemes = (): Theme[] => {
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    const themes = raw ? (JSON.parse(raw) as Theme[]) : [];
    return migrateExistingShapes(themes);
  } catch {
    // If error loading, still attempt migrating if possible
    return migrateExistingShapes([]);
  }
};

// ── store ──────────────────────────────────────────────────────────────────

interface ThemeState {
  themes: Theme[];
  activeThemeId: string | null;

  createTheme: (name: string) => Theme;
  deleteTheme: (id: string) => void;
  renameTheme: (id: string, name: string) => void;
  setActiveTheme: (id: string | null) => void;

  /** Auto-called whenever workspace changes — saves shapes + punts + formations library to active theme. */
  saveCurrentState: (shapes: Scene[], currentPunts: PuntData[], formations: any[]) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themes: loadThemes(),
  activeThemeId: null,

  createTheme: (name) => {
    const newTheme: Theme = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      shapes: [],
      currentPunts: [],
      formations: [],
    };
    const updated = [...get().themes, newTheme];
    set({ themes: updated });
    persist(updated);
    return newTheme;
  },

  deleteTheme: (id) => {
    const updated = get().themes.filter(t => t.id !== id);
    const nextActive = get().activeThemeId === id ? null : get().activeThemeId;
    set({ themes: updated, activeThemeId: nextActive });
    persist(updated);
  },

  renameTheme: (id, name) => {
    const updated = get().themes.map(t => t.id === id ? { ...t, name } : t);
    set({ themes: updated });
    persist(updated);
  },

  setActiveTheme: (id) => set({ activeThemeId: id }),

  saveCurrentState: (shapes, currentPunts, formations) => {
    const { activeThemeId, themes } = get();
    if (!activeThemeId) return;
    const updated = themes.map(t =>
      t.id === activeThemeId
        ? {
            ...t,
            shapes: JSON.parse(JSON.stringify(shapes)),
            currentPunts: JSON.parse(JSON.stringify(currentPunts)),
            formations: JSON.parse(JSON.stringify(formations)),
          }
        : t
    );
    set({ themes: updated });
    persist(updated);
  },
}));
