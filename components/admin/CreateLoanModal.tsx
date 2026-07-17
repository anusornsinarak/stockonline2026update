
import React, { useState, useMemo, useEffect } from 'react';
import { Department, Product } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';

interface CreateLoanModalProps {
    isOpen: boolean;
    onClose: () => void;
    departments: Department[];
    allProducts: Product[];
    onSave: () => void;
}

const CreateLoanModal: React.FC<CreateLoanModalProps> = ({ isOpen, onClose, departments, allProducts, onSave }) => {
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);

    useEffect(() => {
        if (isOpen) {
            setSelectedDeptId(departments[0]?.id || '');
            setItems([]);
            setNotes('');
            setError('');
            setIsSaving(false);
            setSearchTerm('');
        }
    }, [isOpen, departments]);

    const handleAddItem = (product: Product) => {
        if (!items.some(item => item.productId === product.id)) {
            setItems(prev => [...prev, { productId: product.id, quantity: 1 }]);
        }
        setSearchTerm('');
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

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.quantity > 0);
        if (!selectedDeptId || validItems.length === 0) {
            setError('กรุณาเลือกหน่วยงานและเพิ่มรายการอย่างน้อย 1 อย่าง');
            return;
        }
        
        setError('');
        setIsSaving(true);
        
        try {
            const departmentName = departments.find(d => d.id === selectedDeptId)?.name || 'Unknown Department';
            await supabaseService.createDirectLoans(selectedDeptId, departmentName, validItems, notes);
            alert('สร้างรายการยืมสำเร็จ');
            onSave();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="สร้างรายการยืมโดยตรง" size="2xl">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">หน่วยงานผู้ยืม</label>
                    <select
                        value={selectedDeptId}
                        onChange={e => setSelectedDeptId(e.target.value)}
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                    >
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ค้นหาและเพิ่มรายการ</label>
                    <div className="relative mt-1">
                        <input
                            type="text"
                            placeholder="พิมพ์ชื่อเวชภัณฑ์..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
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
                                <th className="p-2 text-right text-sm font-semibold text-slate-500 dark:text-slate-400">จำนวน</th>
                                <th className="p-2 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {items.length > 0 ? items.map(item => {
                                const product = productMap.get(item.productId);
                                if (!product) return null;
                                return (
                                <tr key={item.productId}>
                                    <td className="p-2 text-sm text-slate-800 dark:text-slate-200">{product.name}</td>
                                    <td className="p-2">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={item.quantity === 0 ? '' : item.quantity}
                                            onChange={e => handleQuantityChange(item.productId, e.target.value)}
                                            className="w-20 text-right px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md float-right"
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
                                <tr><td colSpan={3} className="text-center p-4 text-slate-500 dark:text-slate-400">ยังไม่มีรายการ</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">หมายเหตุ (ถ้ามี)</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                    />
                </div>

                {error && <p className="text-red-600 dark:text-red-400 text-sm text-center mb-2">{error}</p>}
                
                <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-600">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">ยกเลิก</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                    >
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกรายการยืม'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CreateLoanModal;
