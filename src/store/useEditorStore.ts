import { create } from 'zustand';

interface EditorState {
  theme: 'dark' | 'light';
  showLabels: boolean;
  showOutlines: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  selectedIds: string[];
  tool: 'select' | 'hand';
  collisionWarning: string;
  syncStatus: 'disconnected' | 'connecting' | 'connected';
  activeDragPunt: { id: string; x: number; y: number } | null;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleLabels: () => void;
  toggleOutlines: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  clearSelection: () => void;
  setTool: (tool: 'select' | 'hand') => void;
  showCollisionWarning: (msg: string) => void;
  setActiveDragPunt: (drag: { id: string; x: number; y: number } | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  theme: 'dark',
  showLabels: true,
  showOutlines: true,
  showGrid: true,
  snapToGrid: false,
  selectedIds: [],
  tool: 'select',
  collisionWarning: '',
  syncStatus: 'disconnected',
  activeDragPunt: null,
  setTheme: (theme) => set({ theme }),
  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  toggleOutlines: () => set((state) => ({ showOutlines: !state.showOutlines })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setSelectedIds: (idsOrUpdater) => set((state) => {
    const nextSelected = typeof idsOrUpdater === 'function' ? idsOrUpdater(state.selectedIds) : idsOrUpdater;
    return { selectedIds: nextSelected };
  }),
  clearSelection: () => set({ selectedIds: [] }),
  setTool: (tool) => set({ tool }),
  setActiveDragPunt: (activeDragPunt) => set({ activeDragPunt }),
  showCollisionWarning: (msg) => {
    set({ collisionWarning: msg });
    setTimeout(() => {
      set((state) => {
        if (state.collisionWarning === msg) {
          return { collisionWarning: '' };
        }
        return {};
      });
    }, 2500);
  }
}));

