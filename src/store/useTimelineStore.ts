import { create } from 'zustand';
import type { Scene, PuntData } from './types';
import { v4 as uuidv4 } from 'uuid';

const TIMELINE_KEY = 'punt_designer_timeline';

const saveTimeline = (scenes: Scene[], activeSceneId: string | null) => {
  try {
    localStorage.setItem(TIMELINE_KEY, JSON.stringify({ scenes, activeSceneId }));
  } catch (e) {
    console.error('Failed to save timeline', e);
  }
};

const loadTimeline = (): { scenes: Scene[]; activeSceneId: string | null } => {
  try {
    const data = localStorage.getItem(TIMELINE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.scenes)) {
        const cleanedScenes = parsed.scenes.filter((s: Scene) => 
          !s.name.includes('(4x4 Grid)') && 
          !s.name.includes('(Octagon Star)') && 
          !s.name.includes('(Circle Gate)')
        );
        const hasPredefined = parsed.scenes.length !== cleanedScenes.length;
        const nextActive = hasPredefined
          ? (cleanedScenes.length > 0 ? cleanedScenes[0].id : null)
          : parsed.activeSceneId;
        return { scenes: cleanedScenes, activeSceneId: nextActive };
      }
    }
  } catch (e) {
    console.error('Failed to load timeline', e);
  }
  return { scenes: [], activeSceneId: null };
};

interface TimelineState {
  scenes: Scene[];
  activeSceneId: string | null;
  isPlaying: boolean;
  playbackProgress: number;
  playFromIndex: number;
  playToIndex: number;
  
  // Actions
  addScene: (punts: PuntData[]) => void;
  deleteScene: (id: string) => void;
  updateScene: (id: string, punts: PuntData[]) => void;
  selectScene: (id: string) => void;
  updateSceneDuration: (id: string, duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackProgress: (progress: number) => void;
  setPlayIndices: (from: number, to: number) => void;
  clearTimeline: () => void;
  loadScenes: (scenes: Scene[], activeSceneId: string | null) => void;
}

const saved = loadTimeline();

export const useTimelineStore = create<TimelineState>((set) => ({
  scenes: saved.scenes,
  activeSceneId: saved.activeSceneId,
  isPlaying: false,
  playbackProgress: 0,
  playFromIndex: 0,
  playToIndex: 0,

  addScene: (punts) => set((state) => {
    const newScene: Scene = {
      id: uuidv4(),
      name: `Shape ${state.scenes.length + 1}`,
      duration: 2.0, // Default 2 seconds transition
      punts: JSON.parse(JSON.stringify(punts)),
    };
    const updated = [...state.scenes, newScene];
    const nextActive = state.activeSceneId || newScene.id;
    saveTimeline(updated, nextActive);
    return {
      scenes: updated,
      activeSceneId: nextActive,
    };
  }),

  deleteScene: (id) => set((state) => {
    const updated = state.scenes.filter(s => s.id !== id);
    // Rename scenes sequentially
    const renamed = updated.map((s, idx) => ({
      ...s,
      name: `Shape ${idx + 1}`
    }));
    let nextActive = state.activeSceneId;
    if (state.activeSceneId === id) {
      nextActive = renamed.length > 0 ? renamed[0].id : null;
    }
    saveTimeline(renamed, nextActive);
    return {
      scenes: renamed,
      activeSceneId: nextActive,
    };
  }),

  updateScene: (id, punts) => set((state) => {
    const updated = state.scenes.map(s =>
      s.id === id ? { ...s, punts: JSON.parse(JSON.stringify(punts)) } : s
    );
    saveTimeline(updated, state.activeSceneId);
    return { scenes: updated };
  }),

  selectScene: (id) => {
    set((state) => {
      saveTimeline(state.scenes, id);
      return { activeSceneId: id, isPlaying: false, playbackProgress: 0 };
    });
  },

  updateSceneDuration: (id, duration) => set((state) => {
    const updated = state.scenes.map(s =>
      s.id === id ? { ...s, duration: Math.max(0.1, duration) } : s
    );
    saveTimeline(updated, state.activeSceneId);
    return { scenes: updated };
  }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackProgress: (progress) => set({ playbackProgress: progress }),
  setPlayIndices: (from, to) => set({ playFromIndex: from, playToIndex: to }),

  clearTimeline: () => {
    saveTimeline([], null);
    set({ scenes: [], activeSceneId: null, isPlaying: false, playbackProgress: 0 });
  },

  loadScenes: (scenes, activeSceneId) => {
    const copied = JSON.parse(JSON.stringify(scenes)) as Scene[];
    saveTimeline(copied, activeSceneId);
    set({ scenes: copied, activeSceneId, isPlaying: false, playbackProgress: 0 });
  },
}));
