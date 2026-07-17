
import React, { useState, useEffect, useMemo } from 'react';
import { User, Product, PurchaseOrder, Company, GoodsReceivedItem } from '../types';
import { supabaseService } from '../services/supabaseService';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';

interface GoodsReceivingViewProps {
    user: User;
    allProducts: Product[];
    onDataChange: () => void;
}

export const GoodsReceivingView: React.FC<GoodsReceivingViewProps> = ({ user, allProducts, onDataChange }) => {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedPOId, setSelectedPOId] = useState<string>('');
    const [receivingItems, setReceivingItems] = useState<GoodsReceivedItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [poSearch, setPoSearch] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            const [pos, comps] = await Promise.all([
                supabaseService.getOrderedPurchaseOrders(),
                supabaseService.getCompanies()
            ]);
            setPurchaseOrders(pos);
            setCompanies(comps);
        };
        fetchInitialData();
    }, []);

    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);
    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);

    const handlePOSelect = async (poId: string) => {
        setSelectedPOId(poId);
        if (!poId) {
            setReceivingItems([]);
            return;
        }
        
        try {
            // Retrieve PO details including items
            const poDetails = await supabaseService.getPurchaseOrderForReceiving(poId);
            
            // Fetch received history to calculate remaining quantity
            const receivedHistory = await supabaseService.getReceivedItemsForPO(poId);
            
            const items: GoodsReceivedItem[] = poDetails.items.map((item: any) => {
                const ordered = item.quantity;
                const received = receivedHistory[item.productId] || 0;
                const remaining = Math.max(0, ordered - received);
                
                return {
                    productId: item.productId,
                    quantityReceived: remaining, // Default to remaining
                    expiryDate: null,
                    lotNumber: '',
                };
            });
            setReceivingItems(items);
        } catch (error) {
            console.error("Error loading PO details", error);
            alert("ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้");
            setSelectedPOId(''); // Reset selection on error
        }
    };

    const handleItemChange = (index: number, field: keyof GoodsReceivedItem, value: any) => {
        const newItems = [...receivingItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setReceivingItems(newItems);
    };

    const handleSubmit = async () => {
        if (!selectedPOId) return;
        const validItems = receivingItems.filter(i => i.quantityReceived > 0);
        if (validItems.length === 0) {
            alert("กรุณาระบุจำนวนที่รับอย่างน้อย 1 รายการ");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Create GRN (Status: Pending Approval)
            const { data: newGrn } = await supabaseService.createGoodsReceivedNote({
                sourceType: 'PO',
                purchaseOrderId: selectedPOId,
                notes: notes,
                items: validItems
            });

            // 2. Automatically Approve GRN to update Stock and PO Status immediately
            if (newGrn) {
                await supabaseService.approveGoodsReceivedNote(newGrn.id);
            }

            alert("บันทึกการรับของและปรับปรุงสต็อกเรียบร้อยแล้ว");
            
            // 3. Reset UI
            setSelectedPOId('');
            setReceivingItems([]);
            setNotes('');
            onDataChange();
            
            // 4. Refresh PO list
            const pos = await supabaseService.getOrderedPurchaseOrders();
            setPurchaseOrders(pos);
        } catch (error: any) {
            console.error("Error saving GRN", error);
            alert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredAvailablePOs = useMemo(() => {
        return purchaseOrders.filter(po => {
            const rawPo = po as any;
            const poNum = po.poNumber || rawPo.po_number || '';
            const companyId = po.companyId || rawPo.company_id;
            const compName = companyMap.get(companyId) || '';
            const search = poSearch.toLowerCase();
            return poNum.toLowerCase().includes(search) || compName.toLowerCase().includes(search);
        });
    }, [purchaseOrders, poSearch, companyMap]);
    
    const selectedPODetails = useMemo(() => {
        return purchaseOrders.find(p => p.id === selectedPOId);
    }, [purchaseOrders, selectedPOId]);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                
                {!selectedPOId ? (
                    // --- VIEW 1: PO List ---
                    <div className="animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <InboxArrowDownIcon className="w-6 h-6"/>
                                รายการใบสั่งซื้อที่รอรับของ (Pending POs)
                            </h3>
                            <div className="w-full md:w-1/3">
                                <input 
                                    type="text" 
                                    value={poSearch} 
                                    onChange={e => setPoSearch(e.target.value)} 
                                    placeholder="ค้นหาเลขที่ PO หรือ ชื่อบริษัท..." 
                                    className="w-full p-2 pl-4 border rounded-lg dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">เลขที่ PO</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">บริษัท</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">วันที่สั่งซื้อ</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">สถานะ</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">ดำเนินการ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredAvailablePOs.length > 0 ? (
                                        filteredAvailablePOs.map(po => {
                                            const companyName = companyMap.get(po.companyId) || 'ไม่ระบุ';
                                            const date = new Date(po.orderedAt || po.createdAt);
                                            const dateStr = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
                                            
                                            return (
                                                <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-sky-600 dark:text-sky-400">{po.poNumber || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{companyName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{dateStr}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${po.status === 'PartiallyReceived' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                                            {po.status === 'PartiallyReceived' ? 'รับบางส่วน' : 'สั่งซื้อแล้ว'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button 
                                                            onClick={() => handlePOSelect(po.id)}
                                                            className="text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all transform hover:scale-105"
                                                        >
                                                            รับของ
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                                                {purchaseOrders.length === 0 ? 'ไม่มีใบสั่งซื้อที่ค้างรับ' : 'ไม่พบรายการที่ค้นหา'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    // --- VIEW 2: Receiving Form ---
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b dark:border-slate-700 gap-4">
                             <div>
                                 <h4 className="font-bold text-xl text-slate-800 dark:text-slate-100">
                                     บันทึกรับของ: <span className="text-sky-600">{selectedPODetails?.poNumber}</span>
                                 </h4>
                                 <p className="text-sm text-slate-500 mt-1">
                                     บริษัท: {companyMap.get(selectedPODetails?.companyId || '')}
                                 </p>
                             </div>
                             <button 
                                onClick={() => setSelectedPOId('')}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 font-medium transition-colors"
                             >
                                 ย้อนกลับไปรายการ
                             </button>
                         </div>

                        <div className="border rounded-lg overflow-hidden dark:border-slate-700">
                            <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-3 border-b dark:border-slate-700">
                                <h4 className="font-semibold text-slate-700 dark:text-slate-200">รายการสินค้าในใบสั่งซื้อ</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-white dark:bg-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-1/3">สินค้า</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-24">จำนวนที่รับ</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">วันหมดอายุ</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Lot Number</th>
                                            <th className="px-4 py-3 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                        {receivingItems.map((item, index) => {
                                            const product = productMap.get(item.productId);
                                            return (
                                                <tr key={item.productId} className={item.quantityReceived === 0 ? 'bg-slate-50 dark:bg-slate-900/50 opacity-60' : ''}>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        <div className="flex flex-col">
                                                            <span>{product?.name}</span>
                                                            <span className="text-slate-500 text-xs font-normal">หน่วย: {product?.unit}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            value={item.quantityReceived} 
                                                            onChange={e => handleItemChange(index, 'quantityReceived', parseInt(e.target.value) || 0)}
                                                            className="w-24 p-2 border rounded text-right dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="date" 
                                                            value={item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : ''} 
                                                            onChange={e => handleItemChange(index, 'expiryDate', e.target.value ? new Date(e.target.value) : null)}
                                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="text" 
                                                            value={item.lotNumber || ''} 
                                                            onChange={e => handleItemChange(index, 'lotNumber', e.target.value)}
                                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                                            placeholder="ระบุ Lot No."
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button 
                                                            onClick={() => handleItemChange(index, 'quantityReceived', 0)}
                                                            className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                            title="ไม่รับรายการนี้ (ตั้งจำนวนเป็น 0)"
                                                        >
                                                            <TrashIcon className="w-5 h-5"/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">หมายเหตุเพิ่มเติม</label>
                            <textarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
                                rows={3}
                                placeholder="เช่น สภาพกล่องสมบูรณ์, ส่งของล่าช้า, ฯลฯ"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800 pb-2">
                            <button 
                                onClick={() => setSelectedPOId('')}
                                className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 font-semibold transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-md transition-all transform hover:scale-105"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                {isSaving ? 'กำลังบันทึก...' : 'ยืนยันรับของ'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
