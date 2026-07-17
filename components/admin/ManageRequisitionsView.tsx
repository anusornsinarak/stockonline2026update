
import React, { useState, useMemo, useEffect } from 'react';
import { Department, Product, Requisition, RequisitionStatus, requisitionStatusMap, User, InventoryItem, BackOrderItem, LoanItem, DocumentSettings } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import TrashIcon from '../icons/TrashIcon';
import PrinterIcon from '../icons/PrinterIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import CubeIcon from '../icons/CubeIcon';
import ArchiveBoxArrowDownIcon from '../icons/ArchiveBoxArrowDownIcon';
import TableTemplate from './TableTemplate';
import InboxIcon from '../icons/InboxIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';
import BuildingOfficeIcon from '../icons/BuildingOfficeIcon';
import ArrowUturnLeftIcon from '../icons/ArrowUturnLeftIcon';
import DocumentPlusIcon from '../icons/DocumentPlusIcon';
import ClipboardDocumentListIcon from '../icons/ClipboardDocumentListIcon';
import Modal from '../Modal';
import ManageBackordersView from './ManageBackordersView';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import ArrowPathIcon from '../icons/ArrowPathIcon';
import ClockIcon from '../icons/ClockIcon';
import ManualStatusEditModal from './ManualStatusEditModal';
import { RequisitionPrintView } from '../RequisitionDashboard';

interface ManageRequisitionsViewProps {
  user: User;
  requisitions: Requisition[];
  departments: Department[];
  allProducts: Product[];
  inventory: InventoryItem[];
  backorders: BackOrderItem[];
  onDataChange: () => void;
  onViewPickingList?: (requisition: Requisition, isPreview: boolean) => void;
  onOpenCreateForDeptModal?: (initialPurpose?: 'requisition' | 'loan') => void;
  onOpenReturnModal?: (requisition: Requisition) => void;
  initialSubTab?: string | null;
  initialSearch?: string | null;
  documentSettings: DocumentSettings | null;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value || 0);

type SubTab = 'all' | 'by_dept' | 'backorders';

export const ManageRequisitionsView: React.FC<ManageRequisitionsViewProps> = (props) => {
    const { requisitions, departments, allProducts, inventory, backorders, onDataChange, onViewPickingList, onOpenCreateForDeptModal, onOpenReturnModal, initialSubTab, documentSettings } = props;
    
    const [activeSubTab, setActiveSubTab] = useState<SubTab>((initialSubTab as SubTab) || 'all');
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [requisitionToPrint, setRequisitionToPrint] = useState<Requisition | null>(null);
    const [editingStatusReq, setEditingStatusReq] = useState<Requisition | null>(null);
    const [selectedReqForModal, setSelectedReqForModal] = useState<Requisition | null>(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => { setCurrentPage(1); }, [searchTerm, deptFilter, statusFilter, monthFilter, activeSubTab]);

    useEffect(() => {
        if (requisitionToPrint) {
            const timer = setTimeout(() => {
                window.print();
            }, 1000);
            const handleAfterPrint = () => setRequisitionToPrint(null);
            window.addEventListener('afterprint', handleAfterPrint, { once: true });
            return () => {
                clearTimeout(timer);
                window.removeEventListener('afterprint', handleAfterPrint);
            };
        }
    }, [requisitionToPrint]);

    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    const inventoryMap = useMemo(() => new Map(inventory.map(i => [i.productId, i.quantity])), [inventory]);

    const filteredRequisitions = useMemo(() => {
        return (requisitions || []).filter(r => {
            const matchesSearch = (r.requisitionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   departmentMap.get(r.departmentId)?.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesDept = deptFilter === 'all' || r.departmentId === deptFilter;
            const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
            
            let matchesMonth = true;
            if (monthFilter !== 'all') {
                const date = new Date(r.createdAt);
                const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                matchesMonth = monthYear === monthFilter;
            }

            return matchesSearch && matchesDept && matchesStatus && matchesMonth;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [requisitions, searchTerm, deptFilter, statusFilter, monthFilter, departmentMap]);

    const paginatedRequisitions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredRequisitions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredRequisitions, currentPage]);

    const totalPages = Math.ceil(filteredRequisitions.length / ITEMS_PER_PAGE);

    const monthOptions = useMemo(() => {
        const months = new Set<string>();
        (requisitions || []).forEach(r => {
            const date = new Date(r.createdAt);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthYear);
        });
        return Array.from(months).sort().reverse().map(m => {
            const [year, month] = m.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const label = date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            return { value: m, label };
        });
    }, [requisitions]);

    return (
        <div className="space-y-6">
            {requisitionToPrint && (
                <RequisitionPrintView 
                    requisition={{...requisitionToPrint, departmentName: departmentMap.get(requisitionToPrint.departmentId)}} 
                    productMap={productMap} 
                    documentSettings={documentSettings} 
                />
            )}

            <div className="no-print">
                <div className="border-b border-slate-200 dark:border-slate-700 mb-2">
                    <nav className="-mb-px flex space-x-8">
                        <button onClick={() => setActiveSubTab('all')} className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeSubTab === 'all' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <ClipboardDocumentListIcon className="w-5 h-5" />
                            ใบเบิกทั้งหมด
                        </button>
                        <button onClick={() => setActiveSubTab('backorders')} className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeSubTab === 'backorders' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <ArchiveBoxArrowDownIcon className="w-5 h-5" />
                            รายการค้างจ่าย
                        </button>
                    </nav>
                </div>

                {activeSubTab === 'all' ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ค้นหา</label>
                                <div className="relative">
                                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                    <input type="text" placeholder="เลขที่, ชื่อใบเบิก, หน่วยงาน..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-slate-700 focus:ring-2 focus:ring-sky-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">เดือน</label>
                                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700 outline-none">
                                    <option value="all">ทุกเดือน</option>
                                    {monthOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">หน่วยงาน</label>
                                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700 outline-none">
                                    <option value="all">ทุกหน่วยงาน</option>
                                    {departments.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">สถานะ</label>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700 outline-none">
                                    <option value="all">ทุกสถานะ</option>
                                    {Object.entries(requisitionStatusMap).map(([key, val]) => (<option key={key} value={key}>{(val as any).warehouseText || (val as any).text}</option>))}
                                </select>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden mt-6">
                            {/* Desktop Table View */}
                            <div className="hidden md:block">
                                <TableTemplate headers={[
                                    {name: 'เลขที่', className: 'w-24'}, 
                                    'ชื่อใบเบิก/หน่วยงาน', 
                                    {name: 'มูลค่าที่ขอ', className: 'text-right w-32'}, 
                                    {name: 'มูลค่าอนุมัติ (V2)', className: 'text-right w-32 text-sky-600 font-bold'}, 
                                    {name: 'สถานะ', className: 'text-center w-40'}, 
                                    {name: 'ดำเนินการ', className: 'text-right w-36'}
                                ]}>
                                    {paginatedRequisitions.map(req => {
                                        const statusConfig = requisitionStatusMap[req.status] || { text: 'N/A', color: 'bg-gray-100' };
                                        
                                        let requestedValue = 0;
                                        let approvedValue = 0;
                                        
                                        (req.items || []).forEach(item => {
                                            const product = productMap.get(item.productId);
                                            const price = item.pricePerUnit ?? product?.pricePerUnit ?? 0;
                                            requestedValue += (item.quantity * price);
                                            const showApproved = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
                                            const qty = (showApproved && item.status !== 'Backordered') ? (item.approvedQuantity || 0) : 0;
                                            approvedValue += (qty * price);
                                        });

                                        const canShowApprovedVal = ['Picking', 'Ready', 'Completed', 'PartiallyApproved'].includes(req.status);

                                        return (
                                            <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 border-b dark:border-slate-700 last:border-b-0 transition-colors cursor-pointer" onClick={() => setSelectedReqForModal(req)}>
                                                <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{req.requisitionNumber || '-'}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800 dark:text-slate-100 mb-1 leading-tight">{req.name}</div>
                                                    <div className="text-sm font-bold text-sky-600">{departmentMap.get(req.departmentId)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400 text-sm">{formatCurrency(requestedValue)}</td>
                                                <td className="px-4 py-3 text-right font-black text-sky-700 dark:text-sky-400 text-lg">
                                                    {canShowApprovedVal ? formatCurrency(approvedValue) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => setEditingStatusReq(req)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border shadow-sm ${statusConfig.color}`}>
                                                        {statusConfig.warehouseText || statusConfig.text}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                                        {onViewPickingList && (
                                                            <button onClick={() => onViewPickingList(req, ['Completed', 'Rejected', 'Cancelled'].includes(req.status))} className="text-sky-600 p-1.5 hover:bg-sky-50 dark:hover:bg-sky-900 rounded-full" title="จัดการ/จัดของ">
                                                                <CubeIcon className="w-5 h-5"/>
                                                            </button>
                                                        )}
                                                        <button onClick={() => setRequisitionToPrint(req)} className="text-blue-600 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-full" title="พิมพ์ใบเบิก">
                                                            <PrinterIcon className="w-5 h-5"/>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </TableTemplate>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y dark:divide-slate-700">
                                {paginatedRequisitions.map(req => {
                                    const statusConfig = requisitionStatusMap[req.status] || { text: 'N/A', color: 'bg-gray-100' };
                                    let requestedValue = 0;
                                    let approvedValue = 0;
                                    (req.items || []).forEach(item => {
                                        const product = productMap.get(item.productId);
                                        const price = item.pricePerUnit ?? product?.pricePerUnit ?? 0;
                                        requestedValue += (item.quantity * price);
                                        const showApproved = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
                                        const qty = (showApproved && item.status !== 'Backordered') ? (item.approvedQuantity || 0) : 0;
                                        approvedValue += (qty * price);
                                    });
                                    const canShowApprovedVal = ['Picking', 'Ready', 'Completed', 'PartiallyApproved'].includes(req.status);

                                    return (
                                        <div key={req.id} className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors" onClick={() => setSelectedReqForModal(req)}>
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{req.requisitionNumber || 'ไม่มีเลขที่'}</div>
                                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{req.name}</div>
                                                    <div className="text-xs font-bold text-sky-600">{departmentMap.get(req.departmentId)}</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setEditingStatusReq(req); }} 
                                                    className={`px-2 py-1 rounded-full text-[9px] font-black border shadow-sm uppercase ${statusConfig.color}`}
                                                >
                                                    {statusConfig.warehouseText || statusConfig.text}
                                                </button>
                                            </div>

                                            <div className="flex justify-between items-end pt-1">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] text-slate-400">มูลค่าที่ขอ: {formatCurrency(requestedValue)}</div>
                                                    {canShowApprovedVal && (
                                                        <div className="text-xs font-black text-sky-600">
                                                            อนุมัติ: {formatCurrency(approvedValue)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                    {onViewPickingList && (
                                                        <button onClick={() => onViewPickingList(req, ['Completed', 'Rejected', 'Cancelled'].includes(req.status))} className="bg-sky-50 dark:bg-sky-900/50 text-sky-600 p-2 rounded-lg" title="จัดการ/จัดของ">
                                                            <CubeIcon className="w-4 h-4"/>
                                                        </button>
                                                    )}
                                                    <button onClick={() => setRequisitionToPrint(req)} className="bg-blue-50 dark:bg-blue-900/50 text-blue-600 p-2 rounded-lg" title="พิมพ์ใบเบิก">
                                                        <PrinterIcon className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {totalPages > 1 && (
                                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex items-center justify-between">
                                    <div className="text-sm text-slate-500 font-medium">
                                        แสดงหน้า {currentPage} จาก {totalPages} (ทั้งหมด {filteredRequisitions.length} รายการ)
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-bold shadow-sm"
                                        >
                                            ย้อนกลับ
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-bold shadow-sm"
                                        >
                                            ถัดไป
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <ManageBackordersView 
                        backorders={backorders} 
                        onDataChange={onDataChange} 
                        productMap={productMap} 
                        departmentMap={departmentMap} 
                        inventoryMap={inventoryMap}
                        departments={departments}
                        allProducts={allProducts}
                        onOpenCreateForDeptModal={onOpenCreateForDeptModal}
                    />
                )}
            </div>

            <ManualStatusEditModal isOpen={!!editingStatusReq} onClose={() => setEditingStatusReq(null)} requisition={editingStatusReq} onSave={onDataChange} />

            {/* Modal ดูรายละเอียด (สำหรับ Admin/Warehouse) */}
            {selectedReqForModal && (
                <Modal isOpen={!!selectedReqForModal} onClose={() => setSelectedReqForModal(null)} title="ตรวจสอบใบเบิก" size="3xl">
                     <div className="space-y-6">
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-4">
                            <div>
                                <h3 className="text-xl font-bold">{selectedReqForModal.name}</h3>
                                <p className="text-sm text-slate-500">หน่วยงาน: {departmentMap.get(selectedReqForModal.departmentId)} | #{selectedReqForModal.requisitionNumber || 'Draft'}</p>
                            </div>
                            <button onClick={() => setRequisitionToPrint(selectedReqForModal)} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 shadow-md">
                                <PrinterIcon className="w-5 h-5" /> พิมพ์
                            </button>
                        </div>

                        {(selectedReqForModal.status === 'Rejected' || selectedReqForModal.status === 'Cancelled') && selectedReqForModal.rejectionReason && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
                                <p className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">
                                    เหตุผลที่{selectedReqForModal.status === 'Rejected' ? 'ไม่อนุมัติ' : 'ยกเลิก'}:
                                </p>
                                <p className="text-sm text-red-700 dark:text-red-400">
                                    {selectedReqForModal.rejectionReason}
                                </p>
                            </div>
                        )}

                        <div className="overflow-x-auto border dark:border-slate-700 rounded-xl">
                            <table className="min-w-full text-[10px] sm:text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="p-2 sm:p-4 text-left font-bold text-slate-500 uppercase text-[9px] sm:text-xs">รายการ</th>
                                        <th className="p-2 sm:p-4 text-center font-bold text-slate-500 uppercase text-[9px] sm:text-xs w-16 sm:w-24">ขอเบิก</th>
                                        <th className="p-2 sm:p-4 text-center font-bold text-slate-500 uppercase text-[9px] sm:text-xs w-16 sm:w-24">อนุมัติ</th>
                                        <th className="p-2 sm:p-4 text-right font-bold text-slate-500 uppercase text-[9px] sm:text-xs w-24 sm:w-32">มูลค่าอนุมัติ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {selectedReqForModal.items?.map(item => {
                                        const product = productMap.get(item.productId);
                                        const price = item.pricePerUnit || product?.pricePerUnit || 0;
                                        const approvedQty = ['Picking', 'Ready', 'Completed', 'PartiallyApproved'].includes(selectedReqForModal.status) ? (item.approvedQuantity || 0) : 0;
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50">
                                                <td className="p-2 sm:p-4 font-medium">{product?.name || 'N/A'}</td>
                                                <td className="p-2 sm:p-4 text-center">{item.quantity}</td>
                                                <td className="p-2 sm:p-4 text-center font-bold text-sky-600">{approvedQty}</td>
                                                <td className="p-2 sm:p-4 text-right font-semibold">{formatCurrency(approvedQty * price)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end pt-4">
                             <button onClick={() => setSelectedReqForModal(null)} className="px-6 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">ปิด</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
