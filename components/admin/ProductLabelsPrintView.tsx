import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import ArrowUturnLeftIcon from '../icons/ArrowUturnLeftIcon';
import QrCodeIcon from '../icons/QrCodeIcon';
import BarcodeIcon from '../icons/BarcodeIcon';

interface ProductLabelsPrintViewProps {
    allProducts: Product[];
    onClose: () => void;
}

const ProductLabelsPrintView: React.FC<ProductLabelsPrintViewProps> = ({ allProducts, onClose }) => {
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(allProducts.map(p => p.id)));
    const [labelType, setLabelType] = useState<'qr' | 'barcode'>('qr');
    const [columns, setColumns] = useState(4);
    const [labelHeight, setLabelHeight] = useState(2); // in inches

    const toggleProduct = (productId: string) => {
        setSelectedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };
    
    const toggleAll = () => {
        if (selectedProducts.size === allProducts.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(allProducts.map(p => p.id)));
        }
    };

    const productsToPrint = useMemo(() => {
        return allProducts.filter(p => selectedProducts.has(p.id)).sort((a,b) => a.name.localeCompare(b.name, 'th'));
    }, [allProducts, selectedProducts]);

    return (
        <div className="animate-fade-in">
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .print-area {
                        display: grid;
                        grid-template-columns: repeat(${columns}, 1fr);
                        gap: 0;
                        width: 100%;
                    }
                    .print-label {
                        page-break-inside: avoid;
                        border: 1px dotted #ccc;
                        padding: 2mm;
                        text-align: center;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        height: ${labelHeight}in;
                    }
                    .print-label-name {
                        font-size: 8pt;
                        font-weight: bold;
                        word-break: break-word;
                        margin-top: 2mm;
                    }
                }
                `}
            </style>

            {/* Controls */}
            <div className="no-print p-4 bg-slate-50 border border-slate-200 rounded-lg mb-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">พิมพ์ฉลากสินค้า</h3>
                    <button onClick={onClose} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
                        <ArrowUturnLeftIcon className="w-5 h-5" />
                        กลับ
                    </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium">ประเภทฉลาก</label>
                        <select value={labelType} onChange={e => setLabelType(e.target.value as 'qr' | 'barcode')} className="mt-1 w-full p-2 border rounded-md">
                            <option value="qr">QR Code</option>
                            <option value="barcode">Barcode</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">คอลัมน์ต่อแถว</label>
                        <input type="number" min="1" max="10" value={columns} onChange={e => setColumns(Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">ความสูง (นิ้ว)</label>
                        <input type="number" min="0.5" max="5" step="0.1" value={labelHeight} onChange={e => setLabelHeight(Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <button onClick={() => window.print()} className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700">พิมพ์</button>
                    <div className="text-sm">
                        เลือก {selectedProducts.size} จาก {allProducts.length} รายการ
                    </div>
                </div>
            </div>

            {/* Product Selection List */}
            <div className="no-print max-h-60 overflow-y-auto border rounded-lg p-2 mb-4">
                <div className="flex items-center p-2 border-b">
                    <input type="checkbox" checked={selectedProducts.size === allProducts.length} onChange={toggleAll} className="h-4 w-4 rounded" />
                    <label className="ml-3 font-semibold">เลือกทั้งหมด</label>
                </div>
                 {allProducts.map(product => (
                    <div key={product.id} className="flex items-center p-2">
                        <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleProduct(product.id)} className="h-4 w-4 rounded" />
                        <label className="ml-3 text-sm">{product.name}</label>
                    </div>
                ))}
            </div>


            {/* Print Area */}
            <div className="print-area">
                {productsToPrint.map(product => (
                    <div key={product.id} className="print-label">
                         {labelType === 'qr' ? (
                            <QRCodeSVG value={product.id} size={50} level="M" />
                        ) : (
                            <Barcode value={product.id} height={20} width={0.8} displayValue={false} margin={0} />
                        )}
                        <p className="print-label-name">{product.name}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProductLabelsPrintView;
