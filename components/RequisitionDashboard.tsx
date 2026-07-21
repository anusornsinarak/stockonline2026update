
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Department, Product, Requisition, RequisitionItem, RequisitionStatus, requisitionStatusMap, InventoryItem, DocumentSettings, Personnel, ExpiringStockItem, requisitionItemStatusMap, DepartmentInventoryItem } from '../types';
import { supabaseService } from '../services/supabaseService';
import PlusIcon from './icons/PlusIcon';
import InboxIcon from './icons/InboxIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import PrinterIcon from './icons/PrinterIcon';
import AutomatedRequisitionForm from './department/AutomatedRequisitionForm';
import CalculatorIcon from './icons/CalculatorIcon';
import TrashIcon from './icons/TrashIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';
import EditIcon from './icons/EditIcon';
import ClipboardDocumentListIcon from './icons/ClipboardDocumentListIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CurrencyDollarIcon from './icons/CurrencyDollarIcon';
import ClockIcon from './icons/ClockIcon';
import LoadingScreen from './LoadingScreen';
import DocumentPlusIcon from './icons/DocumentPlusIcon';
import CalendarDaysIcon from './icons/CalendarDaysIcon';

const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value || 0);

type ViewMode = 'list' | 'form' | 'edit_form';

export const RequisitionPrintView: React.FC<{
    requisitions?: Requisition[];
    requisition?: Partial<Requisition>;
    productMap: Map<string, Product>;
    documentSettings: DocumentSettings | null;
    departmentName?: string;
    personnel?: Personnel[];
}> = ({ requisitions, requisition, productMap, documentSettings, departmentName, personnel }) => {
    const list = requisitions || (requisition ? [requisition as Requisition] : []);
    if (list.length === 0) return null;

    return (
        <div className="print-only font-sarabun text-black bg-white">
            {list.map((req, reqIndex) => {
                const requesterSignature = null; // personnel?.find(p => p.name === req.requesterName)?.signatureImage;
                const items = req.items || [];
                const isProcessed = req.status && ['Picking', 'Ready', 'PartiallyApproved', 'Completed'].includes(req.status);

                const getApprovedQty = (item: RequisitionItem) => {
                    if (item.approvedQuantity !== null && item.approvedQuantity !== undefined) return item.approvedQuantity;
                    if (['Backordered', 'Rejected'].includes(item.status || '')) return 0;
                    return isProcessed ? 0 : item.quantity;
                };

                let grandTotal = 0;

                return (
                    <div key={req.id} className={`${reqIndex > 0 ? 'page-break-before' : ''} p-8 flex flex-col`}>
                        {/* Header Section */}
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold mb-4">ใบเบิกเวชภัณฑ์มิใช่ยา {req.status === 'Draft' ? '(ฉบับร่าง)' : ''}</h2>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="text-left">
                                    <p>เลขที่: <span className="font-bold">{req.requisitionNumber || (req.status === 'Draft' ? 'ฉบับร่าง' : '....................')}</span></p>
                                    <p>ชื่อใบเบิก: <span className="font-bold">{req.name}</span></p>
                                </div>
                                <div className="text-center">
                                    <p>หน่วยงาน: <span className="font-bold">{req.departmentName || departmentName || '........................................................'}</span></p>
                                </div>
                                <div className="text-right">
                                    <p>วันที่เบิก: <span className="font-bold">{new Date(req.createdAt || Date.now()).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                                </div>
                            </div>
                        </div>

                        { (req.status === 'Rejected' || req.status === 'Cancelled') && req.rejectionReason && (
                            <div className="mb-6 p-4 border-2 border-red-200 bg-red-50 rounded-xl no-print-bg">
                                <p className="text-sm font-bold text-red-800 mb-1">เหตุผลที่{req.status === 'Rejected' ? 'ไม่อนุมัติ' : 'ยกเลิก'}:</p>
                                <p className="text-sm text-red-700 leading-relaxed">{req.rejectionReason}</p>
                            </div>
                        )}

                        <table className="w-full text-left border-collapse border border-black mb-8">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-2 text-center w-[5%] text-xs font-bold">ลำดับ</th>
                                    <th className="border border-black p-2 text-center w-[45%] text-xs font-bold">รายการคุณลักษณะเฉพาะ</th>
                                    <th className="border border-black p-2 text-center w-[10%] text-xs font-bold">หน่วยนับ</th>
                                    <th className="border border-black p-2 text-center w-[8%] text-xs font-bold">ขอเบิก</th>
                                    <th className="border border-black p-2 text-center w-[8%] text-xs font-bold">อนุมัติ</th>
                                    <th className="border border-black p-2 text-center w-[10%] text-xs font-bold">ราคา/หน่วย</th>
                                    <th className="border border-black p-2 text-center w-[14%] text-xs font-bold">ราคารวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length > 0 ? items.map((item, index) => {
                                    const product = productMap.get(item.productId);
                                    const price = item.pricePerUnit ?? product?.pricePerUnit ?? 0;
                                    const approvedQty = getApprovedQty(item);
                                    const lineTotal = (isProcessed ? approvedQty : item.quantity) * price;
                                    grandTotal += lineTotal;

                                    return (
                                        <tr key={item.productId || index}>
                                            <td className="border border-black p-1 text-center text-xs">{index + 1}</td>
                                            <td className="border border-black p-1 text-xs leading-tight">
                                                {product?.name || 'N/A'}
                                                {item.status === 'Backordered' && <span className="font-bold text-red-600 ml-1">(ค้างจ่าย)</span>}
                                                {item.status === 'Loaned' && <span className="font-bold text-blue-600 ml-1">(ยืม)</span>}
                                            </td>
                                            <td className="border border-black p-1 text-center text-xs">{product?.unit || '-'}</td>
                                            <td className="border border-black p-1 text-center text-xs font-bold">{(item.quantity || 0).toLocaleString()}</td>
                                            <td className="border border-black p-1 text-center text-xs font-bold text-blue-800">
                                                {isProcessed ? approvedQty.toLocaleString() : '-'}
                                            </td>
                                            <td className="border border-black p-1 text-right text-xs">{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="border border-black p-1 text-right text-xs">{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={7} className="border border-black p-4 text-center text-xs">ไม่มีรายการเวชภัณฑ์</td></tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold bg-gray-50">
                                    <td colSpan={6} className="border border-black p-1 text-right text-xs">รวมเป็นเงินทั้งสิ้น</td>
                                    <td className="border border-black p-1 text-right text-xs">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="mt-8 break-inside-avoid">
                            <table className="w-full border-none no-border-table">
                                <tbody>
                                    <tr className="border-none">
                                        <td className="w-1/2 pb-16 text-center align-top border-none p-0">
                                            <div className="flex flex-col items-center">
                                                {requesterSignature ? (
                                                    <img src={requesterSignature} alt="Signature" className="h-12 object-contain mb-2" />
                                                ) : (
                                                    <p className="text-sm mb-6">(ลงชื่อ)........................................................</p>
                                                )}
                                                <p className="font-bold text-sm">({req.requesterName || '........................................................'})</p>
                                                <p className="text-xs mt-1">{req.requesterPosition || '........................................................'}</p>
                                                <p className="text-sm mt-1">ผู้เบิก</p>
                                            </div>
                                        </td>
                                        <td className="w-1/2 pb-16 text-center align-top border-none p-0">
                                            <div className="flex flex-col items-center">
                                                <p className="text-sm mb-6">(ลงชื่อ)........................................................</p>
                                                <p className="font-bold text-sm">({documentSettings?.documentIssuerName || '........................................................'})</p>
                                                <p className="text-xs mt-1">{documentSettings?.documentIssuerPosition || '........................................................'}</p>
                                                <p className="text-sm mt-1">ผู้จ่าย</p>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr className="border-none">
                                        <td className="w-1/2 text-center align-top border-none p-0">
                                            <div className="flex flex-col items-center">
                                                <p className="text-sm mb-6">(ลงชื่อ)........................................................</p>
                                                <p className="font-bold text-sm">({documentSettings?.documentDisbursementApproverName || '........................................................'})</p>
                                                <p className="text-xs mt-1">{documentSettings?.documentDisbursementApproverPosition || '........................................................'}</p>
                                                <p className="text-sm mt-1">ผู้อนุมัติเบิกจ่าย</p>
                                            </div>
                                        </td>
                                        <td className="w-1/2 text-center align-top border-none p-0">
                                            <div className="flex flex-col items-center">
                                                <p className="text-sm mb-6">(ลงชื่อ)........................................................</p>
                                                <p className="font-bold text-sm">({documentSettings?.documentReceiverName || '........................................................'})</p>
                                                <p className="text-xs mt-1">{documentSettings?.documentReceiverPosition || '........................................................'}</p>
                                                <p className="text-sm mt-1">ผู้รับเวชภัณฑ์</p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* LINE Notification QR Code Section */}
                        <div className="mt-8 break-inside-avoid border-t border-dashed border-gray-300 pt-6">
                            <div className="flex items-center gap-6">
                                <div className="flex-shrink-0 bg-white p-2 border border-gray-200 rounded-lg">
                                    <QRCodeCanvas 
                                        value={`https://line.me/R/oaMessage/@369jbtdm/?${encodeURIComponent('เชื่อมต่อ:' + (req.departmentName || departmentName || ''))}`}
                                        size={100}
                                        level="H"
                                    />
                                </div>
                                <div className="flex-grow">
                                    <h4 className="text-sm font-bold text-slate-800 mb-1">สแกนเพื่อรับการแจ้งเตือนผ่าน LINE</h4>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        สแกน QR Code นี้เพื่อเพิ่มเพื่อน LINE Official Account และส่งข้อความที่ระบุเพื่อเชื่อมต่อหน่วยงานของคุณ 
                                        คุณจะได้รับการแจ้งเตือนเมื่อสถานะใบเบิกมีการเปลี่ยนแปลง (เช่น อนุมัติแล้ว, พร้อมรับของ)
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-2 italic">
                                        * เมื่อสแกนแล้ว กรุณากด "ส่ง" ข้อความที่ปรากฏในช่องแชททันทีเพื่อยืนยันหน่วยงาน
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const RequisitionListPrintView: React.FC<{
    requisitionsToPrint: Requisition[];
    departmentName: string;
    startMonth: number | 'all';
    endMonth: number | 'all';
    selectedYear: number | 'all';
    summaryStats: any;
    productMap: Map<string, Product>;
}> = ({ requisitionsToPrint, departmentName, startMonth, endMonth, selectedYear, summaryStats, productMap }) => {
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    
    const printFooter = (
        <footer className="mt-12 grid grid-cols-3 gap-x-16 gap-y-8 text-sm print-avoid-break">
            <div className="print-signature-box col-start-2">
                <div className="h-10"></div>
                <p>(........................................................)</p>
                <p>ผู้ตรวจสอบ</p>
            </div>
        </footer>
    );

    return (
        <div className="print-only p-8 font-sarabun">
            <div className="print-page-footer"></div>
            <div className="print-section">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold">รายงานสรุปการเบิกจ่าย</h2>
                    <p className="text-base">หน่วยงาน: {departmentName}</p>
                    <p className="text-base">
                        {startMonth === 'all' && endMonth === 'all' 
                            ? 'ทุกเดือน ' 
                            : `ตั้งแต่เดือน ${(startMonth === 'all' ? 'มกราคม' : monthNames[startMonth as number - 1])} ถึง ${(endMonth === 'all' ? 'ธันวาคม' : monthNames[endMonth as number - 1])} `}
                        {selectedYear === 'all' ? 'ทุกปี' : `ปี ${selectedYear as number + 543}`}
                    </p>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
                    <div className="border border-black p-2 text-center">
                        <p className="font-semibold">จำนวนใบเบิก</p>
                        <p className="font-bold text-lg">{summaryStats.countThisMonth.toLocaleString()} ใบ</p>
                    </div>
                    <div className="border border-black p-2 text-center">
                        <p className="font-semibold">ยอดเบิกจ่ายเดือนนี้</p>
                        <p className="font-bold text-lg">{summaryStats.valueThisMonth.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                    </div>
                    <div className="border border-black p-2 text-center">
                        <p className="font-semibold">ยอดรออนุมัติ</p>
                        <p className="font-bold text-lg">{summaryStats.pendingValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                    </div>
                     <div className="border border-black p-2 text-center">
                        <p className="font-semibold">ยอดเบิกจ่ายปีงบประมาณ</p>
                        <p className="font-bold text-lg">{summaryStats.valueThisFiscalYear.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                    </div>
                </div>
                <table className="w-full text-left border-collapse border border-slate-400 print-table-requisition">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="border border-slate-300 p-2 text-sm text-center">เลขที่</th>
                            <th className="border border-slate-300 p-2 text-sm">ชื่อใบเบิก</th>
                            <th className="border border-slate-300 p-2 text-sm text-center">วันที่สร้าง</th>
                            <th className="border border-slate-300 p-2 text-sm text-center">สถานะ</th>
                            <th className="border border-slate-300 p-2 text-sm text-right">มูลค่าที่อนุมัติ (บาท)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requisitionsToPrint.map(req => {
                            const statusInfo = requisitionStatusMap[req.status] || { text: 'N/A' };
                            const approvedValue = (req.items || []).reduce((sum, item) => {
                                const product = productMap.get(item.productId);
                                const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? product?.pricePerUnit ?? 0;
                                const isProcessed = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
                                if (isProcessed) {
                                    if (['Rejected'].includes(item.status as string)) {
                                        return sum;
                                    }
                                    const qty = (item.approvedQuantity !== null && item.approvedQuantity !== undefined) 
                                        ? item.approvedQuantity 
                                        : item.quantity;
                                    return sum + (qty * price);
                                }
                                return sum;
                            }, 0);
                            return (
                                <tr key={req.id}>
                                    <td className="border border-slate-300 p-2 text-sm text-center">{req.requisitionNumber || 'Draft'}</td>
                                    <td className="border border-slate-300 p-2 text-sm">{req.name}</td>
                                    <td className="border border-slate-300 p-2 text-sm text-center">{new Date(req.createdAt).toLocaleDateString('th-TH')}</td>
                                    <td className="border border-slate-300 p-2 text-sm text-center">{statusInfo.text}</td>
                                    <td className="border border-slate-300 p-2 text-sm text-right font-semibold">{approvedValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {printFooter}
            </div>
        </div>
    );
};


interface RequisitionDashboardProps {
    department: Department;
    isRequisitionOpen: boolean;
    documentSettings: DocumentSettings | null;
    personnel: Personnel[];
    onNavigateToSettings?: () => void;
    nextFiscalYearBE: number;
}

const RequisitionDashboard: React.FC<RequisitionDashboardProps> = ({ department, isRequisitionOpen, documentSettings, personnel, onNavigateToSettings, nextFiscalYearBE }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [requisitionToPrint, setRequisitionToPrint] = useState<Partial<Requisition> | null>(null);
    const [isPrintingReport, setIsPrintingReport] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editingReq, setEditingReq] = useState<Requisition | null>(null);
    const [extraData, setExtraData] = useState<{
        inventory: InventoryItem[];
        expiringStock: ExpiringStockItem[];
        surveyData: any;
        deptProducts: Product[];
        deptInventory: DepartmentInventoryItem[];
        activeAnnouncement?: { content: string; enabled: boolean; id: string | null; isOffCycleWeek?: boolean; } | null;
    } | null>(null);
    const [isLoadingForm, setIsLoadingForm] = useState(false);
    const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

    const handleEditRequisition = async (req: Requisition) => {
        setEditingReq(req);
        await prepareFormData();
    };

    // จัดการการพิมพ์
    useEffect(() => {
        if (requisitionToPrint || isPrintingReport) {
            const timer = setTimeout(() => {
                window.print();
            }, 1000);
            
            const handleAfterPrint = () => {
                setRequisitionToPrint(null);
                setIsPrintingReport(false);
            };
            
            window.addEventListener('afterprint', handleAfterPrint, { once: true });
            
            return () => {
                clearTimeout(timer);
                window.removeEventListener('afterprint', handleAfterPrint);
            };
        }
    }, [requisitionToPrint, isPrintingReport]);

    const REQUISITIONS_PER_PAGE = 5;

    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const [startMonth, setStartMonth] = useState<number | 'all'>('all');
    const [endMonth, setEndMonth] = useState<number | 'all'>('all');
    const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear, currentYear - 1, currentYear - 2];
    }, []);

    const filteredRequisitions = useMemo(() => {
        return requisitions.filter(r => {
            // Use approvedAt for completed requisitions, otherwise createdAt
            const reqDate = (r.status === 'Completed' && r.approvedAt) ? new Date(r.approvedAt) : new Date(r.createdAt);
            const matchYear = selectedYear === 'all' || reqDate.getFullYear() === selectedYear;
            const reqMonth = reqDate.getMonth() + 1;
            const matchStartMonth = startMonth === 'all' || reqMonth >= startMonth;
            const matchEndMonth = endMonth === 'all' || reqMonth <= endMonth;
            return matchYear && matchStartMonth && matchEndMonth;
        }).sort((a,b) => {
            if (a.requisitionNumber && b.requisitionNumber) {
                const numCompare = b.requisitionNumber.localeCompare(a.requisitionNumber, undefined, {numeric: true});
                if (numCompare !== 0) return numCompare;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [requisitions, startMonth, endMonth, selectedYear]);

    const summaryStats = useMemo(() => {
        const calculateApprovedValue = (req: Requisition): number => {
            return (req.items || []).reduce((sum, item) => {
                const product = productMap.get(item.productId);
                const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? product?.pricePerUnit ?? 0;
                const isProcessed = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
                
                if (isProcessed) {
                    if (item.status === 'Rejected') return sum;
                    // จุดสำคัญ: ต้องคำนวณแบบเดียวกันเป๊ะกับ Admin
                    const qty = (item.approvedQuantity !== null && item.approvedQuantity !== undefined) 
                        ? item.approvedQuantity 
                        : item.quantity;
                    return sum + (qty * price);
                }
                return sum;
            }, 0);
        };
        const totalValueThisMonth = filteredRequisitions.reduce((sum, req) => sum + calculateApprovedValue(req), 0);
        return { countThisMonth: filteredRequisitions.length, valueThisMonth: totalValueThisMonth, pendingValue: 0, valueThisFiscalYear: totalValueThisMonth };
    }, [filteredRequisitions, productMap]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [reqs, aProducts] = await Promise.all([
                supabaseService.getRequisitionsForDepartment(department.id),
                supabaseService.getProducts()
            ]);
            setRequisitions(reqs);
            setAllProducts(aProducts);
        } catch (err) { setError("ไม่สามารถโหลดข้อมูลได้"); } finally { setIsLoading(false); }
    }, [department.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleExpand = (reqId: string) => {
        setExpandedReqs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(reqId)) newSet.delete(reqId); else newSet.add(reqId);
            return newSet;
        });
    };

    const handleConfirmReceive = async (req: Requisition) => {
        const name = prompt("กรุณาระบุชื่อผู้รับของ:", "");
        if (!name) return;

        try {
            await supabaseService.confirmRequisitionReceipt(req.id, name);
            alert("บันทึกการรับของเรียบร้อย");
            fetchData(); 
        } catch (e) {
            alert('เกิดข้อผิดพลาดในการบันทึกสถานะ');
        }
    };
    
    const handleDeleteRequisition = async (req: Requisition) => {
        if (!['Draft', 'Submitted'].includes(req.status)) return;
        if (!window.confirm('คุณต้องการยกเลิกใบเบิกนี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;

        try {
            await supabaseService.deleteRequisition(req.id);
            fetchData();
        } catch (error) {
            alert('ลบไม่สำเร็จ');
        }
    };

    const prepareFormData = async () => {
        setIsLoadingForm(true);
        try {
            const [inventory, expiringStock, surveyData, deptProducts, deptInventory, activeAnnouncement] = await Promise.all([
                supabaseService.getInventory(),
                supabaseService.getExpiringStock(),
                supabaseService.getSurveyForDepartment(department.id, nextFiscalYearBE),
                supabaseService.getProductsForDepartment(department.id),
                supabaseService.getDepartmentInventory(department.id),
                supabaseService.getAnnouncementSettings()
            ]);
            setExtraData({ inventory, expiringStock, surveyData, deptProducts, deptInventory, activeAnnouncement: activeAnnouncement as any });
            setIsCreating(true);
        } catch (e) {
            console.error(e);
            alert('ไม่สามารถเตรียมข้อมูลสำหรับสร้างใบเบิกได้');
        } finally {
            setIsLoadingForm(false);
        }
    };

    const checkPendingRequisitions = () => {
        const pendingReqs = requisitions.filter(r => ['Draft', 'Submitted', 'PartiallyApproved', 'Picking', 'Ready'].includes(r.status));
        if (pendingReqs.length > 0) {
            alert('คุณมีใบเบิกที่ยังดำเนินการไม่เสร็จสิ้น (แบบร่าง, รออนุมัติ, กำลังจัดของ, หรือรอรับของ)\n\nกรุณาดำเนินการหรือรับของในใบเบิกก่อนหน้าให้เรียบร้อยก่อนสร้างใบเบิกใหม่ เพื่อป้องกันการเบิกซ้ำซ้อน');
            return false;
        }
        return true;
    };

    const handleCreateClick = () => {
        if (!checkPendingRequisitions()) return;
        prepareFormData();
    };

    const toggleSelectReq = (reqId: string) => {
        setSelectedReqIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(reqId)) newSet.delete(reqId); else newSet.add(reqId);
            return newSet;
        });
    };

    const handlePrintSelected = () => {
        if (selectedReqIds.size === 0) {
            alert('กรุณาเลือกใบเบิกที่ต้องการพิมพ์');
            return;
        }
        setIsPrintingReport(true);
    };

    const [reportType, setReportType] = useState<'list' | 'summary'>('list');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');

    const productUsageSummary = useMemo(() => {
        const summaryMap = new Map<string, { quantity: number; value: number }>();
        
        filteredRequisitions.forEach(req => {
            const isProcessed = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
            if (!isProcessed) return;

            (req.items || []).forEach(item => {
                if (item.status === 'Rejected') return;
                if (selectedProductId !== 'all' && item.productId !== selectedProductId) return;

                const product = productMap.get(item.productId);
                const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? product?.pricePerUnit ?? 0;
                const qty = (item.approvedQuantity !== null && item.approvedQuantity !== undefined) 
                    ? item.approvedQuantity 
                    : item.quantity;
                
                const existing = summaryMap.get(item.productId) || { quantity: 0, value: 0 };
                summaryMap.set(item.productId, {
                    quantity: existing.quantity + qty,
                    value: existing.value + (qty * price)
                });
            });
        });

        return Array.from(summaryMap.entries()).map(([productId, data]) => ({
            productId,
            ...data,
            product: productMap.get(productId)
        })).sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || '', 'th'));
    }, [filteredRequisitions, productMap, selectedProductId]);

    const summaryTotalValue = useMemo(() => {
        return productUsageSummary.reduce((sum, item) => sum + item.value, 0);
    }, [productUsageSummary]);

    if (isLoading) return <LoadingScreen message="กำลังโหลดข้อมูล..." />;

    if (isCreating && extraData) {
        return (
            <AutomatedRequisitionForm
                department={department}
                isRequisitionOpen={isRequisitionOpen}
                onCancel={() => { setIsCreating(false); setEditingReq(null); }}
                onSaveSuccess={() => { setIsCreating(false); setEditingReq(null); fetchData(); }}
                allProducts={allProducts}
                initialDeptProducts={extraData.deptProducts}
                initialSurveyQuantities={extraData.surveyData?.quantities || {}}
                expiringStock={extraData.expiringStock}
                inventoryMap={new Map(extraData.inventory.map(i => [i.productId, i.quantity]))}
                pendingRequisitions={requisitions.filter(r => ['Submitted', 'PartiallyApproved', 'Picking'].includes(r.status))}
                personnel={personnel}
                requisitionHistory={requisitions}
                requisitionType={(extraData.activeAnnouncement?.isOffCycleWeek && department.type !== 'External') ? "OffCycle" : "Normal"}
                deptInventory={extraData.deptInventory}
                initialRequisition={editingReq}
            />
        );
    }

    return (
        <div className="max-w-5xl mx-auto bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg">
            {isLoadingForm && <LoadingScreen message="กำลังเตรียมแบบฟอร์ม..." />}
            {requisitionToPrint && <RequisitionPrintView requisition={requisitionToPrint} productMap={productMap} departmentName={department.name} documentSettings={documentSettings} personnel={personnel}/>}
            {isPrintingReport && (
                <RequisitionListPrintView 
                    requisitionsToPrint={selectedReqIds.size > 0 
                        ? requisitions.filter(r => selectedReqIds.has(r.id)) 
                        : filteredRequisitions
                    } 
                    departmentName={department.name} 
                    startMonth={startMonth}
                    endMonth={endMonth}
                    selectedYear={selectedYear} 
                    summaryStats={summaryStats} 
                    productMap={productMap}
                />
            )}
            
            <div className={requisitionToPrint || isPrintingReport ? 'no-print' : ''}>
                
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">รายการใบเบิก</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">จัดการและติดตามสถานะการเบิกเวชภัณฑ์ของหน่วยงาน</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={handleCreateClick}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-3 px-8 rounded-2xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-500/30 active:scale-95"
                        >
                            <DocumentPlusIcon className="w-5 h-5" />
                            สร้างใบเบิกใหม่
                        </button>
                    </div>
                </div>

                {/* Monthly Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ใบเบิกเดือนนี้</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{summaryStats.countThisMonth}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">มูลค่ารวมเดือนนี้</p>
                        <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{formatCurrency(summaryStats.valueThisMonth)}</p>
                    </div>
                    <button 
                        onClick={onNavigateToSettings}
                        className="col-span-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl p-4 flex items-center gap-4 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all text-left group"
                    >
                        <div className="flex-shrink-0 bg-white p-2 rounded-xl shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                            <QRCodeCanvas 
                                value={`https://line.me/R/oaMessage/@369jbtdm/?${encodeURIComponent('เชื่อมต่อ:' + (department.name || ''))}`}
                                size={80}
                                level="H"
                            />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                รับแจ้งเตือนผ่าน LINE
                            </h4>
                            <p className="text-[11px] text-emerald-800/70 dark:text-emerald-300/70 leading-tight mt-1">
                                คลิกที่นี่เพื่อไปที่หน้าตั้งค่าและเชื่อมต่อการแจ้งเตือน
                            </p>
                        </div>
                    </button>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col gap-4 mb-6 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-600">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                                <button 
                                    onClick={() => setReportType('list')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${reportType === 'list' ? 'bg-white dark:bg-slate-700 text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    รายการใบเบิก
                                </button>
                                <button 
                                    onClick={() => setReportType('summary')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${reportType === 'summary' ? 'bg-white dark:bg-slate-700 text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    สรุปการเบิกรายเวชภัณฑ์
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {reportType === 'list' && selectedReqIds.size > 0 && (
                                <button 
                                    onClick={handlePrintSelected}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                                >
                                    <PrinterIcon className="w-5 h-5" />
                                    <span className="text-sm">พิมพ์ ({selectedReqIds.size})</span>
                                </button>
                            )}
                            <div className="flex items-center gap-1">
                                <select 
                                    value={startMonth} 
                                    onChange={(e) => setStartMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className="flex-1 sm:flex-none p-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="all">ตั้งแต่เดือน</option>
                                    {monthNames.map((m, idx) => (
                                        <option key={idx} value={idx + 1}>{m}</option>
                                    ))}
                                </select>
                                <span className="text-slate-500">-</span>
                                <select 
                                    value={endMonth} 
                                    onChange={(e) => setEndMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className="flex-1 sm:flex-none p-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="all">ถึงเดือน</option>
                                    {monthNames.map((m, idx) => (
                                        <option key={idx} value={idx + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="flex-1 sm:flex-none p-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="all">ทุกปี</option>
                                {yearOptions.map(y => (
                                    <option key={y} value={y}>{y + 543}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {reportType === 'summary' && (
                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ค้นหารายการ:</span>
                            <div className="relative flex-grow w-full">
                                <select 
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                    className="w-full p-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 outline-none focus:ring-2 focus:ring-sky-500 appearance-none"
                                >
                                    <option value="all">แสดงทุกรายการ</option>
                                    {Array.from(new Set(filteredRequisitions.flatMap(r => (r.items || []).map(i => i.productId))))
                                        .map(pid => {
                                            const p = productMap.get(pid);
                                            return <option key={pid} value={pid}>{p?.name || pid}</option>;
                                        })
                                        .sort((a, b) => (a.props.children as string).localeCompare(b.props.children as string, 'th'))
                                    }
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                    <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {reportType === 'list' ? (
                        filteredRequisitions.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 dark:text-slate-400 border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                <InboxIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-lg font-medium">ไม่พบรายการใบเบิกในเดือนนี้</p>
                                <button onClick={handleCreateClick} className="mt-4 text-sky-600 hover:underline">สร้างใบเบิกใหม่</button>
                            </div>
                        ) : (
                            filteredRequisitions.slice((currentPage-1)*REQUISITIONS_PER_PAGE, currentPage*REQUISITIONS_PER_PAGE).map(req => {
                        const isExpanded = expandedReqs.has(req.id);
                        const statusInfo = requisitionStatusMap[req.status] || { text: 'N/A', color: 'bg-gray-200' };
                        
                        let requestedVal = 0;
                        let approvedVal = 0;

                        const isProcessed = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);

                        (req.items || []).forEach(item => {
                            const product = productMap.get(item.productId);
                            const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? product?.pricePerUnit ?? 0;
                            
                            // ขอเบิก
                            requestedVal += (item.quantity * price);

                            // อนุมัติ
                            if (isProcessed) {
                                if (item.status === 'Rejected') return;
                                const qty = (item.approvedQuantity !== null && item.approvedQuantity !== undefined) 
                                    ? item.approvedQuantity 
                                    : item.quantity;
                                approvedVal += (qty * price);
                            }
                        });

                        return (
                            <div key={req.id} className={`bg-white dark:bg-slate-700/50 border ${selectedReqIds.has(req.id) ? 'border-sky-500 ring-1 ring-sky-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md`}>
                                {/* Desktop View */}
                                <div className="hidden md:flex p-4 items-center justify-between gap-4 cursor-pointer" onClick={() => toggleExpand(req.id)}>
                                    <div className="flex gap-4 flex-grow items-start">
                                        <div className="flex items-center h-full pt-1" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedReqIds.has(req.id)} 
                                                onChange={() => toggleSelectReq(req.id)}
                                                className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-shrink-0 w-28 font-bold text-slate-400 text-sm">
                                            #{req.requisitionNumber || 'Draft'}
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">{req.name}</p>
                                            </div>
                                            <div className="text-sm font-bold text-sky-600 dark:text-sky-400 leading-tight mb-2">
                                                {department.name}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                                                <span className="text-slate-400">ขอเบิก: {formatCurrency(requestedVal)}</span>
                                                {approvedVal > 0 && <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">อนุมัติแล้ว: {formatCurrency(approvedVal)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 flex-shrink-0 self-center">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>
                                        {req.status === 'Ready' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleConfirmReceive(req); }}
                                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-1 animate-pulse"
                                            >
                                                <CheckCircleIcon className="w-4 h-4" />
                                                ยืนยันรับของ
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setRequisitionToPrint(req); }} className="text-slate-400 hover:text-blue-500">
                                            <PrinterIcon className="w-5 h-5"/>
                                        </button>
                                        {['Draft', 'Submitted'].includes(req.status) && (
                                            <button onClick={(e) => { e.stopPropagation(); handleEditRequisition(req); }} className="text-amber-500 hover:text-amber-700 p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        {['Draft', 'Submitted'].includes(req.status) && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteRequisition(req); }} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-slate-400" /> : <ChevronDownIcon className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden p-4 cursor-pointer" onClick={() => toggleExpand(req.id)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedReqIds.has(req.id)} 
                                                    onChange={() => toggleSelectReq(req.id)}
                                                    className="w-5 h-5 rounded border-slate-300 text-sky-600"
                                                />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">#{req.requisitionNumber || 'Draft'}</span>
                                                <p className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">{req.name}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full shadow-sm ${statusInfo.color}`}>{statusInfo.text}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1 h-4 bg-sky-500 rounded-full"></div>
                                        <p className="text-xs font-bold text-sky-600">{department.name}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <p className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">ยอดขอเบิก</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatCurrency(requestedVal)}</p>
                                        </div>
                                        {approvedVal > 0 && (
                                            <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded-lg border border-green-100 dark:border-green-900/30">
                                                <p className="text-[9px] text-green-500 uppercase font-bold mb-0.5">ยอดอนุมัติ</p>
                                                <p className="text-xs font-bold text-green-600 dark:text-green-400">{formatCurrency(approvedVal)}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            {req.status === 'Ready' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleConfirmReceive(req); }}
                                                    className="bg-green-600 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-md animate-pulse flex items-center gap-1"
                                                >
                                                    <CheckCircleIcon className="w-3.5 h-3.5" />
                                                    รับของ
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setRequisitionToPrint(req); }} className="text-slate-400 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <PrinterIcon className="w-5 h-5"/>
                                            </button>
                                            {['Draft', 'Submitted'].includes(req.status) && (
                                                <button onClick={(e) => { e.stopPropagation(); handleEditRequisition(req); }} className="text-amber-500 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                                                    <EditIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
                                            {isExpanded ? 'ปิดรายละเอียด' : 'ดูรายละเอียด'}
                                            {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-slate-600 p-4 bg-slate-50/30 dark:bg-slate-900/10">
                                        {(req.status === 'Rejected' || req.status === 'Cancelled') && req.rejectionReason && (
                                            <div className="mb-4 p-3 border border-red-200 bg-red-50/50 rounded-lg">
                                                <p className="text-xs font-bold text-red-800 mb-1">เหตุผลที่{req.status === 'Rejected' ? 'ไม่อนุมัติ' : 'ยกเลิก'}:</p>
                                                <p className="text-sm text-red-700">{req.rejectionReason}</p>
                                            </div>
                                        )}
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-[10px] sm:text-sm">
                                                <thead className="text-slate-500 font-bold uppercase text-[9px] sm:text-[10px]">
                                                    <tr>
                                                        <th className="p-2 text-left">รายการ</th>
                                                        <th className="p-2 text-center w-20">ขอเบิก</th>
                                                        <th className="p-2 text-center w-20">อนุมัติ</th>
                                                        <th className="p-2 text-center w-24">สถานะ</th>
                                                        <th className="p-2 text-right w-28">มูลค่า (บาท)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-slate-700">
                                                    {req.items?.map(item => {
                                                        const product = productMap.get(item.productId);
                                                        const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? product?.pricePerUnit ?? 0;
                                                        
                                                        // Determine issued qty
                                                        let issuedQty = item.quantity;
                                                        if (isProcessed) {
                                                            if (item.status === 'Rejected') {
                                                                issuedQty = 0;
                                                            } else {
                                                                issuedQty = (item.approvedQuantity !== null && item.approvedQuantity !== undefined) 
                                                                    ? item.approvedQuantity 
                                                                    : item.quantity;
                                                            }
                                                        }

                                                        // if (isProcessed && item.status === 'Rejected') return null;
                                                        
                                                        const rowValue = issuedQty * price;
                                                        return (
                                                            <tr key={item.id} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                                                <td className="p-2 font-medium text-slate-700 dark:text-slate-300">
                                                                    {product?.name || 'N/A'}
                                                                    {item.status === 'Backordered' && (
                                                                        <div className="text-[9px] text-orange-500 font-bold mt-0.5 flex items-center gap-1">
                                                                            <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                                                                            เบิกใหม่รอบหน้า
                                                                        </div>
                                                                    )}
                                                                    {item.status === 'Rejected' && item.rejectReason && (
                                                                        <div className="text-[10px] text-red-500 mt-0.5">
                                                                            เหตุผล: {item.rejectReason}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="p-2 text-center text-slate-400">{item.quantity}</td>
                                                                <td className={`p-2 text-center font-bold ${issuedQty > 0 ? 'text-sky-600' : 'text-slate-300'}`}>{issuedQty}</td>
                                                                <td className="p-2 text-center">
                                                                    {item.status === 'Backordered' && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">ค้างจ่าย</span>}
                                                                    {item.status === 'Loaned' && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">ยืม</span>}
                                                                    {item.status === 'Rejected' && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">ไม่อนุมัติ</span>}
                                                                    {isProcessed && item.status === 'Approved' && issuedQty > 0 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">จ่ายแล้ว</span>}
                                                                </td>
                                                                <td className="p-2 text-right font-semibold">{rowValue.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">รายการเวชภัณฑ์</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">หน่วย</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">จำนวนที่เบิก (รวม)</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">มูลค่ารวม (บาท)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {productUsageSummary.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-10 text-center text-slate-500">ไม่พบข้อมูลสรุปการเบิก</td>
                                            </tr>
                                        ) : (
                                            productUsageSummary.map(item => (
                                                <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-800 dark:text-slate-100">{item.product?.name || 'N/A'}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {item.productId}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-400">
                                                        {item.product?.unit || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 font-black text-sm">
                                                            {(item.quantity || 0).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-200">
                                                        {formatCurrency(item.value)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {productUsageSummary.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-t-2 border-slate-200 dark:border-slate-600 font-black">
                                                <td colSpan={3} className="px-6 py-4 text-right text-slate-800 dark:text-slate-100 uppercase tracking-wider">มูลค่ารวมทั้งสิ้น</td>
                                                <td className="px-6 py-4 text-right text-sky-600 dark:text-sky-400 text-lg">
                                                    {formatCurrency(summaryTotalValue)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {reportType === 'list' && filteredRequisitions.length > REQUISITIONS_PER_PAGE && (
                        <div className="mt-6 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-sm text-slate-500 font-medium">
                                หน้า {currentPage} จาก {Math.ceil(filteredRequisitions.length / REQUISITIONS_PER_PAGE)} (ทั้งหมด {filteredRequisitions.length} รายการ)
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
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredRequisitions.length / REQUISITIONS_PER_PAGE), prev + 1))}
                                    disabled={currentPage === Math.ceil(filteredRequisitions.length / REQUISITIONS_PER_PAGE)}
                                    className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-bold shadow-sm"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RequisitionDashboard;
