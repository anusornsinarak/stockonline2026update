
import React, { useState, useEffect, useMemo } from 'react';
import { Requisition, Product, RequisitionItem } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

interface IntraMonthReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    requisition: Requisition;
    onSave: () => void;
}

const IntraMonthReturnModal: React.FC<IntraMonthReturnModalProps> = ({ isOpen, onClose, requisition, onSave }) => {
    const [items, setItems] = useState<{ productId: string; product: Product; availableToReturn: number; returnQty: number }[]>([]);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && requisition) {
            setItems(
                (requisition.items || [])
                .filter(item => item.product && (item.approvedQuantity || 0) > 0)
                .map(item => {
                    const approved = item.approvedQuantity || 0;
                    const returned = item.returnedQuantity || 0;
                    return {
                        productId: item.productId,
                        product: item.product!,
                        availableToReturn: approved - returned,
                        returnQty: 0,
                    };
                })
            );
            setReason(`รับคืนของจากใบเบิก #${requisition.requisitionNumber} (หน่วยงาน: ${requisition.departmentName})`);
            setError('');
            setIsSaving(false);
        }
    }, [isOpen, requisition]);

    const handleQuantityChange = (productId: string, value: string) => {
        const quantity = parseInt(value, 10);
        const originalItem = items.find(i => i.productId === productId);
        if (!originalItem) return;

        const validatedQty = Math.max(0, Math.min(isNaN(quantity) ? 0 : quantity, originalItem.availableToReturn));

        setItems(prev => prev.map(item =>
            item.productId === productId ? { ...item, returnQty: validatedQty } : item
        ));
    };

    const handleSubmit = async () => {
        const itemsToReturn = items.filter(i => i.returnQty > 0).map(i => ({ productId: i.productId, quantity: i.returnQty }));
        
        if (itemsToReturn.length === 0) {
            setError('กรุณาระบุจำนวนสินค้าที่ต้องการคืนอย่างน้อย 1 รายการ');
            return;
        }

        if (!reason.trim()) {
            setError('กรุณาระบุเหตุผลในการคืน');
            return;
        }

        setError('');
        setIsSaving(true);
        
        try {
            await supabaseService.createReturnSlip(requisition, itemsToReturn, reason);
            alert('สร้างใบคืนของสำเร็จ กรุณาไปที่หน้า "รับของเข้าระบบ" เพื่ออนุมัติและนำของกลับเข้าสต็อก');
            onSave();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="สร้างใบคืนของ (Return Slip)">
            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg text-sm">
                    <p><strong>จากใบเบิก:</strong> {requisition.name} (#{requisition.requisitionNumber})</p>
                    <p><strong>หน่วยงาน:</strong> {requisition.departmentName}</p>
                    <p className="text-sky-700 dark:text-sky-300">การคืนของจะสร้างใบคืนของ (Return Slip) ซึ่งต้องได้รับการอนุมัติจากคลังเพื่อปรับสต็อก</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">เหตุผลในการคืน</label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={2}
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                        required
                    />
                </div>

                <h4 className="font-semibold text-slate-800 dark:text-slate-100">รายการที่ต้องการคืน</h4>
                <div className="max-h-60 overflow-y-auto border dark:border-slate-700 rounded-lg">
                    <table className="min-w-full">
                        <thead className="bg-slate-100 dark:bg-slate-700/50 sticky top-0">
                            <tr>
                                <th className="p-2 text-left text-sm font-semibold">รายการ</th>
                                <th className="p-2 text-center text-sm font-semibold">ที่ยังไม่ได้คืน</th>
                                <th className="p-2 text-center text-sm font-semibold">จำนวนที่คืน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.productId} className="border-t dark:border-slate-700">
                                    <td className="p-2 text-sm">{item.product.name}</td>
                                    <td className="p-2 text-center text-sm">{item.availableToReturn}</td>
                                    <td className="p-2">
                                        <input 
                                            type="number" 
                                            min="0"
                                            max={item.availableToReturn}
                                            value={item.returnQty === 0 ? '' : item.returnQty}
                                            onChange={e => handleQuantityChange(item.productId, e.target.value)}
                                            className="w-24 text-right px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md mx-auto block"
                                            placeholder="0"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>}

                <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-600">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">ยกเลิก</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400"
                    >
                        {isSaving ? 'กำลังสร้าง...' : 'สร้างใบคืนของ'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default IntraMonthReturnModal;