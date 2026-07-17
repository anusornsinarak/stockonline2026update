
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Added Requisition to imports to resolve 'Cannot find name' error on line 206.
import { Department, Product, LoanItem, Requisition } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';

interface CreateRequisitionForDeptModalProps {
    isOpen: boolean;
    onClose: () => void;
    departments: Department[];
    allProducts: Product[];
    allLoans: LoanItem[];
    inventoryMap: Map<string, number>;
    onSave: (shouldClose: boolean) => void;
    initialPurpose: 'requisition' | 'loan';
}

const CreateRequisitionForDeptModal: React.FC<CreateRequisitionForDeptModalProps> = ({ 
    isOpen, 
    onClose, 
    departments, 
    allProducts, 
    allLoans, 
    inventoryMap, 
    onSave, 
    initialPurpose 
}) => {
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
    const [requisitionName, setRequisitionName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Loan specific state
    const [selectedLoanItemIds, setSelectedLoanItemIds] = useState<Set<number>>(new Set());
    
    // State to track loans that have been fulfilled in this session to hide them immediately
    const [ignoredLoanKeys, setIgnoredLoanKeys] = useState<Set<string>>(new Set());

    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    
    const deptLoans = useMemo(() => {
        return allLoans.filter(l => 
            l.departmentId === selectedDeptId && 
            l.status === 'Pending' &&
            !ignoredLoanKeys.has(`${l.id}-${l.isDerived}`)
        );
    }, [allLoans, selectedDeptId, ignoredLoanKeys]);

    const loansGroupedByRequisition = useMemo(() => {
        const grouped: Record<string, LoanItem[]> = {};
        deptLoans.forEach(loan => {
            const key = loan.requisitionNumber || 'ยืมตรง (Direct)';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(loan);
        });
        return grouped;
    }, [deptLoans]);

    const isLoanFulfillment = initialPurpose === 'loan';

    useEffect(() => {
        if (isOpen) {
            setSelectedDeptId(departments[0]?.id || '');
            setItems([]);
            setRequisitionName('');
            setError('');
            setIsSaving(false);
            setSearchTerm('');
            setIgnoredLoanKeys(new Set()); // Reset on open
            setSelectedLoanItemIds(new Set());
        }
    }, [isOpen, departments]);

    useEffect(() => {
        if (selectedDeptId) {
            const dept = departments.find(d => d.id === selectedDeptId);
            const dateStr = new Date().toLocaleDateString('th-TH');
            if (isLoanFulfillment) {
                setRequisitionName(`ตัดรายการยืม ${dept?.name} ${dateStr}`);
                // Clear selection when dept changes
                setSelectedLoanItemIds(new Set());
            } else {
                setRequisitionName(`เบิกแทน ${dept?.name} ${dateStr}`);
            }
        }
    }, [selectedDeptId, isLoanFulfillment, departments]);

    const handleAddItem = (product: Product) => {
        if (!items.some(item => item.productId === product.id)) {
            setItems(prev => [...prev, { productId: product.id, quantity: 1 }]);
        }
        setSearchTerm('');
    };
    
    // Toggle selection of a specific loan item
    const handleToggleLoanItem = (loan: LoanItem) => {
        const newSet = new Set(selectedLoanItemIds);
        if (newSet.has(loan.id)) {
            newSet.delete(loan.id);
        } else {
            newSet.add(loan.id);
        }
        setSelectedLoanItemIds(newSet);
    };

    // Toggle all items in a requisition group
    const handleToggleRequisitionGroup = (reqNumber: string) => {
        const groupItems = loansGroupedByRequisition[reqNumber];
        const allSelected = groupItems.every(item => selectedLoanItemIds.has(item.id));
        
        const newSet = new Set(selectedLoanItemIds);
        groupItems.forEach(item => {
            if (allSelected) {
                newSet.delete(item.id);
            } else {
                newSet.add(item.id);
            }
        });
        setSelectedLoanItemIds(newSet);
    };

    const handleRemoveItem = (productId: string) => {
        setItems(prev => prev.filter(item => item.productId !== productId));
    };

    const handleQuantityChange = (productId: string, value: string) => {
        const quantity = parseInt(value, 10);
        setItems(prev => prev.map(item => 
            item.productId === productId ? { ...item, quantity: isNaN(quantity) ? 0 : quantity } : item
        ));
    };
    
    const searchableProducts = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const currentProductIds = new Set(items.map(p => p.productId));
        
        return allProducts
            .filter(p => !currentProductIds.has(p.id) && p.name.toLowerCase().includes(lowerCaseSearchTerm))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 7);
    }, [allProducts, items, searchTerm]);

    const isQuantityUnusual = (productId: string, qty: number) => {
        // Simple heuristic: > 500 considered unusual for now
        return qty > 500;
    };

    const handleSubmit = async () => {
        if (!selectedDeptId || !requisitionName.trim()) {
            setError('กรุณาเลือกหน่วยงานและตั้งชื่อใบเบิก');
            return;
        }

        if (isLoanFulfillment) {
             if (selectedLoanItemIds.size === 0) {
                 setError('กรุณาเลือกรายการยืมที่ต้องการตัดอย่างน้อย 1 รายการ');
                 return;
             }
        } else {
             const validItems = items.filter(i => i.quantity > 0);
             if (validItems.length === 0) {
                setError('กรุณาเพิ่มรายการอย่างน้อย 1 อย่าง');
                return;
             }
        }
        
        setError('');
        setIsSaving(true);
        
        try {
            const departmentName = departments.find(d => d.id === selectedDeptId)?.name || 'Unknown Department';
            
            if (isLoanFulfillment) {
                // Gather selected loans
                const loansToFulfill = deptLoans.filter(l => selectedLoanItemIds.has(l.id));
                const itemsToCreate = loansToFulfill.map(l => ({ productId: l.productId, quantity: l.quantity }));
                
                // Create the new requisition
                await supabaseService.createAndCompleteRequisition(selectedDeptId, requisitionName, itemsToCreate);

                // Update original loan items to 'Fulfilled' and original RequisitionItems to 'LoanFulfilled'
                const directLoanIds = loansToFulfill.filter(l => !l.isDerived).map(l => l.id);
                const derivedLoanIds = loansToFulfill.filter(l => l.isDerived).map(l => l.id);
                
                await supabaseService.markLoansAsFulfilled(directLoanIds, derivedLoanIds);

                // Update ignored keys to hide these loans immediately
                const newIgnoredKeys = new Set(ignoredLoanKeys);
                loansToFulfill.forEach(l => newIgnoredKeys.add(`${l.id}-${l.isDerived}`));
                setIgnoredLoanKeys(newIgnoredKeys);
                setSelectedLoanItemIds(new Set()); // Reset selection

                alert('ตัดรายการยืมและสร้างใบเบิกสำเร็จ');
                onSave(false); // Keep open

            } else {
                const validItems = items.filter(i => i.quantity > 0);
                const requisitionData: Partial<Omit<Requisition, 'items' | 'totalValue' | 'departmentName'>> = {
                    departmentId: selectedDeptId,
                    name: requisitionName,
                    status: 'Submitted',
                    type: 'Normal',
                    submittedAt: new Date(),
                    requesterName: 'แอดมิน (สร้างแทน)',
                    requesterPosition: 'เจ้าหน้าที่พัสดุ',
                };
                
                // สั่ง skipAdminNotification เป็น true เพื่อไม่ให้แจ้งเตือนเด้งหา Admin คนอื่น/ตัวเอง
                await supabaseService.saveRequisition(requisitionData, validItems, departmentName, true);
                
                alert('สร้างใบเบิกใหม่สำเร็จ ใบเบิกจะอยู่ในสถานะ "รออนุมัติ"');
                onSave(true);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isLoanFulfillment ? "ตัดรายการยืม (สร้างใบเบิกชดใช้)" : "สร้างใบเบิกแทนหน่วยงาน"} size="2xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">หน่วยงาน</label>
                        <select
                            value={selectedDeptId}
                            onChange={e => setSelectedDeptId(e.target.value)}
                            className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                        >
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ชื่อใบเบิก</label>
                         <input
                            type="text"
                            value={requisitionName}
                            onChange={e => setRequisitionName(e.target.value)}
                            className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                        />
                    </div>
                </div>

                {isLoanFulfillment ? (
                    <div className="space-y-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm flex gap-2">
                             <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                             <div>
                                 <p className="font-bold">คำแนะนำ:</p>
                                 <p>เลือกรายการยืมที่ต้องการตัดยอด ระบบจะสร้างใบเบิกใหม่เพื่อบันทึกเป็นยอดเบิกจริงของวันนี้ และล้างยอดหนี้สินเดิมออก</p>
                             </div>
                        </div>

                         {Object.keys(loansGroupedByRequisition).length === 0 ? (
                            <div className="text-center p-8 border border-dashed rounded-lg text-slate-500">
                                ไม่พบรายการยืมคงค้างสำหรับหน่วยงานนี้
                            </div>
                        ) : (
                            <div className="max-h-[50vh] overflow-y-auto border rounded-lg dark:border-slate-700">
                                {Object.entries(loansGroupedByRequisition).map(([reqNumber, loanItems]) => {
                                    // Fix: Cast loanItems to correct type to avoid 'unknown' error in strict mode
                                    const items = loanItems as LoanItem[];
                                    return (
                                    <div key={reqNumber} className="border-b last:border-b-0 dark:border-slate-700">
                                        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 flex justify-between items-center sticky top-0 z-10">
                                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                                                <input 
                                                    type="checkbox" 
                                                    checked={items.every(l => selectedLoanItemIds.has(l.id))}
                                                    onChange={() => handleToggleRequisitionGroup(reqNumber)}
                                                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                />
                                                ใบเบิกเดิม: #{reqNumber}
                                            </label>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(items[0].createdAt).toLocaleDateString('th-TH')}
                                            </span>
                                        </div>
                                        <div className="divide-y dark:divide-slate-700">
                                            {items.map(loan => (
                                                <label key={loan.id} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedLoanItemIds.has(loan.id)}
                                                        onChange={() => handleToggleLoanItem(loan)}
                                                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-0.5 self-start"
                                                    />
                                                    <div className="ml-3 flex-grow grid grid-cols-12 gap-2 text-sm">
                                                        <div className="col-span-8 font-medium text-slate-800 dark:text-slate-200">{loan.productName}</div>
                                                        <div className="col-span-4 text-right">จำนวน: <span className="font-bold text-sky-600">{loan.quantity}</span></div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                        <div className="flex justify-end text-sm text-slate-600 dark:text-slate-400">
                            เลือกแล้ว {selectedLoanItemIds.size} รายการ
                        </div>
                    </div>
                ) : (
                    // Regular Requisition Creation
                    <>
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ค้นหาและเพิ่มรายการ</label>
                            <div className="relative mt-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="พิมพ์ชื่อเวชภัณฑ์..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                                />
                                {searchableProducts.length > 0 && (
                                    <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-48 overflow-auto">
                                        {searchableProducts.map(p => (
                                            <button key={p.id} onClick={() => handleAddItem(p)} className="w-full text-left px-4 py-2 hover:bg-sky-50 dark:hover:bg-sky-900/50 flex justify-between items-center">
                                                <span>{p.name} <span className="text-xs text-slate-500">({p.unit})</span></span>
                                                <PlusIcon className="w-5 h-5 text-sky-500" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto border dark:border-slate-700 rounded-lg">
                            <table className="min-w-full">
                                <thead className="bg-slate-100 dark:bg-slate-700/50 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left text-sm font-semibold text-slate-500 dark:text-slate-400">รายการ</th>
                                        <th className="p-2 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">คงคลังกลาง</th>
                                        <th className="p-2 text-right text-sm font-semibold text-slate-500 dark:text-slate-400">จำนวนเบิก</th>
                                        <th className="p-2 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {items.length > 0 ? items.map(item => {
                                        const product = productMap.get(item.productId);
                                        if (!product) return null;
                                        const stock = inventoryMap.get(item.productId) || 0;
                                        const isOverStock = item.quantity > stock;
                                        return (
                                        <tr key={item.productId}>
                                            <td className="p-2 text-sm text-slate-800 dark:text-slate-200">{product.name}</td>
                                            <td className="p-2 text-center text-sm text-slate-600 dark:text-slate-300">{stock.toLocaleString()}</td>
                                            <td className="p-2">
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    value={item.quantity === 0 ? '' : item.quantity}
                                                    onChange={e => handleQuantityChange(item.productId, e.target.value)}
                                                    className={`w-20 text-right px-2 py-1 border rounded-md float-right ${isOverStock ? 'border-red-500 text-red-600' : 'border-slate-300 dark:border-slate-600 dark:bg-slate-700'}`}
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveItem(item.productId)}>
                                                    <TrashIcon className="w-5 h-5 text-slate-400 hover:text-red-500"/>
                                                </button>
                                            </td>
                                        </tr>
                                        )
                                    }) : (
                                        <tr><td colSpan={4} className="text-center p-4 text-slate-500 dark:text-slate-400">ยังไม่มีรายการ</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {error && <p className="text-red-600 dark:text-red-400 text-sm text-center mb-2">{error}</p>}
                
                <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-600">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">ยกเลิก</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                    >
                        {isSaving ? 'กำลังบันทึก...' : (isLoanFulfillment ? 'ตัดยอดและสร้างใบเบิก' : 'สร้างใบเบิก')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CreateRequisitionForDeptModal;
