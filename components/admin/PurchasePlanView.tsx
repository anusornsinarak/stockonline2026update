
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
    
    const [plannedManualQuantities, setPlannedManualQuantities] = useState<Record<string, string>>({});
    const [manualStockOverrides, setManualStockOverrides] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isManuallyLocked, setIsManuallyLocked] = useState(true);

    const inventoryMap = useMemo(() => new Map(inventory.map(i => [i.productId, i.quantity])), [inventory]);

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
            const realStock = inventoryMap.get(product.id) || 0; const currentStock = manualStockOverrides[product.id] !== undefined ? manualStockOverrides[product.id] : realStock;
            const price = product.pricePerUnit || 0;
            const plannedValue = plannedQty * price;
            const usageHistory = usageHistoryByProduct[product.id] || {};

            return { product, totalQuantity, plannedQty, currentStock, realStock, plannedValue, usageHistory };
        }).sort((a,b) => a.product.name.localeCompare(b.product.name, 'th'));
    }, [products, aggregatedSurveyData, plannedManualQuantities, manualStockOverrides, inventoryMap, productUsageHistory]);

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

    const renderTableRow = (item: any) => (
        <tr key={item.product.id} className="hover:bg-slate-50/70">
            <td className="px-6 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">{item.product.name}</td>
            <td className="px-6 py-2 text-sm text-right">{item.product.pricePerUnit?.toLocaleString()}</td>
            <td className="px-6 py-2 text-sm text-right">{item.totalQuantity.toLocaleString()}</td>
            <td className="px-6 py-2 w-32">
                <input
                    type="number"
                    value={manualStockOverrides[item.product.id] !== undefined ? manualStockOverrides[item.product.id] : item.realStock}
                    onChange={e => handleManualStockChange(item.product.id, e.target.value)}
                    disabled={(isPlanLocked && isManuallyLocked) || isReadOnly}
                    className={`w-full text-right p-1 border rounded bg-white dark:bg-slate-700 disabled:bg-slate-100 disabled:opacity-75 ${manualStockOverrides[item.product.id] !== undefined ? 'text-blue-600 font-bold border-blue-300' : 'text-slate-600'}`}
                />
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
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">แผนการจัดซื้อปีงบประมาณ {selectedFiscalYear}</h3>
                <div className="flex gap-2">
                    {!isReadOnly && (
                        <button onClick={handleSave} disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400">
                            บันทึกแผน
                        </button>
                    )}
                </div>
            </div>
            <TableTemplate headers={['รายการ', 'ราคา/หน่วย', 'ยอดสำรวจ', 'คงคลัง', 'จำนวนตามแผน', 'มูลค่าจัดซื้อ']}>
                {planData.map(renderTableRow)}
            </TableTemplate>
        </div>
    );
};
