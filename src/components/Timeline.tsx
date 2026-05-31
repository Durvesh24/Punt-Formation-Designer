import React, { useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../store/useTimelineStore';
import { useFormationStore } from '../store/useFormationStore';
import { Play, Pause, Plus, Trash2, Clock, Sparkles, Video, Loader2, Layers } from 'lucide-react';
import type { Scene, PuntData } from '../store/types';
import { getGlobalStage } from '../utils/stageRef';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Lerp a single PuntData between two scenes (same number matching). */
function interpolatePunts(from: Scene, to: Scene, t: number): PuntData[] {
  return from.punts.map((p1) => {
    const p2 = to.punts.find((p) => p.number === p1.number);
    if (!p2) return p1;
    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;
    let diff = ((p2.rotation - p1.rotation + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    const rotation = p1.rotation + diff * t;
    const colorFront = t < 0.5 ? (p1.colorFront ?? 'off') : (p2.colorFront ?? 'off');
    const colorBack  = t < 0.5 ? (p1.colorBack  ?? 'off') : (p2.colorBack  ?? 'off');
    const color      = t < 0.5 ? p1.color : p2.color;
    return { ...p1, x, y, rotation, color, colorFront, colorBack };
  });
}

/** Easing – smooth ease-in-out for a more natural look. */
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── component ──────────────────────────────────────────────────────────────

export const Timeline: React.FC = () => {
  const punts = useFormationStore(state => state.punts);
  const setPunts = useFormationStore(state => state.setPunts);


  const {
    scenes,
    activeSceneId,
    isPlaying,
    playbackProgress,
    playFromIndex,
    playToIndex,
    addScene,
    deleteScene,
    selectScene,
    updateSceneDuration,
    setIsPlaying,
    setPlaybackProgress,
    setPlayIndices,
    clearTimeline,
  } = useTimelineStore();

  const containerRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingLabel, setRecordingLabel] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true); // Closed by default


  // ── auto-sync workspace edits to active scene ──────────────────────────
  useEffect(() => {
    if (activeSceneId && !isPlaying) {
      const activeScene = scenes.find(s => s.id === activeSceneId);
      if (activeScene && JSON.stringify(activeScene.punts) !== JSON.stringify(punts)) {
        useTimelineStore.getState().updateScene(activeSceneId, punts);
      }
    }
  }, [punts, activeSceneId, isPlaying, scenes]);

  // ── load scene into workspace on click ────────────────────────────────
  const handleSelectScene = (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (scene) {
      selectScene(sceneId);
      setPunts(JSON.parse(JSON.stringify(scene.punts)));
    }
  };

  // ── live preview playback loop ─────────────────────────────────────────
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (!isPlaying || scenes.length < 2) {
        setIsPlaying(false);
        return;
      }
      const elapsed = (now - lastTime) / 1000;
      lastTime = now;
      const duration = scenes[playToIndex]?.duration || 2.0;
      let nextProgress = playbackProgress + elapsed / duration;

      if (nextProgress >= 1) {
        if (playToIndex === scenes.length - 1) {
          setIsPlaying(false);
          setPlaybackProgress(0);
          const finalScene = scenes[scenes.length - 1];
          selectScene(finalScene.id);
          setPunts(JSON.parse(JSON.stringify(finalScene.punts)));
          return;
        }
        setPlayIndices(playToIndex, playToIndex + 1);
        nextProgress = 0;
      }
      setPlaybackProgress(nextProgress);
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isPlaying && scenes.length >= 2) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, playbackProgress, playFromIndex, playToIndex, scenes,
      setPlaybackProgress, setPlayIndices, setIsPlaying, selectScene, setPunts]);

  const handlePlayToggle = () => {
    if (scenes.length < 2) {
      alert('Please add at least 2 scenes to play a sequence.');
      return;
    }
    if (!isPlaying) {
      const activeIdx = scenes.findIndex(s => s.id === activeSceneId);
      const fromIdx = (activeIdx !== -1 && activeIdx < scenes.length - 1) ? activeIdx : 0;
      setPlayIndices(fromIdx, fromIdx + 1);
      setPlaybackProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  // ── video export ──────────────────────────────────────────────────────────
  const handleExportVideo = async () => {
    if (scenes.length < 2) {
      alert('Please add at least 2 scenes to export a video.');
      return;
    }

    const stage = getGlobalStage();
    if (!stage) {
      alert('Canvas not ready. Please make sure the workspace is visible.');
      return;
    }

    // The Konva canvas is rendered at physical pixels (CSS size × devicePixelRatio).
    // We record at CSS pixel size so shadows/glows match exactly what you see on screen.
    const konvaCanvas = stage.container().querySelector('canvas') as HTMLCanvasElement;
    if (!konvaCanvas) {
      alert('Konva canvas not found.');
      return;
    }

    const dpr     = window.devicePixelRatio || 1;
    const cssW    = Math.floor(konvaCanvas.width  / dpr);
    const cssH    = Math.floor(konvaCanvas.height / dpr);
    const FPS     = 30;
    const frameDuration = 1000 / FPS; // ms per frame

    const supported = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : null;

    if (!supported) {
      alert('Your browser does not support video recording. Try Chrome or Edge.');
      return;
    }

    setIsRecording(true);
    setRecordingLabel('Starting…');
    setIsPlaying(false);
    await new Promise(r => setTimeout(r, 80));

    // ── recording canvas at CSS pixel size (fixes DPR shadow scaling) ──
    const recCanvas = document.createElement('canvas');
    recCanvas.width  = cssW;
    recCanvas.height = cssH;
    const rCtx = recCanvas.getContext('2d')!;

    // Use captureStream(0) = manual frame timing via requestFrame()
    const stream  = recCanvas.captureStream(0);
    const track   = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: supported, videoBitsPerSecond: 8_000_000 });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    /** Copy current Konva canvas → recording canvas and push one frame to MediaRecorder */
    const captureFrame = () => {
      rCtx.clearRect(0, 0, cssW, cssH);
      // drawImage scales physical-pixel canvas down to CSS-pixel recording canvas
      rCtx.drawImage(konvaCanvas, 0, 0, cssW, cssH);
      track.requestFrame();
    };

    /** Wait exactly N animation frames (ensures React + Konva batchDraw both fire) */
    const waitFrames = (n: number) =>
      new Promise<void>(res => {
        let count = 0;
        const step = () => { if (++count >= n) res(); else requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });

    // ── drive animation frame by frame ──
    const totalDuration = scenes.slice(1).reduce((s, sc) => s + (sc.duration || 2), 0);
    let elapsed = 0;

    for (let i = 0; i < scenes.length - 1; i++) {
      const fromScene = scenes[i];
      const toScene   = scenes[i + 1];
      const dur       = toScene.duration || 2.0;
      const frames    = Math.ceil(dur * FPS);

      setRecordingLabel(`Scene ${i + 1} → ${i + 2} (${Math.round((elapsed / totalDuration) * 100)}%)`);

      for (let f = 0; f <= frames; f++) {
        const t = easeInOut(f / frames);
        const lerped = interpolatePunts(fromScene, toScene, t);

        // 1. Push new punt state into Zustand
        useFormationStore.getState().setPunts(lerped);

        // 2. Wait 2 rAFs: first for React to re-render, second for Konva's batchDraw
        await waitFrames(2);

        // 3. Force a synchronous Konva draw so the canvas is up-to-date right now
        stage.draw();

        // 4. Copy to recording canvas (DPR-corrected) and push frame
        captureFrame();

        // 5. Hold this frame for the correct duration before moving on
        await new Promise(r => setTimeout(r, frameDuration));
      }
      elapsed += dur;
    }

    // Hold last frame for half a second
    setRecordingLabel('Finalising…');
    captureFrame();
    await new Promise(r => setTimeout(r, 500));

    recorder.stop();
    await new Promise<void>(res => { recorder.onstop = () => res(); });

    // Download
    const blob = new Blob(chunks, { type: supported });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `punt-sequence-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Restore workspace to last scene
    const lastScene = scenes[scenes.length - 1];
    setPunts(JSON.parse(JSON.stringify(lastScene.punts)));
    selectScene(lastScene.id);
    useTimelineStore.getState().setPlaybackProgress(0);

    setIsRecording(false);
    setRecordingLabel('');
  };

  // ─── render ────────────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div className="shrink-0 border-t border-slate-800 z-10 bg-slate-900 text-slate-200 py-2.5 px-4 flex items-center justify-between shadow-lg select-none">
        <div className="flex items-center gap-3">
          <Layers size={13} className="text-indigo-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">Timeline</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {scenes.length} shape{scenes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-md active:scale-95"
        >
          Open Timeline
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-800 z-10 bg-slate-900 text-slate-200 transition-all duration-200">

      {/* Timeline context header */}
      <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1 select-none">
        <div className="flex items-center gap-2">
          <Layers size={11} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Timeline</span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-850 text-slate-500">
            {scenes.length} shape{scenes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors hover:bg-slate-850 text-slate-400 hover:text-white"
        >
          Collapse
        </button>
      </div>

      {/* Timeline Controls */}
      <div className="flex items-center justify-between px-3.5 pb-2">
        <div className="flex items-center gap-3">
          {/* Play / Pause */}
          <button
            onClick={handlePlayToggle}
            disabled={isRecording}
            className={`p-2 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
              isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700 shadow-md'
            }`}
            title={isPlaying ? 'Pause Sequence' : 'Play Sequence'}
          >
            {isPlaying
              ? <Pause size={16} className="fill-current text-white" />
              : <Play  size={16} className="fill-current text-white ml-0.5" />}
          </button>

          {/* Add Scene */}
          <button
            onClick={() => addScene(punts)}
            disabled={isRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border disabled:opacity-40 bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200`}
          >
            <Plus size={14} /> Add Shape
          </button>

          {/* Export Video */}
          {scenes.length >= 2 && (
            <button
              onClick={handleExportVideo}
              disabled={isRecording || isPlaying}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border disabled:opacity-50 bg-emerald-700 hover:bg-emerald-600 border-emerald-600 text-white`}
              title="Export animation as WebM video"
            >
              {isRecording
                ? <><Loader2 size={13} className="animate-spin" /> {recordingLabel}</>
                : <><Video size={13} /> Export Video</>}
            </button>
          )}

          {/* Clear Timeline */}
          {scenes.length > 0 && !isRecording && (
            <button
              onClick={clearTimeline}
              className="text-xs text-rose-500 hover:underline font-bold transition-all ml-1"
            >
              Clear Shapes
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 select-none">
          {isPlaying && (
            <div className="flex items-center gap-1.5 text-xs text-blue-500 font-bold animate-pulse">
              <Sparkles size={14} />
              <span>
                Playing: {scenes[playFromIndex]?.name} &rarr; {scenes[playToIndex]?.name}{' '}
                ({(playbackProgress * 100).toFixed(0)}%)
              </span>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              Recording…
            </div>
          )}
          <span className="text-xs text-slate-500 font-semibold">Shapes: {scenes.length}</span>
        </div>
      </div>

      {/* Horizontal Scenes Slider */}
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto px-3.5 pb-2.5 scrollbar-thin scrollbar-thumb-slate-850 scrollbar-track-transparent select-none"
      >
        {scenes.length === 0 ? (
          <div className="w-full flex items-center justify-center py-4 text-xs font-semibold border border-dashed rounded-lg border-slate-850 text-slate-500">
            Timeline is empty. Arrange boats and click "+ Add Shape".
          </div>
        ) : (
          scenes.map((scene, idx) => {
            const isActive           = scene.id === activeSceneId;
            const isTransitioningFrom = isPlaying && idx === playFromIndex;
            const isTransitioningTo   = isPlaying && idx === playToIndex;

            return (
              <div
                key={scene.id}
                onClick={() => !isPlaying && !isRecording && handleSelectScene(scene.id)}
                className={`flex-shrink-0 w-44 border p-2.5 rounded-lg flex flex-col gap-1.5 transition-all cursor-pointer relative group ${
                  isActive
                    ? 'border-blue-500 bg-slate-950/60 shadow-md'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/60'
                } ${isTransitioningFrom ? 'ring-2 ring-emerald-500' : ''} ${
                  isTransitioningTo ? 'ring-2 ring-blue-500 animate-pulse' : ''
                }`}
              >
                {/* Scene Label */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-200">
                    {scene.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteScene(scene.id); }}
                    disabled={isRecording}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                    title="Delete Shape"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Duration Config */}
                <div className="flex items-center gap-1.5 border border-slate-800 rounded px-1.5 py-0.5 bg-slate-950/80">
                  <Clock size={11} className="text-slate-400" />
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={scene.duration}
                    onChange={(e) => { e.stopPropagation(); updateSceneDuration(scene.id, parseFloat(e.target.value) || 2.0); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-10 bg-transparent border-none text-[11px] font-black outline-none p-0 text-center focus:ring-0 text-slate-200"
                  />
                  <span className="text-[9px] text-slate-500 font-bold uppercase">sec</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};


