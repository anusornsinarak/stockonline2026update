



import React, { useState, useEffect } from 'react';
import { Product, Company, ProductSupplier } from '../../types';
// FIX: Changed the import of 'supabaseService' from a default import to a named import to resolve the module resolution error.
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

const AssignSuppliersModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    allCompanies: Company[];
    productSuppliers: ProductSupplier[];
    onSave: (productId: string, companyIds: string[]) => void;
}> = ({ isOpen, onClose, product, allCompanies, productSuppliers, onSave }) => {
    const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const currentSuppliers = productSuppliers
                .filter(ps => ps.productId === product.id)
                .map(ps => ps.companyId);
            setAssignedIds(new Set(currentSuppliers));
        }
    }, [isOpen, product, productSuppliers]);

    const handleToggle = (companyId: string) => {
        setAssignedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(companyId)) {
                newSet.delete(companyId);
            } else {
                newSet.add(companyId);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await supabaseService.setSuppliersForProduct(product.id, Array.from(assignedIds));
            onSave(product.id, Array.from(assignedIds));
        } catch(err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึก');
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`กำหนดบริษัทสำหรับ ${product.name} (${product.unit})`}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">เลือกบริษัทที่จัดหารายการเวชภัณฑ์นี้</p>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-2">
                    {allCompanies.length > 0 ? allCompanies.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(company => (
                        <div key={company.id} className="flex items-center p-1 rounded hover:bg-slate-100">
                            <input
                                id={`comp-${company.id}`}
                                type="checkbox"
                                checked={assignedIds.has(company.id)}
                                onChange={() => handleToggle(company.id)}
                                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                            />
                            <label htmlFor={`comp-${company.id}`} className="ml-3 block text-sm text-slate-900">{company.name}</label>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-500 p-4 text-center">ไม่มีบริษัทในระบบให้กำหนด</p>
                    )}
                </div>
                 <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">ยกเลิก</button>
                    <button onClick={handleSave} disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 transition-colors">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AssignSuppliersModal;