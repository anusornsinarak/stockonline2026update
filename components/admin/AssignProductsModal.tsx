



import React, { useState, useEffect } from 'react';
import { Department, Product } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';

const AssignProductsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    department: Department;
    allProducts: Product[];
    onSave: () => void;
}> = ({ isOpen, onClose, department, allProducts, onSave }) => {
    const [assignedProducts, setAssignedProducts] = useState<Map<string, { isLocked: boolean, lockReason: string | null }>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            supabaseService.getAssignedProductIdsForDepartment(department.id)
                .then(assignments => {
                    const map = new Map();
                    assignments.forEach(a => map.set(a.productId, { isLocked: a.isLocked, lockReason: a.lockReason }));
                    setAssignedProducts(map);
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, department.id]);

    const handleToggle = (productId: string) => {
        setAssignedProducts(prev => {
            const newMap = new Map(prev);
            if (newMap.has(productId)) {
                newMap.delete(productId);
            } else {
                newMap.set(productId, { isLocked: false, lockReason: null });
            }
            return newMap;
        });
    };

    const handleToggleLock = (productId: string) => {
        setAssignedProducts(prev => {
            const newMap = new Map<string, { isLocked: boolean, lockReason: string | null }>(prev);
            const current = newMap.get(productId);
            if (current) {
                newMap.set(productId, { ...current, isLocked: !current.isLocked });
            }
            return newMap;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const assignmentsToSave = Array.from(assignedProducts.entries()).map(([productId, data]) => ({
                productId,
                isLocked: data.isLocked,
                lockReason: data.lockReason
            }));
            await supabaseService.setProductAssignmentsForDepartment(department.id, assignmentsToSave);
            onSave();
        } catch(err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`กำหนดรายการสำหรับ ${department.name}`}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">เลือกรายการเวชภัณฑ์ที่ต้องการให้แสดงในแบบฟอร์มของหน่วยงานนี้</p>
                {isLoading ? (
                    <p>กำลังโหลด...</p>
                ) : (
                    <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-2">
                        {allProducts.length > 0 ? allProducts.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(product => {
                            const isAssigned = assignedProducts.has(product.id);
                            const assignmentData = assignedProducts.get(product.id);
                            
                            return (
                                <div key={product.id} className={`flex items-center justify-between p-2 rounded hover:bg-slate-100 ${assignmentData?.isLocked ? 'bg-red-50/50' : ''}`}>
                                    <div className="flex items-center gap-3 flex-1">
                                        <input
                                            id={`prod-${product.id}`}
                                            type="checkbox"
                                            checked={isAssigned}
                                            onChange={() => handleToggle(product.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                        />
                                        <label htmlFor={`prod-${product.id}`} className="block text-sm text-slate-900 cursor-pointer flex-1">
                                            {product.name}
                                            {assignmentData?.isLocked && assignmentData.lockReason && (
                                                <span className="ml-2 text-xs text-red-500 block sm:inline">({assignmentData.lockReason})</span>
                                            )}
                                        </label>
                                    </div>
                                    {isAssigned && (
                                        <button 
                                            onClick={() => handleToggleLock(product.id)}
                                            className={`p-1.5 rounded-md transition-colors ${assignmentData?.isLocked ? 'text-red-600 hover:bg-red-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                                            title={assignmentData?.isLocked ? "ปลดล็อค" : "ล็อคไม่ให้เบิก"}
                                        >
                                            {assignmentData?.isLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            );
                        }) : (
                           <p className="text-sm text-slate-500 p-4 text-center">ไม่มีรายการในระบบให้กำหนด</p>
                        )}
                    </div>
                )}
                 <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">ยกเลิก</button>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 transition-colors">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default AssignProductsModal;