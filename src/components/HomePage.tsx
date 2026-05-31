import { useState, useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import type { Theme, PuntData, PuntColor } from '../store/types';
import { deserializeShape } from '../utils/sharing';
import { v4 as uuidv4 } from 'uuid';
import { 
  Plus, Layers, Clock, ChevronRight, Trash2, Edit3, Check, X, 
  HelpCircle, Sparkles, Anchor, Save, Video, ArrowRight, Laptop
} from 'lucide-react';

interface HomePageProps {
  onOpenTheme: (theme: Theme) => void;
}

// ── Small shape count badge ────────────────────────────────────────────────
function ShapeBadge({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                     bg-indigo-900/50 border border-indigo-700/40 text-indigo-300">
      <Layers size={9} />
      {count} {count === 1 ? 'shape' : 'shapes'}
    </span>
  );
}

// ── Theme Card ─────────────────────────────────────────────────────────────
function ThemeCard({ theme, onOpen, onDelete }: {
  theme: Theme;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(theme.name);
  const { renameTheme } = useThemeStore();

  const handleRename = () => {
    if (editName.trim()) renameTheme(theme.id, editName.trim());
    setEditing(false);
  };

  const date = new Date(theme.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div
      className="group relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900
                 hover:border-indigo-500/50 hover:bg-slate-800/80
                 transition-all duration-200 overflow-hidden cursor-pointer"
      onClick={() => !editing && onOpen()}
    >
      {/* Top colour bar */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-400
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Name row */}
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && editName.trim()) handleRename(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 bg-slate-800 border border-indigo-500 rounded-lg px-2 py-1
                           text-sm font-bold text-white outline-none"
              />
              <button onClick={handleRename} className="p-1 rounded text-emerald-400 hover:bg-slate-700">
                <Check size={14} />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 rounded text-slate-500 hover:bg-slate-700">
                <X size={14} />
              </button>
            </div>
          ) : (
            <h3 className="font-black text-base text-white leading-tight truncate flex-1">{theme.name}</h3>
          )}

          {!editing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setEditing(true); setEditName(theme.name); }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
                title="Rename"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-lg hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <ShapeBadge count={(theme.formations ?? []).length} />
          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
            <Clock size={9} /> {date}
          </span>
        </div>

        {/* Shape pills preview */}
        {(theme.formations ?? []).length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(theme.formations ?? []).slice(0, 6).map((s) => (
              <span key={s.id}
                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                {s.name}
              </span>
            ))}
            {(theme.formations ?? []).length > 6 && (
              <span className="text-[9px] text-slate-600 font-semibold">+{(theme.formations ?? []).length - 6} more</span>
            )}
          </div>
        )}

        {(theme.formations ?? []).length === 0 && (
          <p className="text-[11px] text-slate-600 italic">No shapes yet — open to start designing</p>
        )}
      </div>

      {/* Bottom open row */}
      <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between
                      bg-slate-950/30 group-hover:bg-slate-800/30 transition-colors">
        <span className="text-[10px] text-slate-600 font-semibold">Click to open</span>
        <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  );
}

// ── New Theme Dialog ───────────────────────────────────────────────────────
function NewThemeDialog({ onCreate, onCancel }: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
         onClick={onCancel}>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-white mb-1">New Theme</h2>
        <p className="text-xs text-slate-400 mb-5">
          Give this show a name. You'll design all its shapes inside.
        </p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Opening Ceremony"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white
                     placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim())}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500
                       text-white disabled:opacity-40 transition-colors">
            Create & Open
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onboarding / How to Use Modal ──────────────────────────────────────────
interface OnboardingModalProps {
  onClose: () => void;
}

function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Step 1: Open or Create a Theme",
      description: "Click 'Add Theme' to start a new project, or click any existing theme card to enter the workspace. This isolates your workspace so your designs never leak.",
      icon: <Layers className="w-12 h-12 text-indigo-400" />
    },
    {
      title: "Step 2: Add and Arrange Boats",
      description: "Use the sidebar grid to toggle boats (P1 to P16) onto the water stage. Select a boat, drag to move, or drag any of the 3 handle dots directly on the boat to rotate it.",
      icon: <Anchor className="w-12 h-12 text-amber-400" />
    },
    {
      title: "Step 3: Navigate & Align Stage",
      description: "Switch to 'Pan Screen' (H) to click and drag around the stage. Toggle 'Magnet Snap to Grid' in the sidebar for alignment, and use green guidelines to match centerpoints.",
      icon: <Sparkles className="w-12 h-12 text-blue-400" />
    },
    {
      title: "Step 4: Save to Formations Library",
      description: "Once your boats are perfectly placed, type a name in the Formations Library input at the top of the sidebar and click Save. Load, duplicate, or rename it anytime.",
      icon: <Save className="w-12 h-12 text-emerald-400" />
    },
    {
      title: "Step 5: Animate & Export Video",
      description: "Click '+ Add Shape' at the bottom to save your current stage layout to the Timeline. Add multiple scenes, click Play to preview the transitions, and click Export Video to download a WebM file.",
      icon: <Video className="w-12 h-12 text-rose-400" />
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('punt_designer_onboarding_completed', 'true');
    } catch { /* */ }
    onClose();
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Animated colored bar at the top */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500" />

        {/* Header containing Step info and Close button */}
        <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider">
          <span>Tutorial · Step {currentStep + 1} of {steps.length}</span>
          <button onClick={handleComplete} className="p-1 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step Icon and Illustration */}
        <div className="flex flex-col items-center justify-center py-4 bg-slate-950/40 rounded-2xl border border-slate-800/60 min-h-[140px]">
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-md">
            {step.icon}
          </div>
        </div>

        {/* Step Content */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-black text-white leading-snug">{step.title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed min-h-[72px]">{step.description}</p>
        </div>

        {/* Step Dots Progress Indicator */}
        <div className="flex justify-center gap-1.5 py-1">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-800 hover:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Action Controls Footer */}
        <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-800 text-slate-350">
          <button
            onClick={handleComplete}
            className="text-xs text-slate-500 hover:text-slate-350 font-bold uppercase tracking-wider transition-colors"
          >
            Skip Tutorial
          </button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-300 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-900/30"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Home Page ──────────────────────────────────────────────────────────────
export function HomePage({ onOpenTheme }: HomePageProps) {
  const { themes, createTheme, deleteTheme } = useThemeStore();
  const [showDialog, setShowDialog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem('punt_designer_onboarding_completed');
    } catch {
      return true;
    }
  });

  // 1. Detect shared shape query parameter on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importB64 = params.get('importShape');
    if (importB64) {
      const decoded = deserializeShape(importB64);
      if (decoded) {
        // Automatically mark onboarding as completed so it never pops up and interrupts their viewing
        try {
          localStorage.setItem('punt_designer_onboarding_completed', 'true');
          setShowOnboarding(false);
        } catch { /* */ }

        // Convert CompressedPunts back to full PuntData objects
        const newPunts: PuntData[] = decoded.punts.map((p: any) => ({
          id: uuidv4(),
          number: Number(p[0]),
          x: Number(p[1]),
          y: Number(p[2]),
          rotation: Number(p[3]),
          color: 'off' as PuntColor,
          colorFront: (p[4] || 'off') as PuntColor,
          colorBack: (p[5] || 'off') as PuntColor,
        }));

        // Load directly into the main theme "Punya Nagari" (or create it if it doesn't exist yet)
        const allThemes = useThemeStore.getState().themes;
        let targetTheme = allThemes.find(t => t.name === 'Punya Nagari') || allThemes[0];
        let updatedThemes = allThemes;

        if (!targetTheme) {
          // If no themes exist at all, create Punya Nagari as the main theme
          targetTheme = {
            id: uuidv4(),
            name: 'Punya Nagari',
            createdAt: Date.now(),
            shapes: [],
            currentPunts: newPunts,
            formations: [],
          };
          updatedThemes = [targetTheme];
        } else {
          // Overwrite the main theme's active canvas punts directly with the shared shape
          updatedThemes = allThemes.map(t => 
            t.id === targetTheme.id ? { ...t, currentPunts: newPunts } : t
          );
          targetTheme = updatedThemes.find(t => t.id === targetTheme.id)!;
        }

        // Update store state and persist to local storage
        useThemeStore.setState({ themes: updatedThemes });
        try {
          localStorage.setItem('punt_designer_themes', JSON.stringify(updatedThemes));
        } catch { /* */ }

        // Instantly bypass dialogs and open the main theme workspace with the shared shape active on canvas
        onOpenTheme(targetTheme);
      }
      
      // Clean up the URL search query to keep browser history beautiful and prevent double pops
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleCreate = (name: string) => {
    const theme = createTheme(name);
    setShowDialog(false);
    onOpenTheme(theme);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this theme and all its shapes? This cannot be undone.')) {
      deleteTheme(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">

      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-widest bg-gradient-to-r from-blue-400 to-indigo-400
                         bg-clip-text text-transparent uppercase">Punt Designer</h1>
          <p className="text-xs text-slate-500 mt-0.5">Formation Choreography Studio</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-800
                       hover:border-slate-700 bg-slate-900/50 text-slate-350 hover:text-white transition-all shadow-sm"
          >
            <HelpCircle size={16} /> <span className="hidden sm:inline">How to Use</span>
          </button>
          <button
            onClick={() => setShowDialog(true)}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500
                       rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-900/40"
          >
            <Plus size={16} /> Add Theme
          </button>
        </div>
      </header>

      {/* Mobile-only read-only advice banner */}
      <div className="block md:hidden px-4 sm:px-8 pt-4">
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs font-semibold leading-relaxed text-indigo-300 flex items-center gap-3">
          <Laptop size={18} className="text-indigo-400 flex-shrink-0 animate-pulse" />
          <span>
            📱 <strong>Mobile Viewer Mode</strong>: You can browse your themes and saved shapes. To edit, drag boats, or choreograph new shapes, please open this studio on a <strong>laptop or PC</strong>.
          </span>
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-10">

        {themes.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-700
                            flex items-center justify-center text-slate-600">
              <Layers size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white mb-2">No themes yet</h2>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed px-4">
                <span className="block md:hidden">To create and configure themes, please access this studio on a laptop or desktop computer.</span>
                <span className="hidden md:block">Add a theme to get started. Each theme holds all the shapes you design inside it.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex items-center gap-2 px-6 py-3 border border-slate-800 hover:border-slate-700
                           rounded-xl text-sm font-bold transition-all bg-slate-900 text-slate-300"
              >
                <HelpCircle size={18} /> How to Use
              </button>
              <button
                onClick={() => setShowDialog(true)}
                className="hidden md:flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500
                           rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-900/40
                           hover:scale-105 active:scale-95"
              >
                <Plus size={16} /> Add Theme
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                Themes ({themes.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Add new card */}
              <button
                onClick={() => setShowDialog(true)}
                className="hidden md:flex rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50
                           hover:bg-indigo-900/10 transition-all duration-200 flex flex-col items-center
                           justify-center gap-3 min-h-[180px] text-slate-600 hover:text-indigo-400 group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center
                                group-hover:scale-110 transition-transform duration-200">
                  <Plus size={20} />
                </div>
                <span className="text-sm font-bold">Add Theme</span>
              </button>

              {/* Theme cards — newest first */}
              {[...themes].reverse().map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  onOpen={() => onOpenTheme(theme)}
                  onDelete={() => handleDelete(theme.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {showDialog && (
        <NewThemeDialog onCreate={handleCreate} onCancel={() => setShowDialog(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
