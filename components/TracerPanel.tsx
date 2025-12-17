import React, { useRef, useState, useEffect } from 'react';
import { cannyEdgeDetection, vectoriseEdges } from '../utils/algo';
import { Shape, ShapeType } from '../types';

interface TracerPanelProps {
    onClose: () => void;
    onAddToEditor: (shapes: Shape[], imageSrc?: string, width?: number, height?: number) => void;
}

export const TracerPanel: React.FC<TracerPanelProps> = ({ onClose, onAddToEditor }) => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [generatedPaths, setGeneratedPaths] = useState<any[]>([]); // Array of point arrays
    
    // Params
    const [cannyLow, setCannyLow] = useState(50);
    const [cannyHigh, setCannyHigh] = useState(150);
    const [simplification, setSimplification] = useState(2.0);
    const [minPathLength, setMinPathLength] = useState(20);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const img = new Image();
            img.src = URL.createObjectURL(e.target.files[0]);
            img.onload = () => {
                setImage(img);
                setGeneratedPaths([]);
                setStatus('idle');
            };
        }
    };

    useEffect(() => {
        if (image && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                // Resize logic here ensures performance on large images. 
                // We must pass these dimensions back to editor.
                canvasRef.current.width = image.width > 800 ? 800 : image.width;
                canvasRef.current.height = image.width > 800 ? image.height * (800/image.width) : image.height;
                ctx.drawImage(image, 0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    }, [image]);

    const process = () => {
        if (!image || !canvasRef.current) return;
        setStatus('processing');

        setTimeout(() => {
            const ctx = canvasRef.current!.getContext('2d');
            if (!ctx) return;
            
            const w = canvasRef.current!.width;
            const h = canvasRef.current!.height;
            const imageData = ctx.getImageData(0, 0, w, h);
            
            // Defaulting to Canny Edge Detection as requested
            const edgeData = cannyEdgeDetection(imageData, cannyLow, cannyHigh);

            // Visualize edges
            const outputImage = new ImageData(edgeData, w, h);
            ctx.putImageData(outputImage, 0, 0);

            // Vectorise to Points
            const paths = vectoriseEdges(edgeData, w, h, simplification, minPathLength);
            setGeneratedPaths(paths);
            setStatus('done');
        }, 100);
    };

    const handleSend = () => {
        const shapes: Shape[] = generatedPaths.map((points, i) => ({
            id: Date.now() + Math.random().toString(),
            name: `Auto-Trace ${i + 1}`,
            type: ShapeType.PATH,
            points: points,
            closed: false,
            fill: 'none',
            stroke: '#ef4444',
            strokeWidth: 2,
            visible: true,
            locked: false
        }));
        
        const w = canvasRef.current?.width;
        const h = canvasRef.current?.height;
        
        // Pass the image src and the specific dimensions used for tracing back to app
        onAddToEditor(shapes, image ? image.src : undefined, w, h);
        onClose();
    };

    // Helper to render points as path for preview
    const getPathD = (points: any[]) => {
         if (points.length < 2) return '';
         return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ');
    };

    return (
        <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">auto_fix_high</span>
                        Auto-Tracer
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto">
                        <div className="space-y-6">
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Source Image</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer relative group">
                                    <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2 group-hover:text-blue-500">cloud_upload</span>
                                    <p className="text-xs text-slate-500">Click to upload image</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm font-semibold text-slate-700">Settings</label>
                                
                                <div className="space-y-4 pt-2">
                                    <div>
                                        <div className="flex justify-between text-xs text-slate-500 mb-1">Simplification: {simplification}</div>
                                        <input type="range" min="1" max="10" step="0.5" value={simplification} onChange={e => setSimplification(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                                            <span>Min Path Size</span>
                                            <span>{minPathLength}px</span>
                                        </div>
                                        <input type="range" min="0" max="200" step="5" value={minPathLength} onChange={e => setMinPathLength(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">Filters out noise and small speckles.</p>
                                    </div>
                                    
                                    <div className="pt-2 border-t border-slate-200 mt-2">
                                        <p className="text-xs font-semibold text-slate-600 mb-2">Canny Thresholds</p>
                                        <div className="mb-2">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">Low: {cannyLow}</div>
                                            <input type="range" min="0" max="100" value={cannyLow} onChange={e => setCannyLow(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">High: {cannyHigh}</div>
                                            <input type="range" min="100" max="255" value={cannyHigh} onChange={e => setCannyHigh(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={process} disabled={!image || status === 'processing'} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-semibold shadow-lg flex justify-center gap-2">
                                {status === 'processing' ? 'Processing...' : 'Run Tracer'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-200 p-8 flex items-center justify-center overflow-auto relative">
                        <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-slate-300 relative">
                            {image ? (
                                <canvas ref={canvasRef} className="max-w-full max-h-[70vh] block" />
                            ) : (
                                <div className="w-[600px] h-[400px] flex flex-col items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-6xl opacity-20 mb-4">image</span>
                                    <p>Upload an image to start tracing</p>
                                </div>
                            )}
                            
                            {status === 'done' && (
                                <svg className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-0 hover:opacity-100 transition-opacity bg-white/80" viewBox={`0 0 ${canvasRef.current?.width} ${canvasRef.current?.height}`}>
                                    {generatedPaths.map((p, i) => (
                                        <path key={i} d={getPathD(p)} fill="none" stroke="red" strokeWidth="2" />
                                    ))}
                                </svg>
                            )}
                        </div>
                        
                        {status === 'done' && generatedPaths.length > 0 && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white p-2 rounded-xl shadow-xl flex gap-4">
                                <div className="flex flex-col px-3 justify-center">
                                     <span className="text-xs font-bold text-slate-500 uppercase">Found</span>
                                     <span className="text-lg font-bold text-indigo-600">{generatedPaths.length} <span className="text-sm font-normal text-slate-400">paths</span></span>
                                </div>
                                <div className="w-px bg-slate-200"></div>
                                <button onClick={handleSend} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2">
                                    <span className="material-symbols-outlined">check</span> Accept
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};