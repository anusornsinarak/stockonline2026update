

import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import Modal from '../Modal';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import PrinterIcon from '../icons/PrinterIcon';
import QrCodeIcon from '../icons/QrCodeIcon';
import BarcodeIcon from '../icons/BarcodeIcon';

interface ProductLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const ProductQrCodeModal: React.FC<ProductLabelModalProps> = ({ isOpen, onClose, product }) => {
    const [labelType, setLabelType] = useState<'qr' | 'barcode'>('qr');
    const [size, setSize] = useState(256);

    // This effect adds/removes a class to the body for print styling
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('qr-modal-open');
        } else {
            document.body.classList.remove('qr-modal-open');
        }
        // Cleanup on unmount
        return () => {
            document.body.classList.remove('qr-modal-open');
        };
    }, [isOpen]);

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Label for ${product.name}`}
            wrapperClassName="qr-modal-print-wrapper-parent"
        >
            <div className="qr-modal-print-wrapper">
                <div id="qr-print-area" className="flex flex-col items-center justify-center p-4 print:border print:border-black">
                    {labelType === 'qr' ? (
                        <QRCodeSVG value={product.id} size={size} level="H" />
                    ) : (
                        <>
                            <Barcode value={product.id} width={size < 128 ? 0.5 : size < 300 ? 0.6 : 0.7} height={size / 4} displayValue={false} margin={2} />
                            <p className="text-xs font-mono tracking-tight mt-1">{product.id}</p>
                        </>
                    )}
                    <p className="mt-2 text-lg font-semibold text-center print-product-name">{product.name}</p>
                    <p className="text-sm text-slate-500 print-product-unit">({product.unit})</p>
                </div>
            
                <div className="mt-6 space-y-4 no-print">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Label Type</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setLabelType('qr')} className={`flex-1 p-2 rounded-md flex items-center justify-center gap-2 transition-colors ${labelType === 'qr' ? 'bg-white shadow text-sky-600 font-semibold' : 'text-slate-600'}`}>
                                <QrCodeIcon className="w-5 h-5" /> QR Code
                            </button>
                            <button onClick={() => setLabelType('barcode')} className={`flex-1 p-2 rounded-md flex items-center justify-center gap-2 transition-colors ${labelType === 'barcode' ? 'bg-white shadow text-sky-600 font-semibold' : 'text-slate-600'}`}>
                                <BarcodeIcon className="w-5 h-5" /> Barcode
                            </button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="qr-size" className="block text-sm font-medium text-slate-700">
                            Adjust Size: {size}px
                        </label>
                        <input
                            id="qr-size"
                            type="range"
                            min="64"
                            max="512"
                            step="16"
                            value={size}
                            onChange={(e) => setSize(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                         <button 
                            onClick={() => window.print()} 
                            className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            Print
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ProductQrCodeModal;