
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Department, Product, DepartmentInventoryLot, DepartmentInventoryItem, DepartmentProductUsage } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import ChevronUpIcon from '../icons/ChevronUpIcon';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import PrinterIcon from '../icons/PrinterIcon';
import QrCodeIcon from '../icons/QrCodeIcon';
import LoadingScreen from '../LoadingScreen';

interface DepartmentInventoryViewProps {
    department: Department;
}

interface EnrichedInventoryItem {
    product: Product;
    lots: DepartmentInventoryLot[];
    totalQuantity: number;
    minStock: number | null;
    maxStock: number | null;
}

const PrintQrView: React.FC<{ inventory: EnrichedInventoryItem[] }> = ({ inventory }) => {
    return (
        <div className="hidden print-only p-4 font-sarabun text-black">
            <div className="grid grid-cols-3 gap-4">
                {inventory.map((item) => (
                    <div key={item.product.id} className="border border-black p-4 flex flex-col items-center justify-center text-center break-inside-avoid">
                        <QRCodeSVG value={item.product.id} size={100} />
                        <p className="mt-2 font-bold text-sm leading-tight">{item.product.name}</p>
                        <p className="text-xs">รหัส: {item.product.id}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PrintView: React.FC<{
    departmentName: string;
    inventory: EnrichedInventoryItem[];
}> = ({ departmentName, inventory }) => {
    return (
        <div className="hidden print-only p-4 font-sarabun text-black" style={{ fontSize: '10pt' }}>
            <div className="text-center mb-4">
                <h1 className="font-bold">แบบฟอร์มการจัดระบบสต๊อก</h1>
                <p>หน่วยงาน {departmentName} โรงพยาบาลกบินทร์บุรี</p> 
            </div>
            <div className="mb-4 space-y-1 text-sm">
                <div className="flex gap-4">
                    <span><input type="checkbox" className="mr-2 align-middle"/>วัสดุสำนักงาน</span>
                    <span><input type="checkbox" className="mr-2 align-middle"/>วัสดุงานบ้าน</span>
                    <span><input type="checkbox" className="mr-2 align-middle"/>วัสดุการแพทย์</span>
                </div>
                <div className="flex gap-4">
                    <span><input type="checkbox" className="mr-2 align-middle"/>เวชภัณฑ์มิใช่ยา</span>
                    <span><input type="checkbox" className="mr-2 align-middle"/>เวชภัณฑ์</span>
                    <span><input type="checkbox" className="mr-2 align-middle"/>อื่นๆ</span>
                </div>
            </div>
            <table className="w-full border-collapse border border-black text-xs">
                <thead>
                    <tr className="font-bold text-center">
                        <th className="border border-black p-1 w-[5%]">ลำดับที่</th>
                        <th className="border border-black p-1 w-[50%]">รายการ</th>
                        <th className="border border-black p-1 w-[15%]">หน่วยนับ</th>
                        <th className="border border-black p-1 w-[10%]">จำนวนที่ใช้จริง</th>
                        <th className="border border-black p-1 w-[10%]">Maximum</th>
                        <th className="border border-black p-1 w-[10%]">Minimum</th>
                    </tr>
                </thead>
                <tbody>
                    {inventory.map((item, index) => (
                        <tr key={item.product.id}>
                            <td className="border border-black p-1 text-center">{index + 1}</td>
                            <td className="border border-black p-1">{item.product.name}</td>
                            <td className="border border-black p-1 text-center">{item.product.unit}</td>
                            <td className="border border-black p-1 text-center">{item.totalQuantity.toLocaleString()}</td>
                            <td className="border border-black p-1 text-center">{item.maxStock ?? ''}</td>
                            <td className="border border-black p-1 text-center">{item.minStock ?? ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const DepartmentInventoryView: React.FC<DepartmentInventoryViewProps> = ({ department }) => {
    const [inventory, setInventory] = useState<EnrichedInventoryItem[]>([]);
    const [usageData, setUsageData] = useState<Map<string, number>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [isPrinting, setIsPrinting] = useState(false);
    const [isPrintingQr, setIsPrintingQr] = useState(false);

    // State for calculator
    const [calcTarget, setCalcTarget] = useState<'minStock' | 'maxStock'>('maxStock');
    const [calcValue, setCalcValue] = useState<string>('30');
    const [calcUnit, setCalcUnit] = useState<'day' | 'week' | 'month'>('day');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [deptProducts, lotItems, inventoryTotals, deptUsage] = await Promise.all([
                supabaseService.getProductsForDepartment(department.id),
                supabaseService.getDepartmentInventoryLots(department.id),
                supabaseService.getDepartmentInventory(department.id),
                supabaseService.getDepartmentProductUsage(department.id),
            ]);

            const sortedDeptProducts = deptProducts.sort((a, b) => a.name.localeCompare(b.name, 'th'));
            const lotsByProduct = lotItems.reduce((acc, lot) => {
                if (!acc[lot.productId]) acc[lot.productId] = [];
                acc[lot.productId].push(lot);
                return acc;
            }, {} as Record<string, DepartmentInventoryLot[]>);
            
            // FIX: Explicitly type the Map or use forEach to ensure correct type inference
            const totalsMap = new Map<string, DepartmentInventoryItem>();
            inventoryTotals.forEach(i => totalsMap.set(i.productId, i));

            setUsageData(new Map(deptUsage.map(u => [u.productId, u.totalApprovedQuantity])));

            const enrichedData = sortedDeptProducts.map(product => {
                const totalInfo = totalsMap.get(product.id);
                let productLots = lotsByProduct[product.id] || [];
                const totalFromLots = productLots.reduce((sum, lot) => sum + lot.quantity, 0);

                if (productLots.length === 0) {
                     productLots.push({
                         departmentId: department.id,
                         productId: product.id,
                         quantity: totalInfo?.quantity || 0,
                         lotNumber: null,
                         expiryDate: null,
                     });
                }
                
                return {
                    product,
                    lots: productLots,
                    totalQuantity: totalInfo?.quantity ?? totalFromLots,
                    minStock: totalInfo?.minStock ?? null,
                    maxStock: totalInfo?.maxStock ?? null,
                };
            });

            setInventory(enrichedData);

        } catch (err) {
            setError("ไม่สามารถโหลดข้อมูลคลังได้");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [department.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleMinMaxChange = (productId: string, field: 'minStock' | 'maxStock', value: string) => {
        const numValue = value === '' ? null : parseInt(value, 10);
        if (value !== '' && (numValue === null || isNaN(numValue) || numValue < 0)) return;

        setInventory(prev => prev.map(item =>
            item.product.id === productId
                ? { ...item, [field]: numValue }
                : item
        ));
    };

    const handleLotChange = (productId: string, lotIndex: number, field: 'quantity' | 'lotNumber' | 'expiryDate', value: string) => {
        setInventory(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newLots = [...item.lots];
                const targetLot = newLots[lotIndex];
                if (targetLot) {
                    if (field === 'quantity') {
                        const numValue = parseInt(value, 10);
                        targetLot.quantity = isNaN(numValue) || numValue < 0 ? 0 : numValue;
                    } else {
                        (targetLot as any)[field] = value;
                    }
                }
                return { ...item, lots: newLots };
            }
            return item;
        }));
    };

    const handleAddLot = (productId: string) => {
        setInventory(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newLot: DepartmentInventoryLot = {
                    departmentId: department.id,
                    productId: productId,
                    quantity: 0,
                    lotNumber: '',
                    expiryDate: '',
                };
                return { ...item, lots: [...item.lots, newLot] };
            }
            return item;
        }));
    };

    const handleRemoveLot = (productId: string, lotIndex: number) => {
        if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Lot นี้?")) return;
        setInventory(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newLots = item.lots.filter((_, index) => index !== lotIndex);
                 // If removing the last lot, add a default empty one back
                if (newLots.length === 0) {
                    newLots.push({
                        departmentId: department.id,
                        productId: productId,
                        quantity: 0,
                        lotNumber: null,
                        expiryDate: null,
                    });
                }
                return { ...item, lots: newLots };
            }
            return item;
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const lotUpdates = inventory.flatMap(item => item.lots);
            
            const inventoryUpdates = inventory.map(item => {
                const totalQuantity = item.lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
                return {
                    productId: item.product.id,
                    minStock: item.minStock,
                    maxStock: item.maxStock,
                    quantity: totalQuantity,
                };
            });

            await Promise.all([
                supabaseService.updateDepartmentInventoryBatch(department.id, inventoryUpdates),
                supabaseService.updateDepartmentInventoryLotsBatch(department.id, lotUpdates)
            ]);
            
            setSuccessMessage('บันทึกข้อมูลสำเร็จ!');
            setTimeout(() => setSuccessMessage(null), 3000);
            fetchData(); // Refetch to confirm
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAutoCalculate = () => {
        const numValue = parseInt(calcValue, 10);
        if (isNaN(numValue) || numValue <= 0) {
            alert('กรุณากรอกค่าที่ถูกต้อง');
            return;
        }

        let multiplier = 1;
        if (calcUnit === 'week') multiplier = 7;
        if (calcUnit === 'month') multiplier = 30;

        const days = numValue * multiplier;

        setInventory(prevInventory => {
            return prevInventory.map(item => {
                const annualUsage = usageData.get(item.product.id) || 0;
                const dailyUsage = annualUsage / 365;
                const calculatedValue = Math.ceil(dailyUsage * days);

                return {
                    ...item,
                    [calcTarget]: calculatedValue,
                };
            });
        });
        alert(`คำนวณและใส่ค่าสำหรับ ${calcTarget === 'minStock' ? 'Min Stock' : 'Max Stock'} สำเร็จ!`);
    };

    const handlePrint = () => {
        setIsPrinting(true);
    };

    const handlePrintQr = () => {
        setIsPrintingQr(true);
    };

    useEffect(() => {
        if (isPrinting || isPrintingQr) {
            const handleAfterPrint = () => {
                setIsPrinting(false);
                setIsPrintingQr(false);
            };
            window.addEventListener('afterprint', handleAfterPrint, { once: true });
            setTimeout(() => window.print(), 100);
            return () => window.removeEventListener('afterprint', handleAfterPrint);
        }
    }, [isPrinting, isPrintingQr]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(i => i.product.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [inventory, searchTerm]);

    if (isLoading) return <LoadingScreen message="กำลังโหลดข้อมูลคลังสินค้า..." />;
    if (error) return <div className="text-center p-8 text-red-500">{error}</div>;

    return (
        <div className="max-w-5xl mx-auto bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg">
            {isPrinting && <PrintView departmentName={department.name} inventory={filteredInventory} />}
            {isPrintingQr && <PrintQrView inventory={filteredInventory} />}
            <div className="no-print">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">คลังของฉัน</h2>
                        <p className="text-slate-600 dark:text-slate-300">จัดการสต็อกคงคลังสำหรับหน่วยงาน: <span className="font-semibold">{department.name}</span></p>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center">
                        <button
                            onClick={handlePrintQr}
                            className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                        >
                            <QrCodeIcon className="w-5 h-5"/>
                            <span className="hidden sm:inline">พิมพ์ QR Code</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <PrinterIcon className="w-5 h-5"/>
                            <span>พิมพ์</span>
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors"
                        >
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                        </button>
                    </div>
                </div>

                {successMessage && <p className="text-green-600 dark:text-green-400 mb-4">{successMessage}</p>}

                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">คำนวณ Min/Max อัตโนมัติ</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                            <div>
                                <label htmlFor="calc-target" className="text-xs font-medium">ตั้งค่า</label>
                                <select id="calc-target" value={calcTarget} onChange={e => setCalcTarget(e.target.value as 'minStock' | 'maxStock')} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                                    <option value="minStock">Min Stock</option>
                                    <option value="maxStock">Max Stock</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="calc-value" className="text-xs font-medium">เท่ากับยอดใช้</label>
                                <input id="calc-value" type="number" value={calcValue} onChange={e => setCalcValue(e.target.value)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="calc-unit" className="text-xs font-medium invisible">หน่วย</label>
                            <select id="calc-unit" value={calcUnit} onChange={e => setCalcUnit(e.target.value as 'day' | 'week' | 'month')} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                                <option value="day">วัน</option>
                                <option value="week">สัปดาห์</option>
                                <option value="month">เดือน</option>
                            </select>
                        </div>
                        <button onClick={handleAutoCalculate} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-slate-400" disabled={isSaving}>คำนวณและใส่ค่า</button>
                    </div>
                </div>

                <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหารายการ..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg shadow-sm"
                    />
                </div>

                <div className="border dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-sm sm:text-base">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="p-2 sm:p-3 text-left font-semibold text-slate-500 dark:text-slate-400">รายการ</th>
                                    <th className="p-2 sm:p-3 text-center font-semibold text-slate-500 dark:text-slate-400 w-16 sm:w-28">นับ</th>
                                    <th className="p-2 sm:p-3 text-center font-semibold text-slate-500 dark:text-slate-400 w-16 sm:w-32">รวม</th>
                                    <th className="hidden sm:table-cell p-2 sm:p-3 text-center font-semibold text-slate-500 dark:text-slate-400 w-32">Min</th>
                                    <th className="hidden sm:table-cell p-2 sm:p-3 text-center font-semibold text-slate-500 dark:text-slate-400 w-32">Max</th>
                                    <th className="p-2 sm:p-3 w-12 sm:w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInventory.map(item => {
                                    const { product } = item;
                                    const totalQuantity = item.lots.reduce((sum, lot) => sum + lot.quantity, 0);
                                    const isExpanded = expandedProducts.has(product.id);
                                    
                                    return (
                                        <React.Fragment key={product.id}>
                                            <tr className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/20">
                                                <td className="p-2 sm:p-3">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{product.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 sm:hidden flex gap-2">
                                                        <span>Min: <input type="number" min="0" value={item.minStock ?? ''} onChange={e => handleMinMaxChange(product.id, 'minStock', e.target.value)} className="w-12 text-center p-0.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded"/></span>
                                                        <span>Max: <input type="number" min="0" value={item.maxStock ?? ''} onChange={e => handleMinMaxChange(product.id, 'maxStock', e.target.value)} className="w-12 text-center p-0.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded"/></span>
                                                    </div>
                                                </td>
                                                <td className="p-2 sm:p-3 text-center text-slate-600 dark:text-slate-300">{product.unit}</td>
                                                <td className="p-2 sm:p-3 text-center text-base sm:text-lg font-bold text-sky-700 dark:text-sky-400">{totalQuantity.toLocaleString()}</td>
                                                <td className="hidden sm:table-cell p-2 sm:p-3 text-center">
                                                    <input type="number" min="0" value={item.minStock ?? ''} onChange={e => handleMinMaxChange(product.id, 'minStock', e.target.value)} className="w-20 sm:w-24 text-right p-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md"/>
                                                </td>
                                                <td className="hidden sm:table-cell p-2 sm:p-3 text-center">
                                                    <input type="number" min="0" value={item.maxStock ?? ''} onChange={e => handleMinMaxChange(product.id, 'maxStock', e.target.value)} className="w-20 sm:w-24 text-right p-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md"/>
                                                </td>
                                                <td className="p-2 sm:p-3 text-center">
                                                    <button onClick={() => setExpandedProducts(prev => {
                                                        const newSet = new Set(prev);
                                                        if (newSet.has(product.id)) newSet.delete(product.id);
                                                        else newSet.add(product.id);
                                                        return newSet;
                                                    })} className="p-1 sm:p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                                        {isExpanded ? <ChevronUpIcon className="w-4 h-4 sm:w-5 sm:h-5"/> : <ChevronDownIcon className="w-4 h-4 sm:w-5 sm:h-5"/>}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50 dark:bg-slate-900/50">
                                                    <td colSpan={6} className="p-2 sm:p-3">
                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold text-sm">จัดการ Lot</h4>
                                                            <div className="grid grid-cols-4 gap-2 items-center px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                                <span>Lot Number</span>
                                                                <span>วันหมดอายุ</span>
                                                                <span className="text-right">จำนวนคงคลัง</span>
                                                                <span></span> {/* For delete button column */}
                                                            </div>
                                                            {item.lots.map((lot, index) => (
                                                                <div key={index} className="grid grid-cols-4 gap-2 items-center">
                                                                    <input type="text" placeholder="Lot Number" value={lot.lotNumber || ''} onChange={(e) => handleLotChange(product.id, index, 'lotNumber', e.target.value)} className="p-1 border rounded text-sm w-full dark:bg-slate-700 dark:border-slate-600" />
                                                                    <input type="date" value={lot.expiryDate || ''} onChange={(e) => handleLotChange(product.id, index, 'expiryDate', e.target.value)} className="p-1 border rounded text-sm w-full dark:bg-slate-700 dark:border-slate-600" />
                                                                    <input type="number" placeholder="0" value={lot.quantity || ''} onChange={(e) => handleLotChange(product.id, index, 'quantity', e.target.value)} min="0" className="p-1 border rounded text-sm w-full text-right dark:bg-slate-700 dark:border-slate-600" />
                                                                    <button onClick={() => handleRemoveLot(product.id, index)} className="text-slate-400 hover:text-red-500 justify-self-center"><TrashIcon className="w-4 h-4" /></button>
                                                                </div>
                                                            ))}
                                                            <button onClick={() => handleAddLot(product.id)} className="flex items-center gap-1 text-sm text-sky-600 font-medium"><PlusIcon className="w-4 h-4"/> เพิ่ม Lot</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredInventory.length === 0 && (
                                    <tr><td colSpan={6} className="text-center p-8 text-slate-500 dark:text-slate-400">ไม่พบรายการที่ค้นหา</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DepartmentInventoryView;
