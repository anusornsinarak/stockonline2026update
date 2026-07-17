
import React, { useState, useEffect } from 'react';
import { Requisition, RequisitionItem } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

interface EditRequisitionPricesModalProps {
    isOpen: boolean;
    onClose: () => void;
    requisition: Requisition;
    onSave: () => void;
}

interface EditableItem {
    id: number;
    productName: string;
    approvedQuantity: number;
    pricePerUnit: string; // Use string for input control
}

const EditRequisitionPricesModal: React.FC<EditRequisitionPricesModalProps> = ({ isOpen, onClose, requisition, onSave }) => {
    const [items, setItems] = useState<EditableItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (requisition) {
            const editableItems = (requisition.items || [])
                .filter(item => item.id && (item.approvedQuantity ?? 0) > 0)
                .map(item => ({
                    id: item.id!,
                    productName: item.product?.name || 'Unknown',
                    approvedQuantity: item.approvedQuantity || 0,
                    pricePerUnit: (item.pricePerUnit ?? item.product?.pricePerUnit ?? 0).toString(),
                }));
            setItems(editableItems);
        }
    }, [requisition]);

    const handlePriceChange = (id: number, value: string) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, pricePerUnit: value } : item));
    };

    const handleSave = async () => {
        if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการแก้ไขราคาของใบเบิกที่อนุมัติแล้ว? การกระทำนี้จะอัปเดตมูลค่าของใบเบิกอย่างถาวร")) {
            return;
        }

        setIsSaving(true);
        setError('');

        // FIX: Replaced price_per_unit with pricePerUnit to match the expected parameter type of updateRequisitionItemPrices.
        const itemsToUpdate: { id: number; pricePerUnit: number }[] = [];
        for (const item of items) {
            const price = parseFloat(item.pricePerUnit);
            if (isNaN(price) || price < 0) {
                setError(`ราคาสำหรับรายการ "${item.productName}" ไม่ถูกต้อง`);
                setIsSaving(false);
                return;
            }
            itemsToUpdate.push({
                id: item.id,
                pricePerUnit: price,
            });
        }

        try {
            await supabaseService.updateRequisitionItemPrices(itemsToUpdate);
            alert('อัปเดตราคาสำเร็จ!');
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก');
            // Don't re-throw, just show the error in the modal
        } finally {
            setIsSaving(false);
        }
    };
    
    const totalValue = items.reduce((sum, item) => sum + ((parseFloat(item.pricePerUnit) || 0) * item.approvedQuantity), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`แก้ไขราคา - ใบเบิก #${requisition.requisitionNumber}`}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">แก้ไขราคาต่อหน่วยสำหรับรายการที่ได้รับการอนุมัติในใบเบิกนี้</p>
                <div className="max-h-80 overflow-y-auto border rounded-lg dark:border-slate-700">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                            <tr>
                                <th className="p-2 text-left text-sm font-semibold">รายการ</th>
                                <th className="p-2 text-center text-sm font-semibold">จำนวนอนุมัติ</th>
                                <th className="p-2 text-center text-sm font-semibold">ราคา/หน่วย (บาท)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="p-2 font-medium">{item.productName}</td>
                                    <td className="p-2 text-center">{item.approvedQuantity}</td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.pricePerUnit}
                                            onChange={e => handlePriceChange(item.id, e.target.value)}
                                            className="w-32 text-right p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-right font-bold text-lg text-slate-800 dark:text-slate-100">
                    มูลค่ารวมใหม่: {totalValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <div className="flex justify-end pt-4 border-t dark:border-slate-600 gap-3">
                    <button onClick={onClose} className="bg-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200">ยกเลิก</button>
                    <button onClick={handleSave} disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกราคาใหม่'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default EditRequisitionPricesModal;
