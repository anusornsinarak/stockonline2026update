
import React, { useState, useEffect, useMemo } from 'react';
import { Product, PurchasePlanItem, InventoryItem, ProductCategory, productCategories, Company, ProductSupplier, DocumentSettings, ProductUsageHistory } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import TableTemplate from './TableTemplate';
import DownloadIcon from '../icons/DownloadIcon';
import * as XLSX from 'xlsx';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import LockClosedIcon from '../icons/LockClosedIcon';
import LockOpenIcon from '../icons/LockOpenIcon';
import PrinterIcon from '../icons/PrinterIcon';
import PurchasePlanPrintView from './PurchasePlanPrintView';
import ChevronUpIcon from '../icons/ChevronUpIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import CalculatorIcon from '../icons/CalculatorIcon';

interface PurchasePlanViewProps {
    products: Product[];
    fiscalYear: number;
    currentFiscalYearBE: number;
    budget: number | null;
    aggregatedSurveyData: { product: Product, totalQuantity: number, totalValue: number }[];
    initialPlan: PurchasePlanItem[];
    onPlanSave: () => void;
    inventory: InventoryItem[];
    documentSettings: DocumentSettings | null;
    productUsageHistory: ProductUsageHistory[];
    isReadOnly?: boolean;
}

export const PurchasePlanView: React.FC<PurchasePlanViewProps> = ({ products = [], fiscalYear, currentFiscalYearBE, budget, aggregatedSurveyData, initialPlan, onPlanSave, inventory, documentSettings, productUsageHistory, isReadOnly }) => {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(fiscalYear);
    const [currentPlan, setCurrentPlan] = useState<PurchasePlanItem[]>(initialPlan);
    const [isLoadingPlan, setIsLoadingPlan] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const [plannedManualQuantities, setPlannedManualQuantities] = useState<Record<string, string>>({});
    const [manualStockOverrides, setManualStockOverrides] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isManuallyLocked, setIsManuallyLocked] = useState(true);
    const [planningBudget, setPlanningBudget] = useState<number>(budget || 0);

    const inventoryMap = useMemo(() => new Map(inventory.map(i => [i.productId, i.quantity])), [inventory]);

    useEffect(() => {
        if (budget !== null && budget !== undefined) {
            setPlanningBudget(budget);
        }
    }, [budget]);

    const isPlanLocked = useMemo(() => {
        const planStartDate = new Date(selectedFiscalYear - 544, 9, 1); 
        return new Date() >= planStartDate;
    }, [selectedFiscalYear]);

    useEffect(() => {
        const fetchPlanForYear = async () => {
            setIsLoadingPlan(true);
            try {
                const [plan, manualStock] = await Promise.all([
                    supabaseService.getPurchasePlan(selectedFiscalYear),
                    supabaseService.getPurchasePlanManualStock(selectedFiscalYear)
                ]);
                setCurrentPlan(plan);
                setManualStockOverrides(manualStock);
            } catch (error) {
                console.error(`Failed to fetch plan for year ${selectedFiscalYear}`, error);
            } finally {
                setIsLoadingPlan(false);
            }
        };

        if (selectedFiscalYear === fiscalYear) {
            setCurrentPlan(initialPlan);
            supabaseService.getPurchasePlanManualStock(selectedFiscalYear).then(setManualStockOverrides);
        } else {
            fetchPlanForYear();
        }
    }, [selectedFiscalYear, fiscalYear, initialPlan]);

    useEffect(() => {
        const hasSavedPlan = currentPlan && currentPlan.length > 0;
        let initialQtys: Record<string, string> = {};
        const planMap = new Map(currentPlan.map(p => [p.productId, p.plannedQuantity]));
        const surveyMap = new Map(aggregatedSurveyData.map(s => [s.product.id, s.totalQuantity]));

        products.forEach(p => {
            if (hasSavedPlan) {
                initialQtys[p.id] = String(planMap.get(p.id) ?? 0);
            } else if (selectedFiscalYear === fiscalYear) {
                initialQtys[p.id] = String(surveyMap.get(p.id) ?? 0);
            } else {
                initialQtys[p.id] = '0';
            }
        });
        setPlannedManualQuantities(initialQtys);
    }, [currentPlan, aggregatedSurveyData, selectedFiscalYear, fiscalYear, products]);

    const handleManualQuantityChange = (productId: string, value: string) => {
        setPlannedManualQuantities(prev => ({ ...prev, [productId]: value }));
    };

    const handleManualStockChange = (productId: string, value: string) => {
        setManualStockOverrides(prev => {
            if (value === '') {
                const next = { ...prev };
                delete next[productId];
                return next;
            }
            return { ...prev, [productId]: parseInt(value, 10) || 0 };
        });
    };

    const planData = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];
        const surveyMap = new Map<string, any>(aggregatedSurveyData.map(s => [s.product.id, s]));
        const usageHistoryByProduct = Array.isArray(productUsageHistory) ? productUsageHistory.reduce((acc, usage) => {
            if (!acc[usage.productId]) acc[usage.productId] = {};
            acc[usage.productId][usage.fiscalYear] = usage.totalQuantity;
            return acc;
        }, {} as Record<string, Record<number, number>>) : {};

        return products.map(product => {
            const surveyData = surveyMap.get(product.id);
            const totalQuantity = surveyData ? surveyData.totalQuantity : 0;
            const plannedQty = parseInt(plannedManualQuantities[product.id] || '0', 10) || 0;
            const realStock = inventoryMap.get(product.id) || 0;
            const currentStock = manualStockOverrides[product.id] !== undefined ? manualStockOverrides[product.id] : realStock;
            const price = product.pricePerUnit || 0;
            const plannedValue = plannedQty * price;
            const usageHistory = usageHistoryByProduct[product.id] || {};

            return { product, totalQuantity, plannedQty, currentStock, realStock, plannedValue, usageHistory };
        }).sort((a,b) => a.product.name.localeCompare(b.product.name, 'th'));
    }, [products, aggregatedSurveyData, plannedManualQuantities, manualStockOverrides, inventoryMap, productUsageHistory]);

    const totalPlannedValue = useMemo(() => {
        return planData.reduce((sum, item) => sum + item.plannedValue, 0);
    }, [planData]);

    const totalSurveyValue = useMemo(() => {
        return planData.reduce((sum, item) => sum + (item.totalQuantity * (item.product.pricePerUnit || 0)), 0);
    }, [planData]);

    const totalSurveyQuantity = useMemo(() => planData.reduce((sum, item) => sum + item.totalQuantity, 0), [planData]);
    const totalPlannedQuantity = useMemo(() => planData.reduce((sum, item) => sum + item.plannedQty, 0), [planData]);

    const handleBulkApplyPercentage = (percent: number, base: 'usage' | 'survey') => {
        if (!window.confirm(`ยืนยันปรับแผน +${percent}% จาก "${base === 'usage' ? 'ใช้จริงปีก่อน' : 'ยอดสำรวจ'}" ทุกรายการ? (ตัวเลขเดิมจะถูกทับ)`)) return;
        
        const newQtys: Record<string, string> = { ...plannedManualQuantities };
        planData.forEach(item => {
            const baseValue = base === 'usage' ? (item.usageHistory[selectedFiscalYear - 1] || 0) : item.totalQuantity;
            const newValue = Math.ceil(baseValue * (1 + (percent / 100)));
            newQtys[item.product.id] = String(newValue);
        });
        setPlannedManualQuantities(newQtys);
    };

    const handleAutoCalculateFromSurvey = () => {
        if (!window.confirm('ยืนยันการคำนวณจำนวนตามแผนจากยอดสำรวจ? (ข้อมูลที่กรอกไว้จะถูกแทนที่)')) return;
        const newQtys: Record<string, string> = {};
        planData.forEach(item => {
            newQtys[item.product.id] = String(item.totalQuantity);
        });
        setPlannedManualQuantities(newQtys);
    };

    const handleAutoCalculateFromUsage = () => {
        if (!window.confirm(`ยืนยันการคำนวณจำนวนตามแผนจากการใช้จริงในปี ${selectedFiscalYear - 1}? (ข้อมูลที่กรอกไว้จะถูกแทนที่)`)) return;
        const newQtys: Record<string, string> = {};
        planData.forEach(item => {
            const usageLastYear = item.usageHistory[selectedFiscalYear - 1] || 0;
            newQtys[item.product.id] = String(usageLastYear);
        });
        setPlannedManualQuantities(newQtys);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const itemsToSave: PurchasePlanItem[] = planData.map(item => ({
            productId: item.product.id,
            fiscalYear: selectedFiscalYear,
            plannedQuantity: item.plannedQty
        }));
        try {
            await Promise.all([
                supabaseService.savePurchasePlan(selectedFiscalYear, itemsToSave),
                supabaseService.savePurchasePlanManualStock(selectedFiscalYear, manualStockOverrides)
            ]);
            alert('บันทึกแผนสำเร็จ!');
            onPlanSave();
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 100);
    };

    const handleExportExcel = () => {
        const exportData = planData.map((item, index) => ({
            'ลำดับ': index + 1,
            'รายการเวชภัณฑ์': item.product.name,
            'หน่วย': item.product.unit,
            [`ใช้จริงปี ${selectedFiscalYear - 3}`]: item.usageHistory[selectedFiscalYear - 3] || 0,
            [`ใช้จริงปี ${selectedFiscalYear - 2}`]: item.usageHistory[selectedFiscalYear - 2] || 0,
            [`ใช้จริงปี ${selectedFiscalYear - 1}`]: item.usageHistory[selectedFiscalYear - 1] || 0,
            'คงคลัง': item.currentStock,
            'ยอดสำรวจ': item.totalQuantity,
            'จำนวนตามแผน': item.plannedQty,
            'ราคาต่อหน่วย': item.product.pricePerUnit,
            'มูลค่าจัดซื้อ': item.plannedValue,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Purchase Plan");
        XLSX.writeFile(wb, `แผนจัดซื้อปี_${selectedFiscalYear}.xlsx`);
    };

    const renderTableRow = (item: any) => {
        const usageLastYear = item.usageHistory[selectedFiscalYear - 1] || 0;
        const recommended5 = Math.ceil(usageLastYear * 1.05);
        const recommended10 = Math.ceil(usageLastYear * 1.10);

        return (
        <tr key={item.product.id} className="hover:bg-slate-50/70">
            <td className="px-6 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">{item.product.name}</td>
            <td className="px-6 py-2 text-sm text-right">{item.product.pricePerUnit?.toLocaleString()}</td>
            <td className="px-6 py-2 text-sm text-right">{item.totalQuantity.toLocaleString()}</td>
            <td className="px-6 py-2 text-sm text-right font-medium text-amber-700 dark:text-amber-500">{usageLastYear.toLocaleString()}</td>
            <td className="px-6 py-2 w-32">
                <input
                    type="number"
                    value={manualStockOverrides[item.product.id] !== undefined ? manualStockOverrides[item.product.id] : item.realStock}
                    onChange={e => handleManualStockChange(item.product.id, e.target.value)}
                    disabled={(isPlanLocked && isManuallyLocked) || isReadOnly}
                    className={`w-full text-right p-1 border rounded bg-white dark:bg-slate-700 disabled:bg-slate-100 disabled:opacity-75 ${manualStockOverrides[item.product.id] !== undefined ? 'text-blue-600 font-bold border-blue-300' : 'text-slate-600'}`}
                />
            </td>
            <td className="px-6 py-2 text-sm text-center">
                <div className="flex flex-col items-center justify-center gap-1">
                    <button 
                        onClick={() => !isReadOnly && handleManualQuantityChange(item.product.id, String(recommended5))}
                        disabled={isReadOnly}
                        className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded cursor-pointer transition-colors border border-emerald-200 w-full"
                        title="คลิกเพื่อใช้ยอดนี้"
                    >
                        +5%: {recommended5.toLocaleString()}
                    </button>
                    <button 
                        onClick={() => !isReadOnly && handleManualQuantityChange(item.product.id, String(recommended10))}
                        disabled={isReadOnly}
                        className="text-[10px] text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded cursor-pointer transition-colors border border-sky-200 w-full"
                        title="คลิกเพื่อใช้ยอดนี้"
                    >
                        +10%: {recommended10.toLocaleString()}
                    </button>
                </div>
            </td>
            <td className="px-6 py-2 w-48">
                <input
                    type="number"
                    value={plannedManualQuantities[item.product.id] || '0'}
                    onChange={e => handleManualQuantityChange(item.product.id, e.target.value)}
                    disabled={(isPlanLocked && isManuallyLocked) || isReadOnly}
                    className="w-full text-right p-1 border rounded bg-white dark:bg-slate-700 disabled:bg-slate-100 disabled:opacity-75"
                />
            </td>
            <td className="px-6 py-2 text-sm text-right font-bold text-sky-700">{item.plannedValue.toLocaleString()}</td>
        </tr>
    )};

    return (
        <div className="space-y-6">
            {isPrinting ? (
                <div className="print-only">
                    <PurchasePlanPrintView 
                        planData={planData} 
                        fiscalYear={selectedFiscalYear} 
                        documentSettings={documentSettings} 
                    />
                </div>
            ) : null}
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isPrinting ? 'hidden print:hidden' : ''}`}>
                <h3 className="text-xl font-bold">แผนการจัดซื้อปีงบประมาณ {selectedFiscalYear}</h3>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportExcel} className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium py-2 px-4 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors shadow-sm flex items-center gap-2">
                        <DownloadIcon className="w-5 h-5" />
                        Excel
                    </button>
                    <button onClick={handlePrint} className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2">
                        <PrinterIcon className="w-5 h-5" />
                        พิมพ์แผน
                    </button>
                    {!isReadOnly && (
                        <>
                            <button onClick={handleAutoCalculateFromUsage} className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium py-2 px-4 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors shadow-sm">
                                ดึงยอดใช้จริงปีก่อน
                            </button>
                            <button onClick={handleAutoCalculateFromSurvey} className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium py-2 px-4 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors shadow-sm">
                                ดึงยอดสำรวจ
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 shadow-sm">
                                บันทึกแผน
                            </button>
                        </>
                    )}
                </div>
            </div>
            
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${isPrinting ? 'hidden print:hidden' : ''}`}>
                {/* Card 1: Budget and Planned Total */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">งบประมาณจัดซื้อรวม</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">฿</span>
                            <input 
                                type="number" 
                                value={planningBudget}
                                onChange={(e) => setPlanningBudget(Number(e.target.value) || 0)}
                                className="w-24 text-right p-1 text-sm border rounded bg-slate-50 dark:bg-slate-900 dark:border-slate-700"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">มูลค่าตามแผนรวม</span>
                        <span className={`text-xl md:text-2xl font-bold ${totalPlannedValue > planningBudget && planningBudget > 0 ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400'}`}>
                            {totalPlannedValue.toLocaleString()} <span className="text-sm font-normal text-slate-500">บาท</span>
                        </span>
                    </div>
                    {planningBudget > 0 && (
                        <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden flex">
                            <div className={`h-2.5 rounded-full ${totalPlannedValue > planningBudget ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, (totalPlannedValue / planningBudget) * 100)}%` }}></div>
                        </div>
                    )}
                </div>
                
                {/* Card 2: Comparison Survey vs Plan */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center gap-2">
                    <span className="text-slate-800 dark:text-slate-200 text-sm font-bold flex items-center gap-2">
                        <CalculatorIcon className="w-4 h-4 text-sky-500" />
                        เปรียบเทียบยอดสำรวจ vs ตามแผน
                    </span>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">ยอดสำรวจรวม:</span>
                        <span className="font-medium">{totalSurveyQuantity.toLocaleString()} ชิ้น <span className="text-[10px] text-slate-400">({totalSurveyValue.toLocaleString()} ฿)</span></span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">ยอดตามแผนรวม:</span>
                        <span className="font-medium text-sky-600 dark:text-sky-400">{totalPlannedQuantity.toLocaleString()} ชิ้น <span className="text-[10px] text-sky-400">({totalPlannedValue.toLocaleString()} ฿)</span></span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
                        <span className="text-slate-500">ส่วนต่างมูลค่า:</span>
                        <span className={`font-bold ${totalPlannedValue - totalSurveyValue > 0 ? 'text-emerald-600' : totalPlannedValue - totalSurveyValue < 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {totalPlannedValue - totalSurveyValue > 0 ? '+' : ''}{(totalPlannedValue - totalSurveyValue).toLocaleString()} ฿
                        </span>
                    </div>
                </div>

                {/* Card 3: Quick Adjust Tools */}
                <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-xl border border-sky-100 dark:border-sky-800 flex flex-col justify-center">
                    <span className="text-sky-800 dark:text-sky-200 text-sm font-bold block mb-3">
                        ⚡ ปรับยอดจำนวนตามแผนทั้งหมดด่วน
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => handleBulkApplyPercentage(5, 'usage')}
                            disabled={isReadOnly}
                            className="text-xs bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 py-1.5 px-2 rounded hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            +5% (จากใช้จริง)
                        </button>
                        <button 
                            onClick={() => handleBulkApplyPercentage(10, 'usage')}
                            disabled={isReadOnly}
                            className="text-xs bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 py-1.5 px-2 rounded hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            +10% (จากใช้จริง)
                        </button>
                        <button 
                            onClick={() => handleBulkApplyPercentage(5, 'survey')}
                            disabled={isReadOnly}
                            className="text-xs bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 py-1.5 px-2 rounded hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            +5% (จากสำรวจ)
                        </button>
                        <button 
                            onClick={() => handleBulkApplyPercentage(10, 'survey')}
                            disabled={isReadOnly}
                            className="text-xs bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 py-1.5 px-2 rounded hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            +10% (จากสำรวจ)
                        </button>
                    </div>
                </div>
            </div>

            <div className={isPrinting ? 'hidden print:hidden' : ''}>
                <TableTemplate headers={['รายการ', 'ราคา/หน่วย', 'ยอดสำรวจ', 'ใช้จริงปีก่อน', 'คงคลัง', 'ยอดแนะนำ', 'จำนวนตามแผน', 'มูลค่าจัดซื้อ']}>
                    {planData.map(renderTableRow)}
                </TableTemplate>
            </div>
        </div>
    );
};
