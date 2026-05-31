import { useEffect, useState, useRef } from 'react';
import { StageArea } from './components/StageArea';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { HomePage } from './components/HomePage';
import { MobileThemeViewer } from './components/MobileThemeViewer';
import { useEditorStore } from './store/useEditorStore';
import { useFormationStore } from './store/useFormationStore';
import { useTimelineStore } from './store/useTimelineStore';
import { useThemeStore } from './store/useThemeStore';
import { resolveCollisionsEdgeToEdge } from './utils/collision';
import { v4 as uuidv4 } from 'uuid';
import { connect as ittySockConnect } from 'itty-sockets';
import type { PuntData, Theme } from './store/types';
import {
  Undo2, Redo2, Palette, MousePointer, Hand,
  Sun, Moon, Sparkles, AlertCircle, Home
} from 'lucide-react';
import type { PuntColor } from './store/types';

function App() {
  const { punts, updatePunt, updatePuntsData, commitHistory, undo, redo, setPunts, savedFormations } = useFormationStore();
  const {
    theme, setTheme, tool, setTool, selectedIds,
    collisionWarning, showCollisionWarning
  } = useEditorStore();
  const { scenes } = useTimelineStore();
  const { setActiveTheme, saveCurrentState, activeThemeId, themes } = useThemeStore();

  const [activeHalf, setActiveHalf] = useState<'both' | 'front' | 'back'>('both');
  const [page, setPage] = useState<'home' | 'editor'>('home');
  const lastThemeIdRef = useRef<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [activeUserCount, setActiveUserCount] = useState(1);

  // ── Real-time tab/window & cross-device presence & sync using dual channels ──
  useEffect(() => {
    if (!activeThemeId || page !== 'editor') {
      setActiveUserCount(1);
      return;
    }

    const activeTheme = useThemeStore.getState().themes.find(t => t.id === activeThemeId);
    if (!activeTheme) return;

    // Use name-based key to align PC and mobile devices (which might have differing local UUIDs)
    const channelKey = activeTheme.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const tabId = uuidv4();
    const channel = new BroadcastChannel('theme_presence_' + channelKey);
    
    // Request initial state synchronization from other tabs locally
    const initReq = { type: 'SYNC_REQUEST', tabId };
    try { channel.postMessage(initReq); } catch {}

    // Track peers with a Map containing the last seen timestamp of each tabId
    const lastSeenMap = new Map<string, number>();

    let lastReceivedPunts = '';
    let lastReceivedScenes = '';
    let lastReceivedFormations = '';
    
    let ittySock: ReturnType<typeof ittySockConnect> | null = null;
    let isClosed = false;

    const announcePresence = () => {
      const msg = { type: 'HEARTBEAT', tabId };
      // 1. Broadcast locally
      try {
        channel.postMessage(msg);
      } catch { /* */ }

      // 2. Broadcast globally over itty-sockets
      if (ittySock) {
        try {
          ittySock.send(msg);
        } catch { /* */ }
      }
    };

    // Connect to itty-sockets relay for cross-device synchronization
    const connectItty = () => {
      if (isClosed) return;
      useEditorStore.setState({ syncStatus: 'connecting' });

      try {
        const roomName = `punt-designer-${channelKey}`;
        console.log('[SYNC] Connecting to itty-sockets channel:', roomName);
        
        ittySock = ittySockConnect(roomName);
        
        // itty-sockets fires 'open' when connected
        ittySock.on('open', () => {
          console.log('[SYNC] ✅ Connected to itty-sockets channel:', roomName);
          useEditorStore.setState({ syncStatus: 'connected' });
          announcePresence();
          // Immediately request full state synchronization from any active peer
          ittySock!.send({ type: 'SYNC_REQUEST', tabId });
        });

        // itty-sockets fires 'message' with { message } containing the parsed payload
        ittySock.on('message', ({ message }: { message: any }) => {
          try {
            handleIncomingMessage(message);
          } catch {
            // Safe ignore corrupt messages
          }
        });

        ittySock.on('close', () => {
          console.log('[SYNC] itty-sockets channel closed');
          useEditorStore.setState({ syncStatus: 'disconnected' });
        });

        ittySock.on('error', () => {
          console.warn('[SYNC] itty-sockets connection error');
          useEditorStore.setState({ syncStatus: 'disconnected' });
        });
      } catch (err) {
        console.error('[SYNC] Failed to initialize itty-sockets:', err);
        useEditorStore.setState({ syncStatus: 'disconnected' });
      }
    };

    const handleIncomingMessage = (data: any) => {
      if (!data || data.tabId === tabId) return;

      if (data.type === 'HEARTBEAT') {
        // Record timestamp for the peer (either local or remote)
        lastSeenMap.set(data.tabId, Date.now());
        setActiveUserCount(1 + lastSeenMap.size);
      }

      if (data.type === 'PUNTS_UPDATE') {
        const puntsStr = JSON.stringify(data.punts);
        if (puntsStr !== lastReceivedPunts && puntsStr !== JSON.stringify(useFormationStore.getState().punts)) {
          lastReceivedPunts = puntsStr;
          useFormationStore.setState({ punts: data.punts });

          // Sync to active theme in useThemeStore so MobileThemeViewer updates instantly!
          const { activeThemeId, themes } = useThemeStore.getState();
          if (activeThemeId) {
            const updated = themes.map(t => t.id === activeThemeId ? { ...t, currentPunts: data.punts } : t);
            useThemeStore.setState({ themes: updated });
            try {
              localStorage.setItem('punt_designer_themes', JSON.stringify(updated));
            } catch { /* */ }
          }
        }
      }

      if (data.type === 'SCENES_UPDATE') {
        const scenesStr = JSON.stringify(data.scenes);
        if (scenesStr !== lastReceivedScenes && scenesStr !== JSON.stringify(useTimelineStore.getState().scenes)) {
          lastReceivedScenes = scenesStr;
          useTimelineStore.setState({ 
            scenes: data.scenes, 
            activeSceneId: data.activeSceneId 
          });

          // Sync to active theme in useThemeStore so MobileThemeViewer updates instantly!
          const { activeThemeId, themes } = useThemeStore.getState();
          if (activeThemeId) {
            const updated = themes.map(t => t.id === activeThemeId ? { ...t, shapes: data.scenes } : t);
            useThemeStore.setState({ themes: updated });
            try {
              localStorage.setItem('punt_designer_themes', JSON.stringify(updated));
            } catch { /* */ }
          }
        }
      }

      if (data.type === 'FORMATIONS_UPDATE') {
        const formStr = JSON.stringify(data.formations);
        if (formStr !== lastReceivedFormations && formStr !== JSON.stringify(useFormationStore.getState().savedFormations)) {
          lastReceivedFormations = formStr;
          useFormationStore.setState({ savedFormations: data.formations });

          // Sync to active theme in useThemeStore so MobileThemeViewer updates instantly!
          const { activeThemeId, themes } = useThemeStore.getState();
          if (activeThemeId) {
            const updated = themes.map(t => t.id === activeThemeId ? { ...t, formations: data.formations } : t);
            useThemeStore.setState({ themes: updated });
            try {
              localStorage.setItem('punt_designer_themes', JSON.stringify(updated));
            } catch { /* */ }
          }
        }
      }

      if (data.type === 'SYNC_REQUEST') {
        // Respond with our current full state to let the connecting client catch up!
        const statePayload = {
          type: 'SYNC_RESPONSE',
          punts: useFormationStore.getState().punts,
          scenes: useTimelineStore.getState().scenes,
          formations: useFormationStore.getState().savedFormations,
          tabId
        };
        try { channel.postMessage(statePayload); } catch {}
        if (ittySock) {
          try { ittySock.send(statePayload); } catch {}
        }
      }

      if (data.type === 'SYNC_RESPONSE') {
        // 1. Sync Punts
        const puntsStr = JSON.stringify(data.punts);
        if (puntsStr !== lastReceivedPunts && puntsStr !== JSON.stringify(useFormationStore.getState().punts)) {
          lastReceivedPunts = puntsStr;
          useFormationStore.setState({ punts: data.punts });
        }

        // 2. Sync Scenes
        const scenesStr = JSON.stringify(data.scenes);
        if (scenesStr !== lastReceivedScenes && scenesStr !== JSON.stringify(useTimelineStore.getState().scenes)) {
          lastReceivedScenes = scenesStr;
          useTimelineStore.setState({ 
            scenes: data.scenes, 
            activeSceneId: data.activeSceneId 
          });
        }

        // 3. Sync Formations Library
        const formStr = JSON.stringify(data.formations);
        if (formStr !== lastReceivedFormations && formStr !== JSON.stringify(useFormationStore.getState().savedFormations)) {
          lastReceivedFormations = formStr;
          useFormationStore.setState({ savedFormations: data.formations });
        }

        // Always sync all elements to active theme in useThemeStore on a sync response to guarantee complete consistency!
        const { activeThemeId, themes } = useThemeStore.getState();
        if (activeThemeId) {
          const updated = themes.map(t => 
            t.id === activeThemeId 
              ? { ...t, currentPunts: data.punts, shapes: data.scenes, formations: data.formations } 
              : t
          );
          useThemeStore.setState({ themes: updated });
          try {
            localStorage.setItem('punt_designer_themes', JSON.stringify(updated));
          } catch { /* */ }
        }
      }
    };

    const handleBroadcastMessage = (e: MessageEvent) => {
      handleIncomingMessage(e.data);
    };

    channel.addEventListener('message', handleBroadcastMessage);
    
    // Connect itty-sockets
    connectItty();

    // Broadcast heartbeat every 2 seconds
    const heartbeatInterval = setInterval(announcePresence, 2000);
    announcePresence();

    // 1-second interval to prune inactive tabs (timeouts longer than 5 seconds)
    const peerCleanup = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [peerId, timestamp] of lastSeenMap.entries()) {
        if (now - timestamp > 5000) {
          lastSeenMap.delete(peerId);
          changed = true;
        }
      }
      if (changed) {
        setActiveUserCount(1 + lastSeenMap.size);
      }
    }, 1000);

    const unsubscribePunts = useFormationStore.subscribe((state) => {
      const puntsStr = JSON.stringify(state.punts);
      if (puntsStr !== lastReceivedPunts) {
        const payload = { type: 'PUNTS_UPDATE', punts: state.punts, tabId };
        try {
          channel.postMessage(payload);
        } catch { /* */ }
        if (ittySock) {
          try {
            ittySock.send(payload);
          } catch { /* */ }
        }
      }
    });

    const unsubscribeTimeline = useTimelineStore.subscribe((state) => {
      const scenesStr = JSON.stringify(state.scenes);
      if (scenesStr !== lastReceivedScenes) {
        const payload = { 
          type: 'SCENES_UPDATE', 
          scenes: state.scenes, 
          activeSceneId: state.activeSceneId, 
          tabId 
        };
        try {
          channel.postMessage(payload);
        } catch { /* */ }
        if (ittySock) {
          try {
            ittySock.send(payload);
          } catch { /* */ }
        }
      }
    });

    const unsubscribeFormations = useFormationStore.subscribe((state) => {
      const formStr = JSON.stringify(state.savedFormations);
      if (formStr !== lastReceivedFormations) {
        const payload = { type: 'FORMATIONS_UPDATE', formations: state.savedFormations, tabId };
        try {
          channel.postMessage(payload);
        } catch { /* */ }
        if (ittySock) {
          try {
            ittySock.send(payload);
          } catch { /* */ }
        }
      }
    });

    return () => {
      isClosed = true;
      useEditorStore.setState({ syncStatus: 'disconnected' });
      clearInterval(heartbeatInterval);
      clearInterval(peerCleanup);
      channel.removeEventListener('message', handleBroadcastMessage);
      unsubscribePunts();
      unsubscribeTimeline();
      unsubscribeFormations();
      try {
        channel.close();
      } catch { /* */ }
      if (ittySock) {
        try {
          ittySock.close();
        } catch { /* */ }
      }
    };
  }, [activeThemeId, page]);


  const isDark = theme === 'dark';
  const activeTheme = themes.find(t => t.id === activeThemeId) ?? null;

  // Keyboard fine adjustments and Undo/Redo shortcuts
  useEffect(() => {
    let arrowKeysPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if the user is typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // 1. Arrow keys movement / rotation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selected = useEditorStore.getState().selectedIds;
        if (selected.length === 0) return;

        e.preventDefault();
        arrowKeysPressed = true;
        
        const currentPunts = useFormationStore.getState().punts;
        const selectedPunts = currentPunts.filter((p) => selected.includes(p.id));

        if (e.shiftKey) {
          // Shift + Arrow rotates the entire selection shape as a group around its geometric center!
          let sumX = 0;
          let sumY = 0;
          selectedPunts.forEach(p => {
            sumX += p.x;
            sumY += p.y;
          });
          const cx = sumX / selectedPunts.length;
          const cy = sumY / selectedPunts.length;

          let deltaRotDeg = 0;
          if (['ArrowLeft', 'ArrowDown'].includes(e.key)) {
            deltaRotDeg = -5; // Counter-clockwise
          } else if (['ArrowRight', 'ArrowUp'].includes(e.key)) {
            deltaRotDeg = 5; // Clockwise
          }

          const deltaRotRad = (deltaRotDeg * Math.PI) / 180;
          const cos = Math.cos(deltaRotRad);
          const sin = Math.sin(deltaRotRad);

          const snap = useEditorStore.getState().snapToGrid;

          const updates = selectedPunts.map((p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            
            let newDx = dx * cos - dy * sin;
            let newDy = dx * sin + dy * cos;
            
            let newX = cx + newDx;
            let newY = cy + newDy;
            let newRot = (p.rotation + deltaRotDeg + 360) % 360;

            if (snap) {
              newX = Math.round(newX / 20) * 20;
              newY = Math.round(newY / 20) * 20;
              newRot = Math.round(newRot / 15) * 15;
            }

            return {
              id: p.id,
              data: {
                x: Math.round(newX),
                y: Math.round(newY),
                rotation: Math.round(newRot)
              }
            };
          });

          updatePuntsData(updates);
        } else {
          // Plain Arrow keys nudge/move the selection
          const step = 2;
          let dx = 0;
          let dy = 0;

          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;

          const otherBoats = currentPunts.filter((p) => !selected.includes(p.id));
          const firstId = selected[0];
          const firstPunt = currentPunts.find(p => p.id === firstId);
          
          if (firstPunt) {
            const proposed = { x: firstPunt.x + dx, y: firstPunt.y + dy, rotation: firstPunt.rotation, number: firstPunt.number };
            const resolved = resolveCollisionsEdgeToEdge(firstId, proposed, otherBoats);
            
            const snappedDx = resolved.x - firstPunt.x;
            const snappedDy = resolved.y - firstPunt.y;

            if (snappedDx === 0 && snappedDy === 0) return;

            const updates = selected.map((id) => {
              const punt = currentPunts.find((p) => p.id === id);
              if (punt) {
                return {
                  id,
                  data: {
                    x: punt.x + snappedDx,
                    y: punt.y + snappedDy,
                  }
                };
              }
              return null;
            }).filter(Boolean) as { id: string; data: Partial<PuntData> }[];

            updatePuntsData(updates);
          }
        }
      }

      // 2. Undo / Redo Keybindings
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        redo();
      }

      // 3. Delete / Backspace key to remove selected punts
      if (['Delete', 'Backspace'].includes(e.key)) {
        const selected = useEditorStore.getState().selectedIds;
        if (selected.length > 0) {
          e.preventDefault();
          useFormationStore.getState().removePunts(selected);
          useEditorStore.getState().clearSelection();
        }
      }

      // 4. Select All (Ctrl+A / Cmd+A) Shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = useFormationStore.getState().punts.map(p => p.id);
        useEditorStore.getState().setSelectedIds(allIds);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && arrowKeysPressed) {
        arrowKeysPressed = false;
        commitHistory(); // Commit once keys are released
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [updatePunt, commitHistory, undo, redo, showCollisionWarning]);

  const handleColorChange = (color: PuntColor) => {
    if (activeHalf === 'both') {
      useFormationStore.getState().updatePunts(selectedIds, { colorFront: color, colorBack: color } as any);
    } else {
      const field = activeHalf === 'front' ? 'colorFront' : 'colorBack';
      useFormationStore.getState().updatePunts(selectedIds, { [field]: color } as any);
    }
  };



  // ── Open a theme: load its shapes + punts, set active, go to editor ──
  const handleOpenTheme = (t: Theme) => {
    // 1. Load shapes into timeline first
    useTimelineStore.getState().loadScenes(t.shapes, t.shapes[0]?.id ?? null);
    
    // 2. Load last workspace punts (or default to standard 16 punts if brand new theme)
    if (t.currentPunts && t.currentPunts.length > 0) {
      setPunts(JSON.parse(JSON.stringify(t.currentPunts)));
    } else {
      useFormationStore.getState().resetPunts();
    }

    // 3. Load theme-specific formations library
    const themeFormations = t.formations ?? [];
    useFormationStore.getState().loadFormations(themeFormations);
    
    // 4. Default theme mode to light when opening a theme
    setTheme('light');
    
    // 5. Set active theme ID only after stores are fully populated to prevent race-condition saves
    setActiveTheme(t.id);
    setPage('editor');
  };


  // ── Auto-save shapes + punts + formations library back into the active theme whenever they change ──
  useEffect(() => {
    if (page === 'editor' && activeThemeId) {
      // If we just loaded/switched to a different theme, skip saving on this first render cycle
      // to avoid overwriting the brand new theme's blank/initial state with the old theme's memory
      if (lastThemeIdRef.current !== activeThemeId) {
        lastThemeIdRef.current = activeThemeId;
        return;
      }
      saveCurrentState(scenes, punts, savedFormations);
    } else {
      lastThemeIdRef.current = null;
    }
  }, [scenes, punts, savedFormations, activeThemeId, page]);



  // ── Render home page ──
  if (page === 'home') {
    return <HomePage onOpenTheme={handleOpenTheme} />;
  }

  // ── Render mobile theme viewer for small screens ──
  if (isMobile && page === 'editor' && activeThemeId) {
    return <MobileThemeViewer themeId={activeThemeId} onBack={() => setPage('home')} />;
  }

  return (
    <div className="w-full overflow-hidden flex flex-col select-none font-sans bg-slate-950 text-slate-100" style={{ height: '100dvh' }}>
      
      {/* 1. TOP HEADER & FIGMA-STYLE TOOLBAR */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 z-20 bg-slate-900">
        {/* Left Brand Area */}
        <div className="flex items-center gap-3">
          {/* Labeled back to themes navigation */}
          <button
            onClick={() => setPage('home')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-xs font-bold border border-slate-800 hover:border-slate-700 bg-slate-900/40 shadow-sm"
            title="Back to Themes"
          >
            <Home size={14} /> Back to Themes
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <div>
            <h1 className="text-sm font-black tracking-widest bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent uppercase">
              {activeTheme ? activeTheme.name : 'Punt Designer'}
            </h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
              {activeTheme ? 'Theme · Punt Designer' : 'Night Water Visualizer'}
            </p>
          </div>
          {activeUserCount > 1 ? (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/20 animate-pulse" title="Other users currently viewing this theme in other sessions or browser tabs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping mr-0.5" />
              Live: {activeUserCount} Users
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Sparkles size={8} /> Active
            </span>
          )}
        </div>

        {/* Center Canvas Tools */}
        <div className="flex items-center gap-2">
          {/* Tool Toggles */}
          <div className="flex rounded-lg p-0.5 border bg-slate-950 border-slate-800">
            <button
              onClick={() => setTool('select')}
              className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-semibold transition-all ${
                tool === 'select'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Select Tool (V)"
            >
              <MousePointer size={14} /> Select
            </button>
            <button
              onClick={() => setTool('hand')}
              className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-semibold transition-all ${
                tool === 'hand'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Hand / Pan Tool (H)"
            >
              <Hand size={14} /> Pan Screen
            </button>
          </div>



          {/* History Controls */}
          <div className="flex items-center gap-1">
            <button 
              onClick={undo}
              className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button 
              onClick={redo}
              className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
          </div>

          <div className="w-px h-6 bg-slate-800" />

          {/* Color Picker for Selection — Front/Back halves */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <Palette size={14} />
              <span>{selectedIds.length} Sel.</span>
            </div>
            {/* Half toggle: Both / Back / Front */}
            <div className="flex rounded-md p-0.5 bg-slate-950">
              {(['both', 'back', 'front'] as const).map((half) => (
                <button
                  key={half}
                  onClick={() => setActiveHalf(half)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                    activeHalf === half
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {half === 'both' ? '⬛ Both' : half === 'front' ? '▶ Front' : '◀ Back'}
                </button>
              ))}
            </div>
            {/* Color swatches */}
            <div className="flex gap-1">
              <button 
                disabled={selectedIds.length === 0}
                onClick={() => handleColorChange('red')}
                className="w-5 h-5 rounded-full bg-red-500 hover:ring-2 hover:ring-offset-1 hover:ring-offset-slate-900 hover:ring-red-400 disabled:opacity-30 border border-red-600 transition-all"
                title={`${activeHalf === 'front' ? 'Front' : 'Back'}: Red`}
              />
              <button 
                disabled={selectedIds.length === 0}
                onClick={() => handleColorChange('yellow')}
                className="w-5 h-5 rounded-full bg-yellow-400 hover:ring-2 hover:ring-offset-1 hover:ring-offset-slate-900 hover:ring-yellow-300 disabled:opacity-30 border border-yellow-500 transition-all"
                title={`${activeHalf === 'front' ? 'Front' : 'Back'}: Yellow`}
              />
              <button 
                disabled={selectedIds.length === 0}
                onClick={() => handleColorChange('green')}
                className="w-5 h-5 rounded-full bg-green-500 hover:ring-2 hover:ring-offset-1 hover:ring-offset-slate-900 hover:ring-green-400 disabled:opacity-30 border border-green-600 transition-all"
                title={`${activeHalf === 'front' ? 'Front' : 'Back'}: Green`}
              />
              <button 
                disabled={selectedIds.length === 0}
                onClick={() => handleColorChange('off')}
                className="w-5 h-5 rounded-full bg-slate-500 hover:ring-2 hover:ring-offset-1 hover:ring-offset-slate-900 hover:ring-slate-400 disabled:opacity-30 border border-slate-600 transition-all"
                title={`${activeHalf === 'front' ? 'Front' : 'Back'}: Off`}
              />
            </div>
          </div>
        </div>

        {/* Right Action Utilities */}
        <div className="flex items-center gap-3">
          {/* Day/Night visual switcher */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-lg border transition-colors bg-slate-800 hover:bg-slate-700 border-slate-700 ${
              isDark ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Day/Night visualizer background"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* 2. MIDDLE WORKSPACE CONTENT (Sidebar + Canvas StageArea) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Side scrollable editor options */}
        <Sidebar />

        {/* Central interactive canvas workspace */}
        <main className="flex-1 h-full relative">
          
          {/* Collision Warning Overlay Banner */}
          {collisionWarning && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white font-bold text-xs py-2 px-4 rounded-full shadow-lg flex items-center gap-2 border border-rose-400 animate-bounce">
              <AlertCircle size={15} />
              <span>{collisionWarning}</span>
            </div>
          )}

          <StageArea />
        </main>
      </div>

      {/* 3. BOTTOM SCENE SEQUENCE TIMELINE */}
      <Timeline />
    </div>
  );
}

export default App;
