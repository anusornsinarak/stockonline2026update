import React, { useState, useEffect, useMemo } from 'react';
import { Product, PurchasePlanItem, InventoryItem, ProductCategory, productCategories, Company, ProductSupplier, DocumentSettings, ProductUsageHistory } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import TableTemplate from './TableTemplate';
import CalculatorIcon from '../icons/CalculatorIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import ChevronUpIcon from '../icons/ChevronUpIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import ShoppingCartIcon from '../icons/ShoppingCartIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';
import Modal from '../Modal';
import TrashIcon from '../icons/TrashIcon';
import PurchasePlanPrintView from './PurchasePlanPrintView';
import PrinterIcon from '../icons/PrinterIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';

interface ManageStockLevelsViewProps {
    products: Product[];
    purchasePlan: PurchasePlanItem[];
    inventory: InventoryItem[];
    onSave: () => void;
    companies: Company[];
    productSuppliers: ProductSupplier[];
    onSwitchToTab: (tab: 'purchaseOrder') => void;
}

type SortKey = 'productName' | 'annualPlanQty' | 'monthlyAvg' | 'currentStock' | 'plannedValue' | 'stockReserveRate';

interface PlanDataItem {
    product: Product;
    annualPlanQty: number;
    monthlyAvg: number;
    currentStock: number;
    plannedValue: number;
    stockReserveRate: number;
}

const StockLevelBar: React.FC<{ current: number; min: number | null; max: number | null }> = ({ current, min, max }) => {
    if (max === null || max <= 0) {
        return <span className="font-semibold">{current.toLocaleString()}</span>;
    }

    const percentage = Math.min((current / max) * 100, 100);
    const minPercentage = min !== null && min > 0 ? (min / max) * 100 : 0;

    let barColor = 'bg-green-500';
    let textColor = 'text-green-800 dark:text-green-200';
    if (min !== null && current < min) {
        barColor = 'bg-red-500';
        textColor = 'text-red-800 dark:text-red-200';
    } else if (current > max) {
        barColor = 'bg-sky-500';
        textColor = 'text-sky-800 dark:text-sky-200';
    }

    return (
        <div className="w-full my-1 min-w-[120px]">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className={`font-bold ${textColor}`}>{current.toLocaleString()}</span>
                <span className="opacity-80">{max.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 relative" title={`คงคลัง: ${current}, Min: ${min ?? 'N/A'}, Max: ${max}`}>
                {min !== null && min > 0 && min < max && (
                    <div 
                        className="absolute h-full w-0.5 bg-slate-500 dark:bg-slate-200 opacity-70"
                        style={{ left: `${minPercentage}%` }}
                        title={`Min Stock: ${min}`}
                    ></div>
                )}
                <div 
                    className={`${barColor} h-2.5 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const StockLevelsPrintView: React.FC<{
    data: PlanDataItem[];
    quantities: Record<string, { min: string; max: string }>;
}> = ({ data, quantities }) => {
    return (
        <div className="hidden print-only p-4 font-sarabun text-black" style={{ fontSize: '10pt' }}>
            <div className="text-center mb-4">
                <h1 className="font-bold">แบบฟอร์มการจัดระบบสต๊อก</h1>
                <p>หน่วยงาน คลังเวชภัณฑ์มิใช่ยา โรงพยาบาลกบินทร์บุรี</p>
            </div>
            <div className="mb-4 space-y-1 text-sm">
                <div className="flex gap-4">
                    <span><input type="checkbox" className="mr-2 align-middle"/>วัสดุสำนักงาน</span>
                    <span><input type="checkbox" className="mr-2 align-middle"/>วัสดุงานบ้าน</span>
                    <span><input type="checkbox" className="mr-2 align-middle"/>วัสดุการแพทย์</span>
                </div>
                <div className="flex gap-4">
                    <span><input type="checkbox" checked readOnly className="mr-2 align-middle"/>เวชภัณฑ์มิใช่ยา</span>
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
                    {data.map((item: PlanDataItem, index) => {
                        const stockLevels = quantities[item.product.id];
                        const max = stockLevels?.max ?? item.product.maxStock?.toString() ?? '';
                        const min = stockLevels?.min ?? item.product.minStock?.toString() ?? '';

                        return (
                            <tr key={item.product.id}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">{item.product.name}</td>
                                <td className="border border-black p-1 text-center">{item.product.unit}</td>
                                <td className="border border-black p-1 text-center">{item.currentStock.toLocaleString()}</td>
                                <td className="border border-black p-1 text-center">{max}</td>
                                <td className="border border-black p-1 text-center">{min}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

const InfoBox: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{title}</p>
        <div className="mt-1">{children}</div>
    </div>
);


const ManageStockLevelsView: React.FC<ManageStockLevelsViewProps> = ({ products, purchasePlan, inventory, onSave, companies, productSuppliers, onSwitchToTab }) => {
    const [quantities, setQuantities] = useState<Record<string, { min: string; max: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    
    // State for calculator
    const [calcTarget, setCalcTarget] = useState<'min' | 'max'>('max');
    const [calcValue, setCalcValue] = useState('3');

    // New state for filtering and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'over'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'productName', direction: 'asc' });

    // New state for Purchase Basket
    const [purchaseBasket, setPurchaseBasket] = useState<Record<string, { product: Product; quantity: number }>>({});
    const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
    const [isCreatingPO, setIsCreatingPO] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);


    useEffect(() => {
        const initialQuantities = products.reduce((acc, product) => {
            acc[product.id] = {
                min: product.minStock?.toString() ?? '',
                max: product.maxStock?.toString() ?? '',
            };
            return acc;
        }, {} as Record<string, { min: string; max: string }>);
        setQuantities(initialQuantities);
    }, [products]);

    const planMap = useMemo(() => new Map(purchasePlan.map(p => [p.productId, p.plannedQuantity])), [purchasePlan]);
    const inventoryMap = useMemo(() => new Map(inventory.map(i => [i.productId, i.quantity])), [inventory]);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{ sortKey: SortKey, children: React.ReactNode, className?: string }> = ({ sortKey, children, className }) => (
        <th className={`p-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1 group transition-colors hover:text-slate-800 dark:hover:text-slate-200">
                <span>{children}</span>
                {sortConfig.key === sortKey ? (
                    sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                ) : (
                    <ChevronDownIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                )}
            </button>
        </th>
    );

    const filteredAndSortedData: PlanDataItem[] = useMemo(() => {
        let data: PlanDataItem[] = products.map(product => {
            const annualPlanQty = planMap.get(product.id) || 0;
            const monthlyAvg = annualPlanQty > 0 ? annualPlanQty / 12 : 0;
            const currentStock = inventoryMap.get(product.id) || 0;
            const plannedValue = annualPlanQty * (product.pricePerUnit || 0);
            const stockReserveRate = monthlyAvg > 0 ? currentStock / monthlyAvg : Infinity;
            return {
                product,
                annualPlanQty,
                monthlyAvg,
                currentStock,
                plannedValue,
                stockReserveRate,
            };
        });

        // Filtering
        data = data.filter(item => {
            const nameMatch = searchTerm === '' || item.product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = categoryFilter === 'all' || item.product.category === categoryFilter;
            
            const stockLevels = quantities[item.product.id];
            const minStock = stockLevels ? parseInt(stockLevels.min || '', 10) || 0 : 0;
            const maxStock = stockLevels ? parseInt(stockLevels.max || '', 10) || 0 : 0;
            
            let statusMatch = true;
            if (statusFilter === 'low') {
                statusMatch = minStock > 0 && item.currentStock < minStock;
            } else if (statusFilter === 'over') {
                statusMatch = maxStock > 0 && item.currentStock > maxStock;
            }

            return nameMatch && categoryMatch && statusMatch;
        });

        // Sorting
        data.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'productName') {
                aValue = a.product.name;
                bValue = b.product.name;
                const result = aValue.localeCompare(bValue, 'th');
                return sortConfig.direction === 'asc' ? result : -result;
            } else {
                aValue = a[sortConfig.key as keyof typeof a];
                bValue = b[sortConfig.key as keyof typeof b];
                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            }
        });

        return data;
    }, [products, planMap, inventoryMap, searchTerm, categoryFilter, statusFilter, quantities, sortConfig]);

     const { totalInventoryValue, totalMonthlyUsageValue, overallStockReserveRate } = useMemo(() => {
        const data = filteredAndSortedData; // Use filtered data for summary
        if (!data || data.length === 0) {
            return { totalInventoryValue: 0, totalMonthlyUsageValue: 0, overallStockReserveRate: 0 };
        }

        const totalValue = data.reduce((sum, item) => {
            return sum + (item.currentStock * (item.product.pricePerUnit || 0));
        }, 0);

        const totalUsageValue = data.reduce((sum, item) => {
            return sum + (item.monthlyAvg * (item.product.pricePerUnit || 0));
        }, 0);

        const reserveRate = totalUsageValue > 0 ? totalValue / totalUsageValue : Infinity;

        return {
            totalInventoryValue: totalValue,
            totalMonthlyUsageValue: totalUsageValue,
            overallStockReserveRate: reserveRate,
        };
    }, [filteredAndSortedData]);

    const getOverallRateDisplay = () => {
        if (overallStockReserveRate === Infinity || overallStockReserveRate === 0 || !totalMonthlyUsageValue) {
            return <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">-</span>;
        }

        const rate = overallStockReserveRate;
        let colorClasses = '';
        if (rate < 1) {
            colorClasses = 'text-red-600 dark:text-red-400';
        } else if (rate > 3) {
            colorClasses = 'text-amber-600 dark:text-amber-400';
        } else {
            colorClasses = 'text-green-600 dark:text-green-400';
        }

        return (
            <p className={`text-2xl font-bold ${colorClasses}`}>
                {rate.toFixed(1)} <span className="text-lg">เดือน</span>
            </p>
        );
    };

    const handleQuantityChange = (productId: string, type: 'min' | 'max', value: string) => {
        setQuantities(prev => ({
            ...prev,
            [productId]: {
                ...(prev[productId] || { min: '', max: '' }),
                [type]: value,
            },
        }));
    };

    const handleAutoCalculate = () => {
        const months = parseInt(calcValue, 10);
        if (isNaN(months) || months <= 0) {
            alert("กรุณากรอกจำนวนเดือนที่ถูกต้อง");
            return;
        }

        const newQuantities = { ...quantities };
        filteredAndSortedData.forEach(item => { // Apply only to filtered items
            const targetValue = Math.ceil(item.monthlyAvg * months);
            newQuantities[item.product.id] = {
                ...(newQuantities[item.product.id] || { min: '', max: '' }),
                [calcTarget]: targetValue.toString(),
            };
        });
        setQuantities(newQuantities);
        alert(`คำนวณและใส่ค่า ${calcTarget === 'min' ? 'Min Stock' : 'Max Stock'} สำหรับรายการที่แสดงผลสำเร็จ`);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // FIX: Add type assertion for `stockLevels` to resolve a potential type inference issue
            // where its properties were not being recognized.
            const updates = Object.entries(quantities).map(([productId, stockLevels]) => {
                const s = stockLevels as { min: string; max: string };
                return {
                    productId,
                    minStock: (s.min === '' || s.min === undefined) ? null : parseInt(s.min, 10),
                    maxStock: (s.max === '' || s.max === undefined) ? null : parseInt(s.max, 10),
                };
            });
            await supabaseService.updateProductMinMaxBatch(updates);
            alert('บันทึกค่า Min/Max Stock สำเร็จ');
            onSave();
        } catch (error) {
            alert(`เกิดข้อผิดพลาดในการบันทึก: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    // --- Purchase Basket Logic ---
    const handleAddToBasket = (item: PlanDataItem) => {
        const stockLevels = quantities[item.product.id];
        const maxStock = stockLevels ? parseInt(stockLevels.max || '0', 10) : 0;
        const quantityToOrder = maxStock - item.currentStock;
        if (quantityToOrder > 0) {
            setPurchaseBasket(prev => ({
                ...prev,
                [item.product.id]: {
                    product: item.product,
                    quantity: quantityToOrder,
                },
            }));
        }
    };
    
    const handleRemoveFromBasket = (productId: string) => {
        setPurchaseBasket(prev => {
            const newBasket = { ...prev };
            delete newBasket[productId];
            return newBasket;
        });
    };
    
    const handleUpdateBasketQuantity = (productId: string, value: string) => {
        const newQuantity = parseInt(value, 10);
        if (isNaN(newQuantity) || newQuantity < 0) return;
        setPurchaseBasket(prev => {
            const currentItem = prev[productId];
            if (!currentItem) {
                return prev;
            }
            return {
                ...prev,
                [productId]: {
                    ...currentItem,
                    quantity: newQuantity,
                },
            };
        });
    };
    
    const handleCreatePurchaseOrders = async () => {
        const basketItems = (Object.values(purchaseBasket) as { product: Product; quantity: number }[]).filter(item => item.quantity > 0);
        if (basketItems.length === 0) return;

        if (!window.confirm(`คุณต้องการสร้างใบสั่งซื้อสำหรับ ${basketItems.length} รายการใช่หรือไม่?`)) return;

        setIsCreatingPO(true);
        try {
            const suppliersByProduct = new Map<string, string[]>();
            productSuppliers.forEach(ps => {
                if (!suppliersByProduct.has(ps.productId)) {
                    suppliersByProduct.set(ps.productId, []);
                }
                suppliersByProduct.get(ps.productId)!.push(ps.companyId);
            });

            const basketByCompany: Record<string, { companyName: string; items: { product: Product; quantity: number }[] }> = {};

            for (const item of basketItems) {
                const companyIds = suppliersByProduct.get(item.product.id);
                const companyId = companyIds && companyIds.length > 0 ? companyIds[0] : 'no_company';

                if (!basketByCompany[companyId]) {
                    const company = companies.find(c => c.id === companyId);
                    basketByCompany[companyId] = { companyName: company?.name || 'ไม่มีบริษัท', items: [] };
                }
                basketByCompany[companyId].items.push(item);
            }

            await supabaseService.createPurchaseOrders(basketByCompany);
            alert(`สร้างใบสั่งซื้อฉบับร่างสำเร็จ!`);
            setPurchaseBasket({});
            setIsBasketModalOpen(false);
            onSwitchToTab('purchaseOrder');
        } catch (err) {
            alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsCreatingPO(false);
        }
    };


    const basketItemCount = Object.keys(purchaseBasket).length;

    useEffect(() => {
        if (isPrinting) {
            const handleAfterPrint = () => {
                setIsPrinting(false);
            };
            window.addEventListener('afterprint', handleAfterPrint, { once: true });
            setTimeout(() => window.print(), 100);
            return () => window.removeEventListener('afterprint', handleAfterPrint);
        }
    }, [isPrinting]);

    const handlePrint = () => {
        setIsPrinting(true);
    };

    return (
        <div className="space-y-6">
            {isPrinting && <StockLevelsPrintView data={filteredAndSortedData} quantities={quantities} />}
            <div className="no-print">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">จัดการระดับสต็อกขั้นต่ำ-สูงสุด (Min/Max Stock)</h3>
                    <div className="flex items-center gap-3">
                         <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            <PrinterIcon className="w-5 h-5"/>
                            <span>พิมพ์</span>
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                        >
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoBox title="อัตราสำรองคลังรวม (ของรายการที่แสดง)">
                        {getOverallRateDisplay()}
                    </InfoBox>
                    <InfoBox title="มูลค่าคลังปัจจุบัน (ของรายการที่แสดง)">
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{totalInventoryValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                    </InfoBox>
                    <InfoBox title="มูลค่าใช้เฉลี่ย/เดือน (ของรายการที่แสดง)">
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{totalMonthlyUsageValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                    </InfoBox>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                    <h3 className="font-semibold flex items-center gap-2"><CalculatorIcon className="w-5 h-5"/> เครื่องมือคำนวณอัตโนมัติ</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">คำนวณจาก "ยอดตามแผน/ปี" หารด้วย 12 เพื่อให้ได้ค่าเฉลี่ยต่อเดือน แล้วคูณด้วยจำนวนเดือนที่คุณระบุ (จะคำนวณเฉพาะรายการที่แสดงในตาราง)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium">คำนวณค่า</label>
                                <select value={calcTarget} onChange={e => setCalcTarget(e.target.value as any)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                                    <option value="min">Min Stock</option>
                                    <option value="max">Max Stock</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium">สำหรับสต็อก</label>
                                <div className="flex items-center">
                                    <input type="number" value={calcValue} onChange={e => setCalcValue(e.target.value)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                                    <span className="ml-2 font-medium">เดือน</span>
                                </div>
                            </div>
                        </div>
                        <div className="sm:col-start-4">
                            <button onClick={handleAutoCalculate} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">คำนวณและใส่ค่า</button>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="relative">
                        <label className="text-sm font-medium">ค้นหาตามชื่อ</label>
                        <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-9" />
                        <input type="text" placeholder="พิมพ์ชื่อ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 mt-1" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">ประเภท</label>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 mt-1">
                            <option value="all">ทุกประเภท</option>
                            {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">สถานะ</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 mt-1">
                            <option value="all">ทั้งหมด</option>
                            <option value="low">สต็อกต่ำกว่า Min</option>
                            <option value="over">สต็อกสูงกว่า Max</option>
                        </select>
                    </div>
                </div>


                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr>
                                <SortableHeader sortKey="productName">รายการ</SortableHeader>
                                <SortableHeader sortKey="annualPlanQty" className="text-right">ยอดตามแผน/ปี</SortableHeader>
                                <SortableHeader sortKey="monthlyAvg" className="text-right">เฉลี่ย/เดือน</SortableHeader>
                                <th className="p-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">คงคลัง</th>
                                <SortableHeader sortKey="stockReserveRate" className="text-center">อัตราสำรองคลัง</SortableHeader>
                                <th className="p-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Min Stock</th>
                                <th className="p-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Max Stock</th>
                                <th className="p-2 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredAndSortedData.map(item => {
                                const { product, annualPlanQty, monthlyAvg, currentStock, stockReserveRate } = item;
                                const stockLevels = quantities[product.id];
                                const min = stockLevels?.min ?? '';
                                const max = stockLevels?.max ?? '';
                                const minStockNum = min === '' ? null : parseInt(min, 10);
                                const maxStockNum = max === '' ? null : parseInt(max, 10);

                                const isInBasket = !!purchaseBasket[product.id];
                                const canAddToBasket = maxStockNum !== null && currentStock < maxStockNum && maxStockNum > currentStock;
                                
                                const isLowStock = minStockNum !== null && currentStock < minStockNum;

                                let reserveRateDisplay;
                                if (stockReserveRate === Infinity || item.monthlyAvg <= 0) {
                                    reserveRateDisplay = <span className="text-xs text-slate-400">-</span>;
                                } else {
                                    const rate = stockReserveRate.toFixed(1);
                                    let colorClasses = '';
                                    let text = `${rate} เดือน`;
                                    let icon = null;

                                    if (stockReserveRate < 1) {
                                        colorClasses = 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
                                        text = `< 1 เดือน`;
                                        icon = <ExclamationTriangleIcon className="w-4 h-4 inline-block mr-1" />;
                                    } else if (stockReserveRate > 3) {
                                        colorClasses = 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
                                        text = `> 3 เดือน`;
                                        icon = <ExclamationTriangleIcon className="w-4 h-4 inline-block mr-1" />;
                                    } else {
                                        colorClasses = 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
                                    }
                                    reserveRateDisplay = (
                                        <span 
                                            className={`px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center ${colorClasses}`}
                                            title={`อัตราสำรอง: ${rate} เดือน`}
                                        >
                                            {icon}
                                            {text}
                                        </span>
                                    );
                                }


                                return (
                                    <tr key={product.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/50 ${isLowStock ? 'bg-amber-50 dark:bg-amber-900/30' : ''}`}>
                                        <td className="px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200">{product.name} ({product.unit})</td>
                                        <td className="px-4 py-2 text-sm text-right">{annualPlanQty.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-300">{monthlyAvg.toFixed(1)}</td>
                                        <td className="px-4 py-2 text-sm"><StockLevelBar current={currentStock} min={minStockNum} max={maxStockNum} /></td>
                                        <td className="px-4 py-2 text-sm text-center">{reserveRateDisplay}</td>
                                        <td className="px-4 py-2 w-32">
                                            <input
                                                type="number"
                                                value={min}
                                                onChange={e => handleQuantityChange(product.id, 'min', e.target.value)}
                                                className="w-full p-1 border border-slate-300 dark:border-slate-600 rounded-md text-right bg-white dark:bg-slate-700"
                                                placeholder="-"
                                            />
                                        </td>
                                        <td className="px-4 py-2 w-32">
                                            <input
                                                type="number"
                                                value={max}
                                                onChange={e => handleQuantityChange(product.id, 'max', e.target.value)}
                                                className="w-full p-1 border border-slate-300 dark:border-slate-600 rounded-md text-right bg-white dark:bg-slate-700"
                                                placeholder="-"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {isInBasket ? (
                                                <button onClick={() => handleRemoveFromBasket(product.id)} className="text-green-500 hover:text-green-700" title="นำออกจากตะกร้า">
                                                    <CheckCircleIcon className="w-6 h-6"/>
                                                </button>
                                            ) : canAddToBasket ? (
                                                <button onClick={() => handleAddToBasket(item)} className="text-sky-500 hover:text-sky-700" title="เพิ่มลงในตะกร้าจัดซื้อ">
                                                    <ShoppingCartIcon className="w-6 h-6"/>
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredAndSortedData.length === 0 && (
                        <div className="text-center py-8 text-slate-500">ไม่พบรายการที่ตรงกับเงื่อนไข</div>
                    )}
                </div>

                {basketItemCount > 0 && (
                    <div className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in">
                        <ShoppingCartIcon className="w-8 h-8"/>
                        <div>
                            <p className="font-bold">ตะกร้าจัดซื้อ</p>
                            <p className="text-sm">{basketItemCount} รายการ</p>
                        </div>
                        <button onClick={() => setIsBasketModalOpen(true)} className="bg-white text-blue-600 font-bold py-1 px-3 rounded-md hover:bg-blue-100">
                            ดูรายการ
                        </button>
                    </div>
                )}

                <Modal isOpen={isBasketModalOpen} onClose={() => setIsBasketModalOpen(false)} title="ตะกร้าจัดซื้อ" size="2xl">
                    <div className="space-y-4">
                        <div className="max-h-96 overflow-y-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr>
                                        <th className="p-2 text-left">รายการ</th>
                                        <th className="p-2 text-right">จำนวนสั่งซื้อ</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(purchaseBasket).map(({ product, quantity }) => (
                                        <tr key={product.id} className="border-t">
                                            <td className="p-2 font-medium">{product.name}</td>
                                            <td className="p-2">
                                                <input 
                                                    type="number"
                                                    value={quantity}
                                                    onChange={e => handleUpdateBasketQuantity(product.id, e.target.value)}
                                                    className="w-24 p-1 border rounded text-right float-right"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveFromBasket(product.id)} className="text-red-500 hover:text-red-700">
                                                    <TrashIcon className="w-5 h-5"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-4 pt-4 border-t">
                            <button onClick={() => setIsBasketModalOpen(false)} className="bg-slate-200 font-bold py-2 px-4 rounded-lg">ปิด</button>
                            <button onClick={handleCreatePurchaseOrders} disabled={isCreatingPO} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400">
                                {isCreatingPO ? 'กำลังสร้าง...' : `สร้างใบสั่งซื้อ (${basketItemCount} รายการ)`}
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default ManageStockLevelsView;
