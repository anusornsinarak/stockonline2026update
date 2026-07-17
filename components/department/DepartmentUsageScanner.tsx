import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Department, Product, DepartmentInventoryItem } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import LoadingScreen from '../LoadingScreen';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';

interface DepartmentUsageScannerProps {
    department: Department;
}

const DepartmentUsageScanner: React.FC<DepartmentUsageScannerProps> = ({ department }) => {
    const [scannedProductId, setScannedProductId] = useState<string | null>(null);
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState<string>('1');
    const [usageType, setUsageType] = useState<'patient' | 'stock_deduction'>('patient');
    const [hn, setHn] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    const [isManualMode, setIsManualMode] = useState(false);
    const [inventory, setInventory] = useState<(DepartmentInventoryItem & { product: Product })[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const [inventoryData, productsData] = await Promise.all([
                    supabaseService.getDepartmentInventory(department.id),
                    supabaseService.getProducts()
                ]);
                
                // Merge product details into inventory items
                const inventoryWithProducts = inventoryData.map(item => {
                    const product = productsData.find(p => p.id === item.productId);
                    return {
                        ...item,
                        product: product || { id: item.productId, name: 'ไม่ทราบชื่อสินค้า', category: '', unit: '', price: 0, minStock: 0, maxStock: 0 } as unknown as Product
                    };
                });
                
                setInventory(inventoryWithProducts);
            } catch (error) {
                console.error("Error fetching inventory:", error);
            }
        };
        fetchInventory();
    }, [department.id]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(i => 
            i.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            i.product?.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.productId?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [inventory, searchTerm]);

    useEffect(() => {
        if (!scannedProductId && !isManualMode) {
            scannerRef.current = new Html5QrcodeScanner(
                "qr-reader-usage",
                { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
                false
            );

            scannerRef.current.render(onScanSuccess, onScanFailure);
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner. ", error);
                });
            }
        };
    }, [scannedProductId, isManualMode]);

    const onScanSuccess = async (decodedText: string) => {
        if (scannerRef.current) {
            scannerRef.current.clear();
        }
        setScannedProductId(decodedText);
        setIsLoading(true);
        try {
            const [inventoryData, productsData] = await Promise.all([
                supabaseService.getDepartmentInventory(department.id),
                supabaseService.getProducts()
            ]);
            
            const item = inventoryData.find(i => i.productId === decodedText);
            
            if (item) {
                const product = productsData.find(p => p.id === item.productId);
                setScannedProduct(product || { id: item.productId, name: 'ไม่ทราบชื่อสินค้า', category: '', unit: '', price: 0, minStock: 0, maxStock: 0 } as unknown as Product);
            } else {
                setMessage({ type: 'error', text: 'ไม่พบสินค้านี้ในคลังของหน่วยงาน' });
                setScannedProductId(null);
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' });
            setScannedProductId(null);
        } finally {
            setIsLoading(false);
        }
    };

    const onScanFailure = (error: any) => {
        // Ignore scan failures
    };

    const handleManualSelect = (item: DepartmentInventoryItem & { product: Product }) => {
        setScannedProductId(item.productId);
        setScannedProduct(item.product);
        setIsManualMode(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannedProduct) return;
        
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            setMessage({ type: 'error', text: 'กรุณาระบุจำนวนที่ถูกต้อง' });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            // Log usage in system_logs
            const logMessage = JSON.stringify({
                action: 'PRODUCT_USAGE',
                departmentId: department.id,
                productId: scannedProduct.id,
                productName: scannedProduct.name,
                quantity: qty,
                usageType: usageType,
                hn: usageType === 'patient' ? (hn || null) : null,
                date: date
            });

            await supabaseService.logSystemEvent({
                level: 'INFO',
                event: 'PRODUCT_USAGE',
                message: logMessage
            });

            // Deduct from department inventory
            const inventory = await supabaseService.getDepartmentInventory(department.id);
            const item = inventory.find(i => i.productId === scannedProduct.id);
            
            if (item) {
                const newQuantity = Math.max(0, item.quantity - qty);
                await supabaseService.updateDepartmentInventoryBatch(department.id, [{
                    productId: scannedProduct.id,
                    quantity: newQuantity,
                    min_stock: item.minStock,
                    max_stock: item.maxStock
                }]);
            }

            setMessage({ type: 'success', text: `บันทึกการใช้ ${scannedProduct.name} จำนวน ${qty} ${scannedProduct.unit} สำเร็จ` });
            
            // Reset form
            setScannedProductId(null);
            setScannedProduct(null);
            setQuantity('1');
            setUsageType('patient');
            setHn('');
            
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">สแกนการใช้สินค้า</h2>
            
            {message && (
                <div className={`p-4 mb-6 rounded-xl ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {!scannedProductId ? (
                <div className="flex flex-col items-center">
                    {!isManualMode ? (
                        <>
                            <div id="qr-reader-usage" className="w-full max-w-md overflow-hidden rounded-2xl shadow-inner border-2 border-slate-200 dark:border-slate-700"></div>
                            <p className="mt-4 text-slate-500 dark:text-slate-400 text-center">
                                สแกน QR Code ของสินค้าเพื่อบันทึกการใช้งานตัดสต๊อก
                            </p>
                            <button
                                onClick={() => setIsManualMode(true)}
                                className="mt-6 text-sky-600 dark:text-sky-400 font-medium hover:underline flex items-center gap-2"
                            >
                                <MagnifyingGlassIcon className="w-5 h-5" />
                                ค้นหาสินค้าด้วยตนเอง
                            </button>
                        </>
                    ) : (
                        <div className="w-full max-w-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">เลือกสินค้าจากคลัง</h3>
                                <button
                                    onClick={() => setIsManualMode(false)}
                                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                    กลับไปสแกน QR
                                </button>
                            </div>
                            <div className="relative mb-4">
                                <input
                                    type="text"
                                    placeholder="ค้นหาชื่อ หรือ รหัสสินค้า..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <MagnifyingGlassIcon className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                            </div>
                            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                                {filteredInventory.length === 0 ? (
                                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">ไม่พบสินค้าในคลัง</p>
                                ) : (
                                    filteredInventory.map(item => (
                                        <button
                                            key={item.productId}
                                            onClick={() => handleManualSelect(item)}
                                            className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                                        >
                                            <div className="font-bold text-slate-800 dark:text-slate-100">{item.product?.name || 'ไม่ทราบชื่อสินค้า'}</div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 flex justify-between mt-1">
                                                <span>รหัส: {item.productId}</span>
                                                <span>คงเหลือ: {item.quantity} {item.product?.unit || ''}</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {scannedProduct && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{scannedProduct.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">รหัส: {scannedProduct.id}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">จำนวนที่ใช้ ({scannedProduct?.unit})</label>
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ประเภทการใช้งาน</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="usageType" 
                                    value="patient" 
                                    checked={usageType === 'patient'} 
                                    onChange={() => setUsageType('patient')}
                                    className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-slate-700 dark:text-slate-300">ใช้กับคนไข้</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="usageType" 
                                    value="stock_deduction" 
                                    checked={usageType === 'stock_deduction'} 
                                    onChange={() => setUsageType('stock_deduction')}
                                    className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-slate-700 dark:text-slate-300">เบิกตัดออกจาก stock</span>
                            </label>
                        </div>
                    </div>

                    {usageType === 'patient' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">HN คนไข้ (ถ้ามี)</label>
                            <input
                                type="text"
                                value={hn}
                                onChange={(e) => setHn(e.target.value)}
                                className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                                placeholder="ระบุ HN คนไข้"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">วันที่ใช้</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                            required
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setScannedProductId(null);
                                setScannedProduct(null);
                                setMessage(null);
                            }}
                            className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 transition-colors shadow-lg shadow-sky-500/30 disabled:opacity-50"
                        >
                            {isLoading ? 'กำลังบันทึก...' : 'บันทึกการใช้'}
                        </button>
                    </div>
                </form>
            )}
            
            {isLoading && <LoadingScreen message="กำลังประมวลผล..." />}
        </div>
    );
};

export default DepartmentUsageScanner;
