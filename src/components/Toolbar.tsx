import React, { useState } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useFormationStore } from '../store/useFormationStore';
import { Undo2, Redo2 } from 'lucide-react';
import type { PuntColor } from '../store/types';

type Half = 'front' | 'back';

const COLOR_OPTIONS: { value: PuntColor; bg: string; ring: string; label: string }[] = [
  { value: 'red',    bg: 'bg-red-500',    ring: 'hover:ring-red-400',    label: 'Red' },
  { value: 'yellow', bg: 'bg-yellow-400', ring: 'hover:ring-yellow-300', label: 'Yellow' },
  { value: 'green',  bg: 'bg-green-500',  ring: 'hover:ring-green-400',  label: 'Green' },
  { value: 'off',    bg: 'bg-slate-500',  ring: 'hover:ring-slate-400',  label: 'Off' },
];

export const Toolbar: React.FC = () => {
  const { selectedIds } = useEditorStore();
  const { undo, redo, updatePunts, historyIndex, history } = useFormationStore();
  const [activeHalf, setActiveHalf] = useState<Half>('front');

  const handleColorChange = (color: PuntColor) => {
    if (selectedIds.length === 0) return;
    const field = activeHalf === 'front' ? 'colorFront' : 'colorBack';
    updatePunts(selectedIds, { [field]: color });
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-2 flex items-center gap-2 z-10 text-slate-200">
      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={historyIndex === 0}
        className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={18} />
      </button>
      <button
        onClick={redo}
        disabled={historyIndex === history.length - 1}
        className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={18} />
      </button>

      <div className="w-px h-6 bg-slate-700 mx-1" />

      {/* Half selector + colour swatches */}
      <div className="flex flex-col gap-1.5">
        {/* Front / Back toggle pill */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 self-start">
          {(['front', 'back'] as Half[]).map((half) => (
            <button
              key={half}
              onClick={() => setActiveHalf(half)}
              className={`
                text-xs font-semibold px-3 py-1 rounded-md transition-all duration-150
                ${activeHalf === half
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              {half === 'front' ? '▶ Front' : '◀ Back'}
            </button>
          ))}
        </div>

        {/* Colour swatches */}
        <div className="flex items-center gap-1.5 px-0.5">
          {COLOR_OPTIONS.map(({ value, bg, ring, label }) => (
            <button
              key={value}
              disabled={selectedIds.length === 0}
              onClick={() => handleColorChange(value)}
              title={`${activeHalf === 'front' ? 'Front' : 'Back'}: ${label}`}
              className={`
                w-7 h-7 rounded-full border border-white/10
                ${bg} ${ring}
                hover:ring-2 hover:ring-offset-1 hover:ring-offset-slate-800
                disabled:opacity-30 transition-all duration-150
                ${selectedIds.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            />
          ))}
          {/* Half diagram hint */}
          <div className="ml-1 w-9 h-5 rounded overflow-hidden border border-white/20 flex-shrink-0" title="Front = right bow half, Back = left stern half">
            <div className="flex h-full">
              <div className={`flex-1 transition-all ${activeHalf === 'back'  ? 'bg-blue-500' : 'bg-slate-600'}`} />
              <div className="w-px bg-white/20" />
              <div className={`flex-1 transition-all ${activeHalf === 'front' ? 'bg-blue-500' : 'bg-slate-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Selection count */}
      {selectedIds.length > 0 && (
        <>
          <div className="w-px h-6 bg-slate-700 mx-1" />
          <span className="text-xs text-slate-400 font-medium pr-1">
            {selectedIds.length} selected
          </span>
        </>
      )}
    </div>
  );
};
