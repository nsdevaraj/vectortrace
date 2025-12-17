import React from 'react';
import { ToolType } from '../types';

interface ToolbarProps {
    activeTool: ToolType;
    setTool: (t: ToolType) => void;
    onClear: () => void;
    onImportImage: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setTool, onClear, onImportImage }) => {
    const tools = [
        { id: ToolType.SELECT, icon: 'arrow_selector_tool', label: 'Select (V)' },
        { id: ToolType.HAND, icon: 'pan_tool', label: 'Pan (H)' },
        { id: ToolType.PEN, icon: 'edit_attributes', label: 'Pen (P)' },
        { id: ToolType.RECT, icon: 'rectangle', label: 'Rectangle (R)' },
        { id: ToolType.CIRCLE, icon: 'circle', label: 'Circle (C)' },
    ];

    return (
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-3 shadow-sm z-20">
            {tools.map(tool => (
                <button
                    key={tool.id}
                    onClick={() => setTool(tool.id)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        activeTool === tool.id
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                    title={tool.label}
                >
                    <span className="material-symbols-outlined text-[20px]">{tool.icon}</span>
                </button>
            ))}

            <div className="w-8 h-px bg-slate-200 my-2"></div>

            <button
                onClick={onImportImage}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                title="Import Image to Trace"
            >
                <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
            </button>

            <div className="flex-1"></div>

            <button
                onClick={onClear}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors mb-2"
                title="Clear Canvas"
            >
                <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
        </aside>
    );
};