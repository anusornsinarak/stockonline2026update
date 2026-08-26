import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem, Product } from '../../types';
import TableTemplate from './TableTemplate';
import ClockIcon from '../icons/ClockIcon';
import PencilSquareIcon from '../icons/PencilSquareIcon';
import ChevronUpIcon from '../icons/ChevronUpIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import StockAdjustmentModal from './StockAdjustmentModal';
import { supabaseService } from '../../services/supabaseService';

const InventoryView: React.FC<{
    products: Product[];
    inventory: InventoryItem[];
    onViewStockCard: (productId: string) => void;
    onDataChange: () => void;
}> = ({ products, inventory, onViewStockCard, onDataChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Adjustment modal states
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
    const [adjustCurrentStock, setAdjustCurrentStock] = useState(0);

    // Bulk adjustment states
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});
    const [isSavingBulk, setIsSavingBulk] = useState(false);

    useEffect(() => {
        if (isBulkMode) {
            const savedDraft = localStorage.getItem('bulk_stock_adjustment_draft');
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    if (Object.keys(parsed).length > 0) {
                        if (window.confirm('มีการปรับสต๊อคค้างอยู่ คุณต้องการทำต่อหรือไม่?')) {
                            setDraftValues(parsed);
                        } else {
                            localStorage.removeItem('bulk_stock_adjustment_draft');
                            setDraftValues({});
                        }
                    }
                } catch (e) {
                    localStorage.removeItem('bulk_stock_adjustment_draft');
                }
            } else {
                setDraftValues({});
            }
        }
    }, [isBulkMode]);

    const handleDraftChange = (productId: string, val: string) => {
        const newDraft = { ...draftValues, [productId]: val };
        setDraftValues(newDraft);
        localStorage.setItem('bulk_stock_adjustment_draft', JSON.stringify(newDraft));
    };

    const getPendingChanges = () => {
        let count = 0;
        const changes: {product: Product, delta: number}[] = [];
        
        products.forEach(p => {
            const draftStr = draftValues[p.id];
            if (draftStr !== undefined && draftStr !== '') {
                const actual = parseInt(draftStr, 10);
                if (!isNaN(actual)) {
                    const current = inventoryMap.get(p.id)?.quantity ?? 0;
                    if (actual !== current) {
                        count++;
                        changes.push({ product: p, delta: actual - current });
                    }
                }
            }
        });
        return { count, changes };
    };

    const handleSaveBulk = async () => {
        const { count, changes } = getPendingChanges();
        if (count === 0) {
            alert('ไม่พบรายการที่มีการเปลี่ยนแปลง (ยอดนับจริงตรงกับระบบทั้งหมด หรือไม่ได้ระบุยอด)');
            return;
        }

        if (!window.confirm(`ยืนยันการปรับปรุงสต๊อกจำนวน ${count} รายการ ใช่หรือไม่?`)) {
            return;
        }

        setIsSavingBulk(true);
        try {
            for (const change of changes) {
                await supabaseService.adjustStockQuantity(
                    change.product.id, 
                    change.delta, 
                    'ปรับปรุงจากการนับสต็อกจริง (ปรับหลายรายการ)'
                );
            }
            alert('ปรับปรุงสต๊อกสำเร็จ!');
            localStorage.removeItem('bulk_stock_adjustment_draft');
            setDraftValues({});
            setIsBulkMode(false);
            onDataChange();
        } catch (error) {
            alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'ไม่สามารถปรับสต๊อกได้'));
        } finally {
            setIsSavingBulk(false);
        }
    };

    const inventoryMap = useMemo(() => new Map(inventory.map(item => [item.productId, item])), [inventory]);

    const combinedData = useMemo(() => {
        const data = products.map(product => {
            const stock = inventoryMap.get(product.id);
            return {
                product,
                quantity: stock?.quantity ?? 0,
                updatedAt: stock?.updatedAt
            };
        }).filter(item => 
            item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Sort logic
        data.sort((a, b) => {
            if (sortOrder === 'asc') {
                return a.product.name.localeCompare(b.product.name, 'th');
            } else {
                return b.product.name.localeCompare(a.product.name, 'th');
            }
        });

        return data;
    }, [products, inventoryMap, searchTerm, sortOrder]);

    const timeSince = (date?: Date): string => {
        if (!date) return 'N/A';
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " ปีที่แล้ว";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " เดือนที่แล้ว";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " วันที่แล้ว";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " ชั่วโมงที่แล้ว";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " นาทีที่แล้ว";
        return "เมื่อสักครู่";
    };

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const headers = isBulkMode 
        ? [
            {
                name: (
                    <button onClick={toggleSortOrder} className="flex items-center gap-1 group transition-colors hover:text-slate-800">
                        <span>รายการ</span>
                        {sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                )
            },
            'หน่วย',
            { name: 'คงเหลือในระบบ', className: 'text-right'},
            { name: 'ยอดนับจริง', className: 'text-center'},
            { name: 'ส่วนต่าง', className: 'text-right'}
        ]
        : [
            {
                name: (
                    <button onClick={toggleSortOrder} className="flex items-center gap-1 group transition-colors hover:text-slate-800">
                        <span>รายการ</span>
                        {sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                )
            },
            'หน่วย',
            { name: 'คงเหลือในคลัง', className: 'text-right'},
            'อัปเดตล่าสุด',
            'การดำเนินการ'
        ];

    const openAdjustModal = (product: Product, currentStock: number) => {
        setAdjustProduct(product);
        setAdjustCurrentStock(currentStock);
        setIsAdjustModalOpen(true);
    };

    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        if (!window.confirm('คุณต้องการคำนวณและซิงค์ยอดคงเหลือของทุกรายการให้ตรงกับประวัติ Stock Card หรือไม่?\n(ใช้เพื่อแก้ไขปัญหายอดคงคลังปัจจุบันไม่ตรงกับยอดใน Stock Card)')) return;
        
        setIsSyncing(true);
        try {
            await supabaseService.syncAllInventoryWithTransactions();
            alert('ซิงค์ข้อมูลเรียบร้อยแล้ว');
            onDataChange();
        } catch (error) {
            alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'ไม่สามารถซิงค์ได้'));
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div>
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row gap-4 items-end justify-between">
                <div className="w-full md:w-1/2">
                    <label htmlFor="search-inventory" className="block text-sm font-medium text-slate-700">
                        ค้นหารายการ
                    </label>
                    <input
                        id="search-inventory"
                        type="text"
                        placeholder="พิมพ์ชื่อเวชภัณฑ์..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm"
                        autoComplete="off"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleSync} 
                        disabled={isSyncing}
                        className="bg-orange-100 text-orange-700 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-orange-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                        title="คำนวณยอดคงคลังใหม่จากประวัติการทำรายการทั้งหมด"
                    >
                        <ClockIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}/>
                        {isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ยอดกับ Stock Card'}
                    </button>
                    {!isBulkMode ? (
                        <button onClick={() => setIsBulkMode(true)} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-sky-700 transition-colors flex items-center gap-2">
                            <PencilSquareIcon className="w-5 h-5"/>
                            ปรับสต็อก (หลายรายการ)
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setIsBulkMode(false)} className="bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow hover:bg-slate-400 transition-colors">
                                ยกเลิก / กลับ
                            </button>
                            <button onClick={handleSaveBulk} disabled={isSavingBulk} className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-emerald-700 transition-colors disabled:bg-emerald-400 flex items-center gap-2">
                                {isSavingBulk ? 'กำลังบันทึก...' : 'บันทึกรายการที่ปรับ'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <TableTemplate headers={headers}>
                {combinedData.map(item => {
                    const currentQuantity = item.quantity;
                    const draftStr = draftValues[item.product.id];
                    let diff = 0;
                    let hasDraft = false;
                    
                    if (draftStr !== undefined && draftStr !== '') {
                        const actual = parseInt(draftStr, 10);
                        if (!isNaN(actual)) {
                            diff = actual - currentQuantity;
                            hasDraft = true;
                        }
                    }

                    return (
                        <tr key={item.product.id} className={item.quantity <= 0 && !isBulkMode ? 'bg-red-50' : 'hover:bg-slate-50/70'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.product.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.product.unit}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${item.quantity <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                {item.quantity.toLocaleString('th-TH')}
                            </td>
                            {isBulkMode ? (
                                <>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={draftStr !== undefined ? draftStr : ''}
                                            onChange={(e) => handleDraftChange(item.product.id, e.target.value)}
                                            placeholder={currentQuantity.toString()}
                                            className="w-24 text-center border border-sky-300 rounded p-1 focus:ring-2 focus:ring-sky-500 shadow-sm"
                                        />
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${hasDraft && diff !== 0 ? (diff > 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>
                                        {hasDraft && diff !== 0 ? (diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()) : '-'}
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{timeSince(item.updatedAt)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <button 
                                                onClick={() => onViewStockCard(item.product.id)} 
                                                className="text-slate-500 hover:text-sky-600 transition-colors"
                                                title="ดูประวัติ (Stock Card)"
                                            >
                                                <ClockIcon className="w-5 h-5"/>
                                            </button>
                                            <button 
                                                onClick={() => openAdjustModal(item.product, item.quantity)}
                                                className="text-amber-500 hover:text-amber-600 transition-colors"
                                                title="ปรับสต็อก (Physical Count)"
                                            >
                                                <PencilSquareIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    );
                })}
                 {combinedData.length === 0 && (
                    <tr>
                        <td colSpan={isBulkMode ? 5 : 5} className="text-center py-10 text-slate-500">ไม่พบรายการ</td>
                    </tr>
                )}
            </TableTemplate>
            
            {adjustProduct && (
                <StockAdjustmentModal
                    isOpen={isAdjustModalOpen}
                    onClose={() => setIsAdjustModalOpen(false)}
                    product={adjustProduct}
                    currentStock={adjustCurrentStock}
                    onSuccess={() => {
                        setIsAdjustModalOpen(false);
                        onDataChange();
                    }}
                />
            )}
        </div>
    );
};

export default InventoryView;