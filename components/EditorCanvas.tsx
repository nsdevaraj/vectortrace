import React, { useRef, useState, useEffect } from 'react';
import { Shape, ToolType, ShapeType, Point, ViewTransform, ImageShape } from '../types';

interface EditorCanvasProps {
    tool: ToolType;
    shapes: Shape[];
    selectedId: string | null;
    viewTransform: ViewTransform;
    onSelect: (id: string | null) => void;
    onAddShape: (shape: Shape) => void;
    onUpdateShape: (id: string, updates: Partial<Shape>) => void;
    onImmediateUpdateShape: (id: string, updates: Partial<Shape>) => void;
    onDeleteShape: (id: string) => void;
    onShapeActionEnd: () => void;
    setViewTransform: (t: ViewTransform) => void;
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    backgroundImage: ImageShape | null;
    showBackground: boolean;
    backgroundOpacity: number;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
    tool,
    shapes,
    selectedId,
    viewTransform,
    onSelect,
    onAddShape,
    onUpdateShape,
    onImmediateUpdateShape,
    onDeleteShape,
    onShapeActionEnd,
    setViewTransform,
    fillColor,
    strokeColor,
    strokeWidth,
    showGrid,
    snapToGrid,
    gridSize,
    backgroundImage,
    showBackground,
    backgroundOpacity
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
    const [draggedHandleIndex, setDraggedHandleIndex] = useState<number | null>(null);
    const [draggingShapeStartPos, setDraggingShapeStartPos] = useState<Point | null>(null);
    
    // Track if a modification actually happened during drag
    const isDirtyRef = useRef(false);

    // Temporary drawing state
    const [currentShape, setCurrentShape] = useState<Partial<Shape> | null>(null);
    const [penPoints, setPenPoints] = useState<Point[]>([]);
    const [cursorPos, setCursorPos] = useState<Point | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; shapeId: string | null }>({ visible: false, x: 0, y: 0, shapeId: null });

    // Helper: Snap to grid
    const snap = (val: number) => {
        if (!snapToGrid) return val;
        return Math.round(val / gridSize) * gridSize;
    };

    const getSVGPoint = (clientX: number, clientY: number) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left - viewTransform.x) / viewTransform.k,
            y: (clientY - rect.top - viewTransform.y) / viewTransform.k
        };
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom parameters
        const delta = -Math.sign(e.deltaY);
        const factor = 1.1;
        const scaleChange = delta > 0 ? factor : 1 / factor;
        
        // Calculate new scale
        let newK = viewTransform.k * scaleChange;
        newK = Math.max(0.1, Math.min(50, newK)); // Limits 10% to 5000%

        // Calculate new translation to keep mouse position stable
        // Formula: newPos = mousePos - (mousePos - oldPos) * (newScale / oldScale)
        const newX = mouseX - (mouseX - viewTransform.x) * (newK / viewTransform.k);
        const newY = mouseY - (mouseY - viewTransform.y) * (newK / viewTransform.k);

        setViewTransform({ x: newX, y: newY, k: newK });
    };

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Calculate safe position
        const x = Math.min(e.clientX, window.innerWidth - 260);
        const y = Math.min(e.clientY, window.innerHeight - 300);

        setContextMenu({
            visible: true,
            x,
            y,
            shapeId: id
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Close context menu if open
        if (contextMenu.visible) {
            setContextMenu({ ...contextMenu, visible: false });
            return;
        }

        const rawPt = getSVGPoint(e.clientX, e.clientY);
        const pt = { x: snap(rawPt.x), y: snap(rawPt.y) };
        isDirtyRef.current = false;
        
        // Pan
        if (tool === ToolType.HAND || e.button === 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Handle Vertex Editing for Selected Path
        if (tool === ToolType.SELECT && selectedId) {
            const shape = shapes.find(s => s.id === selectedId);
            
            // Check if clicking a handle
            if (shape?.type === ShapeType.PATH && (e.target as Element).getAttribute('data-handle-index')) {
                const idx = parseInt((e.target as Element).getAttribute('data-handle-index') || '0');
                setDraggedHandleIndex(idx);
                setIsDragging(true);
                e.stopPropagation();
                return;
            }
        }

        if (tool === ToolType.SELECT) {
            // Background click deselects
            if (e.target === svgRef.current) {
                onSelect(null);
            }
            return;
        }

        // Drawing
        if (tool === ToolType.RECT || tool === ToolType.SQUARE || tool === ToolType.TRIANGLE) {
            setIsDragging(true);
            setDragStart(pt);
            // Initialize with RECT type logic for bounds tracking
            setCurrentShape({ type: ShapeType.RECT, x: pt.x, y: pt.y, width: 0, height: 0 });
        } else if (tool === ToolType.CIRCLE) {
            setIsDragging(true);
            setDragStart(pt);
            setCurrentShape({ type: ShapeType.CIRCLE, cx: pt.x, cy: pt.y, r: 0 });
        } else if (tool === ToolType.PEN) {
            // Check if clicking near start point to close the path
            if (penPoints.length > 2) {
                const startPt = penPoints[0];
                const screenDist = Math.sqrt(
                    Math.pow((pt.x - startPt.x) * viewTransform.k, 2) + 
                    Math.pow((pt.y - startPt.y) * viewTransform.k, 2)
                );
                
                if (screenDist < 10) { // 10px tolerance for closing path
                    finishPen();
                    return;
                }
            }
            // Add point
            setPenPoints([...penPoints, pt]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rawPt = getSVGPoint(e.clientX, e.clientY);
        const pt = { x: snap(rawPt.x), y: snap(rawPt.y) };

        if (tool === ToolType.PEN) {
            setCursorPos(pt);
        }

        // Panning
        if ((tool === ToolType.HAND || e.buttons === 4) && isDragging) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setViewTransform({ ...viewTransform, x: viewTransform.x + dx, y: viewTransform.y + dy });
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Editing Vertex
        if (tool === ToolType.SELECT && isDragging && draggedHandleIndex !== null && selectedId) {
             const shape = shapes.find(s => s.id === selectedId);
             if (shape && shape.type === ShapeType.PATH) {
                 const newPoints = [...shape.points];
                 newPoints[draggedHandleIndex] = pt;
                 onUpdateShape(selectedId, { points: newPoints });
                 isDirtyRef.current = true;
             }
             return;
        }

        // Move Shape
        if (tool === ToolType.SELECT && isDragging && selectedId && draggingShapeStartPos) {
             const shape = shapes.find(s => s.id === selectedId);
             if (shape) {
                 if(shape.type === ShapeType.RECT || shape.type === ShapeType.IMAGE) {
                    onUpdateShape(selectedId, { x: shape.x + (pt.x - dragStart.x), y: shape.y + (pt.y - dragStart.y) });
                 } else if (shape.type === ShapeType.CIRCLE) {
                    onUpdateShape(selectedId, { cx: shape.cx + (pt.x - dragStart.x), cy: shape.cy + (pt.y - dragStart.y) });
                 } else if (shape.type === ShapeType.PATH) {
                     // Move all points
                     const dx = pt.x - dragStart.x;
                     const dy = pt.y - dragStart.y;
                     const newPoints = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                     onUpdateShape(selectedId, { points: newPoints });
                 }
                 setDragStart(pt); // Reset drag start for next frame delta
                 isDirtyRef.current = true;
             }
             return;
        }

        // Drawing Preview
        if (isDragging && currentShape) {
            if (tool === ToolType.RECT || tool === ToolType.TRIANGLE) {
                const w = pt.x - dragStart.x;
                const h = pt.y - dragStart.y;
                setCurrentShape({
                    ...currentShape,
                    x: w < 0 ? pt.x : dragStart.x,
                    y: h < 0 ? pt.y : dragStart.y,
                    width: Math.abs(w),
                    height: Math.abs(h)
                } as any);
            } else if (tool === ToolType.SQUARE) {
                const w = pt.x - dragStart.x;
                const h = pt.y - dragStart.y;
                const size = Math.max(Math.abs(w), Math.abs(h));
                const newX = w < 0 ? dragStart.x - size : dragStart.x;
                const newY = h < 0 ? dragStart.y - size : dragStart.y;
                setCurrentShape({
                    ...currentShape,
                    x: newX,
                    y: newY,
                    width: size,
                    height: size
                } as any);
            } else if (tool === ToolType.CIRCLE) {
                const r = Math.sqrt(Math.pow(pt.x - dragStart.x, 2) + Math.pow(pt.y - dragStart.y, 2));
                setCurrentShape({ ...currentShape, r } as any);
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDraggedHandleIndex(null);
        setDraggingShapeStartPos(null);

        // Commit history if we were dragging/editing a shape
        if (tool === ToolType.SELECT && isDirtyRef.current) {
            onShapeActionEnd();
            isDirtyRef.current = false;
        }

        if (tool === ToolType.HAND || tool === ToolType.SELECT) return;

        if (isDragging && currentShape) {
            const id = Date.now().toString();
            let newShape: Shape | null = null;
            const nameBase = tool === ToolType.RECT ? "Rectangle" : tool === ToolType.SQUARE ? "Square" : tool === ToolType.TRIANGLE ? "Triangle" : "Circle";
            const name = nameBase + " " + (shapes.length + 1);

            if (tool === ToolType.RECT || tool === ToolType.SQUARE) {
                const r = currentShape as any;
                if (r.width > 2 && r.height > 2) {
                    newShape = {
                        id, name,
                        type: ShapeType.RECT,
                        x: r.x, y: r.y, width: r.width, height: r.height,
                        fill: fillColor, stroke: strokeColor, strokeWidth,
                        visible: true, locked: false
                    };
                }
            } else if (tool === ToolType.TRIANGLE) {
                const r = currentShape as any;
                if (r.width > 2 && r.height > 2) {
                    // Create triangle points from bounds
                    const points = [
                        { x: r.x + r.width / 2, y: r.y },           // Top Middle
                        { x: r.x + r.width, y: r.y + r.height },    // Bottom Right
                        { x: r.x, y: r.y + r.height }               // Bottom Left
                    ];
                    newShape = {
                        id, name,
                        type: ShapeType.PATH,
                        points: points,
                        closed: true,
                        fill: fillColor, stroke: strokeColor, strokeWidth,
                        visible: true, locked: false
                    };
                }
            } else if (tool === ToolType.CIRCLE) {
                const c = currentShape as any;
                if (c.r > 2) {
                    newShape = {
                        id, name,
                        type: ShapeType.CIRCLE,
                        cx: c.cx, cy: c.cy, r: c.r,
                        fill: fillColor, stroke: strokeColor, strokeWidth,
                        visible: true, locked: false
                    };
                }
            }

            if (newShape) {
                onAddShape(newShape);
                onSelect(id);
            }
            setCurrentShape(null);
        }
    };

    const finishPen = () => {
        if (tool === ToolType.PEN && penPoints.length > 2) {
            const id = Date.now().toString();
            const newShape: Shape = {
                id,
                name: "Polygon " + (shapes.length + 1),
                type: ShapeType.PATH,
                points: penPoints,
                closed: true,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth,
                visible: true, locked: false
            };
            onAddShape(newShape);
            setPenPoints([]);
            onSelect(id);
            setCursorPos(null);
        } else if (tool === ToolType.PEN) {
            setPenPoints([]);
            setCursorPos(null);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') finishPen();
            if (e.key === 'Escape') {
                setPenPoints([]);
                setCurrentShape(null);
                onSelect(null);
                setCursorPos(null);
                setContextMenu({ ...contextMenu, visible: false });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [penPoints, fillColor, strokeColor, contextMenu]);

    const handleShapeMouseDown = (e: React.MouseEvent, id: string) => {
        if (tool === ToolType.SELECT && e.button === 0) { // Only Left Click
            e.stopPropagation();
            onSelect(id);
            setIsDragging(true);
            const rawPt = getSVGPoint(e.clientX, e.clientY);
            const pt = { x: snap(rawPt.x), y: snap(rawPt.y) };
            setDragStart(pt);
            setDraggingShapeStartPos(pt);
        }
    };

    // Helper to generate path string
    const getPathString = (points: Point[], closed: boolean) => {
        if (points.length === 0) return '';
        const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        return closed ? d + ' Z' : d;
    };

    const targetShape = contextMenu.shapeId ? shapes.find(s => s.id === contextMenu.shapeId) : null;

    return (
        <div 
            className="flex-1 bg-slate-100 overflow-hidden relative canvas-bg cursor-crosshair"
            onWheel={handleWheel}
        >
            <svg
                ref={svgRef}
                className="w-full h-full touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
                    
                    {/* Grid */}
                    {showGrid && (
                        <defs>
                            <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
                            </pattern>
                        </defs>
                    )}
                    {showGrid && <rect width="50000" height="50000" x="-25000" y="-25000" fill="url(#grid)" pointerEvents="none" />}

                    {/* Background Image Layer */}
                    {backgroundImage && showBackground && (
                        <image
                            href={backgroundImage.href}
                            x={backgroundImage.x} 
                            y={backgroundImage.y} 
                            width={backgroundImage.width} 
                            height={backgroundImage.height}
                            opacity={backgroundOpacity}
                            style={{ pointerEvents: 'none' }}
                        />
                    )}

                    {/* Shapes */}
                    {shapes.map(shape => {
                        if (!shape.visible) return null; // Respect visibility setting
                        
                        const isSelected = shape.id === selectedId;
                        const commonProps = {
                            key: shape.id,
                            className: `hover:opacity-80 transition-opacity ${isSelected ? 'outline-none' : ''}`,
                            onMouseDown: (e: React.MouseEvent) => handleShapeMouseDown(e, shape.id),
                            onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, shape.id),
                            style: { cursor: tool === ToolType.SELECT ? 'move' : 'inherit' }
                        };

                        if (shape.type === ShapeType.PATH) {
                            return (
                                <g key={shape.id}>
                                    <path
                                        d={getPathString(shape.points, shape.closed)}
                                        fill={shape.fill}
                                        stroke={shape.stroke}
                                        strokeWidth={shape.strokeWidth}
                                        {...commonProps}
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {/* Vertex Handles for Selected Path */}
                                    {isSelected && tool === ToolType.SELECT && shape.points.map((p, i) => (
                                        <circle
                                            key={i}
                                            cx={p.x} cy={p.y} r={4 / viewTransform.k + 2} // Scale independent size
                                            fill="#fff"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            data-handle-index={i}
                                            className="cursor-pointer hover:fill-blue-100"
                                        />
                                    ))}
                                </g>
                            );
                        } else if (shape.type === ShapeType.RECT) {
                            return (
                                <g key={shape.id}>
                                    <rect
                                        x={shape.x} y={shape.y} width={shape.width} height={shape.height}
                                        fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth}
                                        {...commonProps}
                                    />
                                    {isSelected && (
                                        <rect 
                                            x={shape.x-2} y={shape.y-2} width={shape.width+4} height={shape.height+4}
                                            fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4" pointerEvents="none"
                                        />
                                    )}
                                </g>
                            );
                        } else if (shape.type === ShapeType.CIRCLE) {
                            return (
                                <g key={shape.id}>
                                    <circle
                                        cx={shape.cx} cy={shape.cy} r={shape.r}
                                        fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth}
                                        {...commonProps}
                                    />
                                    {isSelected && (
                                         <rect 
                                            x={shape.cx-shape.r-2} y={shape.cy-shape.r-2} width={shape.r*2+4} height={shape.r*2+4}
                                            fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4" pointerEvents="none"
                                        />
                                    )}
                                </g>
                            );
                        }
                        return null;
                    })}

                    {/* Temporary Drawings */}
                    {currentShape && (tool === ToolType.RECT || tool === ToolType.SQUARE) && (
                        <rect
                            x={(currentShape as any).x} y={(currentShape as any).y}
                            width={(currentShape as any).width} height={(currentShape as any).height}
                            fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}
                            opacity={0.5} pointerEvents="none"
                        />
                    )}
                    {currentShape && tool === ToolType.TRIANGLE && (
                         <polygon
                             points={`${(currentShape as any).x + (currentShape as any).width/2},${(currentShape as any).y} ${(currentShape as any).x + (currentShape as any).width},${(currentShape as any).y + (currentShape as any).height} ${(currentShape as any).x},${(currentShape as any).y + (currentShape as any).height}`}
                             fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}
                             opacity={0.5} pointerEvents="none"
                         />
                    )}
                    {currentShape && tool === ToolType.CIRCLE && (
                        <circle
                            cx={(currentShape as any).cx} cy={(currentShape as any).cy}
                            r={(currentShape as any).r}
                            fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}
                            opacity={0.5} pointerEvents="none"
                        />
                    )}
                    
                    {/* Pen Preview with Rubber Band */}
                    {tool === ToolType.PEN && penPoints.length > 0 && (
                        <g>
                            <polyline
                                points={penPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray="4 4"
                                className="pointer-events-none opacity-60"
                            />
                            {/* Rubber Band to cursor */}
                            {cursorPos && (
                                <line 
                                    x1={penPoints[penPoints.length - 1].x} 
                                    y1={penPoints[penPoints.length - 1].y} 
                                    x2={cursorPos.x} 
                                    y2={cursorPos.y} 
                                    stroke={strokeColor}
                                    strokeWidth={1}
                                    strokeDasharray="2 2"
                                    opacity={0.5}
                                    pointerEvents="none"
                                />
                            )}
                            {/* Snap to start indicator */}
                            {penPoints.length > 2 && cursorPos && (() => {
                                const startPt = penPoints[0];
                                const screenDist = Math.sqrt(
                                    Math.pow((cursorPos.x - startPt.x) * viewTransform.k, 2) + 
                                    Math.pow((cursorPos.y - startPt.y) * viewTransform.k, 2)
                                );
                                if (screenDist < 10) {
                                    return (
                                        <circle 
                                            cx={startPt.x} cy={startPt.y} 
                                            r={6 / viewTransform.k} 
                                            fill="none" 
                                            stroke={strokeColor} 
                                            strokeWidth={2}
                                            className="animate-pulse"
                                        />
                                    );
                                }
                                return null;
                            })()}
                        </g>
                    )}
                    
                     {tool === ToolType.PEN && penPoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={3 / viewTransform.k} fill={strokeColor} />
                     ))}

                </g>
            </svg>

            {/* Hint for Pen Tool */}
             {tool === ToolType.PEN && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium backdrop-blur-sm pointer-events-none">
                    {penPoints.length === 0 ? 'Click to start drawing polygon' : penPoints.length > 2 ? 'Click to add point. Click start to close.' : 'Click to add point. Enter to finish.'}
                </div>
            )}

            {/* Context Menu Overlay */}
            {contextMenu.visible && (
                <div className="fixed inset-0 z-40" onMouseDown={() => setContextMenu({ ...contextMenu, visible: false })} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ ...contextMenu, visible: false }); }}></div>
            )}
            
            {/* Context Menu */}
            {contextMenu.visible && targetShape && (
                <div 
                    className="fixed bg-white rounded-lg shadow-xl border border-slate-200 w-64 z-50 overflow-hidden text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 font-bold text-slate-700">
                        Edit Shape
                    </div>
                    <div className="p-3 space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                            <input 
                                type="text" 
                                value={targetShape.name}
                                onChange={(e) => onImmediateUpdateShape(targetShape.id, { name: e.target.value })}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-700 focus:border-blue-500 outline-none"
                            />
                        </div>
                        
                        {(targetShape as any).fill !== undefined && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Fill Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={(targetShape as any).fill === 'none' ? '#ffffff' : (targetShape as any).fill}
                                        onChange={(e) => onImmediateUpdateShape(targetShape.id, { fill: e.target.value })}
                                        className="h-8 w-12 p-0 border-0 rounded cursor-pointer"
                                    />
                                    <button 
                                        onClick={() => onImmediateUpdateShape(targetShape.id, { fill: 'none' })}
                                        className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                                            (targetShape as any).fill === 'none' ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                    >
                                        None
                                    </button>
                                </div>
                            </div>
                        )}

                        {(targetShape as any).stroke !== undefined && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Stroke Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={(targetShape as any).stroke}
                                        onChange={(e) => onImmediateUpdateShape(targetShape.id, { stroke: e.target.value })}
                                        className="h-8 w-full p-0 border-0 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="border-t border-slate-100 pt-3 mt-1">
                            <button 
                                onClick={() => {
                                    onDeleteShape(targetShape.id);
                                    setContextMenu({ ...contextMenu, visible: false });
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 py-1.5 rounded transition-colors font-medium"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                                Delete Shape
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};