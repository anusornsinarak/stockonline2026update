import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BackOrderItem, Product, Department } from '../../types';
import TableTemplate from './TableTemplate';
import { supabaseService } from '../../services/supabaseService';
import CubeIcon from '../icons/CubeIcon';
import TrashIcon from '../icons/TrashIcon';
import PlusIcon from '../icons/PlusIcon';
import EditIcon from '../icons/EditIcon';
import PrinterIcon from '../icons/PrinterIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import CalendarDaysIcon from '../icons/CalendarDaysIcon';
// FIX: Added missing import for ArrowPathIcon
import ArrowPathIcon from '../icons/ArrowPathIcon';

interface ManageBackordersViewProps {
    backorders: BackOrderItem[];
    onDataChange: () => void;
    productMap: Map<string, Product>;
    departmentMap: Map<string, string>;
    inventoryMap: Map<string, number>;
    departments: Department[];
    allProducts: Product[];
    onOpenCreateForDeptModal?: (initialPurpose?: 'requisition' | 'loan') => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value || 0);

const InfoBox: React.FC<{ title: string, children: React.ReactNode, icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4">
        {icon && <div className="flex-shrink-0 p-2 bg-sky-50 dark:bg-sky-900/30 rounded-lg text-sky-600 dark:text-sky-400">{icon}</div>}
        <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <div className="mt-1">{children}</div>
        </div>
    </div>
);

const PrintSelectedLayout: React.FC<{ title: string; items: BackOrderItem[] }> = ({ title, items }) => {
    const groupedItems = useMemo(() => {
        const groups: Record<string, BackOrderItem[]> = {};
        items.forEach(item => {
            const deptName = item.departmentName || 'ไม่ระบุหน่วยงาน';
            if (!groups[deptName]) {
                groups[deptName] = [];
            }
            groups[deptName].push(item);
        });
        return groups;
    }, [items]);

    const departmentNames = Object.keys(groupedItems).sort((a, b) => a.localeCompare(b, 'th'));
    const grandTotal = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return (
        <div className="font-sarabun p-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="text-sm text-slate-600">พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</p>
            </div>

            {departmentNames.map((deptName, index) => {
                const deptItems = groupedItems[deptName];
                deptItems.sort((a, b) => (a.productName || '').localeCompare(b.productName || '', 'th'));
                const deptTotal = deptItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

                return (
                    <div key={deptName} className={`mb-8 ${index > 0 ? 'print-section' : ''}`}>
                        <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-300 mb-4 pb-2">
                            หน่วยงาน: {deptName}
                        </h2>
                        <table className="w-full text-left border-collapse border border-slate-400">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="border border-slate-300 p-2 text-sm w-12 text-center">ลำดับ</th>
                                    <th className="border border-slate-300 p-2 text-sm w-32 text-center">วันที่สร้าง</th>
                                    <th className="border border-slate-300 p-2 text-sm">รายการ</th>
                                    <th className="border border-slate-300 p-2 text-sm text-center w-24">ใบเบิกเดิม</th>
                                    <th className="border border-slate-300 p-2 text-sm text-right w-24">จำนวน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deptItems.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="border border-slate-300 p-2 text-sm text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 p-2 text-sm text-center">{new Date(item.createdAt).toLocaleDateString('th-TH')}</td>
                                        <td className="border border-slate-300 p-2 text-sm font-medium">{item.productName}</td>
                                        <td className="border border-slate-300 p-2 text-sm text-center">{item.requisitionNumber ? `#${item.requisitionNumber}` : '-'}</td>
                                        <td className="border border-slate-300 p-2 text-sm text-right font-bold">{(item.quantity || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-bold">
                                    <td colSpan={4} className="border border-slate-300 p-2 text-right">รวม {deptName}</td>
                                    <td className="border border-slate-300 p-2 text-right">{deptTotal.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })}
            
            <div className="mt-8 pt-4 border-t-4 border-double border-slate-400 flex justify-between items-center text-lg font-bold">
                <span>รวมทั้งหมด ({items.length} รายการ)</span>
                <span>{grandTotal.toLocaleString()} ชิ้น</span>
            </div>
        </div>
    );
};

const ManageBackordersView: React.FC<ManageBackordersViewProps> = (props) => {
    const { backorders, onDataChange, productMap, departmentMap, inventoryMap, departments, allProducts, onOpenCreateForDeptModal } = props;

    const [isProcessingItem, setIsProcessingItem] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loanDepartmentFilter, setLoanDepartmentFilter] = useState('all');
    
    // Default to all to show everything pending
    const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
    const [yearFilter, setYearFilter] = useState<number | 'all'>('all');

    const [selectedBackorderIds, setSelectedBackorderIds] = useState<Set<number>>(new Set());
    const [printData, setPrintData] = useState<{ title: string; items: BackOrderItem[] } | null>(null);
    const [isConsolidatingBackorders, setIsConsolidatingBackorders] = useState(false);
    
    const backorderSelectAllRef = useRef<HTMLInputElement>(null);

    const monthNames = useMemo(() => ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"], []);
    const yearOptions = useMemo(() => {
        const uniqueYears = [...new Set(backorders.map(item => new Date(item.createdAt).getFullYear()))];
        const currentYear = new Date().getFullYear();
        if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
        return uniqueYears.sort((a: number, b: number) => b - a);
    }, [backorders]);

    useEffect(() => {
        if (printData) {
            const timer = setTimeout(() => window.print(), 100);
            const handleAfterPrint = () => setPrintData(null);
            window.addEventListener('afterprint', handleAfterPrint, { once: true });
            return () => {
                clearTimeout(timer);
                window.removeEventListener('afterprint', handleAfterPrint);
            };
        }
    }, [printData]);
    
    const filteredBackorders = useMemo(() => {
        return (backorders || []).filter(item => {
            const itemDate = new Date(item.createdAt);
            const yearMatch = yearFilter === 'all' || itemDate.getFullYear() === yearFilter;
            const monthMatch = monthFilter === 'all' || (itemDate.getMonth() + 1) === monthFilter;
            if (!yearMatch || !monthMatch) return false;
            
            const lowerSearch = searchTerm.toLowerCase();
            const deptMatch = loanDepartmentFilter === 'all' || item.departmentId === loanDepartmentFilter;
            const searchMatch = !searchTerm.trim() ||
                (item.productName || '').toLowerCase().includes(lowerSearch) ||
                (item.departmentName || '').toLowerCase().includes(lowerSearch) ||
                (item.requisitionNumber || '').toLowerCase().includes(lowerSearch);
            
            return deptMatch && searchMatch;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [backorders, searchTerm, monthFilter, yearFilter, loanDepartmentFilter]);
    
    const handleFulfillBackorder = async (item: BackOrderItem) => {
        if (!window.confirm(`คุณต้องการตัดจ่ายรายการค้างจ่าย "${item.productName}"?`)) return;
        setIsProcessingItem(String(item.id));
        try {
            await supabaseService.fulfillBackorderItem(item.id);
            onDataChange();
        } catch (error) {
            alert('ไม่สามารถดำเนินการได้');
        } finally { setIsProcessingItem(null); }
    };

    const handleConsolidateBackorders = async () => {
        if (selectedBackorderIds.size === 0) return;
        setIsConsolidatingBackorders(true);
        try {
            await supabaseService.fulfillBackorderItemsBatch(Array.from(selectedBackorderIds));
            setSelectedBackorderIds(new Set());
            onDataChange();
        } catch (error) { alert('เกิดข้อผิดพลาด'); } finally { setIsConsolidatingBackorders(false); }
    };

    const handleCancelBackorder = async (item: BackOrderItem) => {
        if (!window.confirm(`ยกเลิกค้างจ่าย "${item.productName}"?`)) return;
        setIsProcessingItem(String(item.id));
        try {
            await supabaseService.cancelBackorderItem(item.id);
            onDataChange();
        } catch (error) { alert('เกิดข้อผิดพลาด'); } finally { setIsProcessingItem(null); }
    };

    const handleToggleBackorderSelection = (itemId: number) => {
        setSelectedBackorderIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId); else newSet.add(itemId);
            return newSet;
        });
    };

    const handleSelectAllBackorders = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedBackorderIds(new Set(filteredBackorders.map(item => item.id)));
        else setSelectedBackorderIds(new Set());
    };
    
    useEffect(() => {
        if (backorderSelectAllRef.current) {
            backorderSelectAllRef.current.checked = filteredBackorders.length > 0 && selectedBackorderIds.size === filteredBackorders.length;
            backorderSelectAllRef.current.indeterminate = selectedBackorderIds.size > 0 && selectedBackorderIds.size < filteredBackorders.length;
        }
    }, [selectedBackorderIds, filteredBackorders]);

    const handlePrintSelected = () => {
        const items = backorders.filter(item => selectedBackorderIds.has(item.id));
        setPrintData({ title: 'รายการค้างจ่ายที่เลือก', items });
    };

    const backorderSummary = useMemo(() => {
        const totalValue = (backorders || []).reduce((sum, item) => sum + ((item.quantity || 0) * (productMap.get(item.productId)?.pricePerUnit || 0)), 0);
        return { count: (backorders || []).length, value: totalValue };
    }, [backorders, productMap]);

    return (
        <div className="space-y-6">
            {printData && <PrintSelectedLayout title={printData.title} items={printData.items} />}
            <div className={printData ? 'no-print' : ''}>
                
                {/* Dashboard Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InfoBox title="รายการค้างจ่ายทั้งหมด" icon={<CubeIcon className="w-6 h-6"/>}>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{(backorderSummary.count || 0).toLocaleString()}</p>
                        </InfoBox>
                        <InfoBox title="มูลค่าค้างจ่ายทั้งหมด" icon={<PlusIcon className="w-6 h-6"/>}>
                            <p className="text-xl font-bold text-sky-600 dark:text-sky-400">{formatCurrency(backorderSummary.value)}</p>
                        </InfoBox>
                    </div>
                </div>

                {/* Filters Panel */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">เครื่องมือกรองข้อมูล</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">ค้นหา</label>
                            <input 
                                type="text" 
                                placeholder="ค้นหารายการ, หน่วยงาน, เลขที่ใบเบิก..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none transition-all" 
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">เดือน</label>
                            <div className="relative">
                                <CalendarDaysIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <select 
                                    value={monthFilter} 
                                    onChange={e => setMonthFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none appearance-none"
                                >
                                    <option value="all">ทุกเดือน</option>
                                    {monthNames.map((name, idx) => (
                                        <option key={idx} value={idx + 1}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">ปี</label>
                            <select 
                                value={yearFilter} 
                                onChange={e => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none appearance-none"
                            >
                                <option value="all">ทุกปี</option>
                                {yearOptions.map(year => (
                                    <option key={year} value={year}>{year + 543}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                        <div className="flex items-center gap-4">
                            <select 
                                value={loanDepartmentFilter} 
                                onChange={e => setLoanDepartmentFilter(e.target.value)}
                                className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 outline-none"
                            >
                                <option value="all">ทุกหน่วยงาน</option>
                                {departments.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={() => {setSearchTerm(''); setMonthFilter('all'); setYearFilter('all'); setLoanDepartmentFilter('all');}}
                            className="text-xs font-bold text-sky-600 hover:text-sky-800 dark:text-sky-400 uppercase underline"
                        >
                            ล้างตัวกรองทั้งหมด
                        </button>
                    </div>
                </div>

                {/* Backorders Section */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <CubeIcon className="w-5 h-5 text-orange-500" />
                            รายการค้างจ่าย ({filteredBackorders.length})
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleConsolidateBackorders} 
                                disabled={selectedBackorderIds.size === 0 || isConsolidatingBackorders} 
                                className="flex items-center gap-2 bg-emerald-600 text-white font-bold py-1.5 px-4 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-all text-sm"
                            >
                                <CheckCircleIcon className="w-4 h-4"/>
                                รวบเบิกที่เลือก ({selectedBackorderIds.size})
                            </button>
                            <button 
                                onClick={handlePrintSelected} 
                                disabled={selectedBackorderIds.size === 0} 
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-1.5 px-4 rounded-lg hover:bg-slate-200 transition-all text-sm"
                            >
                                <PrinterIcon className="w-4 h-4"/>
                                พิมพ์ที่เลือก
                            </button>
                        </div>
                    </div>
                    <TableTemplate headers={[
                        <div className="flex items-center justify-center"><input type="checkbox" ref={backorderSelectAllRef} onChange={handleSelectAllBackorders} className="rounded" /></div>, 
                        'วันที่สร้าง', 'หน่วยงาน', 'รายการ', {name: 'จำนวน', className: 'text-right'}, 'ใบเบิกเดิม', {name: 'ดำเนินการ', className: 'text-center'}
                    ]}>
                        {filteredBackorders.map(item => {
                            const isProcessing = isProcessingItem === String(item.id);
                            return (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-4 py-2 text-center"><input type="checkbox" checked={selectedBackorderIds.has(item.id)} onChange={() => handleToggleBackorderSelection(item.id)} className="rounded" /></td>
                                <td className="px-4 py-2 text-sm">{new Date(item.createdAt).toLocaleDateString('th-TH')}</td>
                                <td className="px-4 py-2 text-sm font-medium">{item.departmentName}</td>
                                <td className="px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{item.productName}</td>
                                <td className="px-4 py-2 text-sm text-right font-bold text-sky-600">{(item.quantity || 0).toLocaleString()}</td>
                                <td className="px-4 py-2 text-sm text-slate-500">#{item.requisitionNumber}</td>
                                <td className="px-4 py-2">
                                    <div className="flex gap-2 justify-center">
                                        <button 
                                            onClick={() => handleFulfillBackorder(item)} 
                                            disabled={isProcessing}
                                            className="text-emerald-600 p-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-colors"
                                            title="ตัดจ่ายรายการนี้"
                                        >
                                            {isProcessing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CubeIcon className="w-5 h-5"/>}
                                        </button>
                                        <button 
                                            onClick={() => handleCancelBackorder(item)} 
                                            disabled={isProcessing}
                                            className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                            title="ยกเลิกรายการนี้"
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                         {filteredBackorders.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-10 text-slate-500 dark:text-slate-400">ไม่พบรายการค้างจ่ายในช่วงเวลาที่เลือก</td></tr>
                        )}
                    </TableTemplate>
                </div>
            </div>
        </div>
    );
};

export default ManageBackordersView;