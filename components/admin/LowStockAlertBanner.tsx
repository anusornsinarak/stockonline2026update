import React, { useState, useMemo } from 'react';
import { Product, ProductCategory, productCategories } from '../../types';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import BellIcon from '../icons/BellIcon';
import XMarkIcon from '../icons/XMarkIcon';
import EyeIcon from '../icons/EyeIcon';
import DownloadIcon from '../icons/DownloadIcon';
import ShoppingCartIcon from '../icons/ShoppingCartIcon';
import ClockIcon from '../icons/ClockIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import Modal from '../Modal';
import * as XLSX from 'xlsx';
import { supabaseService } from '../../services/supabaseService';

export interface LowStockItem {
    product: Product;
    currentStock: number;
    minStock: number;
    maxStock: number | null;
    deficit: number;
}

interface LowStockAlertBannerProps {
    lowStockItems: LowStockItem[];
    onNavigateToStockLevels?: () => void;
    onNavigateToStockCard?: (productId?: string) => void;
    onNavigateToPurchaseOrder?: () => void;
    onRecheck?: () => void;
    className?: string;
    role?: 'Admin' | 'Warehouse';
}

export const LowStockAlertBanner: React.FC<LowStockAlertBannerProps> = ({
    lowStockItems,
    onNavigateToStockLevels,
    onNavigateToStockCard,
    onNavigateToPurchaseOrder,
    onRecheck,
    className = '',
    role = 'Admin'
}) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isNotifying, setIsNotifying] = useState(false);
    const [notifySuccessMsg, setNotifySuccessMsg] = useState<string | null>(null);

    const totalDeficit = useMemo(() => {
        return lowStockItems.reduce((sum, item) => sum + item.deficit, 0);
    }, [lowStockItems]);

    const filteredItems = useMemo(() => {
        return lowStockItems.filter(item => {
            const matchesSearch = item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.product.zone && item.product.zone.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = selectedCategory === 'all' || item.product.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [lowStockItems, searchTerm, selectedCategory]);

    const handleExportExcel = () => {
        const exportData = filteredItems.map((item, index) => ({
            'ลำดับ': index + 1,
            'ชื่อเวชภัณฑ์': item.product.name,
            'หมวดหมู่': item.product.category || '-',
            'โซนจัดเก็บ': item.product.zone || '-',
            'คงเหลือในคลัง': item.currentStock,
            'เกณฑ์ขั้นต่ำ (Min)': item.minStock,
            'เกณฑ์สูงสุด (Max)': item.maxStock ?? '-',
            'จำนวนที่ขาด (ต่ำกว่า Min)': item.deficit,
            'หน่วยนับ': item.product.unit,
            'ราคา/หน่วย (บาท)': item.product.pricePerUnit || 0,
            'มูลค่าประมาณการเติมสต็อก (บาท)': item.deficit * (item.product.pricePerUnit || 0),
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "เวชภัณฑ์ต่ำกว่าเกณฑ์ขั้นต่ำ");
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `รายงานเวชภัณฑ์ต่ำกว่าเกณฑ์ขั้นต่ำ_${dateStr}.xlsx`);
    };

    const handleSendBroadcastNotification = async () => {
        if (!window.confirm(`ยืนยันการส่งการแจ้งเตือนเวชภัณฑ์ต่ำกว่าเกณฑ์ (${lowStockItems.length} รายการ) ไปยังแอปและ LINE/Telegram ของผู้ดูแลระบบและคลังสินค้าหรือไม่?`)) {
            return;
        }

        setIsNotifying(true);
        setNotifySuccessMsg(null);
        try {
            await supabaseService.checkAndNotifyLowStock(true);
            setNotifySuccessMsg('ส่งการแจ้งเตือนสำเร็จแล้ว!');
            if (onRecheck) onRecheck();
            setTimeout(() => setNotifySuccessMsg(null), 4000);
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการส่งแจ้งเตือน: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsNotifying(false);
        }
    };

    if (lowStockItems.length === 0) {
        return null;
    }

    if (isDismissed) {
        return (
            <div className={`mb-4 flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 shadow-sm ${className}`}>
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="font-semibold">
                        มีเวชภัณฑ์ต่ำกว่าเกณฑ์ขั้นต่ำ {lowStockItems.length} รายการ (ซ่อนอยู่)
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDetailModalOpen(true)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                    >
                        ดูรายการ
                    </button>
                    <button
                        onClick={() => setIsDismissed(false)}
                        className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        title="ขยายแถบแจ้งเตือน"
                    >
                        แสดงแถบ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`mb-6 rounded-2xl border-2 border-amber-400/80 dark:border-amber-600/60 bg-gradient-to-r from-amber-50 via-orange-50/60 to-yellow-50 dark:from-amber-950/50 dark:via-orange-950/30 dark:to-yellow-950/40 p-4 sm:p-5 shadow-md shadow-amber-500/5 transition-all ${className}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left Icon & Message */}
                    <div className="flex items-start gap-3.5">
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm flex-shrink-0 mt-0.5 animate-bounce" style={{ animationDuration: '2.5s' }}>
                            <ExclamationTriangleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-extrabold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                                    แจ้งเตือนเวชภัณฑ์ต่ำกว่าเกณฑ์ขั้นต่ำ (Minimum Stock Level)
                                </h3>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500 text-white shadow-sm">
                                    {lowStockItems.length} รายการ
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-200/90 mt-1">
                                ตรวจพบรายการเวชภัณฑ์ที่มีจำนวนคงเหลือในคลังกลางน้อยกว่าเกณฑ์ขั้นต่ำ (Min Stock) ที่กำหนดไว้ โปรดตรวจสอบและเตรียมดำเนินการเติมสต็อก
                            </p>

                            {/* Preview Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                {lowStockItems.slice(0, 4).map((item) => (
                                    <span
                                        key={item.product.id}
                                        onClick={() => setIsDetailModalOpen(true)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-amber-300 dark:border-amber-700/60 shadow-xs cursor-pointer hover:bg-amber-100/80 transition-colors"
                                        title={`คลิกเพื่อดูรายละเอียด: คงเหลือ ${item.currentStock} / Min ${item.minStock} ${item.product.unit}`}
                                    >
                                        <span className="truncate max-w-[150px]">{item.product.name}</span>
                                        <span className="font-bold text-red-600 dark:text-red-400">
                                            ({item.currentStock}/{item.minStock} {item.product.unit})
                                        </span>
                                    </span>
                                ))}
                                {lowStockItems.length > 4 && (
                                    <span
                                        onClick={() => setIsDetailModalOpen(true)}
                                        className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/40 cursor-pointer hover:bg-amber-300/60 transition-colors"
                                    >
                                        +{lowStockItems.length - 4} รายการเพิ่มเติม...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsDetailModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95"
                        >
                            <EyeIcon className="w-4 h-4" />
                            <span>ดูรายการ ({lowStockItems.length})</span>
                        </button>

                        {role === 'Admin' && onNavigateToStockLevels && (
                            <button
                                type="button"
                                onClick={onNavigateToStockLevels}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs"
                            >
                                จัดระดับสต็อก
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsDismissed(true)}
                            className="p-2 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 rounded-xl transition-colors"
                            title="ซ่อนการแจ้งเตือนชั่วคราว"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detailed Low Stock Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={`รายการเวชภัณฑ์ที่ต่ำกว่าเกณฑ์ขั้นต่ำ (${lowStockItems.length} รายการ)`}
                maxWidth="max-w-5xl"
            >
                <div className="space-y-4">
                    {/* Success Notice if broadcast sent */}
                    {notifySuccessMsg && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-xl flex items-center justify-between animate-fade-in">
                            <span>{notifySuccessMsg}</span>
                            <span className="text-emerald-600 font-bold">✓</span>
                        </div>
                    )}

                    {/* Filter and Action Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="ค้นหาชื่อเวชภัณฑ์ หรือ โซนจัดเก็บ..."
                                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                                />
                                <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="text-xs sm:text-sm py-1.5 px-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
                            >
                                <option value="all">ทุกหมวดหมู่</option>
                                {productCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={handleSendBroadcastNotification}
                                disabled={isNotifying}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
                                title="ส่งการแจ้งเตือนข้อความเตือนไปยัง In-App และ LINE/Telegram ของผู้ดูแลระบบทันที"
                            >
                                <BellIcon className="w-3.5 h-3.5" />
                                <span>{isNotifying ? 'กำลังส่ง...' : 'กระจายแจ้งเตือน'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExportExcel}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
                            >
                                <DownloadIcon className="w-3.5 h-3.5" />
                                <span>ส่งออก Excel</span>
                            </button>
                        </div>
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50">
                            <span className="text-slate-500 dark:text-slate-400 block">รายการต่ำกว่า Min</span>
                            <span className="text-lg font-black text-red-600 dark:text-red-400">{lowStockItems.length} รายการ</span>
                        </div>
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50">
                            <span className="text-slate-500 dark:text-slate-400 block">ยอดขาดรวมทั้งหมด</span>
                            <span className="text-lg font-black text-amber-700 dark:text-amber-300">{totalDeficit.toLocaleString('th-TH')} หน่วย</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400 block">แสดงผลปัจจุบัน</span>
                            <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{filteredItems.length} รายการ</span>
                        </div>
                        <div className="p-2.5 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-900/50">
                            <span className="text-slate-500 dark:text-slate-400 block">สถานะระบบ</span>
                            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 mt-1 block">แจ้งเตือนอัตโนมัติแล้ว</span>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto max-h-[50vh] border border-slate-200 dark:border-slate-700 rounded-xl">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-2.5 text-center w-12">ลำดับ</th>
                                    <th className="p-2.5">รายการเวชภัณฑ์</th>
                                    <th className="p-2.5">หมวดหมู่ / โซน</th>
                                    <th className="p-2.5 text-center">หน่วยนับ</th>
                                    <th className="p-2.5 text-right font-bold">คงเหลือในคลัง</th>
                                    <th className="p-2.5 text-right">เกณฑ์ขั้นต่ำ (Min)</th>
                                    <th className="p-2.5 text-right">เกณฑ์สูงสุด (Max)</th>
                                    <th className="p-2.5 text-right text-red-600 font-bold">จำนวนที่ขาด</th>
                                    <th className="p-2.5 text-center">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-slate-500 dark:text-slate-400">
                                            ไม่พบรายการที่ตรงกับคำค้นหา
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item, index) => {
                                        const stockPercentage = item.minStock > 0 ? Math.round((item.currentStock / item.minStock) * 100) : 0;
                                        return (
                                            <tr key={item.product.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="p-2.5 text-center text-slate-400">{index + 1}</td>
                                                <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    <div>{item.product.name}</div>
                                                    {item.product.zone && (
                                                        <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                            Zone: {item.product.zone}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                                    {item.product.category}
                                                </td>
                                                <td className="p-2.5 text-center text-slate-600 dark:text-slate-400">
                                                    {item.product.unit}
                                                </td>
                                                <td className="p-2.5 text-right font-black text-red-600 dark:text-red-400">
                                                    <div className="flex flex-col items-end">
                                                        <span>{item.currentStock.toLocaleString('th-TH')}</span>
                                                        <span className="text-[10px] font-normal text-slate-400">
                                                            ({stockPercentage}% ของ Min)
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                                                    {item.minStock.toLocaleString('th-TH')}
                                                </td>
                                                <td className="p-2.5 text-right text-slate-500 dark:text-slate-400">
                                                    {item.maxStock !== null ? item.maxStock.toLocaleString('th-TH') : '-'}
                                                </td>
                                                <td className="p-2.5 text-right font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20">
                                                    -{item.deficit.toLocaleString('th-TH')}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {onNavigateToStockCard && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsDetailModalOpen(false);
                                                                    onNavigateToStockCard(item.product.id);
                                                                }}
                                                                className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="ดูประวัติการเคลื่อนไหว (Stock Card)"
                                                            >
                                                                <ClockIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {onNavigateToPurchaseOrder && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsDetailModalOpen(false);
                                                                    onNavigateToPurchaseOrder();
                                                                }}
                                                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="ไปที่การจัดซื้อ (PO)"
                                                            >
                                                                <ShoppingCartIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            * ระบบตรวจสอบและแจ้งเตือนอัตโนมัติเมื่อคงเหลือในสต็อกมีจำนวนน้อยกว่าเกณฑ์ขั้นต่ำ (Min Stock)
                        </div>
                        <div className="flex items-center gap-2">
                            {role === 'Admin' && onNavigateToStockLevels && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDetailModalOpen(false);
                                        onNavigateToStockLevels();
                                    }}
                                    className="px-4 py-2 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition-colors"
                                >
                                    ไปที่จัดการระดับสต็อก (Min/Max)
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};
