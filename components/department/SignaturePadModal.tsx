

import React, { useRef, useEffect, useState } from 'react';
import Modal from '../Modal';

interface SignaturePadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureDataUrl: string) => void;
}

const SignaturePadModal: React.FC<SignaturePadModalProps> = ({ isOpen, onClose, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    const getContext = () => canvasRef.current?.getContext('2d');

    const initializeCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) {
            // Set display size (css pixels)
            const rect = canvas.getBoundingClientRect();
            // FIX: Add null check for getBoundingClientRect result to prevent potential runtime errors if the canvas element is not found.
            if (!rect) return;
            
            const { width, height } = rect;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            // Set actual size in memory (scaled for high-dpi displays)
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);

            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    };
    
    useEffect(() => {
        if (isOpen) {
            setHasDrawn(false);
            // Delay initialization to ensure modal and canvas are rendered
            setTimeout(initializeCanvas, 100);
        }
    }, [isOpen]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        if (e.nativeEvent instanceof MouseEvent) {
            return { x: e.nativeEvent.clientX - rect.left, y: e.nativeEvent.clientY - rect.top };
        }
        if (e.nativeEvent instanceof TouchEvent) {
            return { x: e.nativeEvent.touches[0].clientX - rect.left, y: e.nativeEvent.touches[0].clientY - rect.top };
        }
        return { x: 0, y: 0 };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const ctx = getContext();
        if (ctx) {
            const { x, y } = getCoords(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
            setIsDrawing(true);
            setHasDrawn(true);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const ctx = getContext();
        if (ctx) {
            const { x, y } = getCoords(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        const ctx = getContext();
        if (ctx) {
            ctx.closePath();
            setIsDrawing(false);
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
        }
    };

    const handleSave = () => {
        if (!hasDrawn) {
            alert("กรุณาลงลายเซ็นก่อนบันทึก");
            return;
        }
        const canvas = canvasRef.current;
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="ลงลายเซ็น">
            <div className="flex flex-col items-center">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg w-full h-48 cursor-crosshair bg-slate-50 dark:bg-slate-700"
                />
                <div className="flex justify-between w-full mt-4">
                    <button onClick={clearCanvas} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg">
                        ล้าง
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="bg-slate-500 text-white font-bold py-2 px-4 rounded-lg">
                            ยกเลิก
                        </button>
                        <button onClick={handleSave} className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg">
                            บันทึก
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default SignaturePadModal;