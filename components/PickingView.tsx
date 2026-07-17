import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Requisition, Product, RequisitionItem, RequisitionStatus, RequisitionItemStatus, requisitionItemStatusMap, DocumentSettings, requisitionStatusMap } from '../types';
import { supabaseService } from '../services/supabaseService';
import ArrowUturnLeftIcon from './icons/ArrowUturnLeftIcon';
import PrinterIcon from './icons/PrinterIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import BarcodeIcon from './icons/BarcodeIcon';
import Modal from './Modal';
import PencilSquareIcon from './icons/PencilSquareIcon';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import MinusIcon from './icons/MinusIcon';
import { PickingListPrintView } from './admin/PickingListPrintView';
import ExclamationCircleIcon from './icons/ExclamationCircleIcon';

import { Personnel } from '../types';

interface PickingViewProps {
    requisition: Requisition;
    allProducts: Product[];
    inventoryMap: Map<string, number>;
    onClose: () => void;
    isPreview?: boolean;
    onItemsUpdated: () => void;
    onStockUpdated?: () => void;
    onProcessRequisitionWithStock: (items: RequisitionItem[], editReason?: string | null) => Promise<void>;
    onProcessSimple: (items: RequisitionItem[]) => Promise<void>;
    documentSettings: DocumentSettings | null;
    personnel?: Personnel[];
}

const PickingView: React.FC<PickingViewProps> = ({ requisition, allProducts, inventoryMap, onClose, isPreview = false, onItemsUpdated, onStockUpdated, onProcessRequisitionWithStock, onProcessSimple, documentSettings, personnel }) => {
    const [items, setItems] = useState<RequisitionItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [addItemSearch, setAddItemSearch] = useState('');
    const [requisitionToPrint, setRequisitionToPrint] = useState<Requisition | null>(null);
    const [showBackorderModal, setShowBackorderModal] = useState(false);
    const [partialItems, setPartialItems] = useState<RequisitionItem[]>([]);
    const [backorderActions, setBackorderActions] = useState<Record<number, 'create' | 'cancel'>>({});
    const [deptInventory, setDeptInventory] = useState<any[]>([]);
    const [requisitionHistory, setRequisitionHistory] = useState<Requisition[]>([]);
    const draftSaveTimeout = useRef<number | null>(null);

    useEffect(() => {
        const fetchExtraData = async () => {
            try {
                const [inv, reqs] = await Promise.all([
                    supabaseService.getDepartmentInventory(requisition.departmentId),
                    supabaseService.getRequisitionsForDepartment(requisition.departmentId)
                ]);
                setDeptInventory(inv);
                setRequisitionHistory(reqs);
            } catch (e) {
                console.error("Failed to fetch extra data for picking view", e);
            }
        };
        fetchExtraData();
    }, [requisition.departmentId]);

    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    
    useEffect(() => {
        let initialItems = requisition.items || [];
        
        initialItems = initialItems.map(item => {
            const product = productMap.get(item.productId);
            const price = item.pricePerUnit ?? product?.pricePerUnit ?? 0;
            
            // Default to 0 if approvedQuantity is null or undefined
            let approvedValue = item.approvedQuantity;
            if (approvedValue === null || approvedValue === undefined) {
                approvedValue = 0;
            }

            const deptInv = deptInventory.find(inv => inv.productId === item.productId);
            let lastApprovedQty = 0;
            if (requisitionHistory.length > 0) {
                const sortedHistory = [...requisitionHistory].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                for (const req of sortedHistory) {
                    if (req.id === requisition.id) continue;
                    if (['Approved', 'PartiallyApproved', 'Picking', 'Ready', 'Completed'].includes(req.status)) {
                        const reqItem = req.items?.find(i => i.productId === item.productId);
                        if (reqItem && reqItem.approvedQuantity !== undefined && reqItem.approvedQuantity > 0) {
                            lastApprovedQty = reqItem.approvedQuantity;
                            break;
                        }
                    }
                }
            }

            return {
                ...item,
                approvedQuantity: approvedValue,
                status: item.status || 'Pending',
                pricePerUnit: price,
                product: product || item.product,
                minStock: deptInv?.minStock,
                maxStock: deptInv?.maxStock,
                lastApprovedQty
            };
        });
        
        const draftJson = localStorage.getItem(`picking_draft_${requisition.id}`);
        if (draftJson && !isPreview) {
            try {
                const draftItems = JSON.parse(draftJson);
                if (Array.isArray(draftItems) && draftItems.length > 0) {
                    // If requisition is still in Draft or Submitted status, 
                    // we should be careful about loading approvedQuantity from draft 
                    // as it might contain old auto-filled values from previous versions.
                    const isInitialStatus = ['Draft', 'Submitted'].includes(requisition.status);

                    const refreshedItems = draftItems.map((dItem: RequisitionItem) => {
                        const latestInfo = initialItems.find(i => i.productId === dItem.productId);
                        
                        let approvedQty = dItem.approvedQuantity;
                        // If it's a fresh requisition and the draft has values matching requested quantity,
                        // it's likely old auto-fill data. Reset it to 0.
                        if (isInitialStatus && approvedQty === dItem.quantity && approvedQty > 0) {
                            approvedQty = 0;
                        }

                        return {
                            ...dItem,
                            quantity: latestInfo?.quantity ?? dItem.quantity, // CRITICAL: Always use latest requested quantity from DB
                            approvedQuantity: approvedQty,
                            lastApprovedQty: latestInfo?.lastApprovedQty || 0,
                            minStock: latestInfo?.minStock,
                            maxStock: latestInfo?.maxStock
                        };
                    });
                    setItems(refreshedItems);
                    return; 
                }
            } catch (e) {
                localStorage.removeItem(`picking_draft_${requisition.id}`);
            }
        }

        setItems(JSON.parse(JSON.stringify(initialItems))); 
    }, [requisition, isPreview, productMap, deptInventory, requisitionHistory]);
    
    useEffect(() => {
        if (isPreview || isProcessing) return;
        if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
        draftSaveTimeout.current = window.setTimeout(() => {
            if (items.length > 0) {
                localStorage.setItem(`picking_draft_${requisition.id}`, JSON.stringify(items));
            }
        }, 1000);
        return () => { if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current); };
    }, [items, requisition.id, isPreview, isProcessing]);
    
    useEffect(() => {
        if (requisitionToPrint) {
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            
            const handleAfterPrint = () => {
                setRequisitionToPrint(null);
                // After auto-printing from save, close the view
                if (!isProcessing) {
                    onClose();
                }
            };
            window.addEventListener('afterprint', handleAfterPrint, { once: true });
            return () => { clearTimeout(timer); window.removeEventListener('afterprint', handleAfterPrint); };
        }
    }, [requisitionToPrint, isProcessing, onClose]);
    
    const handleItemUpdate = (itemId: number, field: 'approvedQuantity' | 'status' | 'pricePerUnit' | 'rejectReason' | 'lockProduct', value: string | number | boolean) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const updatedItem = { ...item };
                if (field === 'approvedQuantity') {
                    const numValue = typeof value === 'string' ? parseInt(value, 10) : value as number;
                    updatedItem.approvedQuantity = isNaN(numValue) ? 0 : numValue;
                    if (updatedItem.approvedQuantity > 0 && updatedItem.status !== 'Loaned' && updatedItem.status !== 'Backordered') {
                        updatedItem.status = 'Approved';
                    }
                } else if (field === 'pricePerUnit') {
                    const numValue = typeof value === 'string' ? parseFloat(value) : value as number;
                    updatedItem.pricePerUnit = isNaN(numValue) ? 0 : numValue;
                } else if (field === 'status') {
                    updatedItem.status = value as RequisitionItemStatus;
                    if (value === 'Rejected') updatedItem.approvedQuantity = 0;
                } else if (field === 'rejectReason') {
                    updatedItem.rejectReason = value as string;
                } else if (field === 'lockProduct') {
                    updatedItem.lockProduct = value as boolean;
                }
                return updatedItem;
            }
            return item;
        }));
    };
    
    const handleAddItem = (productToAdd: Product) => {
        const newItem: RequisitionItem = {
            id: -Date.now(), 
            requisitionId: requisition.id,
            productId: productToAdd.id,
            quantity: 0, 
            pricePerUnit: productToAdd.pricePerUnit,
            product: productToAdd,
            status: 'Approved',
            approvedQuantity: 0, 
            departmentStockOnSubmit: null,
            returnedQuantity: 0,
        };
        setItems(prev => [...prev, newItem]);
        setAddItemSearch('');
    };

    const handleRemoveItem = (itemIdToRemove: number) => {
        if (!window.confirm("ลบรายการนี้ออกจากใบเบิก?")) return;
        setItems(prev => prev.filter(item => item.id !== itemIdToRemove));
    };

    const processItems = async (itemsToProcess: RequisitionItem[]) => {
        setIsProcessing(true);
        try {
            const finalItems = itemsToProcess.map(i => {
                // Only auto-reject if status is 'Approved' but quantity is 0
                // If user explicitly chose 'Backordered' or 'Loaned', respect that choice
                const isAutoReject = i.approvedQuantity === 0 && (i.status === 'Approved' || i.status === 'Pending');
                return {
                    ...i,
                    status: isAutoReject ? 'Rejected' : i.status
                };
            });

            await onProcessSimple(finalItems);
            localStorage.removeItem(`picking_draft_${requisition.id}`);
            
            // Auto-trigger print after save success
            const itemsWithProduct = finalItems.map(item => ({
                ...item,
                product: item.product || productMap.get(item.productId)
            }));
            setRequisitionToPrint({ ...requisition, items: itemsWithProduct });
        } catch(e) {
            alert("เกิดข้อผิดพลาดในการบันทึก");
            setIsProcessing(false);
        }
    };

    const handleConfirmAndSave = async () => {
        if (isPreview || isProcessing) return;
        
        // Check for partial approvals that need confirmation
        const partials = items.filter(item => 
            item.approvedQuantity > 0 && 
            item.approvedQuantity < item.quantity && 
            item.status !== 'Backordered' && 
            item.status !== 'Rejected' &&
            item.status !== 'Loaned'
        );

        if (partials.length > 0) {
            setPartialItems(partials);
            const initialActions: Record<number, 'create' | 'cancel'> = {};
            partials.forEach(item => {
                initialActions[item.id] = 'create';
            });
            setBackorderActions(initialActions);
            setShowBackorderModal(true);
            return;
        }

        await processItems(items);
    };

    const handleBackorderConfirm = async () => {
        const newItems = items.map(item => {
            const action = backorderActions[item.id];
            if (action === 'cancel') {
                // Keep original quantity, but ensure status is Approved (not Backordered)
                // This prevents the backorder logic from triggering while preserving the requested amount
                return { ...item, status: 'Approved' as RequisitionItemStatus };
            } else if (action === 'create') {
                // Set status to Backordered so the system knows to track the difference
                return { ...item, status: 'Backordered' as RequisitionItemStatus };
            }
            return item;
        });
        
        setShowBackorderModal(false);
        await processItems(newItems);
    };

    const searchableProducts = useMemo(() => {
        if (!addItemSearch.trim()) return [];
        const lowerCaseSearchTerm = addItemSearch.toLowerCase();
        const currentProductIds = new Set(items.map(item => item.productId));
        return allProducts
            .filter(p => !currentProductIds.has(p.id) && p.name.toLowerCase().includes(lowerCaseSearchTerm))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 7);
    }, [allProducts, items, addItemSearch]);
    
    const itemsToDisplay = useMemo(() => {
        return [...items].sort((a,b) => {
            const productA = a.product || productMap.get(a.productId);
            const productB = b.product || productMap.get(b.productId);
            if (!productA || !productB) return 0;
            const zoneA = productA.zone || 'Ω'; 
            const zoneB = productB.zone || 'Ω';
            return zoneA.localeCompare(zoneB, undefined, { numeric: true }) || productA.name.localeCompare(productB.name, 'th');
        });
    }, [items, productMap]);

    const handlePrint = () => {
        const itemsWithProduct = items.map(item => ({
            ...item,
            product: item.product || productMap.get(item.productId)
        }));
        setRequisitionToPrint({ ...requisition, items: itemsWithProduct });
    };
    
    const summary = useMemo(() => {
        return itemsToDisplay.reduce((acc, item) => {
            // Exclude Backordered items from total value
            if (item.status === 'Backordered') return acc;
            
            const qty = item.approvedQuantity || 0;
            const price = item.pricePerUnit || 0;
            if (qty > 0) {
                acc.totalValue += (qty * price);
                acc.itemCount += 1;
            }
            return acc;
        }, { totalValue: 0, itemCount: 0 });
    }, [itemsToDisplay]);

    return (
        <div className="animate-fade-in">
            {requisitionToPrint && <PickingListPrintView requisition={requisitionToPrint} departmentName={requisitionToPrint.departmentName || ''} documentSettings={documentSettings} personnel={personnel} />}
            
            <Modal
                isOpen={showBackorderModal}
                onClose={() => setShowBackorderModal(false)}
                title="จัดการรายการค้างจ่าย"
                size="lg"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800">
                        <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="font-bold">พบรายการที่จ่ายไม่ครบตามจำนวนที่ขอ</p>
                            <p className="text-sm mt-1">กรุณาเลือกการดำเนินการสำหรับส่วนต่างที่เหลือของแต่ละรายการ</p>
                        </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
                        {partialItems.map(item => {
                            const product = item.product || productMap.get(item.productId);
                            const remaining = item.quantity - item.approvedQuantity;
                            const action = backorderActions[item.id] || 'create';

                            return (
                                <div key={item.id} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{product?.name}</h4>
                                            <p className="text-xs text-slate-500">ขอเบิก: {item.quantity} | อนุมัติ: {item.approvedQuantity}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
                                                ขาด {remaining} {product?.unit}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${action === 'create' ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <input 
                                                type="radio" 
                                                name={`action-${item.id}`} 
                                                checked={action === 'create'} 
                                                onChange={() => setBackorderActions(prev => ({ ...prev, [item.id]: 'create' }))}
                                                className="w-4 h-4 text-sky-600"
                                            />
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">ตั้งเป็นรายการค้างจ่าย</p>
                                                <p className="text-xs text-slate-500">ระบบจะสร้างรายการค้างจ่ายสำหรับ {remaining} ชิ้น</p>
                                            </div>
                                        </label>
                                        
                                        <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${action === 'cancel' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <input 
                                                type="radio" 
                                                name={`action-${item.id}`} 
                                                checked={action === 'cancel'} 
                                                onChange={() => setBackorderActions(prev => ({ ...prev, [item.id]: 'cancel' }))}
                                                className="w-4 h-4 text-red-600"
                                            />
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">ยกเลิกส่วนที่เหลือ</p>
                                                <p className="text-xs text-slate-500">ตัดยอดเหลือเท่าที่อนุมัติ ({item.approvedQuantity})</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                        <button 
                            onClick={() => setShowBackorderModal(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                        >
                            กลับไปแก้ไข
                        </button>
                        <button 
                            onClick={handleBackorderConfirm}
                            className="px-6 py-2 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-700 shadow-sm"
                        >
                            ยืนยันการดำเนินการ
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="no-print">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                    <button onClick={onClose} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-sky-600 font-medium">
                        <ArrowUturnLeftIcon className="w-5 h-5"/>
                        <span>กลับ</span>
                    </button>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">อนุมัติ / ระบุจำนวน (V2)</h2>
                        <p className="text-slate-600 dark:text-slate-300">ใบเบิก #{requisition.requisitionNumber} - {requisition.departmentName}</p>
                        <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
                            * มูลค่าและจำนวนที่อนุมัติจะถูกบันทึก ณ วันที่ทำการอนุมัติ
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
                            <PrinterIcon className="w-5 h-5"/>
                            <span>พิมพ์ใบจัดของ</span>
                        </button>
                        {!isPreview && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        setItems(prev => prev.map(item => ({ ...item, approvedQuantity: item.quantity })));
                                    }}
                                    className="flex items-center gap-2 bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 shadow-sm transition-all"
                                >
                                    <CheckCircleIcon className="w-5 h-5"/>
                                    <span>อนุมัติทั้งหมดตามที่ขอ</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        if (window.confirm("ล้างจำนวนอนุมัติทั้งหมดเป็น 0?")) {
                                            setItems(prev => prev.map(item => ({ ...item, approvedQuantity: 0 })));
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 shadow-sm transition-all"
                                >
                                    <TrashIcon className="w-5 h-5"/>
                                    <span>ล้างเป็น 0 ทั้งหมด</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {!isPreview && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">ค้นหาและเพิ่มรายการพิเศษ</label>
                            <div className="relative">
                                <input type="text" value={addItemSearch} onChange={e => setAddItemSearch(e.target.value)} placeholder="พิมพ์ชื่อเวชภัณฑ์..." className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 shadow-sm" disabled={isPreview} />
                                {searchableProducts.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                                        {searchableProducts.map(p => (
                                            <button key={p.id} onClick={() => handleAddItem(p)} className="w-full text-left px-4 py-3 hover:bg-sky-50 dark:hover:bg-sky-900/50 flex justify-between items-center">
                                                <span>{p.name} <span className="text-xs text-slate-500">({p.unit})</span></span>
                                                <PlusIcon className="w-5 h-5 text-sky-500" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="p-2 text-left text-sm font-semibold">รายการ</th>
                                    <th className="p-2 text-center text-sm font-semibold">Min/Max</th>
                                    <th className="p-2 text-center text-sm font-semibold">อนุมัติก่อน</th>
                                    <th className="p-2 text-center text-sm font-semibold">ขอเบิก</th>
                                    <th className="p-2 text-center text-sm font-semibold">อนุมัติ</th>
                                    <th className="p-2 text-right text-sm font-semibold">ราคา/หน่วย</th>
                                    <th className="p-2 text-center text-sm font-semibold">สถานะ</th>
                                    <th className="p-2 text-right text-sm font-semibold">มูลค่าอนุมัติ (บาท)</th>
                                    {!isPreview && <th className="p-2 w-10"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {itemsToDisplay.map(item => {
                                    const product = item.product || productMap.get(item.productId);
                                    if (!product) return null;
                                    const approvedQty = item.approvedQuantity || 0;
                                    // If Backordered, show no value
                                    const rowValue = item.status === 'Backordered' ? 0 : approvedQty * (item.pricePerUnit || 0);

                                    return (
                                    <React.Fragment key={item.id}>
                                        <tr className="border-t dark:border-slate-700 hover:bg-slate-50 transition-colors">
                                            <td className="p-2">
                                                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{product.name}</div>
                                                <div className="text-[10px] text-slate-500">หน่วย: {product.unit} | Zone: {product.zone || 'N/A'}</div>
                                            </td>
                                            <td className="p-2 text-center text-xs text-slate-500">
                                                {item.minStock ?? '-'}/{item.maxStock ?? '-'}
                                            </td>
                                            <td className="p-2 text-center text-xs text-slate-500">
                                                {item.lastApprovedQty || '-'}
                                            </td>
                                            <td className="p-2 text-center text-xs text-slate-500">{item.quantity}</td>
                                            <td className="p-2 w-24">
                                                <input type="number" value={item.approvedQuantity === 0 ? '' : item.approvedQuantity} onChange={e => handleItemUpdate(item.id!, 'approvedQuantity', e.target.value)} min={0} className="w-full text-right p-1 border rounded text-sm dark:bg-slate-700 border-sky-400 focus:ring-2 focus:ring-sky-200" disabled={isPreview} placeholder="0"/>
                                            </td>
                                            <td className="p-2 w-28">
                                                <input type="number" step="0.01" value={item.pricePerUnit ?? ''} onChange={e => handleItemUpdate(item.id!, 'pricePerUnit', e.target.value)} min={0} className="w-full text-right p-1 border rounded text-sm dark:bg-slate-700 bg-amber-50 dark:bg-amber-900/10" disabled={isPreview} />
                                            </td>
                                            <td className="p-2 w-32">
                                                <select value={item.status} onChange={e => handleItemUpdate(item.id!, 'status', e.target.value)} className="w-full p-1 border rounded text-xs dark:bg-slate-700" disabled={isPreview}>
                                                    <option value="Approved">อนุมัติ</option>
                                                    <option value="Rejected">ไม่อนุมัติ</option>
                                                    <option value="Backordered">ค้างจ่าย</option>
                                                    <option value="Loaned">ยืม</option>
                                                </select>
                                            </td>
                                            <td className="p-2 text-right font-black text-xs text-sky-700 dark:text-sky-400">
                                                {item.status === 'Backordered' ? '-' : rowValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                            </td>
                                            {!isPreview && (
                                                <td className="p-2 text-center">
                                                    <button onClick={() => handleRemoveItem(item.id!)} className="text-slate-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                                </td>
                                            )}
                                        </tr>
                                        {item.status === 'Rejected' && (
                                            <tr className="bg-red-50/50 dark:bg-red-900/10 border-b dark:border-slate-700">
                                                <td colSpan={!isPreview ? 7 : 6} className="p-2 px-4">
                                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                        <div className="flex-1 w-full">
                                                            <input 
                                                                type="text" 
                                                                placeholder="หมายเหตุการไม่อนุมัติ (ถ้ามี)" 
                                                                value={item.rejectReason || ''} 
                                                                onChange={e => handleItemUpdate(item.id!, 'rejectReason', e.target.value)}
                                                                className="w-full p-1.5 border rounded text-sm border-red-200 focus:ring-red-200 dark:bg-slate-800 dark:border-red-800"
                                                                disabled={isPreview}
                                                            />
                                                        </div>
                                                        <label className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 cursor-pointer whitespace-nowrap">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={item.lockProduct || false} 
                                                                onChange={e => handleItemUpdate(item.id!, 'lockProduct', e.target.checked)}
                                                                className="rounded text-red-500 focus:ring-red-500"
                                                                disabled={isPreview}
                                                            />
                                                            <span>ล็อคไม่ให้เบิกครั้งหน้า</span>
                                                        </label>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                    )
                                })}
                            </tbody>
                            <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                                <tr>
                                    <td colSpan={5} className="p-3 text-right text-sm">
                                        รวมมูลค่าอนุมัติสุทธิ:
                                    </td>
                                    <td className="p-3 text-right text-sky-600 dark:text-sky-400 text-lg">
                                        {summary.totalValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
                                    </td>
                                    {!isPreview && <td></td>}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {!isPreview && (
                        <div className="mt-4 pt-4 border-t flex justify-end gap-4">
                            <button
                                onClick={handleConfirmAndSave}
                                disabled={isProcessing}
                                className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2.5 px-8 rounded-lg hover:bg-sky-700 shadow-md transform scale-105 transition-all active:scale-100"
                            >
                                <CheckCircleIcon className="w-6 h-6" />
                                {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันการอนุมัติ'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PickingView;