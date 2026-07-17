import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Department, Product, RequisitionItem, Requisition, RequisitionStatus, ExpiringStockItem, Personnel, DepartmentInventoryItem } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../supabaseClient';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import ShoppingCartIcon from '../icons/ShoppingCartIcon';
import SignaturePadModal from '../SignaturePadModal';

interface AutomatedRequisitionFormProps {
    department: Department;
    isRequisitionOpen: boolean;
    onCancel: () => void;
    onSaveSuccess: (reqId?: string) => void;
    allProducts: Product[];
    initialDeptProducts: Product[];
    initialSurveyQuantities: Record<string, number>;
    expiringStock: ExpiringStockItem[];
    initialRequisition?: Requisition | null;
    requisitionType: 'Normal' | 'OffCycle' | 'Urgent';
    inventoryMap: Map<string, number>;
    pendingRequisitions: Requisition[];
    personnel: Personnel[];
    requisitionHistory?: Requisition[];
    deptInventory: DepartmentInventoryItem[];
}

const AutomatedRequisitionForm: React.FC<AutomatedRequisitionFormProps> = ({ department, isRequisitionOpen, onCancel, onSaveSuccess, allProducts, initialDeptProducts, initialSurveyQuantities, expiringStock, initialRequisition, requisitionType, inventoryMap, pendingRequisitions, personnel, requisitionHistory, deptInventory }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    
    const [items, setItems] = useState<RequisitionItem[]>([]);
    const [name, setName] = useState('');
    const [requesterName, setRequesterName] = useState('');
    const [requesterPosition, setRequesterPosition] = useState('');
    const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
    const [urgentReason, setUrgentReason] = useState('');
    const [showSurveyItems, setShowSurveyItems] = useState(false);
    const [isCartHidden, setIsCartHidden] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isSubmittingWithSignature, setIsSubmittingWithSignature] = useState(false);
    const [localSignatureUrl, setLocalSignatureUrl] = useState<string | null | undefined>(undefined);

    const getSignature = () => {
        if (localSignatureUrl !== undefined) return localSignatureUrl;
        return personnel.find(p => p.name === requesterName.trim())?.signatureImage;
    };

    const basketRef = useRef<HTMLDivElement>(null);
    const draftSaveTimeout = useRef<number | null>(null);
    
    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    const currentItemIds = useMemo(() => new Set(items.map(p => p.productId)), [items]);
    const isEditMode = !!initialRequisition;
    const type = initialRequisition?.type || requisitionType;
    const requiresReason = type === 'Urgent' || type === 'OffCycle';

    const uniquePositions = useMemo(() => {
        const positions = new Set(personnel.map(p => p.position).filter(p => p && p.trim() !== ''));
        return Array.from(positions).sort();
    }, [personnel]);

    const frequentlyOrderedProducts = useMemo(() => {
        if (!requisitionHistory) return [];

        const productStats: Record<string, { count: number; lastOrdered: Date }> = {};

        requisitionHistory.forEach(req => {
            req.items?.forEach(item => {
                if (item.status !== 'Rejected') {
                    const productId = item.productId;
                    if (!productStats[productId]) {
                        productStats[productId] = { count: 0, lastOrdered: new Date(0) };
                    }
                    productStats[productId].count += 1;
                    if (new Date(req.createdAt) > productStats[productId].lastOrdered) {
                        productStats[productId].lastOrdered = new Date(req.createdAt);
                    }
                }
            });
        });

        return Object.entries(productStats)
            .map(([productId, stats]) => ({
                product: productMap.get(productId),
                ...stats
            }))
            .filter((item): item is { product: Product; count: number; lastOrdered: Date } => !!item.product) 
            .sort((a, b) => b.lastOrdered.getTime() - a.lastOrdered.getTime()) 
            .map(item => item.product);

    }, [requisitionHistory, productMap]);

    const frequentlyOrderedProductsToShow = useMemo(() => {
        return frequentlyOrderedProducts
            .filter(p => !currentItemIds.has(p.id))
            .slice(0, 15); 
    }, [frequentlyOrderedProducts, currentItemIds]);

    const handleItemChange = (productId: string, field: 'quantity' | 'departmentStockOnSubmit', value: string) => {
        const numValue = value === '' ? null : parseInt(value, 10);
        if (value !== '' && (numValue === null || isNaN(numValue) || numValue < 0)) return;

        setItems(prev => prev.map(item => 
            item.productId === productId 
            ? { ...item, [field]: numValue } 
            : item
        ));
    };

    const handleNameChange = (name: string) => {
        setRequesterName(name);
        setLocalSignatureUrl(undefined);
        const person = personnel.find(p => p.name === name);
        if (person) {
            setRequesterPosition(person.position);
        }
    };
    
    useEffect(() => {
        const isDraft = !initialRequisition || (initialRequisition && initialRequisition.id.startsWith('draft-'));

        if (isDraft && !isSaving) {
            if (draftSaveTimeout.current) {
                clearTimeout(draftSaveTimeout.current);
            }

            draftSaveTimeout.current = window.setTimeout(() => {
                const draftData = {
                    id: initialRequisition?.id || `draft-${Date.now()}`,
                    departmentId: department.id,
                    name,
                    items,
                    requesterName,
                    requesterPosition,
                    type,
                    urgentReason,
                    createdAt: initialRequisition?.createdAt || new Date(),
                };
                try {
                    if (items.length > 0 || name.trim() !== '') {
                        localStorage.setItem(`unsavedRequisition_${department.id}`, JSON.stringify(draftData));
                    } else {
                        localStorage.removeItem(`unsavedRequisition_${department.id}`);
                    }
                } catch (e) {
                    console.error("Failed to save draft to localStorage", e);
                }
            }, 500); 
        }

        return () => {
            if (draftSaveTimeout.current) {
                clearTimeout(draftSaveTimeout.current);
            }
        };
    }, [items, name, requesterName, requesterPosition, urgentReason, department.id, isSaving, initialRequisition, type]);


    useEffect(() => {
        const event = new CustomEvent('toggleLineContact', { detail: false });
        window.dispatchEvent(event);
        return () => {
            const event = new CustomEvent('toggleLineContact', { detail: true });
            window.dispatchEvent(event);
        };
    }, []);

    useEffect(() => {
        setLocalSignatureUrl(undefined);
        if (initialRequisition) { 
            setName(initialRequisition.name || '');
            setItems(initialRequisition.items || []);
            setRequesterName(initialRequisition.requesterName || '');
            setRequesterPosition(initialRequisition.requesterPosition || '');
            setUrgentReason(initialRequisition.urgentReason || '');
        } else { 
            const now = new Date();
            const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
            const defaultName = requiresReason 
                ? `ใบเบิก${type === 'Urgent' ? 'ด่วน' : 'นอกรอบ'} ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear() + 543}`
                : `ใบเบิก ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear() + 543}`;
            setName(defaultName);

            const savedRequester = localStorage.getItem(`requesterInfo-${department.id}`);
            if (savedRequester) {
                try {
                    const { name, position } = JSON.parse(savedRequester);
                    setRequesterName(name || '');
                    const person = personnel.find(p => p.name === name);
                    if (person) {
                        setRequesterPosition(person.position);
                    } else {
                        setRequesterPosition(position || '');
                    }
                } catch (e) {
                    setRequesterName('');
                    setRequesterPosition('');
                }
            } else {
                setRequesterName('');
                setRequesterPosition('');
            }
            
            setItems([]); 
            setUrgentReason('');
        }
    }, [initialRequisition, department.id, requiresReason, personnel]);

    const handleAddItem = (product: Product) => {
        setIsCartHidden(false);
        if (!items.some(item => item.productId === product.id)) {
             setItems(prev => [...prev, {
                requisitionId: initialRequisition?.id || '',
                productId: product.id,
                quantity: 1, 
                departmentStockOnSubmit: null,
                pricePerUnit: product.pricePerUnit || 0,
                status: 'Pending',
                approvedQuantity: null,
                returnedQuantity: null,
            }]);
        }
        setCatalogSearchTerm('');
    };

    const handleRemoveItem = (productId: string) => {
        setItems(prev => prev.filter(item => item.productId !== productId));
    };

    const handleSave = async (status: RequisitionStatus) => {
        const zeroQtyItems = items.filter(i => !i.quantity || i.quantity <= 0);
        const itemsToSave = items.filter(i => (i.quantity || 0) > 0);
        
        if (itemsToSave.length === 0) {
             setError('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ และระบุจำนวนให้ถูกต้อง (มากกว่า 0)');
             return;
        }

        if (status === 'Submitted' && zeroQtyItems.length > 0) {
            const confirmMsg = `มี ${zeroQtyItems.length} รายการที่ไม่ได้ระบุจำนวน (หรือเป็น 0) ซึ่งจะไม่ถูกส่งไปเบิก คุณต้องการดำเนินการต่อหรือไม่?`;
            if (!window.confirm(confirmMsg)) {
                return;
            }
        }

        if (!name.trim() || (status === 'Submitted' && (!requesterName.trim() || !requesterPosition.trim()))) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }

        if (status === 'Submitted' && requiresReason && !urgentReason.trim()) {
            setError('กรุณาระบุเหตุผลการเบิก');
            return;
        }

        if (status === 'Submitted') {
            const warnings: string[] = [];
            const missingMinMax: string[] = [];

            itemsToSave.forEach(item => {
                const product = productMap.get(item.productId);
                const deptInv = deptInventory.find(inv => inv.productId === item.productId);
                
                // ใช้เฉพาะ Min/Max ของหน่วยงานเท่านั้น ไม่ใช้ของส่วนกลาง
                const minStock = deptInv?.minStock;
                const maxStock = deptInv?.maxStock;
                const requestedQty = item.quantity || 0;
                
                if (minStock !== null && minStock !== undefined && maxStock !== null && maxStock !== undefined) {
                    // ไม่นำยอดคงเหลือมาคำนวณตามที่ผู้ใช้ต้องการ
                    if (requestedQty > maxStock) {
                        warnings.push(`- ${product?.name}: เบิกเกิน Max (Max: ${maxStock}, เบิก: ${requestedQty} ${product?.unit})`);
                    } else if (requestedQty < minStock) {
                        warnings.push(`- ${product?.name}: เบิกต่ำกว่า Min (Min: ${minStock}, เบิก: ${requestedQty} ${product?.unit})`);
                    }
                } else {
                    missingMinMax.push(`- ${product?.name}`);
                }
            });

            let confirmMsg = '';
            if (warnings.length > 0) {
                confirmMsg += `พบรายการเบิกที่ไม่สอดคล้องกับ Min/Max:\n${warnings.join('\n')}\n\n`;
            }
            if (missingMinMax.length > 0) {
                confirmMsg += `รายการที่ยังไม่ได้ตั้งค่า Min/Max ของหน่วยงาน (แนะนำให้ตั้งค่าเพื่อการบริหารคลังที่ดีขึ้น):\n${missingMinMax.join('\n')}\n\n`;
            }

            if (confirmMsg) {
                confirmMsg += `คุณยังต้องการยืนยันการส่งใบเบิกนี้หรือไม่?`;
                if (!window.confirm(confirmMsg)) {
                    return;
                }
            } else {
                if (!window.confirm("ยืนยันการส่งใบเบิก?")) {
                    return;
                }
            }

            /* 
            // Check signature
            if (!getSignature()) {
                setIsSubmittingWithSignature(true);
                setIsSignatureModalOpen(true);
                return;
            }
            */
        }

        await executeSubmit(status);
    };

    const executeSubmit = async (status: RequisitionStatus) => {
        const itemsToSave = items.filter(i => (i.quantity || 0) > 0);
        setIsSaving(true);
        setError('');
        try {
            const requisitionData: Partial<Omit<Requisition, 'items' | 'totalValue' | 'departmentName'>> = {
                id: initialRequisition?.id,
                departmentId: department.id,
                name,
                status,
                type: type,
                urgentReason: requiresReason ? urgentReason.trim() : undefined,
                submittedAt: status === 'Submitted' ? new Date() : null,
                requesterName: requesterName.trim() || null,
                requesterPosition: requesterPosition.trim() || null,
                requisitionNumber: initialRequisition?.requisitionNumber,
            } as any;
            
            const savedReqId = await supabaseService.saveRequisition(requisitionData, itemsToSave, department.name);

            localStorage.removeItem(`unsavedRequisition_${department.id}`);

            if (requesterName.trim() || requesterPosition.trim()) {
                localStorage.setItem(`requesterInfo-${department.id}`, JSON.stringify({ name: requesterName.trim(), position: requesterPosition.trim() }));
            }
            
            onSaveSuccess(status === 'Submitted' ? savedReqId : undefined);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
             setIsSaving(false);
        }
    };

    const handleSignatureDelete = async () => {
        setIsSaving(true);
        try {
            const person = personnel.find(p => p.name === requesterName.trim());
            if (person) {
                await supabaseService.updatePersonnelSignature(person.id, null);
            }
            setLocalSignatureUrl(null);
            setIsSaving(false);
            alert('ลบลายเซ็นสำเร็จ');
            // Don't close modal, let them draw a new one, or they can close it themselves
            // If they were submitting, they now have to sign and save to continue
        } catch (error) {
            console.error("Error deleting signature:", error);
            setError("ไม่สามารถลบลายเซ็นได้");
            setIsSaving(false);
        }
    };

    const handleSignatureSave = async (signatureDataUrl: string) => {
        setIsSignatureModalOpen(false);
        setIsSaving(true);
        try {
            let person = personnel.find(p => p.name === requesterName.trim());
            if (!person) {
                // Create new personnel
                person = await supabaseService.addPersonnel({
                    name: requesterName.trim(),
                    position: requesterPosition.trim()
                });
            }
            await supabaseService.updatePersonnelSignature(person.id, signatureDataUrl);
            setLocalSignatureUrl(signatureDataUrl);
            
            if (isSubmittingWithSignature) {
                await executeSubmit('Submitted');
            } else {
                setIsSaving(false);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกลายเซ็น');
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        const isDraft = !initialRequisition || (initialRequisition && initialRequisition.id.startsWith('draft-'));
        const hasContent = items.length > 0 || (name && name.trim() !== '');

        if (isDraft && hasContent) {
            if (window.confirm('คุณต้องการยกเลิกใบเบิกนี้หรือไม่? ข้อมูลฉบับร่างที่ยังไม่ได้บันทึกจะถูกลบ')) {
                localStorage.removeItem(`unsavedRequisition_${department.id}`);
                onCancel();
            }
        } else {
            onCancel();
        }
    };

    const catalogProductsToShow = useMemo(() => {
        const lowerCaseSearchTerm = catalogSearchTerm.toLowerCase();
        if (catalogSearchTerm.trim() !== '') {
            return allProducts
                .filter(p =>
                    !currentItemIds.has(p.id) &&
                    p.name.toLowerCase().includes(lowerCaseSearchTerm)
                )
                .sort((a, b) => a.name.localeCompare(b.name, 'th'))
                .slice(0, 20); 
        }
        if (showSurveyItems) {
            return initialDeptProducts
                .filter(p => !currentItemIds.has(p.id))
                .sort((a, b) => a.name.localeCompare(b.name, 'th'));
        }
        return allProducts
            .filter(p => !currentItemIds.has(p.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 50);

    }, [allProducts, initialDeptProducts, currentItemIds, catalogSearchTerm, showSurveyItems]);
    
    const basketItems = useMemo(() => {
        return items.map(item => {
            const product = productMap.get(item.productId);
            const inventoryItem = deptInventory?.find(inv => inv.productId === item.productId);
            
            let lastApprovedQty = 0;
            if (requisitionHistory) {
                const sortedHistory = [...requisitionHistory].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                for (const req of sortedHistory) {
                    if (req.id === initialRequisition?.id) continue;
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
                product,
                minStock: inventoryItem?.minStock,
                maxStock: inventoryItem?.maxStock,
                lastApprovedQty
            };
        }).filter(item => item.product)
           .sort((a,b) => (a.product?.name || '').localeCompare(b.product?.name || '', 'th'));
    }, [items, productMap, deptInventory, requisitionHistory, initialRequisition]);

    const handleScrollToBasket = () => {
        basketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setIsCartHidden(true);
    };

    // Drag logic for floating cart button
    const fabRef = useRef<HTMLButtonElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const fabPos = useRef({ x: 0, y: 0 });
    const dragDistance = useRef(0);

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        dragDistance.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY };
        if (fabRef.current) {
            fabRef.current.setPointerCapture(e.pointerId);
            fabRef.current.style.transition = 'none';
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        dragDistance.current += Math.abs(dx) + Math.abs(dy);

        fabPos.current.x += dx;
        fabPos.current.y += dy;
        
        if (fabRef.current) {
            fabRef.current.style.transform = `translate(${fabPos.current.x}px, ${fabPos.current.y}px)`;
        }
        
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        if (fabRef.current) {
            fabRef.current.releasePointerCapture(e.pointerId);
            fabRef.current.style.transition = 'transform 0.2s';
        }
    };

    const handleFabClick = (e: React.MouseEvent) => {
        if (dragDistance.current > 10) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        handleScrollToBasket();
    };

    const title = isEditMode ? 'แก้ไขใบเบิก' : requiresReason ? `สร้างใบเบิก${type === 'Urgent' ? 'ด่วน / ฉุกเฉิน' : 'นอกรอบ'}` : 'สร้างใบเบิก';

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
                <button onClick={handleCancel} className="text-sm font-medium text-slate-600 dark:text-slate-300">ยกเลิก</button>
            </div>

            {error && <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/50 p-3 rounded-lg border border-red-200 dark:border-red-800">{error}</p>}
            
            {requiresReason && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-l-4 border-amber-400 rounded-r-lg flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold">{type === 'Urgent' ? 'การเบิกด่วน/ฉุกเฉิน' : 'การเบิกนอกรอบ'}</h4>
                        <p className="text-sm">
                            {type === 'Urgent' 
                                ? 'นี่คือการเบิกด่วน/ฉุกเฉิน กรุณาระบุเหตุผลความจำเป็นในการเบิกด้านล่าง'
                                : 'สัปดาห์นี้ไม่ใช่รอบเบิกจ่าย หากยืนยันการเบิกจะถือว่าเป็นการเบิกนอกรอบ กรุณาระบุเหตุผลในการเบิกด้านล่าง'
                            }
                        </p>
                    </div>
                </div>
            )}
            
             {!isEditMode && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-l-4 border-amber-400 rounded-r-lg flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold">คำแนะนำ</h4>
                        <p className="text-sm">เพื่อความถูกต้องของข้อมูล, แนะนำให้อัปเดตยอดคงคลังในหน้า "คลังของฉัน" ให้เป็นปัจจุบันก่อนทำการเบิก</p>
                    </div>
                </div>
            )}
            
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2 flex flex-col gap-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">รายการที่เคยเบิก</h3>
                        <div className="mt-2 border rounded-lg overflow-y-auto max-h-64 dark:border-slate-700">
                            {frequentlyOrderedProductsToShow.length > 0 ? (
                                <ul className="divide-y dark:divide-slate-700">
                                    {frequentlyOrderedProductsToShow.map(p => (
                                        <li key={p.id} className="flex justify-between items-center p-3">
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">หน่วย: {p.unit}</p>
                                            </div>
                                            <button onClick={() => handleAddItem(p)} className="flex items-center gap-1.5 bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-sm font-bold py-1.5 px-3 rounded-full hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors">
                                                <PlusIcon className="w-4 h-4" />
                                                หยิบ
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-sm text-slate-500 dark:text-slate-400 p-4">ไม่มีประวัติการเบิก หรือเบิกไปแล้วในตะกร้านี้</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">แคตตาล็อกเวชภัณฑ์ทั้งหมด</h3>
                        <div className="relative mt-2">
                            <input
                                id="search-product"
                                type="text"
                                placeholder="พิมพ์เพื่อค้นหาเวชภัณฑ์..."
                                value={catalogSearchTerm}
                                onChange={e => setCatalogSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg"
                                autoComplete="off"
                            />
                        </div>
                        <div className="mt-2">
                            <label className="flex items-center text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showSurveyItems}
                                    onChange={(e) => setShowSurveyItems(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="ml-2">แสดงเฉพาะรายการที่ทำสำรวจไว้</span>
                            </label>
                        </div>
                        
                        <div className="mt-2 border rounded-lg overflow-y-auto max-h-[40vh] dark:border-slate-700">
                            <ul className="divide-y dark:divide-slate-700">
                                {catalogProductsToShow.length > 0 ? catalogProductsToShow.map(p => (
                                    <li key={p.id} className="flex justify-between items-center p-3">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">หน่วย: {p.unit}</p>
                                        </div>
                                        <button onClick={() => handleAddItem(p)} className="flex items-center gap-1.5 bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-sm font-bold py-1.5 px-3 rounded-full hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors">
                                            <PlusIcon className="w-4 h-4" />
                                            หยิบ
                                        </button>
                                    </li>
                                )) : (
                                    <li className="p-4 text-center text-sm text-slate-500">
                                        {catalogSearchTerm.trim() !== '' ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีรายการ'}
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>


                <div ref={basketRef} id="requisition-basket" className="lg:w-1/2 flex flex-col gap-4">
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <ShoppingCartIcon className="w-6 h-6"/>
                        ใบเบิกปัจจุบัน ({basketItems.length})
                    </h3>

                    <div className="space-y-4 p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ชื่อใบเบิก</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ชื่อผู้เบิก</label>
                                </div>
                                <input list="personnel-list" value={requesterName} onChange={e => handleNameChange(e.target.value)} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" />
                                <datalist id="personnel-list">
                                    {personnel.map(p => <option key={p.id} value={p.name} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ตำแหน่ง</label>
                                <input type="text" list="position-list" value={requesterPosition} onChange={e => setRequesterPosition(e.target.value)} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" />
                                <datalist id="position-list">
                                    {uniquePositions.map((pos, idx) => <option key={idx} value={pos} />)}
                                </datalist>
                            </div>
                        </div>
                        {requiresReason && (
                            <div>
                                <label className="block text-sm font-medium text-amber-700 dark:text-amber-500">เหตุผลการเบิก{type === 'Urgent' ? 'ด่วน' : 'นอกรอบ'} *</label>
                                <input type="text" required value={urgentReason} onChange={e => setUrgentReason(e.target.value)} className="mt-1 w-full border-amber-300 dark:border-amber-600 dark:bg-slate-700 rounded-lg focus:ring-amber-500 focus:border-amber-500" placeholder="ระบุเหตุผลความจำเป็น..." />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-grow border rounded-lg overflow-y-auto max-h-[40vh] lg:max-h-none dark:border-slate-700">
                        {basketItems.length === 0 ? (
                             <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 p-8">
                                ตะกร้าว่างเปล่า
                            </div>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left font-semibold text-slate-500 dark:text-slate-400">รายการ</th>
                                        <th className="p-2 text-center font-semibold text-slate-500 dark:text-slate-400">Min/Max</th>
                                        <th className="p-2 text-center font-semibold text-slate-500 dark:text-slate-400">อนุมัติครั้งก่อน</th>
                                        <th className="p-2 text-center font-semibold text-slate-500 dark:text-slate-400">คงคลัง</th>
                                        <th className="p-2 text-center font-semibold text-slate-500 dark:text-slate-400">จำนวนเบิก</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {basketItems.map(item => (
                                        <tr key={item.productId} className="border-t dark:border-slate-700">
                                            <td className="p-2 font-medium">
                                                {item.product!.name} <span className="text-slate-500 text-sm font-normal">({item.product!.unit})</span>
                                                {item.maxStock && item.quantity > item.maxStock && (
                                                    <span className="ml-2 text-xs text-red-500 font-bold bg-red-100 px-1.5 py-0.5 rounded">เกิน Max</span>
                                                )}
                                            </td>
                                            <td className="p-2 text-center text-slate-500">
                                                {item.minStock ?? '-'}/{item.maxStock ?? '-'}
                                            </td>
                                            <td className="p-2 text-center text-slate-500">
                                                {item.lastApprovedQty || '-'}
                                            </td>
                                            <td className="p-2"><input type="number" min="0" value={item.departmentStockOnSubmit ?? ''} onChange={e => handleItemChange(item.productId, 'departmentStockOnSubmit', e.target.value)} className="w-20 text-right p-1 border rounded bg-white dark:bg-slate-700 mx-auto block" placeholder="0"/></td>
                                            <td className="p-2"><input type="number" min="1" value={item.quantity || ''} onChange={e => handleItemChange(item.productId, 'quantity', e.target.value)} className="w-20 text-right p-1 border rounded bg-white dark:bg-slate-700 font-bold text-sky-600 mx-auto block" /></td>
                                            <td className="p-2 text-center"><button onClick={() => handleRemoveItem(item.productId)}><TrashIcon className="w-5 h-5 text-slate-400 hover:text-red-500 mx-auto block"/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {error && <p className="text-red-600 dark:text-red-400 text-sm animate-shake">{error}</p>}
                        <div className="flex items-center gap-4">
                            <button onClick={() => handleSave('Draft')} disabled={isSaving || items.length === 0} className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50">
                                บันทึกฉบับร่าง
                            </button>
                            <button onClick={() => handleSave('Submitted')} disabled={isSaving || !isRequisitionOpen || items.length === 0} className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 dark:disabled:bg-slate-600">
                                {isSaving ? 'กำลังส่ง...' : (isRequisitionOpen ? 'ยืนยันและส่งใบเบิก' : 'ระบบปิดเบิก')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {basketItems.length > 0 && !isCartHidden && (
                <button
                    ref={fabRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={handleFabClick}
                    className="lg:hidden fixed bottom-28 right-6 z-50 w-16 h-16 rounded-full bg-sky-600 text-white shadow-lg flex items-center justify-center hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 animate-fade-in touch-none"
                    aria-label={`ไปที่ตะกร้า (${basketItems.length} รายการ)`}
                    style={{ animationDuration: '0.3s' }}
                >
                    <ShoppingCartIcon className="w-8 h-8 pointer-events-none"/>
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-white pointer-events-none">
                        {basketItems.length}
                    </span>
                </button>
            )}

            {/* <SignaturePadModal
                isOpen={isSignatureModalOpen}
                onClose={() => { setIsSignatureModalOpen(false); setIsSubmittingWithSignature(false); }}
                onSave={handleSignatureSave}
                onDelete={getSignature() ? handleSignatureDelete : undefined}
                requesterName={requesterName.trim()}
            /> */}
        </div>
    );
};

export default AutomatedRequisitionForm;