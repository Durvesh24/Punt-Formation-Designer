import React, { useState } from 'react';
import { useFormationStore } from '../store/useFormationStore';
import { useEditorStore } from '../store/useEditorStore';
import { getPuntDimensions } from '../utils/sizes';
import { serializeShape } from '../utils/sharing';
import type { Formation } from '../store/types';
import { 
  LayoutGrid, Maximize, Shuffle, Type, Square, Grid3x3, 
  Save, Trash2, Copy, Edit3, Share2, Check, X 
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    punts, resetPunts, centerPunts, randomizePunts,
    clearAllPunts, addPuntByNumber, removePunts,
    savedFormations, saveFormation, overwriteFormation, deleteFormation, loadFormation, 
    duplicateFormation, renameFormation
  } = useFormationStore();

  const { 
    selectedIds, setSelectedIds, clearSelection,
    showLabels, toggleLabels, 
    showOutlines, toggleOutlines, 
    showGrid, toggleGrid,
    snapToGrid, toggleSnapToGrid
  } = useEditorStore();

  const [newFormationName, setNewFormationName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [sharingForm, setSharingForm] = useState<Formation | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isDark = true; // Permanently dark theme styling for sidebar UI

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormationName.trim()) return;
    saveFormation(newFormationName.trim(), creatorName.trim() || undefined);
    setNewFormationName('');
    setCreatorName('');
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renameFormation(id, editName.trim());
    setEditingId(null);
  };

  const handleShare = (form: Formation) => {
    setSharingForm(form);
    setCopiedLink(false);
  };

  const handleOverwrite = (id: string, name: string) => {
    if (confirm(`Overwrite "${name}" with your current active stage layout and timeline scenes?`)) {
      overwriteFormation(id);
    }
  };

  const getShareLink = () => {
    if (!sharingForm) return '';
    const token = serializeShape(sharingForm);
    return `${window.location.origin}${window.location.pathname}?importShape=${token}`;
  };

  const handleCopyLink = () => {
    const link = getShareLink();
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <aside className="w-72 h-full flex flex-col gap-5 p-4 border-r border-slate-800 shrink-0 overflow-y-auto select-none bg-slate-900 text-slate-200">
      
      {/* 1. Custom Formation Library (Shifted to Top) */}
      <div className="flex flex-col gap-3">
        <h2 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          <Save size={13} className="text-indigo-400" /> Formations Library
        </h2>
        
        <form onSubmit={handleSave} className="flex flex-col gap-1.5">
          <input
            type="text"
            value={newFormationName}
            onChange={(e) => setNewFormationName(e.target.value)}
            placeholder="Formation name..."
            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isDark 
                ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600 focus:border-indigo-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
            }`}
          />
          <div className="flex gap-1.5">
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Created by (your name)..."
              className={`flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark 
                  ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600 focus:border-indigo-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
              }`}
            />
            <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center" title="Save Formation">
              <Save size={14} />
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {savedFormations.length === 0 ? (
            <div className="text-[10px] text-slate-500 italic text-center py-2">
              No saved formations in library.
            </div>
          ) : (
            savedFormations.map((form) => (
              <div 
                key={form.id} 
                className={`group flex items-center justify-between p-2 border rounded-lg text-xs transition-all ${
                  isDark ? 'bg-slate-950/40 hover:bg-slate-800/40 border-slate-800' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {editingId === form.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`flex-1 border rounded px-1.5 py-0.5 text-xs ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <button onClick={() => handleRename(form.id)} className="p-1 text-emerald-500 hover:bg-slate-800 rounded">
                      <Save size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col flex-1 min-w-0 pr-1.5">
                      <span 
                        onClick={() => loadFormation(form.id)}
                        className={`font-bold hover:underline cursor-pointer truncate text-xs ${
                          isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-indigo-900'
                        }`}
                        title="Load Formation"
                      >
                        {form.name}
                      </span>
                      {form.createdBy && (
                        <span className="text-[9px] text-slate-500 font-bold tracking-wide mt-0.5 truncate uppercase">
                          Created by {form.createdBy}
                        </span>
                      )}
                    </div>
                    {/* Scene count badge */}
                    {(form.scenes?.length ?? 0) > 0 && (
                      <span className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/50" title={`${form.scenes.length} scenes saved`}>
                        {form.scenes.length} sc
                      </span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(form.id); setEditName(form.name); }}
                        className="p-1 hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 rounded"
                        title="Rename"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => handleOverwrite(form.id, form.name)}
                        className="p-1 hover:bg-slate-800/40 text-slate-400 hover:text-emerald-400 rounded"
                        title="Overwrite with current layout"
                      >
                        <Save size={11} />
                      </button>
                      <button
                        onClick={() => handleShare(form)}
                        className="p-1 hover:bg-slate-800/40 text-slate-400 hover:text-indigo-405 rounded"
                        title="Share Shape"
                      >
                        <Share2 size={11} />
                      </button>
                      <button
                        onClick={() => duplicateFormation(form.id)}
                        className="p-1 hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 rounded"
                        title="Duplicate"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => deleteFormation(form.id)}
                        className="p-1 hover:bg-slate-800/40 text-slate-400 hover:text-rose-500 rounded"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />

      {/* 2. Interactive Boat Inventory / Dispatcher */}
      <div>
        <h2 className={`text-xs font-black uppercase tracking-wider mb-3 flex items-center justify-between ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          <span>Boat Inventory ({punts.length}/16)</span>
          {punts.length > 0 && (
            <button
              onClick={() => {
                clearAllPunts();
                clearSelection();
              }}
              className="text-[10px] font-black text-rose-500 hover:underline uppercase tracking-wider transition-colors"
            >
              Clear Stage
            </button>
          )}
        </h2>
        
        {/* Compact Legend of Boat Types */}
        <div className="flex gap-3 mb-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1.5"><span className="text-amber-500">⚓</span> Anchor (P4)</span>
          <span className="flex items-center gap-1.5"><span className="text-slate-700 dark:text-slate-350 font-bold">*</span> Asterisk (P1-8)</span>
          <span className="flex items-center gap-1.5"><span className="text-indigo-550 dark:text-indigo-400 font-bold">C</span> Corner (P9-16)</span>
        </div>
        
        {/* Compact Grid of P1 to P16 */}
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 16 }, (_, i) => {
            const num = i + 1;
            const dims = getPuntDimensions(num);
            const activeBoat = punts.find(p => p.number === num);
            const isSelected = activeBoat ? selectedIds.includes(activeBoat.id) : false;

            const getSidebarLabel = () => {
              if (num === 4) return `⚓ P4`;
              if (num >= 1 && num <= 8) return `* P${num}`;
              if (num >= 9 && num <= 16) return `C P${num}`;
              return `P${num}`;
            };
            
            return (
              <div key={num} className="relative group">
                <button
                  onClick={() => {
                    if (activeBoat) {
                      // Toggle selection
                      if (isSelected) {
                        setSelectedIds((prev) => prev.filter(id => id !== activeBoat.id));
                      } else {
                        setSelectedIds([activeBoat.id]);
                      }
                    } else {
                      // Dispatch boat to center
                      addPuntByNumber(num);
                      // Auto-select immediately
                      setTimeout(() => {
                        const newBoat = useFormationStore.getState().punts.find(p => p.number === num);
                        if (newBoat) setSelectedIds([newBoat.id]);
                      }, 30);
                    }
                  }}
                  title={activeBoat ? `P${num} (${(dims.length/10).toFixed(1)}m) - Click to Toggle Selection` : `Add P${num} (${(dims.length/10).toFixed(1)}m)`}
                  className={`w-full py-2 border rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer ${
                    activeBoat
                      ? isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/30'
                        : isDark
                          ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-750'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                      : isDark
                        ? 'bg-slate-950/40 border-slate-850 text-slate-600 hover:text-slate-400 hover:border-slate-800'
                        : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <span className="leading-none">{getSidebarLabel()}</span>
                  <span className="text-[7.5px] font-normal mt-0.5 opacity-60">{(dims.length / 10).toFixed(1)}m</span>
                </button>

                {/* Direct Deletion Circular Cross Badge */}
                {activeBoat && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePunts([activeBoat.id]);
                      if (isSelected) {
                        setSelectedIds((prev) => prev.filter(id => id !== activeBoat.id));
                      }
                    }}
                    title={`Remove P${num} from stage`}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-[9px] font-black leading-none border border-slate-900/10 dark:border-slate-950 transition-colors shadow-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />

      {/* 3. Stage controls */}
      <div>
        <h2 className={`text-xs font-black uppercase tracking-wider mb-3 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>Stage Actions</h2>
        <div className="flex flex-col gap-1.5">
          <button 
            onClick={resetPunts} 
            title="Spawns all 16 boats in a grid layout"
            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-bold transition-colors text-left ${
              isDark ? 'bg-slate-800/40 hover:bg-slate-800 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <LayoutGrid size={14} className="text-slate-400" /> Populate / Reset Grid
          </button>
          <button 
            onClick={centerPunts} 
            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-bold transition-colors text-left ${
              isDark ? 'bg-slate-800/40 hover:bg-slate-800 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Maximize size={14} className="text-slate-400" /> Center Workspace
          </button>
          <button 
            onClick={randomizePunts} 
            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-bold transition-colors text-left ${
              isDark ? 'bg-slate-800/40 hover:bg-slate-800 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Shuffle size={14} className="text-slate-400" /> Randomize Placement
          </button>
          <button 
            onClick={() => setSelectedIds(punts.map(p => p.id))} 
            title="Selects all boats currently on the stage (Ctrl+A)"
            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-bold transition-colors text-left ${
              isDark ? 'bg-slate-800/40 hover:bg-slate-800 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Type size={14} className="text-indigo-400" /> Select All Punts (Ctrl+A)
          </button>
        </div>
      </div>

      <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />

      {/* 4. Display Options */}
      <div>
        <h2 className={`text-xs font-black uppercase tracking-wider mb-3 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>Display Options</h2>
        <div className="flex flex-col gap-1">
          <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}>
            <span className="flex items-center gap-2.5"><Type size={14} className="text-slate-400" /> Show Boat Numbers</span>
            <input type="checkbox" checked={showLabels} onChange={toggleLabels} className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500" />
          </label>
          <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}>
            <span className="flex items-center gap-2.5"><Square size={14} className="text-slate-400" /> Show Light Outlines</span>
            <input type="checkbox" checked={showOutlines} onChange={toggleOutlines} className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500" />
          </label>
          <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}>
            <span className="flex items-center gap-2.5"><Grid3x3 size={14} className="text-slate-400" /> Show Water Grid</span>
            <input type="checkbox" checked={showGrid} onChange={toggleGrid} className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500" />
          </label>
          <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}>
            <span className="flex items-center gap-2.5"><LayoutGrid size={14} className="text-indigo-400" /> Magnet Snap to Grid</span>
            <input type="checkbox" checked={snapToGrid} onChange={toggleSnapToGrid} className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500" />
          </label>
        </div>
      </div>

      {sharingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-350 flex items-center gap-2">
                <Share2 size={15} className="text-indigo-400" /> Share Shape
              </h3>
              <button
                onClick={() => setSharingForm(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <span className="text-xs font-bold text-slate-400">Shape Name:</span>
              <span className="text-sm font-black text-white bg-slate-950 px-3 py-2 rounded-xl border border-slate-850">
                {sharingForm.name}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <span className="text-xs font-bold text-slate-400">Shareable Link:</span>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={getShareLink()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none select-all truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 ${
                    copiedLink
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                  }`}
                >
                  {copiedLink ? <><Check size={13} /> Copied</> : 'Copy Link'}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic leading-relaxed text-left">
              Anyone with this link can open it to instantly load and edit this exact shape directly on their stage canvas!
            </p>
          </div>
        </div>
      )}

    </aside>
  );
};
