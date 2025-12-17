import React, { useState, useEffect, useCallback } from 'react';
import { LayerPanel } from './components/LayerPanel';
import { EditorCanvas } from './components/EditorCanvas';
import { TracerPanel } from './components/TracerPanel';
import { ToolType, Shape, ViewTransform, ShapeType, ImageShape } from './types';

function App() {
    // Editor State
    const [tool, setTool] = useState<ToolType>(ToolType.SELECT);
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [viewTransform, setViewTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
    const [showGrid, setShowGrid] = useState(true);
    const [snapToGrid, setSnapToGrid] = useState(false);
    
    // History State
    const [history, setHistory] = useState<Shape[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Background Image State
    const [backgroundImage, setBackgroundImage] = useState<ImageShape | null>(null);
    const [showBackground, setShowBackground] = useState(true);
    const [backgroundOpacity, setBackgroundOpacity] = useState(0.5);

    // Styling State
    const [fillColor, setFillColor] = useState('none');
    const [strokeColor, setStrokeColor] = useState('#fbbf24');
    const [strokeWidth, setStrokeWidth] = useState(2);

    // Modal State
    const [showTracer, setShowTracer] = useState(false);

    // --- History Management ---

    const addToHistory = (newShapes: Shape[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newShapes);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setShapes(newShapes);
    };

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setShapes(history[newIndex]);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setShapes(history[newIndex]);
        }
    }, [history, historyIndex]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // --- Handlers ---

    const handleClearShapes = () => {
        addToHistory([]);
        setSelectedId(null);
    };

    const handleSetBackgroundImage = (url: string, forcedWidth?: number, forcedHeight?: number) => {
        const img = new Image();
        img.onload = () => {
            let width = forcedWidth;
            let height = forcedHeight;

            if (!width || !height) {
                const maxW = 800;
                if (img.width > maxW) {
                    width = maxW;
                    height = img.height * (maxW / img.width);
                } else {
                    width = img.width;
                    height = img.height;
                }
            }

            const newImage: ImageShape = {
                id: 'bg-image',
                name: "Background",
                type: ShapeType.IMAGE,
                visible: true,
                locked: true,
                x: 0, y: 0,
                width: width!, 
                height: height!,
                href: url,
                opacity: 1
            };
            setBackgroundImage(newImage);
            setViewTransform({ x: 20, y: 20, k: 1 });
        };
        img.src = url;
    };

    const handleImportImage = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                handleSetBackgroundImage(url);
            }
        };
        input.click();
    };

    const handleDelete = (id: string) => {
        const newShapes = shapes.filter(s => s.id !== id);
        addToHistory(newShapes);
        if (selectedId === id) setSelectedId(null);
    };

    // Called by LayerPanel (immediate save)
    const handleImmediateUpdateShape = (id: string, updates: Partial<Shape>) => {
        const newShapes = shapes.map(s => s.id === id ? { ...s, ...updates } as Shape : s);
        addToHistory(newShapes);
    };

    // Called by EditorCanvas during drag (transient, no save)
    const handleTransientUpdateShape = (id: string, updates: Partial<Shape>) => {
        setShapes(prev => prev.map(s => s.id === id ? { ...s, ...updates } as Shape : s));
    };

    // Called by EditorCanvas on drag end (commit)
    const handleShapeActionEnd = () => {
        addToHistory(shapes);
    };

    const handleAddShape = (shape: Shape) => {
        addToHistory([...shapes, shape]);
    };

    const handleExport = () => {
        const svgContent = document.querySelector('svg')?.outerHTML;
        if (svgContent) {
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'areas.svg';
            a.click();
        }
    };

    const zoomIn = () => setViewTransform(t => ({ ...t, k: t.k * 1.2 }));
    const zoomOut = () => setViewTransform(t => ({ ...t, k: t.k * 0.8 }));

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            
            {/* Main Workspace */}
            <div className="flex-1 flex flex-col relative">
                <EditorCanvas 
                    tool={tool}
                    shapes={shapes}
                    selectedId={selectedId}
                    viewTransform={viewTransform}
                    onSelect={setSelectedId}
                    onAddShape={handleAddShape}
                    onUpdateShape={handleTransientUpdateShape}
                    onShapeActionEnd={handleShapeActionEnd}
                    setViewTransform={setViewTransform}
                    fillColor={fillColor}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    showGrid={showGrid}
                    snapToGrid={snapToGrid}
                    gridSize={20}
                    backgroundImage={backgroundImage}
                    showBackground={showBackground}
                    backgroundOpacity={backgroundOpacity}
                />

                {/* Bottom Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex items-center justify-between shadow-lg z-30">
                    <div className="flex items-center gap-1">
                         <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200">
                             <button onClick={() => setTool(ToolType.SELECT)} className={`p-2 rounded ${tool === ToolType.SELECT ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Select/Edit (V)">
                                <span className="material-symbols-outlined">arrow_selector_tool</span>
                             </button>
                             <button onClick={() => setTool(ToolType.PEN)} className={`p-2 rounded ${tool === ToolType.PEN ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Draw Polygon (P)">
                                <span className="material-symbols-outlined">polyline</span>
                             </button>
                             <button onClick={() => setTool(ToolType.RECT)} className={`p-2 rounded ${tool === ToolType.RECT ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Rectangle (R)">
                                <span className="material-symbols-outlined">rectangle</span>
                             </button>
                             <button onClick={() => setTool(ToolType.SQUARE)} className={`p-2 rounded ${tool === ToolType.SQUARE ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Square">
                                <span className="material-symbols-outlined">crop_square</span>
                             </button>
                             <button onClick={() => setTool(ToolType.CIRCLE)} className={`p-2 rounded ${tool === ToolType.CIRCLE ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Circle (C)">
                                <span className="material-symbols-outlined">circle</span>
                             </button>
                             <button onClick={() => setTool(ToolType.TRIANGLE)} className={`p-2 rounded ${tool === ToolType.TRIANGLE ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Triangle">
                                <span className="material-symbols-outlined">change_history</span>
                             </button>
                             <button onClick={() => setTool(ToolType.HAND)} className={`p-2 rounded ${tool === ToolType.HAND ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`} title="Pan (Space)">
                                <span className="material-symbols-outlined">pan_tool</span>
                             </button>
                         </div>

                         <div className="h-8 w-px bg-slate-200 mx-2"></div>
                         
                         {/* Undo/Redo Buttons */}
                         <div className="flex items-center gap-1">
                             <button 
                                onClick={undo} 
                                disabled={historyIndex <= 0}
                                className="p-2 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Undo (Ctrl+Z)"
                             >
                                <span className="material-symbols-outlined">undo</span>
                             </button>
                             <button 
                                onClick={redo} 
                                disabled={historyIndex >= history.length - 1}
                                className="p-2 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Redo (Ctrl+Y)"
                             >
                                <span className="material-symbols-outlined">redo</span>
                             </button>
                         </div>

                         <div className="h-8 w-px bg-slate-200 mx-2"></div>

                         <button onClick={handleImportImage} className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors uppercase tracking-tight whitespace-nowrap">
                            {backgroundImage ? 'Replace Image' : 'Add Image'}
                         </button>
                         
                         {backgroundImage && (
                             <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 mx-2">
                                <label className="flex items-center gap-1 cursor-pointer select-none text-xs font-semibold text-slate-600">
                                    <input type="checkbox" checked={showBackground} onChange={e => setShowBackground(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                    Show Img
                                </label>
                                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                <span className="material-symbols-outlined text-slate-400 text-sm">opacity</span>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.1" 
                                    value={backgroundOpacity} 
                                    onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                                    className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                                    title="Background Opacity"
                                />
                             </div>
                         )}

                         <div className="h-8 w-px bg-slate-200 mx-2"></div>

                         <button onClick={handleClearShapes} className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 rounded border border-transparent hover:border-red-100 transition-colors uppercase tracking-tight whitespace-nowrap">
                            Clear Paths
                         </button>
                    </div>

                    <div className="flex items-center gap-4">
                         <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
                            <label className="flex items-center gap-1 cursor-pointer select-none">
                                <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                Grid
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer select-none">
                                <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                Snap
                            </label>
                         </div>
                         
                         <div className="flex items-center bg-white border border-slate-300 rounded shadow-sm">
                            <button onClick={zoomOut} className="p-1 hover:bg-slate-50 border-r border-slate-200">
                                <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <span className="px-3 text-xs font-mono w-16 text-center">{Math.round(viewTransform.k * 100)}%</span>
                            <button onClick={zoomIn} className="p-1 hover:bg-slate-50 border-l border-slate-200">
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                         </div>

                         <button onClick={handleExport} className="bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 px-6 py-2 text-sm font-bold uppercase tracking-wide rounded shadow-sm transition-colors">
                            Export
                         </button>
                    </div>
                </div>

                {/* Tracer Button Floating */}
                 <button
                    onClick={() => setShowTracer(true)}
                    className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-slate-200 shadow-md text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2 z-20"
                >
                    <span className="material-symbols-outlined">auto_fix_high</span>
                </button>
            </div>
            
            <LayerPanel 
                shapes={shapes}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onUpdateShape={handleImmediateUpdateShape}
                onDeleteAll={handleClearShapes}
            />

            {/* Modal */}
            {showTracer && (
                <TracerPanel 
                    onClose={() => setShowTracer(false)} 
                    onAddToEditor={(newShapes, imageSrc, w, h) => {
                        addToHistory([...shapes, ...newShapes]);
                        if (imageSrc) handleSetBackgroundImage(imageSrc, w, h);
                    }}
                />
            )}
        </div>
    );
}

export default App;