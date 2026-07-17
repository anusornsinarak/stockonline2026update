
import React, { useState, useEffect } from 'react';
import { GoodsReceivedNote, GoodsReceivedItem, grnStatusMap, Product } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import EditIcon from '../icons/EditIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';
import TrashIcon from '../icons/TrashIcon';

interface GrnDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    grn: GoodsReceivedNote;
    productMap: Map<string, Product>;
    onDataChange: () => void;
}

const TableTemplate: React.FC<{headers: string[], children: React.ReactNode}> = ({headers, children}) => (
    <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
        <table className="min-w-full">
            <thead className="bg-slate-100 dark:bg-slate-700/50">
                <tr>
                    {headers.map(h => <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>)}
                </tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    </div>
);

const toISODateString = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
};


const GrnDetailModal: React.FC<GrnDetailModalProps> = ({ isOpen, onClose, grn, productMap, onDataChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItems, setEditedItems] = useState<(GoodsReceivedItem & { pricePerUnit?: number })[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (grn) {
            const fetchPricesAndSetItems = async () => {
                let poItemsMap = new Map<string, number>();
                if (grn.sourceType === 'PO' && grn.purchaseOrderId) {
                    try {
                        const poDetails = await supabaseService.getPurchaseOrderForReceiving(grn.purchaseOrderId);
                        if (poDetails) {
                            poDetails.items.forEach(item => {
                                poItemsMap.set(item.productId, item.pricePerUnit);
                            });
                        }
                    } catch (e) {
                        console.warn("Could not fetch PO details for pricing, falling back to product master.", e)
                    }
                }

                const itemsWithPrice = grn.items.map(item => {
                    const poPrice = poItemsMap.get(item.productId);
                    const productPrice = productMap.get(item.productId)?.pricePerUnit;
                    return {
                        ...item,
                        pricePerUnit: poPrice !== undefined ? poPrice : (productPrice !== undefined ? productPrice : 0)
                    };
                });

                setEditedItems(JSON.parse(JSON.stringify(itemsWithPrice || [])));
            };

            fetchPricesAndSetItems();
            setIsEditing(false);
            setError('');
        }
    }, [grn, productMap]);

    const handleItemChange = (itemId: number, field: 'quantityReceived' | 'expiryDate' | 'lotNumber' | 'pricePerUnit', value: string) => {
        setEditedItems(prev => prev.map(item => {
            if (item.id === itemId) {
                if (field === 'quantityReceived') {
                    const numValue = parseInt(value, 10);
                    return { ...item, quantityReceived: isNaN(numValue) ? 0 : numValue };
                }
                if (field === 'pricePerUnit') {
                    const numValue = parseFloat(value);
                    return { ...item, pricePerUnit: isNaN(numValue) ? 0 : numValue };
                }
                return { ...item, [field]: value || null };
            }
            return item;
        }));
    };
    
    const handleRemoveItem = (itemId: number) => {
        if (!window.confirm("การลบรายการนี้จะตั้งค่าจำนวนที่รับเป็น 0 และปรับสต็อกคืน คุณต้องการดำเนินการต่อหรือไม่?")) return;
        handleItemChange(itemId, 'quantityReceived', '0');
    };

    const updatePricesIfNeeded = async () => {
        const priceUpdatePromises: Promise<any>[] = [];
        for (const item of editedItems) {
            const product = productMap.get(item.productId);
            const newPrice = item.pricePerUnit;
            if (product && newPrice !== undefined && product.pricePerUnit !== newPrice) {
                const updatedProduct: Product = {
                    ...product,
                    pricePerUnit: newPrice,
                    previousPricePerUnit: product.pricePerUnit,
                };
                priceUpdatePromises.push(supabaseService.updateProduct(updatedProduct));
            }
        }
        await Promise.all(priceUpdatePromises);
    };

    const handleSaveEdits = async () => {
        if (!grn) return;
    
        if (grn.status === 'Completed') {
            if (!window.confirm("คำเตือน: การแก้ไขใบรับของที่เสร็จสมบูรณ์แล้วจะปรับเปลี่ยนสต็อกสินค้าคงคลังและราคาหลักของสินค้าโดยตรง การกระทำนี้ควรใช้เพื่อแก้ไขข้อผิดพลาดในการบันทึกข้อมูลเท่านั้น ยืนยันที่จะดำเนินการต่อหรือไม่?")) {
                return;
            }
        }
        setIsSaving(true);
        setError('');
        try {
            await updatePricesIfNeeded();

            if (grn.status === 'Completed') {
                await supabaseService.updateCompletedGoodsReceivedNote(grn, editedItems);
            } else if (grn.status === 'Pending Approval') {
                await supabaseService.updatePendingGrn(grn.id, editedItems);
            }
            alert("แก้ไขใบรับของสำเร็จ");
            onDataChange();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleApprove = async () => {
        if (!window.confirm("คุณต้องการอนุมัติใบรับของนี้และนำสินค้าเข้าสต็อกใช่หรือไม่? หากมีการแก้ไขราคา ราคาใหม่จะถูกบันทึกเป็นราคาปัจจุบันของสินค้า")) return;
        setIsSaving(true);
        try {
            await updatePricesIfNeeded();
            await supabaseService.approveGoodsReceivedNote(grn.id);
            alert("อนุมัติสำเร็จ สินค้าถูกเพิ่มเข้าสต็อกและอัปเดตราคาแล้ว");
            onClose();
            onDataChange();
        } catch (error) {
            alert(`เกิดข้อผิดพลาดในการอนุมัติ: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบรับของนี้? การดำเนินการนี้จะหักสินค้าออกจากสต็อกตามจำนวนที่รับเข้า และไม่สามารถย้อนกลับได้")) {
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await supabaseService.cancelCompletedGrn(grn.id);
            alert("ยกเลิกใบรับของสำเร็จ");
            onDataChange();
            onClose();
        } catch(err) {
            setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeletePending = async () => {
        if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบใบรับของฉบับร่างนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้")) return;
        setIsSaving(true);
        try {
            await supabaseService.deletePendingGrn(grn.id);
            alert("ลบใบรับของฉบับร่างสำเร็จ");
            onClose();
            onDataChange();
        } catch (error) {
            alert(`เกิดข้อผิดพลาดในการลบ: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    const headers = ['รายการ', 'จำนวน', 'ราคา/หน่วย', 'วันหมดอายุ', 'Lot Number'];
    if (isEditing) {
        headers.push(''); // For delete button
    }


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`รายละเอียด GRN #${grn.grnNumber}`}>
            <div className="space-y-4">
                <p><strong>แหล่งที่มา:</strong> {grn.sourceType === 'PO' ? `PO #${grn.poNumber || grn.purchaseOrderId}` : 'แหล่งอื่น'}</p>
                <p><strong>วันที่สร้าง:</strong> {new Date(grn.receivedDate).toLocaleString('th-TH')}</p>
                {grn.notes && <p><strong>หมายเหตุ:</strong> {grn.notes}</p>}
                
                <h4 className="font-semibold pt-2 border-t dark:border-slate-600">รายการ</h4>
                <div className="max-h-60 overflow-y-auto">
                    <TableTemplate headers={headers}>
                        {(isEditing ? editedItems : grn.items).map(item => (
                            <tr key={item.id}>
                                <td className="px-4 py-2 dark:text-slate-200">{productMap.get(item.productId)?.name || 'N/A'}</td>
                                <td className="px-4 py-2 text-right">
                                    {isEditing ? (
                                        <input type="number" min="0" value={item.quantityReceived} onChange={e => handleItemChange(item.id!, 'quantityReceived', e.target.value)} className="w-24 text-right px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                                    ) : ((item.quantityReceived || 0).toLocaleString())}
                                </td>
                                 <td className="px-4 py-2 text-center">
                                    {isEditing ? (
                                        <input type="number" step="0.01" min="0" value={item.pricePerUnit || ''} onChange={e => handleItemChange(item.id!, 'pricePerUnit', e.target.value)} className="w-28 text-right px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                                    ) : ((item.pricePerUnit || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }))}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    {isEditing ? (
                                        <input type="date" value={toISODateString(item.expiryDate)} onChange={e => handleItemChange(item.id!, 'expiryDate', e.target.value)} className="w-36 px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                                    ) : (item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('th-TH') : '-')}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    {isEditing ? (
                                        <input type="text" value={item.lotNumber || ''} onChange={e => handleItemChange(item.id!, 'lotNumber', e.target.value)} className="w-36 px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                                    ) : (item.lotNumber || '-')}
                                </td>
                                {isEditing && (
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => handleRemoveItem(item.id!)} className="text-slate-400 hover:text-red-500" title="ตั้งค่าจำนวนเป็น 0">
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </TableTemplate>
                </div>
                
                {error && <p className="text-red-600 text-sm text-center">{error}</p>}

                <div className="flex justify-between items-center pt-4 border-t dark:border-slate-600">
                    <div>
                        {grn.status === 'Pending Approval' && !isEditing && (
                             <button onClick={handleDeletePending} disabled={isSaving} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-slate-400">
                                <TrashIcon className="w-5 h-5" />
                                {isSaving ? 'กำลังลบ...' : 'ลบใบรับของ'}
                            </button>
                        )}
                         {grn.status === 'Completed' && !isEditing && (
                            <button onClick={handleCancel} disabled={isSaving} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-slate-400">
                                <TrashIcon className="w-5 h-5" />
                                ยกเลิกใบรับของ
                            </button>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="bg-slate-200 dark:bg-slate-600 dark:text-slate-200 font-bold py-2 px-4 rounded-lg">ยกเลิก</button>
                                <button onClick={handleSaveEdits} disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-500">
                                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                                </button>
                            </>
                        ) : (
                            <>
                                {(grn.status === 'Pending Approval' || grn.status === 'Completed') && (
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">
                                        <EditIcon className="w-5 h-5" />
                                        แก้ไข
                                    </button>
                                )}
                                {grn.status === 'Pending Approval' && (
                                     <button onClick={handleApprove} disabled={isSaving} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-slate-400">
                                        <CheckCircleIcon className="w-5 h-5" />
                                        {isSaving ? 'กำลังอนุมัติ...' : 'อนุมัติและนำเข้าสต็อก'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default GrnDetailModal;
