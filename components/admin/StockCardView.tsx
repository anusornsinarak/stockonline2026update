
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Product, ProductTransaction, InventoryItem, GoodsReceivedNote, PurchaseOrder, Company } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PrinterIcon from '../icons/PrinterIcon';
import DownloadIcon from '../icons/DownloadIcon';
import * as XLSX from 'xlsx';
import TableTemplate from './TableTemplate';
import CubeIcon from '../icons/CubeIcon';
import GrnDetailModal from './GrnDetailModal';
import Modal from '../Modal';
import PlusIcon from '../icons/PlusIcon';
import MinusIcon from '../icons/MinusIcon';
import PencilSquareIcon from '../icons/PencilSquareIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';


interface StockCardViewProps {
    allProducts: Product[];
    inventory: InventoryItem[];
    goodsReceivedNotes: GoodsReceivedNote[];
    purchaseOrders: PurchaseOrder[];
    companies: Company[];
    onDataChange: () => void;
}

const toISODateString = (date: Date) => {
    return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
};

const getFiscalYearStartDate = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    // Fiscal year starts in October (month 9)
    const fiscalYearStartYear = currentMonth >= 9 ? currentYear : currentYear - 1;
    return new Date(fiscalYearStartYear, 9, 1);
};

const InfoBox: React.FC<{ title: string, children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600 ${className}`}>
        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{title}</p>
        <div className="mt-1">{children}</div>
    </div>
);

const StockAdjustmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    currentStock: number;
    onSuccess: () => void;
}> = ({ isOpen, onClose, product, currentStock, onSuccess }) => {
    const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAdjustmentType('increase');
            setQuantity('');
            setNotes('');
            setError('');
            setIsSaving(false);
        }
    }, [isOpen]);

    const quantityChange = parseInt(quantity, 10) || 0;
    const newStock = adjustmentType === 'increase' ? currentStock + quantityChange : currentStock - quantityChange;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (quantityChange <= 0 || !notes.trim()) {
            setError('กรุณากรอกจำนวนและเหตุผลให้ถูกต้อง');
            return;
        }
        if (adjustmentType === 'decrease' && quantityChange > currentStock) {
            setError('จำนวนที่ลดต้องไม่เกินยอดคงคลังปัจจุบัน');
            return;
        }
        
        setIsSaving(true);
        setError('');
        try {
            const finalQuantityChange = adjustmentType === 'increase' ? quantityChange : -quantityChange;
            await supabaseService.adjustStockQuantity(product.id, finalQuantityChange, notes);
            alert('ปรับสต็อกสำเร็จ!');
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`ปรับสต็อก: ${product.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ประเภทการปรับ</label>
                    <div className="mt-2 flex gap-4">
                        <label className="flex items-center"><input type="radio" value="increase" checked={adjustmentType === 'increase'} onChange={() => setAdjustmentType('increase')} className="h-4 w-4" /> <span className="ml-2">เพิ่มสต็อก</span></label>
                        <label className="flex items-center"><input type="radio" value="decrease" checked={adjustmentType === 'decrease'} onChange={() => setAdjustmentType('decrease')} className="h-4 w-4" /> <span className="ml-2">ลดสต็อก</span></label>
                    </div>
                </div>
                <div>
                    <label htmlFor="adj-quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-200">จำนวนที่ปรับ</label>
                    <input id="adj-quantity" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md" required />
                </div>
                 <div className="grid grid-cols-2 gap-4 text-center">
                    <InfoBox title="คงคลังปัจจุบัน"><p className="text-xl font-bold">{currentStock.toLocaleString()}</p></InfoBox>
                    <InfoBox title="คงคลังหลังปรับ"><p className="text-xl font-bold text-sky-600 dark:text-sky-400">{newStock.toLocaleString()}</p></InfoBox>
                </div>
                <div>
                    <label htmlFor="adj-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-200">หมายเหตุ / เหตุผล (สำคัญมาก)</label>
                    <textarea id="adj-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-md" required placeholder="เช่น จากการนับสต็อกจริง, ของชำรุด, ปรับยอดยกมา" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-600">
                    <button type="button" onClick={onClose} className="bg-slate-200 font-bold py-2 px-4 rounded-lg">ยกเลิก</button>
                    <button type="submit" disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400">
                        {isSaving ? 'กำลังบันทึก...' : 'ยืนยันการปรับสต็อก'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};


const StockCardView: React.FC<StockCardViewProps> = ({ allProducts = [], inventory = [], goodsReceivedNotes = [], purchaseOrders = [], companies = [], onDataChange }) => {
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [productSearch, setProductSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const [transactions, setTransactions] = useState<(Partial<ProductTransaction> & { balance: number })[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // State for the new modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGrnForDetail, setSelectedGrnForDetail] = useState<GoodsReceivedNote | null>(null);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const inventoryMap = useMemo(() => new Map((inventory || []).map(item => [item.productId, item.quantity])), [inventory]);
    const productMap = useMemo(() => new Map((allProducts || []).map(p => [p.id, p])), [allProducts]);
    const grnMap = useMemo(() => new Map((goodsReceivedNotes || []).map(grn => [grn.grnNumber, grn])), [goodsReceivedNotes]);
    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

    const selectedProduct = useMemo(() => productMap.get(selectedProductId), [productMap, selectedProductId]);

    // Filter products for Searchable Select
    const filteredProductOptions = useMemo(() => {
        if (!productSearch.trim()) return allProducts.sort((a,b) => a.name.localeCompare(b.name, 'th'));
        return allProducts
            .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
            .sort((a,b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 100); // Limit results for performance
    }, [allProducts, productSearch]);

    useEffect(() => {
        setDateRange({
            start: toISODateString(getFiscalYearStartDate()),
            end: toISODateString(new Date())
        });
    }, []);

    const fetchAndProcessHistory = useCallback(async () => {
        if (!selectedProduct || !dateRange.start || !dateRange.end) {
            setTransactions([]);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const allHistory = await supabaseService.getProductTransactionHistory(selectedProduct.id, dateRange.end);
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);

            let openingBalance = 0;

            (allHistory || []).forEach(tx => {
                if (new Date(tx.transactionDate) < startDate) {
                    openingBalance += tx.quantityIn - tx.quantityOut;
                }
            });

            const transactionsInRange = (allHistory || []).filter(tx => new Date(tx.transactionDate) >= startDate);
            const openingRecord: (Partial<ProductTransaction> & { balance: number }) = {
                transactionDate: startDate,
                transactionType: 'ยอดยกมา',
                referenceDocument: '-',
                departmentName: null,
                quantityIn: 0,
                quantityOut: 0,
                balance: openingBalance,
            };

            let runningBalance = openingBalance;
            const processedTransactions = transactionsInRange.map(tx => {
                runningBalance += tx.quantityIn - tx.quantityOut;
                return { ...tx, balance: runningBalance };
            });

            setTransactions([openingRecord, ...processedTransactions]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดประวัติได้');
        } finally {
            setIsLoading(false);
        }
    }, [selectedProduct, dateRange]);


    useEffect(() => {
        fetchAndProcessHistory();
    }, [selectedProduct, dateRange, fetchAndProcessHistory, inventory]); 

    // Handle outside click for searchable select
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const latestPurchase = useMemo(() => {
        if (!selectedProduct) return null;
    
        const receiveEvents = (goodsReceivedNotes || []).flatMap(grn =>
            (grn.items || [])
                .filter(item => item.productId === selectedProduct.id)
                .map(item => ({
                    grn,
                    item,
                    receivedDate: new Date(grn.receivedDate)
                }))
        );
        
        if (receiveEvents.length === 0) return null;
    
        receiveEvents.sort((a, b) => b.receivedDate.getTime() - a.receivedDate.getTime());
        const latestEvent = receiveEvents[0];
        
        let companyName = 'จากแหล่งอื่น';
        if (latestEvent.grn.purchaseOrderId) {
            const po = (purchaseOrders || []).find(p => p.id === latestEvent.grn.purchaseOrderId);
            if (po) {
                companyName = companyMap.get(po.companyId) || 'ไม่พบชื่อบริษัท';
            }
        }
    
        return {
            date: latestEvent.receivedDate,
            quantity: latestEvent.item.quantityReceived,
            price: selectedProduct.pricePerUnit || 0,
            company: companyName
        };
    }, [selectedProduct, goodsReceivedNotes, purchaseOrders, companyMap]);

    const { summary, sortedAndFilteredTransactions } = useMemo(() => {
        let items = [...transactions];
        if (typeFilter !== 'all') {
            items = items.filter(tx => tx.transactionType === typeFilter || tx.transactionType === 'ยอดยกมา');
        }
        
        const summaryStats = items.slice(1).reduce((acc, tx) => {
             acc.totalIn += tx.quantityIn || 0;
             acc.totalOut += tx.quantityOut || 0;
             return acc;
        }, { totalIn: 0, totalOut: 0 });

        return { summary: summaryStats, sortedAndFilteredTransactions: items.sort((a,b) => new Date(b.transactionDate!).getTime() - new Date(a.transactionDate!).getTime()) };
    }, [transactions, typeFilter]);

    const handleExport = () => {
        if (!selectedProduct) return;
        const dataToExport = sortedAndFilteredTransactions.map(tx => ({
            'วันที่': tx.transactionType === 'ยอดยกมา' ? toISODateString(tx.transactionDate!) : new Date(tx.transactionDate!).toLocaleString('th-TH'),
            'ประเภท': tx.transactionType,
            'อ้างอิง/หน่วยงาน': tx.departmentName || tx.referenceDocument,
            'รับเข้า': tx.quantityIn || '',
            'จ่ายออก': tx.quantityOut || '',
            'คงเหลือ': tx.balance,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "StockCard");
        XLSX.writeFile(workbook, `StockCard_${selectedProduct?.name.replace(/\s/g, '_')}.xlsx`);
    };
    
    const handleOpenGrnModal = (grnNumber: string) => {
        const grn = grnMap.get(grnNumber);
        if (grn) {
            setSelectedGrnForDetail(grn);
            setIsModalOpen(true);
        } else {
            alert(`ไม่พบข้อมูลสำหรับ GRN #${grnNumber}`);
        }
    };

    const handleSelectProduct = (productId: string, productName: string) => {
        setSelectedProductId(productId);
        setProductSearch(productName);
        setIsDropdownOpen(false);
    };

    const currentStock = inventoryMap.get(selectedProductId) ?? 0;
    const inventoryValue = currentStock * (selectedProduct?.pricePerUnit || 0);
    
    return (
        <>
            <div className="flex flex-col lg:flex-row gap-6">
                 {/* Left Column: Product Selection (Searchable) */}
                 <div className="lg:w-1/3 flex-shrink-0 space-y-3">
                    <h3 className="text-lg font-semibold">เลือกรายการ</h3>
                    <div className="relative" ref={dropdownRef}>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={isDropdownOpen ? productSearch : (selectedProduct?.name || productSearch)}
                                onFocus={() => {
                                    setIsDropdownOpen(true);
                                    if (selectedProduct) setProductSearch(''); // Clear search on focus to show all
                                }}
                                onChange={(e) => {
                                    setProductSearch(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                placeholder="พิมพ์ชื่อเวชภัณฑ์เพื่อค้นหา..."
                                className="w-full pl-9 pr-10 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {isDropdownOpen && (
                            <div className="absolute z-[100] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto animate-fade-in">
                                {filteredProductOptions.length > 0 ? (
                                    <ul className="py-1">
                                        {filteredProductOptions.map(p => (
                                            <li key={p.id}>
                                                <button
                                                    onClick={() => handleSelectProduct(p.id, p.name)}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors flex justify-between items-center ${selectedProductId === p.id ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                                                >
                                                    <span className="truncate">{p.name}</span>
                                                    <span className="text-xs opacity-60 ml-2">({p.unit})</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm italic">
                                        ไม่พบรายการที่ค้นหา
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>

                {/* Right Column: Details & Stock Card */}
                <div className="flex-grow min-w-0">
                    {!selectedProduct ? (
                         <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg h-full flex flex-col justify-center">
                            <CubeIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <h3 className="mt-2 text-lg font-medium text-slate-900 dark:text-slate-100">
                               เลือกรายการ
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                               พิมพ์ค้นหาหรือเลือกรายการจากด้านซ้ายเพื่อดูประวัติสต็อก
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2 print-section">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedProduct.name}</h2>
                                        <p className="text-slate-500 dark:text-slate-400">{selectedProduct.category} | หน่วย: {selectedProduct.unit} | Zone: {selectedProduct.zone || 'N/A'}</p>
                                    </div>
                                    <button onClick={() => setIsAdjustModalOpen(true)} className="flex items-center gap-2 bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors no-print">
                                        <PencilSquareIcon className="w-5 h-5"/>
                                        ปรับสต็อก
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print-section">
                                <InfoBox title="ยอดคงเหลือปัจจุบัน">
                                    <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{currentStock.toLocaleString('th-TH')}</p>
                                </InfoBox>
                                <InfoBox title="มูลค่าคงคลัง">
                                    <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{inventoryValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                                </InfoBox>
                                 <InfoBox title="ราคาปัจจุบัน">
                                    <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{(selectedProduct.pricePerUnit || 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                                </InfoBox>
                                 <InfoBox title="การซื้อล่าสุด" className="col-span-1 md:col-span-2 lg:col-span-1">
                                    {latestPurchase ? (
                                        <div className="text-sm space-y-1">
                                            <p><strong>วันที่:</strong> {latestPurchase.date.toLocaleDateString('th-TH')}</p>
                                            <p><strong>จำนวน:</strong> {(latestPurchase.quantity || 0).toLocaleString()} {selectedProduct.unit}</p>
                                            <p><strong>ราคา:</strong> {(latestPurchase.price || 0).toLocaleString('th-TH', {style: 'currency', currency: 'THB'})}</p>
                                            <p><strong>บริษัท:</strong> {latestPurchase.company}</p>
                                        </div>
                                    ) : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                                 </InfoBox>
                            </div>
                            
                            <div className="print-section">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 no-print">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <div>
                                            <label className="text-sm font-medium">ตั้งแต่:</label>
                                            <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="ml-2 border-slate-300 rounded-md shadow-sm text-sm p-1.5 dark:bg-slate-700"/>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">ถึง:</label>
                                            <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="ml-2 border-slate-300 rounded-md shadow-sm text-sm p-1.5 dark:bg-slate-700"/>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 self-end md:self-center">
                                        <button onClick={handleExport} className="flex items-center gap-2 bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"><DownloadIcon className="w-5 h-5"/> Excel</button>
                                        <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"><PrinterIcon className="w-5 h-5"/> พิมพ์</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                                    <InfoBox title="รับเข้าในช่วงเวลาที่เลือก">
                                         <p className="text-2xl font-bold text-green-600">{summary.totalIn.toLocaleString('th-TH')}</p>
                                    </InfoBox>
                                     <InfoBox title="จ่ายออกในช่วงเวลาที่เลือก">
                                        <p className="text-2xl font-bold text-red-600">{summary.totalOut.toLocaleString('th-TH')}</p>
                                    </InfoBox>
                                </div>

                                <h3 className="text-lg font-semibold mb-2">ประวัติความเคลื่อนไหว (Stock Card)</h3>
                                <TableTemplate headers={['วันที่', 'ประเภท', 'อ้างอิง/หน่วยงาน', 'รับเข้า', 'จ่ายออก', 'คงเหลือ', '']}>
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="text-center p-8">กำลังโหลดข้อมูล...</td></tr>
                                    ) : error ? (
                                        <tr><td colSpan={7} className="text-center p-8 text-red-600">{error}</td></tr>
                                    ) : sortedAndFilteredTransactions.length > 0 ? (
                                        sortedAndFilteredTransactions.map((tx, index) => (
                                            <tr key={index} className={tx.transactionType === 'ยอดยกมา' ? 'bg-slate-100 dark:bg-slate-700 font-semibold' : 'hover:bg-slate-50/70 dark:hover:bg-slate-700/50'}>
                                                <td className="px-2 py-2 text-sm">{new Date(tx.transactionDate!).toLocaleDateString('th-TH')}</td>
                                                <td className="px-2 py-2 text-sm">{tx.transactionType}</td>
                                                <td className="px-2 py-2 text-sm truncate max-w-xs">{tx.departmentName || tx.referenceDocument}</td>
                                                <td className={`px-2 py-2 text-sm text-right ${(tx.quantityIn || 0) > 0 ? 'text-green-600' : ''}`}>{(tx.quantityIn || 0) > 0 ? (tx.quantityIn || 0).toLocaleString() : '-'}</td>
                                                <td className={`px-2 py-2 text-sm text-right ${(tx.quantityOut || 0) > 0 ? 'text-red-600' : ''}`}>{(tx.quantityOut || 0) > 0 ? (tx.quantityOut || 0).toLocaleString() : '-'}</td>
                                                <td className="px-2 py-2 text-sm text-right font-semibold">{(tx.balance || 0).toLocaleString()}</td>
                                                <td className="px-2 py-2 text-center">
                                                    {tx.transactionType === 'รับเข้า' && tx.referenceDocument && tx.referenceDocument.startsWith('GRN') && (
                                                        <button 
                                                            onClick={() => handleOpenGrnModal(tx.referenceDocument!)}
                                                            className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 font-medium text-xs"
                                                        >
                                                            ดู/แก้ไข
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={7} className="text-center py-10 text-slate-500 dark:text-slate-400">ไม่พบประวัติการทำรายการในช่วงเวลานี้</td></tr>
                                    )}
                                </TableTemplate>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {selectedGrnForDetail && (
                <GrnDetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    grn={selectedGrnForDetail}
                    productMap={productMap}
                    onDataChange={onDataChange}
                />
            )}
            
            {selectedProduct && (
                 <StockAdjustmentModal
                    isOpen={isAdjustModalOpen}
                    onClose={() => setIsAdjustModalOpen(false)}
                    product={selectedProduct}
                    currentStock={currentStock}
                    onSuccess={() => {
                        setIsAdjustModalOpen(false);
                        onDataChange();
                    }}
                />
            )}
        </>
    );
};

export default StockCardView;
