import React from 'react';
import { Shape, ShapeType } from '../types';
import { simplifyPath } from '../utils/algo';

interface LayerPanelProps {
    shapes: Shape[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdateShape: (id: string, updates: Partial<Shape>) => void;
    onDeleteAll: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ shapes, selectedId, onSelect, onDelete, onUpdateShape, onDeleteAll }) => {
    
    // Helper to format coordinate string for display
    const getCoordString = (shape: Shape) => {
        if (shape.type === ShapeType.PATH) {
            return shape.points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
        }
        if (shape.type === ShapeType.RECT) {
            return `${Math.round(shape.x)}, ${Math.round(shape.y)}, ${Math.round(shape.width)}, ${Math.round(shape.height)}`;
        }
        return '...';
    };

    return (
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-20 shadow-xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 text-lg">AREAS</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-full">{shapes.length}</span>
                    {shapes.length > 0 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteAll(); }}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Delete All Areas"
                        >
                            <span className="material-symbols-outlined text-lg">delete_sweep</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4 bg-slate-100">
                {[...shapes].reverse().map((shape) => {
                    const isSelected = selectedId === shape.id;
                    return (
                        <div 
                            key={shape.id}
                            onClick={() => onSelect(shape.id)}
                            className={`rounded-lg border-2 p-3 transition-all cursor-pointer bg-white ${
                                isSelected ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
                            } ${!shape.visible ? 'opacity-60' : ''}`}
                        >
                            <div className="flex justify-between items-center gap-2 mb-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateShape(shape.id, { visible: !shape.visible }); }}
                                    className={`p-1 rounded transition-colors ${shape.visible ? 'text-slate-400 hover:text-slate-700' : 'text-slate-300 hover:text-slate-500'}`}
                                    title={shape.visible ? "Hide" : "Show"}
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {shape.visible ? 'visibility' : 'visibility_off'}
                                    </span>
                                </button>

                                <input 
                                    type="text"
                                    value={shape.name}
                                    onChange={(e) => onUpdateShape(shape.id, { name: e.target.value })}
                                    className="font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full text-sm py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }}
                                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                            
                            <div className="bg-slate-50 rounded p-2 border border-slate-100 ml-8">
                                <div className="text-[10px] uppercase text-slate-400 font-bold mb-1 tracking-wider">
                                    {shape.type === ShapeType.PATH ? 'Points' : shape.type === ShapeType.IMAGE ? 'Image Data' : 'Bounds'}
                                </div>
                                <div className="text-xs font-mono text-slate-600 break-words leading-relaxed max-h-16 overflow-hidden text-ellipsis">
                                    {getCoordString(shape)}
                                </div>
                            </div>
                            
                            {/* Quick Properties for Selected Item */}
                            {isSelected && shape.type !== ShapeType.IMAGE && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 ml-8">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">FILL</label>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="color" 
                                                value={(shape as any).fill === 'none' ? '#ffffff' : (shape as any).fill}
                                                onChange={(e) => onUpdateShape(shape.id, { fill: e.target.value })}
                                                className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                                            />
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onUpdateShape(shape.id, { fill: 'none' }); }}
                                                className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"
                                            >
                                                None
                                            </button>
                                        </div>
                                    </div>
                                     <div className="flex-1">
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">STROKE</label>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="color" 
                                                value={(shape as any).stroke}
                                                onChange={(e) => onUpdateShape(shape.id, { stroke: e.target.value })}
                                                className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isSelected && shape.type === ShapeType.PATH && (
                                <div className="mt-3 ml-8 border-t border-slate-100 pt-2">
                                    <label className="text-[10px] text-slate-400 font-bold block mb-1">SIMPLIFY PATH</label>
                                    <div className="flex items-center gap-2">
                                         <button 
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 const newPoints = simplifyPath(shape.points, 1.0); // Mild
                                                 onUpdateShape(shape.id, { points: newPoints });
                                             }}
                                             className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 rounded text-slate-600 border border-slate-200 shadow-sm transition-all active:scale-95"
                                             title="Remove redundant points (Tolerance 1.0)"
                                         >
                                             Mild
                                         </button>
                                         <button 
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 const newPoints = simplifyPath(shape.points, 2.5); // Medium
                                                 onUpdateShape(shape.id, { points: newPoints });
                                             }}
                                             className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 rounded text-slate-600 border border-slate-200 shadow-sm transition-all active:scale-95"
                                             title="Optimize shape significantly (Tolerance 2.5)"
                                         >
                                             Med
                                         </button>
                                         <button 
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 const newPoints = simplifyPath(shape.points, 5.0); // Strong
                                                 onUpdateShape(shape.id, { points: newPoints });
                                             }}
                                             className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 rounded text-slate-600 border border-slate-200 shadow-sm transition-all active:scale-95"
                                             title="Aggressive simplification (Tolerance 5.0)"
                                         >
                                             Strong
                                         </button>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1 text-right italic">
                                        {shape.points.length} points
                                    </div>
                                </div>
                            )}

                            {isSelected && shape.type === ShapeType.IMAGE && (
                                <div className="mt-3 ml-8">
                                    <label className="text-[10px] text-slate-400 font-bold block mb-1">OPACITY</label>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.1" 
                                        value={(shape as any).opacity} 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => onUpdateShape(shape.id, { opacity: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {shapes.length === 0 && (
                     <div className="text-center py-12 px-4 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">layers_clear</span>
                        <p className="text-sm">No areas defined.</p>
                        <p className="text-xs mt-1">Select the Pen tool to start tracing.</p>
                    </div>
                )}
            </div>
        </aside>
    );
};