import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabaseService } from '../services/supabaseService';
import { PublicProductInfo } from '../types';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import CameraIcon from './icons/CameraIcon';
import BarcodeIcon from './icons/BarcodeIcon';
import Modal from './Modal';

type ScanMode = 'camera' | 'text';

const PublicProductScannerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [mode, setMode] = useState<ScanMode>('text');
    const [scannedProductInfo, setScannedProductInfo] = useState<PublicProductInfo | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);

    const [textInput, setTextInput] = useState('');
    const textInputRef = useRef<HTMLInputElement>(null);
    
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = "qr-reader-public";

    const fetchProductInfo = async (productId: string) => {
        setIsLoading(true);
        setScanError(null);
        setScannedProductInfo(null);
        try {
            const productInfo = await supabaseService.getPublicProductInfo(productId);
            if (productInfo) {
                setScannedProductInfo(productInfo);
            } else {
                setScanError(`ไม่พบข้อมูลสำหรับรหัส: ${productId}`);
            }
        } catch (error) {
            setScanError(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดึงข้อมูล");
        } finally {
            setIsLoading(false);
        }
    };

    const startScanner = useCallback(() => {
        if (html5QrCodeRef.current?.isScanning) {
            return;
        }
        const qrCodeScanner = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = qrCodeScanner;

        const successCallback = (decodedText: string) => {
            if (qrCodeScanner.isScanning) {
                try {
                    // State 2 is PAUSED
                    if (qrCodeScanner.getState() !== 2) {
                        qrCodeScanner.pause(true);
                    }
                } catch (e) {
                    console.error("Error pausing scanner:", e);
                }
            }
            fetchProductInfo(decodedText);
        };

        const errorCallback = (errorMessage: string) => { /* Ignore */ };

        qrCodeScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.85, height: Math.min(w, h) * 0.85 }) },
            successCallback,
            errorCallback
        ).then(() => setIsCameraReady(true)).catch(err => setScanError(`ไม่สามารถเปิดกล้องได้: ${err}`));
    }, []);
    
    const stopScanner = () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
        }
    };

    const handleScanNext = useCallback(() => {
        setScannedProductInfo(null);
        setScanError(null);
        setTextInput('');
        if (mode === 'camera' && html5QrCodeRef.current) {
            try {
                // State 2 is PAUSED in html5-qrcode
                if (html5QrCodeRef.current.getState() === 2) {
                    html5QrCodeRef.current.resume();
                }
            } catch (e) {
                console.warn("Could not resume scanner. Restarting.", e);
                startScanner();
            }
        } else if (mode === 'text') {
            textInputRef.current?.focus();
        }
    }, [mode, startScanner]);

    useEffect(() => {
        if (mode === 'camera') {
            startScanner();
        } else {
            stopScanner();
            textInputRef.current?.focus();
        }
        
        return () => stopScanner();
    }, [mode, startScanner]);

    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout> | null = null;
        if (scannedProductInfo || scanError) {
            timerId = setTimeout(() => {
                handleScanNext();
            }, 4000); // 4 seconds delay
        }
        return () => {
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [scannedProductInfo, scanError, handleScanNext]);


    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (textInput.trim()) {
            fetchProductInfo(textInput.trim());
        }
    }

    const renderResult = () => (
        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            {isLoading && <p className="text-slate-500 dark:text-slate-400">กำลังค้นหาข้อมูล...</p>}
            {scannedProductInfo && (
                <>
                    <p className="text-muted-foreground text-lg">คงเหลือ</p>
                    <p className="text-6xl font-bold text-sky-600 dark:text-sky-400 my-2">{scannedProductInfo.quantity.toLocaleString()}</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{scannedProductInfo.name}</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-300">หน่วย: {scannedProductInfo.unit} | Zone: {scannedProductInfo.zone || 'N/A'}</p>
                </>
            )}
            {scanError && !scannedProductInfo && (
                <>
                    <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">เกิดข้อผิดพลาด</h3>
                    <p className="text-red-600 dark:text-red-400 mt-2">{scanError}</p>
                </>
            )}
            <button onClick={handleScanNext} className="mt-6 w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700">
                สแกนถัดไป (อัตโนมัติใน 4 วินาที)
            </button>
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title="สแกน QR Code/Barcode">
            <div className="relative min-h-[300px]">
                <div className="flex mb-4 border-b dark:border-slate-700">
                    <button onClick={() => setMode('camera')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${mode === 'camera' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-600' : 'text-slate-500 dark:text-slate-400'}`}>
                        <CameraIcon className="w-5 h-5" /> ใช้กล้อง
                    </button>
                    <button onClick={() => setMode('text')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${mode === 'text' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-600' : 'text-slate-500 dark:text-slate-400'}`}>
                        <BarcodeIcon className="w-5 h-5" /> พิมพ์รหัส
                    </button>
                </div>

                {mode === 'camera' && (
                    <div id={scannerContainerId} className="w-full h-64 border dark:border-slate-700 rounded-lg overflow-hidden">
                        {!isCameraReady && !scanError && <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">กำลังเปิดกล้อง...</div>}
                    </div>
                )}

                {mode === 'text' && (
                    <form onSubmit={handleTextSubmit} className="space-y-4 p-4">
                        <label htmlFor="text-scan-input" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            พิมพ์รหัสจาก Barcode หรือ QR Code
                        </label>
                        <input
                            ref={textInputRef}
                            id="text-scan-input"
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                        />
                        <button type="submit" className="w-full bg-sky-600 text-white font-bold py-2 rounded-lg">
                            ค้นหา
                        </button>
                    </form>
                )}

                {(isLoading || scannedProductInfo || scanError) && renderResult()}
            </div>
        </Modal>
    );
};

export default PublicProductScannerModal;
