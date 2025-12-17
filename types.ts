export enum ToolType {
    SELECT = 'SELECT',
    PEN = 'PEN',
    RECT = 'RECT',
    CIRCLE = 'CIRCLE',
    SQUARE = 'SQUARE',
    TRIANGLE = 'TRIANGLE',
    HAND = 'HAND'
}

export enum ShapeType {
    PATH = 'path',
    RECT = 'rect',
    CIRCLE = 'circle',
    IMAGE = 'image'
}

export interface BaseShape {
    id: string;
    type: ShapeType;
    visible: boolean;
    locked: boolean;
    name: string; // Added name for Area list
}

export interface PathShape extends BaseShape {
    type: ShapeType.PATH;
    points: Point[]; // Store points directly for editing
    closed: boolean;
    stroke: string;
    strokeWidth: number;
    fill: string;
}

export interface RectShape extends BaseShape {
    type: ShapeType.RECT;
    x: number;
    y: number;
    width: number;
    height: number;
    stroke: string;
    strokeWidth: number;
    fill: string;
}

export interface CircleShape extends BaseShape {
    type: ShapeType.CIRCLE;
    cx: number;
    cy: number;
    r: number;
    stroke: string;
    strokeWidth: number;
    fill: string;
}

export interface ImageShape extends BaseShape {
    type: ShapeType.IMAGE;
    x: number;
    y: number;
    width: number;
    height: number;
    href: string;
    opacity: number;
}

export type Shape = PathShape | RectShape | CircleShape | ImageShape;

export interface Point {
    x: number;
    y: number;
}

export interface ViewTransform {
    x: number;
    y: number;
    k: number; // Zoom scale
}