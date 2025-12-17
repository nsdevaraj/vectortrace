import { Point } from '../types';

// Helper to convert image data to grayscale
export const toGrayscale = (data: Uint8ClampedArray): Uint8Array => {
    const gray = new Uint8Array(data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    return gray;
};

// Gaussian Blur
export const gaussianBlur = (data: Float32Array | Uint8Array, w: number, h: number): Float32Array => {
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const kSum = 16;
    const output = new Float32Array(data.length);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    sum += data[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
                }
            }
            output[y * w + x] = sum / kSum;
        }
    }
    return output;
};

// Canny Edge Detection with NMS and Hysteresis
export const cannyEdgeDetection = (imageData: ImageData, lowThreshold: number, highThreshold: number): Uint8ClampedArray => {
    const { width, height } = imageData;
    const gray = toGrayscale(imageData.data);
    const blurred = gaussianBlur(gray, width, height);

    const magnitudes = new Float32Array(width * height);
    const directions = new Float32Array(width * height);

    // Sobel Kernels
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    // 1. Gradient Calculation
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;
            
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const val = blurred[(y + i) * width + (x + j)];
                    sumX += val * gx[(i + 1) * 3 + (j + 1)];
                    sumY += val * gy[(i + 1) * 3 + (j + 1)];
                }
            }

            magnitudes[y * width + x] = Math.sqrt(sumX * sumX + sumY * sumY);
            directions[y * width + x] = Math.atan2(sumY, sumX);
        }
    }

    // 2. Non-Maximum Suppression
    const nms = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const angle = directions[y * width + x];
            const mag = magnitudes[y * width + x];
            
            // Normalize angle to 0-180
            let a = angle * (180 / Math.PI);
            if (a < 0) a += 180;
            
            let q = 255; 
            let r = 255;

            // 0 degrees (East-West) - Gradient direction check (Left/Right)
            if ((a >= 0 && a < 22.5) || (a >= 157.5 && a <= 180)) {
                q = magnitudes[y * width + (x + 1)];
                r = magnitudes[y * width + (x - 1)];
            }
            // 45 degrees (North-East) - Check TopRight/BottomLeft
            else if (a >= 22.5 && a < 67.5) {
                // Diagonal / (45 deg) goes from SW to NE. 
                // Perpendicular Gradient points SE or NW. 
                // Check neighbors in gradient direction
                q = magnitudes[(y + 1) * width + (x + 1)];
                r = magnitudes[(y - 1) * width + (x - 1)];
            }
            // 90 degrees (North-South) - Check Top/Bottom
            else if (a >= 67.5 && a < 112.5) {
                q = magnitudes[(y + 1) * width + x];
                r = magnitudes[(y - 1) * width + x];
            }
            // 135 degrees (North-West) - Check TopRight/BottomLeft (Diagonal /)
            else if (a >= 112.5 && a < 157.5) {
                q = magnitudes[(y - 1) * width + (x + 1)];
                r = magnitudes[(y + 1) * width + (x - 1)];
            }

            if (mag >= q && mag >= r) {
                nms[y * width + x] = mag;
            } else {
                nms[y * width + x] = 0;
            }
        }
    }

    // 3. Hysteresis Thresholding
    const edges = new Uint8ClampedArray(imageData.data.length); 
    const traceMap = new Uint8Array(width * height); // 0: none, 1: weak, 2: strong
    const stack: number[] = [];

    // Identify Strong and Weak
    for (let i = 0; i < nms.length; i++) {
        if (nms[i] >= highThreshold) {
            traceMap[i] = 2;
            stack.push(i);
        } else if (nms[i] >= lowThreshold) {
            traceMap[i] = 1;
        }
    }

    // Track edges from strong
    while (stack.length > 0) {
        const idx = stack.pop()!;
        const cx = idx % width;
        const cy = Math.floor(idx / width);
        
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const nx = cx + j;
                const ny = cy + i;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (traceMap[nIdx] === 1) {
                        traceMap[nIdx] = 2; // Promote weak to strong
                        stack.push(nIdx);
                    }
                }
            }
        }
    }

    // Output to RGBA
    for (let i = 0; i < traceMap.length; i++) {
        const val = traceMap[i] === 2 ? 255 : 0;
        const idx = i * 4;
        edges[idx] = val;
        edges[idx + 1] = val;
        edges[idx + 2] = val;
        edges[idx + 3] = 255;
    }

    return edges;
};

// Vectorization: Convert Pixel Edges to Point Arrays
export const vectoriseEdges = (edgeData: Uint8ClampedArray, width: number, height: number, simplification: number = 1.0, minPathLength: number = 20): Point[][] => {
    const pixels: Point[] = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Check Red channel
            if (edgeData[(y * width + x) * 4] === 255) {
                pixels.push({ x, y });
            }
        }
    }

    const visited = new Set<string>();
    const paths: Point[][] = [];

    for (const p of pixels) {
        const key = `${p.x},${p.y}`;
        if (visited.has(key)) continue;

        const path: Point[] = [];
        // DFS stack
        const stack = [p];
        visited.add(key);
        path.push(p);

        // Simple greedy walk
        while (stack.length) {
            const curr = stack[stack.length - 1]; // Peek
            let foundNext = false;

            // Search neighbors
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = curr.x + dx;
                    const ny = curr.y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nKey = `${nx},${ny}`;
                        if (!visited.has(nKey) && edgeData[(ny * width + nx) * 4] === 255) {
                            visited.add(nKey);
                            const nextPt = { x: nx, y: ny };
                            path.push(nextPt);
                            stack.push(nextPt);
                            foundNext = true;
                            break; // Greedy: take first neighbor found and continue
                        }
                    }
                }
                if (foundNext) break;
            }

            if (!foundNext) {
                stack.pop(); // Backtrack
            }
        }

        if (path.length > minPathLength) {
            paths.push(path);
        }
    }

    const stride = Math.max(1, Math.floor(simplification));
    
    return paths.map(path => {
        if (path.length < 2) return [];
        const simplePath = [];
        for (let i = 0; i < path.length; i += stride) {
            simplePath.push(path[i]);
        }
        // Ensure last point is included
        if (simplePath[simplePath.length - 1] !== path[path.length - 1]) {
            simplePath.push(path[path.length - 1]);
        }
        return simplePath;
    }).filter(p => p.length > 1);
};