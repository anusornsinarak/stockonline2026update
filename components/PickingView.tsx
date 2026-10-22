import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Requisition, Product, RequisitionItem, RequisitionStatus, RequisitionItemStatus, requisitionItemStatusMap, DocumentSettings, requisitionStatusMap } from '../types';
import { safeGetStorage, safeSetStorage, safeRemoveStorage } from '../utils';
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
import ArchiveBoxArrowDownIcon from './icons/ArchiveBoxArrowDownIcon';

import { Personnel } from '../types';

interface PickingViewProps {
    requisition: Requisition;
    allProducts: Product[];
    inventoryMap: Map<string, number>;
    onClose: () => void;
    onNavigateToReceipts?: () => void;
    isPreview?: boolean;
    onItemsUpdated: () => void;
    onStockUpdated?: () => void;
    onProcessRequisitionWithStock: (items: RequisitionItem[], editReason?: string | null) => Promise<void>;
    onProcessSimple: (items: RequisitionItem[]) => Promise<void>;
    documentSettings: DocumentSettings | null;
    personnel?: Personnel[];
}

const PickingView: React.FC<PickingViewProps> = ({ requisition, allProducts, inventoryMap, onClose, onNavigateToReceipts, isPreview = false, onItemsUpdated, onStockUpdated, onProcessRequisitionWithStock, onProcessSimple, documentSettings, personnel }) => {
    const [items, setItems] = useState<RequisitionItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [addItemSearch, setAddItemSearch] = useState('');
    const [requisitionToPrint, setRequisitionToPrint] = useState<Requisition | null>(null);
    const [showBackorderModal, setShowBackorderModal] = useState(false);
    const [partialItems, setPartialItems] = useState<RequisitionItem[]>([]);
    const [backorderActions, setBackorderActions] = useState<Record<number, 'create' | 'cancel'>>({});
    
    // Stock shortfall handling states
    const [showStockShortfallModal, setShowStockShortfallModal] = useState(false);
    const [showConfirmShortfallModal, setShowConfirmShortfallModal] = useState(false);
    const [shortfallItems, setShortfallItems] = useState<{
        item: RequisitionItem;
        stock: number;
        shortfall: number;
    }[]>([]);
    const [selectedGlobalAction, setSelectedGlobalAction] = useState<'borrow' | 'backorder' | 'cancel' | 'reject'>('borrow');
    const [itemActionOverrides, setItemActionOverrides] = useState<Record<number, 'borrow' | 'backorder' | 'cancel' | 'reject'>>({});
    const [toastNotification, setToastNotification] = useState<string | null>(null);

    const [deptInventory, setDeptInventory] = useState<any[]>([]);
    const [requisitionHistory, setRequisitionHistory] = useState<Requisition[]>([]);
    const draftSaveTimeout = useRef<number | null>(null);
    const lastLoadedReqIdRef = useRef<string | null>(null);

    // Real-time current stock map (Single Source of Truth)
    const [liveInventoryMap, setLiveInventoryMap] = useState<Map<string, number>>(inventoryMap);

    useEffect(() => {
        setLiveInventoryMap(inventoryMap);
    }, [inventoryMap]);

    const refreshLiveStock = useCallback(async () => {
        try {
            const inv = await supabaseService.getInventory();
            const map = new Map(inv.map(i => [i.productId, i.quantity]));
            setLiveInventoryMap(map);
        } catch (e) {
            console.error("Failed to refresh live stock in PickingView:", e);
        }
    }, []);

    useEffect(() => {
        refreshLiveStock();
        const handleRefresh = () => {
            refreshLiveStock();
        };
        window.addEventListener('app-data-refresh', handleRefresh);
        return () => window.removeEventListener('app-data-refresh', handleRefresh);
    }, [refreshLiveStock]);

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

        // Background update of the SAME requisition currently open:
        // PRESERVE user input (approvedQuantity, status) while updating background stock / product metadata
        if (lastLoadedReqIdRef.current === requisition.id) {
            setItems(prevItems => {
                if (prevItems.length === 0) return initialItems;
                return prevItems.map(prev => {
                    const latest = initialItems.find(i => i.productId === prev.productId);
                    return {
                        ...prev,
                        product: latest?.product || prev.product,
                        minStock: latest?.minStock ?? prev.minStock,
                        maxStock: latest?.maxStock ?? prev.maxStock,
                        lastApprovedQty: latest?.lastApprovedQty ?? prev.lastApprovedQty,
                        quantity: latest?.quantity ?? prev.quantity
                    };
                });
            });
            return;
        }

        // Switching or first opening this requisition:
        lastLoadedReqIdRef.current = requisition.id;
        
        const draftJson = safeGetStorage(`picking_draft_${requisition.id}`);
        if (draftJson && !isPreview) {
            try {
                const draftItems = JSON.parse(draftJson);
                if (Array.isArray(draftItems) && draftItems.length > 0) {
                    const isInitialStatus = ['Draft', 'Submitted'].includes(requisition.status);

                    const refreshedItems = draftItems.map((dItem: RequisitionItem) => {
                        const latestInfo = initialItems.find(i => i.productId === dItem.productId);
                        
                        let approvedQty = dItem.approvedQuantity;
                        if (isInitialStatus && approvedQty === dItem.quantity && approvedQty > 0) {
                            approvedQty = 0;
                        }

                        return {
                            ...dItem,
                            quantity: latestInfo?.quantity ?? dItem.quantity,
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
                safeRemoveStorage(`picking_draft_${requisition.id}`);
            }
        }

        setItems(JSON.parse(JSON.stringify(initialItems))); 
    }, [requisition, isPreview, productMap, deptInventory, requisitionHistory]);
    
    useEffect(() => {
        if (isPreview || isProcessing) return;
        if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
        draftSaveTimeout.current = window.setTimeout(() => {
            if (items.length > 0) {
                safeSetStorage(`picking_draft_${requisition.id}`, JSON.stringify(items));
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
                setIsProcessing(false);
                onClose();
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
                const finalStatus = (i.approvedQuantity || 0) > 0 && i.status === 'Pending'
                    ? 'Approved'
                    : (isAutoReject ? 'Rejected' : i.status);
                return {
                    ...i,
                    status: finalStatus
                };
            });

            await onProcessSimple(finalItems);
            safeRemoveStorage(`picking_draft_${requisition.id}`);
            
            // Immediately update local live stock so UI reflects deducted balances
            setLiveInventoryMap(prev => {
                const next = new Map(prev);
                finalItems.forEach(i => {
                    if (['Approved', 'Picking', 'Ready', 'Completed'].includes(i.status) && (i.approvedQuantity || 0) > 0) {
                        const cur: number = Number(next.get(i.productId)) || 0;
                        const approved: number = Number(i.approvedQuantity) || 0;
                        next.set(i.productId, Math.max(0, cur - approved));
                    }
                });
                return next;
            });
            onStockUpdated?.();
            onItemsUpdated();

            // Auto-trigger print after save success
            const itemsWithProduct = finalItems.map(item => ({
                ...item,
                product: item.product || productMap.get(item.productId)
            }));
            const allAreRejected = finalItems.every(i => i.status === 'Rejected');
            const targetStatus = allAreRejected ? 'Rejected' : 'Picking';
            setRequisitionToPrint({ ...requisition, status: targetStatus, items: itemsWithProduct });
        } catch(e) {
            alert("เกิดข้อผิดพลาดในการบันทึก");
            setIsProcessing(false);
        }
    };

    const handleGoToReceipts = () => {
        if (items.length > 0) {
            safeSetStorage(`picking_draft_${requisition.id}`, JSON.stringify(items));
        }
        setShowStockShortfallModal(false);
        if (onNavigateToReceipts) {
            onNavigateToReceipts();
        } else {
            onClose();
        }
    };

    const handleApplyGlobalAction = (action: 'borrow' | 'backorder' | 'cancel' | 'reject') => {
        setSelectedGlobalAction(action);
        const updatedOverrides: Record<number, 'borrow' | 'backorder' | 'cancel' | 'reject'> = {};
        shortfallItems.forEach(s => {
            updatedOverrides[s.item.id] = action;
        });
        setItemActionOverrides(updatedOverrides);
    };

    const handleApplyAdjustedStock = () => {
        setItems(prevItems => prevItems.map(item => {
            const shortfallEntry = shortfallItems.find(s => s.item.id === item.id);
            if (!shortfallEntry) return item;

            const stock = shortfallEntry.stock;
            const requested = item.quantity;
            const action = itemActionOverrides[item.id] || selectedGlobalAction;
            const shortfall = Math.max(0, requested - stock);

            let newApprovedQty = Math.max(0, stock);
            let newStatus: RequisitionItemStatus = item.status;
            let newRejectReason = item.rejectReason;

            if (stock === 0) {
                if (action === 'borrow') {
                    newStatus = 'Loaned';
                    newApprovedQty = requested;
                    newRejectReason = 'สต็อกในคลังเป็น 0 ปรับเป็นการยืมทั้งหมด';
                } else if (action === 'backorder') {
                    newStatus = 'Backordered';
                    newApprovedQty = 0;
                    newRejectReason = 'สต็อกในคลังเป็น 0 ตั้งเป็นค้างจ่าย';
                } else if (action === 'reject') {
                    newStatus = 'Rejected';
                    newApprovedQty = 0;
                    newRejectReason = 'สต็อกในคลังเป็น 0 ไม่อนุมัติจ่าย';
                } else if (action === 'cancel') {
                    newStatus = 'Approved';
                    newApprovedQty = 0;
                    newRejectReason = 'สต็อกในคลังเป็น 0 ยกเลิกรายการจ่าย';
                }
            } else {
                newApprovedQty = stock;
                if (action === 'borrow') {
                    newStatus = 'Loaned';
                    newRejectReason = `จ่ายตามสต็อก ${stock} ชิ้น ส่วนที่ขาด ${shortfall} ชิ้นปรับเป็นยืม`;
                } else if (action === 'backorder') {
                    newStatus = 'Backordered';
                    newRejectReason = `จ่ายตามสต็อก ${stock} ชิ้น ส่วนที่ขาด ${shortfall} ชิ้นตั้งค้างจ่าย`;
                } else if (action === 'cancel') {
                    newStatus = 'Approved';
                    newRejectReason = `จ่ายตามสต็อก ${stock} ชิ้น ยกเลิกส่วนที่เหลือ`;
                } else if (action === 'reject') {
                    newStatus = 'Approved';
                    newRejectReason = `จ่ายตามสต็อก ${stock} ชิ้น ส่วนที่ขาด ${shortfall} ชิ้นไม่อนุมัติ`;
                }
            }

            return {
                ...item,
                approvedQuantity: newApprovedQty,
                status: newStatus,
                rejectReason: newRejectReason
            };
        }));

        setShowStockShortfallModal(false);
        setToastNotification('ระบบได้ปรับยอดจ่ายเท่าที่มีในสต็อกและจัดการส่วนที่เหลือตามตัวเลือกเรียบร้อยแล้ว');
        setTimeout(() => setToastNotification(null), 5000);
    };

    const handleCheckStock = () => {
        const shortages: {
            item: RequisitionItem;
            stock: number;
            shortfall: number;
        }[] = [];

        items.forEach(item => {
            if (item.status === 'Rejected') return;
            const stock = Math.max(0, liveInventoryMap.get(item.productId) ?? 0);
            const qtyToCheck = (item.approvedQuantity !== undefined && item.approvedQuantity !== null && item.approvedQuantity > 0)
                ? item.approvedQuantity
                : item.quantity;

            if (qtyToCheck > stock || stock === 0) {
                shortages.push({
                    item,
                    stock,
                    shortfall: Math.max(0, qtyToCheck - stock) || (stock === 0 ? item.quantity : 1)
                });
            }
        });

        if (shortages.length > 0) {
            setShortfallItems(shortages);
            const initialOverrides: Record<number, 'borrow' | 'backorder' | 'cancel' | 'reject'> = {};
            shortages.forEach(s => {
                initialOverrides[s.item.id] = selectedGlobalAction;
            });
            setItemActionOverrides(initialOverrides);
            setShowStockShortfallModal(true);
        } else {
            setToastNotification('เวชภัณฑ์ทุกรายการมีสต็อกในคลังเพียงพอสำหรับการจ่าย');
            setTimeout(() => setToastNotification(null), 3500);
        }
    };

    const handleConfirmAndSave = async () => {
        if (isPreview || isProcessing) return;

        // 1. Check for stock shortages first
        const shortages: {
            item: RequisitionItem;
            stock: number;
            shortfall: number;
        }[] = [];

        items.forEach(item => {
            if (item.status === 'Rejected') return;
            const stock = Math.max(0, liveInventoryMap.get(item.productId) ?? 0);
            const approvedQty = item.approvedQuantity || 0;

            if (approvedQty > stock) {
                shortages.push({
                    item,
                    stock,
                    shortfall: approvedQty - stock
                });
            } else if (stock === 0 && approvedQty > 0) {
                shortages.push({
                    item,
                    stock: 0,
                    shortfall: approvedQty
                });
            }
        });

        if (shortages.length > 0) {
            setShortfallItems(shortages);
            const initialOverrides: Record<number, 'borrow' | 'backorder' | 'cancel' | 'reject'> = {};
            shortages.forEach(s => {
                initialOverrides[s.item.id] = selectedGlobalAction;
            });
            setItemActionOverrides(initialOverrides);
            // Open the confirm shortfall modal to ask for confirmation (ถามซ้ำ)
            setShowConfirmShortfallModal(true);
            return;
        }
        
        // 2. Check for partial approvals that need confirmation
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

    const handleFinalizeShortfallApproval = async () => {
        setShowConfirmShortfallModal(false);
        setShowStockShortfallModal(false);

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
            .slice(0, 100);
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

    const handlePrint = async () => {
        const itemsWithProduct = items.map(item => ({
            ...item,
            product: item.product || productMap.get(item.productId)
        }));
        const targetStatus = requisition.status === 'Submitted' ? 'Picking' : requisition.status;
        setRequisitionToPrint({ ...requisition, status: targetStatus, items: itemsWithProduct });
        if (requisition.status === 'Submitted' && !isPreview) {
            try {
                await supabaseService.updateRequisitionStatus(requisition.id, 'Picking');
                if (onItemsUpdated) onItemsUpdated();
            } catch (err) {
                console.error('Failed to update status on print:', err);
            }
        }
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
            {requisitionToPrint && (
                <>
                    <div className="fixed top-4 right-4 z-50 no-print flex items-center gap-3 bg-slate-900/95 dark:bg-slate-800/95 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 animate-fade-in text-xs backdrop-blur-sm">
                        <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            พิมพ์เอกสารแล้ว (สถานะเปลี่ยนเป็นกำลังจัดของ)
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setRequisitionToPrint(null);
                                setIsProcessing(false);
                                onClose();
                            }}
                            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold rounded-lg shadow-sm transition-all"
                        >
                            เสร็จสิ้น / ปิดหน้านี้
                        </button>
                    </div>
                    <PickingListPrintView requisition={requisitionToPrint} departmentName={requisitionToPrint.departmentName || ''} documentSettings={documentSettings} personnel={personnel} />
                </>
            )}
            
            {/* Modal: ตรวจสอบสต็อกไม่พอจ่าย หรือสต็อกเป็น 0 */}
            <Modal
                isOpen={showStockShortfallModal}
                onClose={() => setShowStockShortfallModal(false)}
                title="แจ้งเตือน: เวชภัณฑ์ในสต็อกไม่พอจ่าย หรือสต็อกเป็น 0"
                size="2xl"
            >
                <div className="space-y-5">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 rounded-xl border border-amber-200 dark:border-amber-800">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">
                                พบเวชภัณฑ์ {shortfallItems.length} รายการ ที่สต็อกในคลังไม่พอจ่าย หรือมีสต็อกเป็น 0
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                ท่านสามารถเลือกให้รับของเข้าระบบก่อน หรือปรับจ่ายเท่าที่มีในสต็อก พร้อมกำหนดการจัดการสำหรับจำนวนส่วนที่ขาด/ส่วนที่เหลือได้ทันที
                            </p>
                        </div>
                    </div>

                    {/* Option 1: ต้องการรับของเข้าระบบก่อน */}
                    <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded-lg flex-shrink-0">
                                <ArchiveBoxArrowDownIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                    ทางเลือกที่ 1: รับของเข้าระบบก่อน แล้วค่อยกลับมาอนุมัติ
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    ระบบจะบันทึกร่างใบเบิกนี้ไว้ให้อัตโนมัติ เพื่อให้ท่านไปบันทึกรับของเข้าระบบ (Receipts) ก่อน แล้วจึงกลับมาอนุมัติใบเบิกนี้
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleGoToReceipts}
                            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 transition-all flex-shrink-0"
                        >
                            <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                            <span>ไปหน้ารับของเข้าระบบ</span>
                        </button>
                    </div>

                    {/* Option 2: ปรับจ่ายเท่าที่มี และจัดการส่วนที่เหลือ */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                ทางเลือกที่ 2: ปรับจ่ายเท่าที่มีในสต็อก (ถ้าสต็อกเป็น 0 จะจ่าย 0)
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                กำหนดวิธีจัดการสำหรับจำนวนส่วนที่ขาด/ส่วนที่เหลือ (เลือกพร้อมกันทั้งหมด หรือเลือกแยกรายตัวด้านล่าง):
                            </p>
                        </div>

                        {/* Quick Selection Buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalAction('borrow')}
                                className={`p-2.5 rounded-lg border text-center transition-all ${
                                    selectedGlobalAction === 'borrow'
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-300 dark:ring-purple-700'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="font-bold text-xs text-purple-700 dark:text-purple-300">ปรับเป็นยืม</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">ส่วนที่ขาดปรับเป็นยืม</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalAction('backorder')}
                                className={`p-2.5 rounded-lg border text-center transition-all ${
                                    selectedGlobalAction === 'backorder'
                                        ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 ring-2 ring-orange-300 dark:ring-orange-700'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="font-bold text-xs text-orange-700 dark:text-orange-300">ค้างจ่าย</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">ส่วนที่ขาดตั้งค้างจ่าย</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalAction('cancel')}
                                className={`p-2.5 rounded-lg border text-center transition-all ${
                                    selectedGlobalAction === 'cancel'
                                        ? 'bg-slate-200 dark:bg-slate-600 border-slate-500 ring-2 ring-slate-300 dark:ring-slate-500'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="font-bold text-xs text-slate-700 dark:text-slate-200">ยกเลิก</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">ตัดยอดส่วนที่ขาดทิ้ง</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyGlobalAction('reject')}
                                className={`p-2.5 rounded-lg border text-center transition-all ${
                                    selectedGlobalAction === 'reject'
                                        ? 'bg-red-50 dark:bg-red-950/40 border-red-500 ring-2 ring-red-300 dark:ring-red-700'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="font-bold text-xs text-red-700 dark:text-red-300">ไม่อนุมัติ</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">ส่วนที่ขาดไม่อนุมัติ</div>
                            </button>
                        </div>

                        {/* List of Shortfall Items with Per-Item Control */}
                        <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">เวชภัณฑ์</th>
                                        <th className="p-2 text-center">ขอเบิก</th>
                                        <th className="p-2 text-center">สต็อกในคลัง</th>
                                        <th className="p-2 text-center">ปรับจ่าย</th>
                                        <th className="p-2 text-center">ส่วนที่ขาด</th>
                                        <th className="p-2 text-left">การจัดการส่วนที่ขาด</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700 bg-white dark:bg-slate-800">
                                    {shortfallItems.map(({ item, stock, shortfall }) => {
                                        const product = item.product || productMap.get(item.productId);
                                        const action = itemActionOverrides[item.id] || selectedGlobalAction;
                                        return (
                                            <tr key={item.id}>
                                                <td className="p-2">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">{product?.name || item.productId}</div>
                                                    <div className="text-[10px] text-slate-500">หน่วย: {product?.unit || '-'}</div>
                                                </td>
                                                <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{item.quantity}</td>
                                                <td className="p-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded font-bold ${stock === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                                        {stock}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                    {stock}
                                                </td>
                                                <td className="p-2 text-center font-bold text-red-600 dark:text-red-400">
                                                    {shortfall}
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        value={action}
                                                        onChange={e => setItemActionOverrides(prev => ({ ...prev, [item.id]: e.target.value as any }))}
                                                        className="p-1 border rounded text-xs dark:bg-slate-700 dark:border-slate-600 font-semibold"
                                                    >
                                                        <option value="borrow">ยืม (ขาด {shortfall})</option>
                                                        <option value="backorder">ค้างจ่าย (ขาด {shortfall})</option>
                                                        <option value="cancel">ยกเลิกส่วนที่ขาด</option>
                                                        <option value="reject">ไม่อนุมัติส่วนที่ขาด</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setShowStockShortfallModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                กลับไปแก้ไขเอง
                            </button>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleApplyAdjustedStock}
                                    className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-all"
                                >
                                    ปรับจ่ายเท่าที่มี
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowStockShortfallModal(false);
                                        setShowConfirmShortfallModal(true);
                                    }}
                                    className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                                >
                                    <CheckCircleIcon className="w-4 h-4" />
                                    <span>ยืนยันอนุมัติจ่ายตามนี้ (แม้ของไม่พอ)</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Option 3: ยืนยันอนุมัติจ่ายตามจำนวนนี้ (แม้ของไม่พอจ่าย) */}
                    <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border-2 border-amber-400 dark:border-amber-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg flex-shrink-0">
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                        ทางเลือกที่ 3: ยืนยันอนุมัติจ่ายตามจำนวนนี้ (แม้ของไม่พอจ่าย)
                                    </h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                        ถามยืนยันซ้ำ
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    อนุมัติจ่ายตามยอดที่ระบุทันที (สำหรับกรณีของจริงมาถึงแล้ว หรือต้องการอนุมัติไปก่อน) ระบบจะถามยืนยันซ้ำอีกครั้งก่อนบันทึก
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowStockShortfallModal(false);
                                setShowConfirmShortfallModal(true);
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 transition-all flex-shrink-0"
                        >
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>อนุมัติตามยอดนี้ (ถามยืนยันซ้ำ)</span>
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal: ถามซ้ำเพื่อยืนยันการอนุมัติเมื่อของไม่พอจ่าย */}
            <Modal
                isOpen={showConfirmShortfallModal}
                onClose={() => setShowConfirmShortfallModal(false)}
                title="⚠️ ยืนยันการอนุมัติ: พบเวชภัณฑ์ในสต็อกไม่พอจ่าย"
                size="lg"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">
                                ยืนยันอนุมัติจ่าย แม้จะมีเวชภัณฑ์ไม่พอจ่าย {shortfallItems.length} รายการ?
                            </p>
                            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                                ระบบตรวจพบว่ายอดที่ท่านต้องการอนุมัติจ่าย มีจำนวนมากกว่าสต็อกคงเหลือในคลังกลาง หรือสต็อกในคลังเป็น 0
                            </p>
                        </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex justify-between items-center">
                            <span>รายการเวชภัณฑ์ที่ไม่พอจ่าย</span>
                            <span className="text-red-600 dark:text-red-400 font-bold">{shortfallItems.length} รายการ</span>
                        </div>
                        <div className="max-h-52 overflow-y-auto divide-y dark:divide-slate-700 text-xs bg-white dark:bg-slate-800">
                            {shortfallItems.map(({ item, stock, shortfall }) => {
                                const product = item.product || productMap.get(item.productId);
                                return (
                                    <div key={item.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{product?.name || item.productId}</div>
                                            <div className="text-[10px] text-slate-500">
                                                หน่วย: {product?.unit || '-'} | ขอเบิก: {item.quantity}
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-2 flex-shrink-0">
                                            <div className="text-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                                                <div className="text-[10px] text-slate-400">ในคลัง</div>
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{stock}</div>
                                            </div>
                                            <div className="text-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">จะอนุมัติ</div>
                                                <div className="font-black text-emerald-700 dark:text-emerald-300">{item.approvedQuantity || 0}</div>
                                            </div>
                                            <div className="text-center px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800">
                                                <div className="text-[10px] text-red-500">ขาด</div>
                                                <div className="font-bold text-red-600 dark:text-red-400">-{shortfall}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-800 dark:text-sky-200 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                            <span>ℹ️ ข้อมูลการทำงานของระบบ:</span>
                        </div>
                        <p>
                            • เมื่อยืนยัน ระบบจะบันทึกยอดอนุมัติให้ตามที่ระบุไว้ทันที (สถานะ: อนุมัติแล้ว/พร้อมจ่าย)
                        </p>
                        <p>
                            • เหมาะสำหรับกรณีที่สินค้าจริงมีส่งมาถึงแล้วแต่ยังไม่ได้ลงรับในระบบ หรือได้รับอนุมัติกรณีพิเศษ
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => {
                                setShowConfirmShortfallModal(false);
                                setShowStockShortfallModal(true);
                            }}
                            className="text-xs text-slate-600 dark:text-slate-300 hover:text-sky-600 underline font-medium"
                        >
                            ← ดูตัวเลือกปรับจ่ายเท่าที่มี (ค้างจ่าย/ยืม/ยกเลิก)
                        </button>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={() => setShowConfirmShortfallModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                กลับไปแก้ไขตัวเลข
                            </button>
                            <button
                                type="button"
                                onClick={handleFinalizeShortfallApproval}
                                disabled={isProcessing}
                                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg shadow-md flex items-center gap-1.5 transition-all"
                            >
                                <CheckCircleIcon className="w-4 h-4" />
                                <span>{isProcessing ? 'กำลังบันทึก...' : 'ขอยืนยันอนุมัติตามยอดนี้'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

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
                        <p className="text-slate-600 dark:text-slate-300 font-semibold">ใบเบิก #{requisition.requisitionNumber || 'Draft'} - {requisition.departmentName}</p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                            {requisition.requisitionPeriod && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                                    รอบเดือนที่เบิก: {requisition.requisitionPeriod}
                                </span>
                            )}
                            {requisition.documentRefNo && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                                    เลขที่หนังสืออ้างอิง: {requisition.documentRefNo}
                                </span>
                            )}
                        </div>
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
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    type="button"
                                    onClick={handleCheckStock}
                                    className="flex items-center gap-1.5 bg-amber-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-amber-700 shadow-sm transition-all text-sm"
                                    title="ตรวจสอบสต็อกในคลังกลาง หรือปรับจ่ายเท่าที่มี"
                                >
                                    <ExclamationTriangleIcon className="w-5 h-5"/>
                                    <span>ตรวจสต็อก/ปรับจ่ายเท่าที่มี</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setItems(prev => prev.map(item => ({ ...item, approvedQuantity: item.quantity })));
                                    }}
                                    className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-emerald-700 shadow-sm transition-all text-sm"
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
                                    className="flex items-center gap-1.5 bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg hover:bg-slate-300 shadow-sm transition-all text-sm"
                                >
                                    <TrashIcon className="w-5 h-5"/>
                                    <span>ล้างเป็น 0 ทั้งหมด</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {toastNotification && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-medium flex items-center justify-between shadow-sm animate-fade-in">
                            <div className="flex items-center gap-2">
                                <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                <span>{toastNotification}</span>
                            </div>
                            <button type="button" onClick={() => setToastNotification(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">ปิด</button>
                        </div>
                    )}
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
                                    <th className="p-2 text-center text-sm font-semibold">สต็อกในคลัง</th>
                                    <th className="p-2 text-center text-sm font-semibold">อนุมัติจ่าย</th>
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
                                    const stock = liveInventoryMap.get(item.productId) ?? 0;
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
                                            <td className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                            <td className="p-2 text-center">
                                                {stock === 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
                                                        หมด (0)
                                                    </span>
                                                ) : stock < item.quantity ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                        ไม่พอ ({stock})
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                        มี ({stock})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2 w-28">
                                                <input 
                                                    type="number" 
                                                    value={item.approvedQuantity === 0 ? '' : item.approvedQuantity} 
                                                    onChange={e => handleItemUpdate(item.id!, 'approvedQuantity', e.target.value)} 
                                                    min={0} 
                                                    className={`w-full text-right p-1 border rounded text-sm dark:bg-slate-700 focus:ring-2 ${
                                                        (item.approvedQuantity || 0) > stock 
                                                            ? 'border-red-500 bg-red-50/50 text-red-900 focus:ring-red-200 dark:bg-red-900/20 dark:text-red-200 font-bold' 
                                                            : 'border-sky-400 focus:ring-sky-200'
                                                    }`} 
                                                    disabled={isPreview} 
                                                    placeholder="0"
                                                />
                                                {(item.approvedQuantity || 0) > stock && (
                                                    <div className="text-[10px] text-red-600 dark:text-red-400 font-bold text-right leading-tight mt-0.5">
                                                        ⚠️ เกิน (+{((item.approvedQuantity || 0) - stock)})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 w-28">
                                                <input type="number" step="0.01" value={item.pricePerUnit ?? ''} onChange={e => handleItemUpdate(item.id!, 'pricePerUnit', e.target.value)} min={0} className="w-full text-right p-1 border rounded text-sm dark:bg-slate-700 bg-amber-50 dark:bg-amber-900/10" disabled={isPreview} />
                                            </td>
                                            <td className="p-2 w-32">
                                                <select value={item.status} onChange={e => handleItemUpdate(item.id!, 'status', e.target.value)} className="w-full p-1 border rounded text-xs dark:bg-slate-700 font-medium" disabled={isPreview}>
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
                                                <td colSpan={!isPreview ? 8 : 7} className="p-2 px-4">
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
                                    <td colSpan={6} className="p-3 text-right text-sm">
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