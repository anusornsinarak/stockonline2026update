import React, { useRef, useState, useEffect } from 'react';
import Modal from './Modal';

interface SignaturePadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureDataUrl: string) => void;
    onDelete?: () => void;
    requesterName: string;
}

const SignaturePadModal: React.FC<SignaturePadModalProps> = ({ isOpen, onClose, onSave, onDelete, requesterName }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#000000';
            }
        }
    }, [isOpen]);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // Handle touch events
        if ('touches' in e) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        
        // Handle mouse events
        return {
            x: (e as React.MouseEvent).clientX - rect.left,
            y: (e as React.MouseEvent).clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.closePath();
        }
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleSave = () => {
        if (canvasRef.current) {
            // Check if canvas is empty
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const pixelBuffer = new Uint32Array(
                ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
            );
            const hasContent = pixelBuffer.some(color => color !== 0);
            
            if (!hasContent) {
                alert('กรุณาเซ็นชื่อก่อนบันทึก');
                return;
            }

            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`ลายเซ็นผู้เบิก: ${requesterName}`} size="md">
            <div className="flex flex-col items-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">
                    กรุณาเซ็นชื่อในกรอบด้านล่าง ลายเซ็นนี้จะถูกบันทึกและใช้สำหรับใบเบิกในครั้งต่อไปโดยอัตโนมัติ
                </p>
                <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white overflow-hidden touch-none">
                    <canvas
                        ref={canvasRef}
                        width={300}
                        height={150}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="cursor-crosshair"
                    />
                </div>
                <div className="flex justify-between w-full mt-6 gap-2">
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                            ลบลายเซ็นที่บันทึกไว้
                        </button>
                    )}
                    <button
                        onClick={clearSignature}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 flex-1"
                    >
                        ล้างลายเซ็น
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex-1"
                    >
                        บันทึกลายเซ็น
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SignaturePadModal;
