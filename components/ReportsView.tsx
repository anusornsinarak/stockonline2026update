
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Department, Product, Requisition, InventoryItem, productCategories, GoodsReceivedNote, DepartmentType, PurchasePlanItem, SurveyEntry, ProductUsageHistory, DocumentSettings, ProductCategory, departmentTypes } from '../types';
import PrinterIcon from './icons/PrinterIcon';
import * as XLSX from 'xlsx';
import DownloadIcon from './icons/DownloadIcon';
import Modal from './Modal';
import StockMovementReportView from './admin/StockMovementReportView';
import PurchasePlanPrintView from './admin/PurchasePlanPrintView';
import { supabaseService } from '../services/supabaseService';
import ArrowUturnLeftIcon from './icons/ArrowUturnLeftIcon';

// --- Type definitions & Constants ---
type ReportId = 'usageSummary' | 'inventoryStatus' | 'inventoryValue' | 'priceComparison' | 'receivingSummary' | 'inventoryMovement' | 'crosstabUsage' | 'slowMovingStock' | 'offCycleRequisition' | 'stockMovementSummary' | 'purchasePlan' | 'returns' | 'unplannedPurchases' | 'usageVsPlan' | 'departmentUsageVsPlan';
type DatePreset = 'today' | 'this_month' | 'this_year' | 'custom';

interface ReportDefinition {
    id: ReportId;
    name: string;
    description: string;
    needsFiscalYearFilter?: boolean;
    needsDateRangeFilter?: boolean;
    needsDeptTypeFilter?: boolean;
    needsDepartmentFilter?: boolean;
}

const availableReports: ReportDefinition[] = [
    {
        id: 'usageSummary',
        name: 'รายงานสรุปการเบิกจ่ายเวชภัณฑ์',
        description: 'สรุปมูลค่าการเบิกจ่ายตามหน่วยงานและประเภท สำหรับช่วงเวลาที่เลือก',
        needsDateRangeFilter: true,
        needsDeptTypeFilter: true,
    },
    {
        id: 'departmentUsageVsPlan',
        name: 'รายงานติดตามแผนการใช้จ่ายรายหน่วยงาน',
        description: 'ติดตามและเปรียบเทียบยอดเบิกจ่ายจริงกับแผนความต้องการ (Survey) ของแต่ละหน่วยงาน พร้อมวิเคราะห์รายการนอกแผน',
        needsFiscalYearFilter: true,
        needsDepartmentFilter: true,
    },
    {
        id: 'usageVsPlan',
        name: 'รายงานการเบิกเทียบแผนจัดซื้อ (ภาพรวม)',
        description: 'เปรียบเทียบยอดเบิกจริงกับแผนจัดซื้อรวม พร้อมวิเคราะห์รายการนอกแผน',
        needsFiscalYearFilter: true,
    },
    {
        id: 'crosstabUsage',
        name: 'รายงานสรุปยอดใช้จ่าย (ตารางไขว้)',
        description: 'แสดงมูลค่าการเบิกจ่าย แยกตามหน่วยงาน (แถว) และประเภทเวชภัณฑ์ (คอลัมน์)',
        needsDateRangeFilter: true,
        needsDeptTypeFilter: true,
    },
     {
        id: 'offCycleRequisition',
        name: 'รายงานการเบิกนอกรอบ',
        description: 'สรุปจำนวนครั้งและมูลค่าการเบิกนอกรอบของแต่ละหน่วยงาน สำหรับช่วงเวลาที่เลือก',
        needsDateRangeFilter: true,
    },
    {
        id: 'purchasePlan',
        name: 'รายงานแผนการจัดซื้อประจำปี',
        description: 'แสดงแผนการจัดซื้อที่บันทึกไว้สำหรับปีงบประมาณที่เลือก ในรูปแบบเอกสารทางการ',
        needsFiscalYearFilter: true,
    },
    {
        id: 'unplannedPurchases',
        name: 'รายงานการจัดซื้อนอกแผน / รายการใหม่',
        description: 'แสดงรายการที่มีการจัดซื้อจริงแต่ไม่อยู่ในแผนจัดซื้อ หรือเป็นรายการสินค้าใหม่ที่เพิ่มระหว่างปี',
        needsFiscalYearFilter: true,
    },
    {
        id: 'stockMovementSummary',
        name: 'รายงานบัญชีรับ-จ่าย (ตามฟอร์ม)',
        description: 'สรุปการรับเข้า, จ่ายออก, และยอดคงเหลือของเวชภัณฑ์สำหรับปีงบประมาณที่เลือก',
        needsFiscalYearFilter: true,
    },
    {
        id: 'receivingSummary',
        name: 'รายงานการรับเข้าเวชภัณฑ์',
        description: 'สรุปมูลค่าการรับเข้าตามประเภท สำหรับช่วงเวลาที่เลือก',
        needsDateRangeFilter: true,
    },
    {
        id: 'inventoryMovement',
        name: 'รายงานสรุปความเคลื่อนไหว (รับเข้า-จ่ายออก)',
        description: 'เปรียบเทียบมูลค่ารับเข้าและเบิกจ่ายตามประเภท สำหรับช่วงเวลาที่เลือก',
        needsDateRangeFilter: true,
    },
     {
        id: 'returns',
        name: 'รายงานการรับคืนสินค้า',
        description: 'สรุปรายการรับคืนสินค้าจากหน่วยงาน สำหรับช่วงเวลาที่เลือก',
        needsDateRangeFilter: true,
    },
    {
        id: 'inventoryStatus',
        name: 'รายงานสินค้าคงคลัง',
        description: 'แสดงจำนวนคงคลังล่าสุดของสินค้าทุกรายการ ณ ปัจจุบัน',
    },
     {
        id: 'slowMovingStock',
        name: 'รายงานสินค้าค้างสต็อก (Slow-Moving)',
        description: 'แสดงรายการสินค้าในคลังที่ไม่มีการเบิกจ่ายหรือรับเข้าในช่วง 180 วันที่ผ่านมา',
    },
    {
        id: 'inventoryValue',
        name: 'รายงานมูลค่าคลังสินค้า',
        description: 'คำนวณมูลค่ารวมของสินค้าทั้งหมดที่มีในคลังตามราคาปัจจุบัน',
    },
    {
        id: 'priceComparison',
        name: 'รายงานเปรียบเทียบราคา',
        description: 'แสดงรายการที่มีการเปลี่ยนแปลงราคาระหว่างปีก่อนกับปีปัจจุบัน และผลกระทบต่อการจัดซื้อ',
    },
];


// --- Helper Functions ---
const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('th-TH').format(value);

const getFiscalYear = (date: Date) => {
    return (date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear()) + 543;
};

const getFiscalYearDateRange = (fiscalYearBE: number) => {
    const gregorianYearEnd = fiscalYearBE - 543;
    const gregorianYearStart = gregorianYearEnd - 1;
    return {
        start: new Date(gregorianYearStart, 9, 1), // Oct 1
        end: new Date(gregorianYearEnd, 8, 30, 23, 59, 59), // Sep 30
    };
};

const toISODateString = (date: Date) => {
    return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
};


// --- Print Layout Component ---
interface ReportPrintData {
    id: ReportId;
    title: string;
    summaryStats?: { title: string; value: string }[];
    tables: { title: string; data: any[]; columns: { key: string; label: string; format?: (val: any) => string; className?: string }[] }[];
    data?: any; // For custom reports
}

const ReportPrintLayout: React.FC<{ reports: ReportPrintData[] }> = ({ reports }) => (
    <div className="p-4 font-sarabun">
        {reports.map((report, index) => (
             <section key={report.title} className={`print-section ${index > 0 ? 'page-break-before' : ''}`}>
                <header className="text-center mb-6">
                    <h1 className="text-2xl font-bold">{report.title}</h1>
                    <p className="text-sm text-slate-600">พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</p>
                </header>
                 {report.summaryStats && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {report.summaryStats.map(stat => (
                            <div key={stat.title} className="border border-black p-4 text-center">
                                <h2 className="text-base font-bold text-black">{stat.title}</h2>
                                <p className="text-xl font-bold text-black">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}
                {report.tables.map(tableInfo => (
                    <div key={tableInfo.title} className="mb-6">
                        <h3 className="text-xl font-bold mb-2">{tableInfo.title}</h3>
                        <table className="w-full text-left border-collapse border border-slate-400">
                            <thead>
                                <tr className="bg-slate-100">
                                    {tableInfo.columns.map(col => <th key={col.key} className={`border border-slate-300 p-2 text-sm ${col.className?.includes('text-right') ? 'text-right' : ''}`}>{col.label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {tableInfo.data.length > 0 ? tableInfo.data.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {tableInfo.columns.map(col => (
                                            <td key={col.key} className={`border border-slate-300 p-2 text-sm ${col.className}`}>
                                                {col.format ? col.format(row[col.key]) : row[col.key]}
                                            </td>
                                        ))}
                                    </tr>
                                )) : (
                                     <tr><td colSpan={tableInfo.columns.length} className="text-center py-4 text-slate-500 border border-slate-300">ไม่มีข้อมูล</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ))}
            </section>
        ))}
    </div>
);

// --- Report Preview Modal Component ---
const ReportPreviewModal: React.FC<{
    reports: ReportPrintData[];
    onClose: () => void;
    onPrint: () => void;
    onExport: () => void;
}> = ({ reports, onClose, onPrint, onExport }) => (
    <Modal isOpen={true} onClose={onClose} title="ดูตัวอย่างรายงาน" size="fullscreen" wrapperClassName="print:!p-0">
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 p-4 bg-slate-50 border-b flex justify-between items-center no-print">
                <h3 className="font-semibold">ตัวอย่างก่อนพิมพ์</h3>
                <div className="flex gap-3">
                    <button onClick={onClose} className="bg-slate-200 font-bold py-2 px-4 rounded-lg">ปิด</button>
                    <button onClick={onExport} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg"><DownloadIcon className="w-5 h-5"/> Excel</button>
                    <button onClick={onPrint} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"><PrinterIcon className="w-5 h-5"/> พิมพ์</button>
                </div>
            </div>
            <div className="flex-grow overflow-auto bg-gray-300 p-4">
                <div className="bg-white shadow-lg mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                     <ReportPrintLayout reports={reports} />
                </div>
            </div>
        </div>
    </Modal>
);

interface ReportsViewProps {
    requisitions: Requisition[];
    products: Product[];
    departments: Department[];
    inventory: InventoryItem[];
    goodsReceivedNotes: GoodsReceivedNote[];
    purchasePlan: PurchasePlanItem[];
    surveyResults: SurveyEntry[];
    productUsageHistory: ProductUsageHistory[];
    documentSettings: DocumentSettings | null;
}

export const ReportsView: React.FC<ReportsViewProps> = (props) => {
    const { 
        requisitions = [], 
        products = [], 
        departments = [], 
        inventory = [], 
        goodsReceivedNotes = [], 
        purchasePlan = [], 
        surveyResults = [], 
        productUsageHistory = [], 
        documentSettings 
    } = props;
    
    const [selectedReportId, setSelectedReportId] = useState<ReportId | null>(null);
    const [previewData, setPreviewData] = useState<ReportPrintData[] | null>(null);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    // Adjusted: Default to 1 month ago to show more data initially
    const defaultStartDate = new Date(today);
    defaultStartDate.setMonth(today.getMonth() - 1);
    
    const [startDate, setStartDate] = useState(toISODateString(defaultStartDate));
    const [endDate, setEndDate] = useState(toISODateString(today));
    const [deptTypeFilter, setDeptTypeFilter] = useState<DepartmentType | 'all'>('all');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [fiscalYearFilter, setFiscalYearFilter] = useState<number>(getFiscalYear(today));

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

    const handleBack = () => {
        setPreviewData(null);
    };

    const handlePrint = () => {
        if (previewData) {
            window.print();
        }
    };

    const handleExport = () => {
        if (!previewData || !previewData[0]) return;
        const reportTitle = previewData[0].title;
        
        const wb = XLSX.utils.book_new();

        previewData.forEach(reportSection => {
            reportSection.tables.forEach(table => {
                const dataToExport = table.data.map(row => {
                    const newRow: Record<string, any> = {};
                    table.columns.forEach(col => {
                        const value = row[col.key];
                        // Apply formatting function if it exists and the value is a number, otherwise use raw value
                        const formattedValue = (typeof value === 'number' && col.format) ? col.format(value) : value;
                        newRow[col.label] = formattedValue;
                    });
                    return newRow;
                });
                const ws = XLSX.utils.json_to_sheet(dataToExport);
                const sheetName = table.title.replace(/[\\/*?:"<>|]/g, '').substring(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });
        });

        if (wb.SheetNames.length > 0) {
            XLSX.writeFile(wb, `${reportTitle}.xlsx`);
        } else {
            alert('No data to export.');
        }
    };

    const generateReport = async (reportId: ReportId) => {
        setPreviewData(null);
        
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const filteredReqsByDate = (requisitions || []).filter(req => {
            const dateToUse = req.approvedAt || req.submittedAt || req.createdAt;
            const reportDate = dateToUse ? new Date(dateToUse) : null;
            return ['Completed', 'Ready', 'PartiallyApproved', 'Picking', 'Submitted'].includes(req.status) &&
                   reportDate && reportDate >= start && reportDate <= end;
        });

        const filteredGrnsByDate = (goodsReceivedNotes || []).filter(grn => {
            const receivedAt = new Date(grn.receivedDate);
            return grn.status === 'Completed' && receivedAt >= start && receivedAt <= end;
        });
        
        switch (reportId) {
            case 'usageSummary': {
                const filteredDepts = departments.filter(d => deptTypeFilter === 'all' || d.type === deptTypeFilter);
                const filteredDeptIds = new Set(filteredDepts.map(d => d.id));
    
                const filteredReqs = filteredReqsByDate.filter(req => filteredDeptIds.has(req.departmentId));
    
                const usageData: Record<string, { departmentName: string, values: Record<string, number>, total: number }> = {};
    
                filteredDepts.forEach(dept => {
                    usageData[dept.id] = {
                        departmentName: dept.name,
                        values: productCategories.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {} as Record<string, number>),
                        total: 0
                    };
                });
    
                filteredReqs.forEach(req => {
                    (req.items || []).forEach(item => {
                        const approvedQty = (['Completed', 'Ready'].includes(req.status) && (item.approvedQuantity ?? 0) > 0)
                            ? (item.approvedQuantity || 0)
                            : (item.quantity || 0);

                        if (approvedQty > 0) {
                            const product = productMap.get(item.productId);
                            if (product?.category) {
                                const value = approvedQty * (item.pricePerUnit ?? product.pricePerUnit ?? 0);
                                if (usageData[req.departmentId]) {
                                    usageData[req.departmentId].values[product.category] += value;
                                    usageData[req.departmentId].total += value;
                                }
                            }
                        }
                    });
                });
    
                const tableData = Object.values(usageData).map(deptData => ({
                    departmentName: deptData.departmentName,
                    ...deptData.values,
                    total: deptData.total
                })).sort((a, b) => a.departmentName.localeCompare(b.departmentName, 'th'));
                
                const grandTotals = productCategories.reduce((acc, cat) => ({...acc, [cat]: tableData.reduce((sum, row) => sum + row[cat as ProductCategory], 0) }), {} as Record<string, number>);
                const grandTotalValue = tableData.reduce((sum, row) => sum + row.total, 0);
    
                const totalRow = { departmentName: 'รวมทั้งสิ้น', ...grandTotals, total: grandTotalValue };
                
                const finalTableData = [...tableData, totalRow];
    
                setPreviewData([{
                    id: 'usageSummary',
                    title: `รายงานสรุปการเบิกจ่ายเวชภัณฑ์ (${startDate} - ${endDate})`,
                    tables: [{
                        title: `สรุปตามหน่วยงาน (ประเภท: ${departmentTypes.find(dt => dt.value === deptTypeFilter)?.label || 'ทั้งหมด'})`,
                        columns: [
                            { key: 'departmentName', label: 'หน่วยงาน', className: 'font-bold' },
                            ...productCategories.map(cat => ({ key: cat, label: cat, format: (val: number) => val === 0 ? '-' : formatCurrency(val), className: 'text-right' })),
                            { key: 'total', label: 'รวม', format: (val: number) => formatCurrency(val), className: 'text-right font-bold' },
                        ],
                        data: finalTableData,
                    }],
                }]);
                return;
            }
            case 'usageVsPlan': {
                // 1. Get Plan for the selected fiscal year
                let specificPlan = purchasePlan;
                if (fiscalYearFilter) {
                    try {
                        specificPlan = await supabaseService.getPurchasePlan(fiscalYearFilter);
                    } catch (e) {
                        console.warn("Could not fetch specific plan", e);
                    }
                }
                const planMap = new Map<string, number>(specificPlan.map(p => [p.productId, p.plannedQuantity]));

                // 2. Get Usage (Requisitions) for the fiscal year
                const fiscalYearRange = getFiscalYearDateRange(fiscalYearFilter);
                const reqsInFiscalYear = (requisitions || []).filter(req => {
                    const reportDate = req.approvedAt || req.submittedAt || req.createdAt;
                    return ['Completed', 'Ready', 'PartiallyApproved', 'Picking', 'Submitted'].includes(req.status) &&
                           reportDate && reportDate >= fiscalYearRange.start && reportDate <= fiscalYearRange.end;
                });

                // 3. Aggregate Usage
                const usageMap = new Map<string, number>();
                reqsInFiscalYear.forEach(req => {
                    (req.items || []).forEach(item => {
                        const approvedQty = (['Completed', 'Ready'].includes(req.status) && (item.approvedQuantity ?? 0) > 0)
                            ? (item.approvedQuantity || 0)
                            : (item.quantity || 0);

                        if (approvedQty > 0) {
                            usageMap.set(item.productId, (usageMap.get(item.productId) || 0) + approvedQty);
                        }
                    });
                });

                // 4. Combine Data
                const allProductIds = new Set([...Array.from(planMap.keys()), ...Array.from(usageMap.keys())]);
                const reportData: any[] = [];

                allProductIds.forEach(productId => {
                    const product = productMap.get(productId);
                    if (!product) return;

                    const plannedQty = planMap.get(productId) || 0;
                    const usedQty = usageMap.get(productId) || 0;
                    const diff = usedQty - plannedQty;
                    const percentUsed = plannedQty > 0 ? (usedQty / plannedQty) * 100 : (usedQty > 0 ? 100 : 0);
                    
                    let status = 'ปกติ';
                    if (plannedQty === 0 && usedQty > 0) status = 'ไม่ได้ตั้งแผน';
                    else if (usedQty > plannedQty) status = 'เกินแผน';
                    else if (usedQty >= plannedQty * 0.8) status = 'ใกล้ครบแผน';

                    reportData.push({
                        productName: product.name,
                        category: product.category,
                        plannedQty,
                        usedQty,
                        diff,
                        percentUsed,
                        status,
                        valueUsed: usedQty * (product.pricePerUnit || 0)
                    });
                });

                // Sort by status (critical first) then name
                reportData.sort((a, b) => {
                    const statusOrder: Record<string, number> = { 'ไม่ได้ตั้งแผน': 0, 'เกินแผน': 1, 'ใกล้ครบแผน': 2, 'ปกติ': 3 };
                    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
                    return a.productName.localeCompare(b.productName, 'th');
                });

                setPreviewData([{
                    id: 'usageVsPlan',
                    title: `รายงานการเบิกเทียบแผนจัดซื้อ ปีงบประมาณ ${fiscalYearFilter}`,
                    tables: [{
                        title: 'รายละเอียดรายสินค้า',
                        columns: [
                            { key: 'productName', label: 'รายการ' },
                            { key: 'category', label: 'ประเภท' },
                            { key: 'plannedQty', label: 'แผนจัดซื้อ', format: formatNumber, className: 'text-right' },
                            { key: 'usedQty', label: 'เบิกจริง', format: formatNumber, className: 'text-right' },
                            { key: 'diff', label: 'ส่วนต่าง', format: (v) => (v > 0 ? `+${formatNumber(v)}` : formatNumber(v)), className: 'text-right' },
                            { key: 'percentUsed', label: '% การใช้', format: (v) => `${v.toFixed(1)}%`, className: 'text-right' },
                            { key: 'valueUsed', label: 'มูลค่าเบิก', format: formatCurrency, className: 'text-right' },
                            { key: 'status', label: 'สถานะ' },
                        ],
                        data: reportData,
                    }],
                    summaryStats: [
                        { title: 'มูลค่าเบิกจริงรวม', value: formatCurrency(reportData.reduce((sum, item) => sum + item.valueUsed, 0)) },
                        { title: 'รายการเกินแผน/นอกแผน', value: reportData.filter(i => i.status === 'เกินแผน' || i.status === 'ไม่ได้ตั้งแผน').length.toString() }
                    ]
                }]);
                return;
            }

            case 'departmentUsageVsPlan': {
                // 1. Get Survey Data (Plan) for the fiscal year
                // Note: surveyResults prop might contain all years, need to filter if possible or assume it's relevant
                // Ideally, we should fetch survey results for the specific fiscal year if not already
                // For now, let's use the passed surveyResults and assume they are relevant or filter by year if structure allows.
                // The current SurveyEntry structure doesn't seem to have fiscalYear directly on root, but maybe in ID or we assume current context.
                // Actually, AdminDashboard fetches `surveySubmissions` which are `SurveyEntry[]`.
                // Let's assume `surveyResults` passed here are for the relevant context or we filter.
                
                // If we need to be precise, we might need to fetch survey results for the specific year.
                // Let's try to use what we have, or fetch if needed.
                let relevantSurveys = surveyResults;
                // If SurveyEntry has fiscalYear, filter it. If not, we might be showing mixed data.
                // Looking at types.ts (not visible here but recalled), SurveyEntry usually has fiscalYear.
                // relevantSurveys = surveyResults.filter(s => {
                //     const surveyDate = new Date(s.submittedAt);
                //     const surveyFiscalYear = getFiscalYear(surveyDate);
                //     return surveyFiscalYear === fiscalYearFilter;
                // });
                // FIX: Since survey_submissions table only stores the latest version per department (upsert logic),
                // we should assume the available survey IS the current plan. Filtering by fiscal year based on submission date
                // is risky if the plan was submitted early (e.g. in previous fiscal year) or edited recently.
                relevantSurveys = surveyResults;

                // Filter by department if selected
                if (deptFilter !== 'all') {
                    relevantSurveys = relevantSurveys.filter(s => s.departmentId === deptFilter);
                }

                // 2. Get Usage (Requisitions)
                const fiscalYearRange = getFiscalYearDateRange(fiscalYearFilter);
                let reqsInFiscalYear = (requisitions || []).filter(req => {
                    const reportDate = req.approvedAt || req.submittedAt || req.createdAt;
                    return ['Completed', 'Ready', 'PartiallyApproved', 'Picking', 'Submitted'].includes(req.status) &&
                           reportDate && reportDate >= fiscalYearRange.start && reportDate <= fiscalYearRange.end;
                });

                if (deptFilter !== 'all') {
                    reqsInFiscalYear = reqsInFiscalYear.filter(r => r.departmentId === deptFilter);
                }

                // 3. Build Data Structure
                // Map<DepartmentId, Map<ProductId, { planned: number, used: number }>>
                const dataMap = new Map<string, Map<string, { planned: number, used: number }>>();

                // Process Plan
                relevantSurveys.forEach(survey => {
                    if (!dataMap.has(survey.departmentId)) dataMap.set(survey.departmentId, new Map());
                    const deptProducts = dataMap.get(survey.departmentId)!;
                    
                    Object.entries(survey.quantities).forEach(([productId, details]) => {
                        const qty = (details as any).quantity || 0;
                        if (qty > 0) {
                            if (!deptProducts.has(productId)) deptProducts.set(productId, { planned: 0, used: 0 });
                            deptProducts.get(productId)!.planned += qty;
                        }
                    });
                });

                // Process Usage
                reqsInFiscalYear.forEach(req => {
                    if (!dataMap.has(req.departmentId)) dataMap.set(req.departmentId, new Map());
                    const deptProducts = dataMap.get(req.departmentId)!;

                    (req.items || []).forEach(item => {
                        const approvedQty = (['Completed', 'Ready'].includes(req.status) && (item.approvedQuantity ?? 0) > 0)
                            ? (item.approvedQuantity || 0)
                            : (item.quantity || 0);

                        if (approvedQty > 0) {
                            if (!deptProducts.has(item.productId)) deptProducts.set(item.productId, { planned: 0, used: 0 });
                            deptProducts.get(item.productId)!.used += approvedQty;
                        }
                    });
                });

                // 4. Flatten for Table
                const tableData: any[] = [];
                dataMap.forEach((productsMap, deptId) => {
                    const dept = departmentMap.get(deptId);
                    if (!dept) return;

                    productsMap.forEach((values, productId) => {
                        const product = productMap.get(productId);
                        if (!product) return;

                        const diff = values.used - values.planned;
                        let status = 'ปกติ';
                        if (values.planned === 0 && values.used > 0) status = 'ไม่ได้ตั้งแผน';
                        else if (values.used > values.planned) status = 'เกินแผน';

                        // Only show if there is activity (planned or used)
                        if (values.planned > 0 || values.used > 0) {
                            tableData.push({
                                departmentName: dept.name,
                                productName: product.name,
                                category: product.category,
                                plannedQty: values.planned,
                                usedQty: values.used,
                                diff,
                                valueUsed: values.used * (product.pricePerUnit || 0),
                                status
                            });
                        }
                    });
                });

                // Sort
                tableData.sort((a, b) => {
                    if (a.departmentName !== b.departmentName) return a.departmentName.localeCompare(b.departmentName, 'th');
                    return a.productName.localeCompare(b.productName, 'th');
                });

                setPreviewData([{
                    id: 'departmentUsageVsPlan',
                    title: `รายงานติดตามแผนการใช้จ่ายรายหน่วยงาน ปีงบประมาณ ${fiscalYearFilter}`,
                    tables: [{
                        title: `รายละเอียด ${deptFilter !== 'all' ? departmentMap.get(deptFilter)?.name : 'ทุกหน่วยงาน'}`,
                        columns: [
                            { key: 'departmentName', label: 'หน่วยงาน' },
                            { key: 'productName', label: 'รายการ' },
                            { key: 'plannedQty', label: 'แผน (จำนวน)', format: formatNumber, className: 'text-right' },
                            { key: 'usedQty', label: 'เบิกจริง (จำนวน)', format: formatNumber, className: 'text-right' },
                            { key: 'diff', label: 'ส่วนต่าง', format: (v: number) => (v > 0 ? `+${formatNumber(v)}` : formatNumber(v)), className: 'text-right' },
                            { key: 'valueUsed', label: 'มูลค่าเบิกจริง', format: formatCurrency, className: 'text-right' },
                            { key: 'status', label: 'สถานะ' },
                        ],
                        data: tableData,
                    }],
                    summaryStats: [
                         { title: 'มูลค่าเบิกจริงรวม', value: formatCurrency(tableData.reduce((sum, item) => sum + item.valueUsed, 0)) },
                         { title: 'รายการต้องเฝ้าระวัง (เกิน/นอกแผน)', value: tableData.filter(i => i.status === 'เกินแผน' || i.status === 'ไม่ได้ตั้งแผน').length.toString() }
                    ]
                }]);
                return;
            }

            case 'crosstabUsage': {
                const filteredDepts = departments.filter(d => deptTypeFilter === 'all' || d.type === deptTypeFilter);
                const filteredDeptIds = new Set(filteredDepts.map(d => d.id));
                const relevantReqs = filteredReqsByDate.filter(req => filteredDeptIds.has(req.departmentId));
            
                const crosstabData: Record<string, Record<ProductCategory, number>> = {};
                filteredDepts.forEach(dept => {
                    crosstabData[dept.name] = productCategories.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {} as Record<ProductCategory, number>);
                });
            
                relevantReqs.forEach(req => {
                    const deptName = departmentMap.get(req.departmentId)?.name;
                    if (deptName && crosstabData[deptName]) {
                        (req.items || []).forEach(item => {
                            const product = productMap.get(item.productId);
                            const approvedQty = (['Completed', 'Ready'].includes(req.status) && (item.approvedQuantity ?? 0) > 0)
                                ? (item.approvedQuantity || 0)
                                : (item.quantity || 0);

                            if (product && approvedQty > 0) {
                                const value = approvedQty * (item.pricePerUnit ?? product.pricePerUnit ?? 0);
                                crosstabData[deptName][product.category] += value;
                            }
                        });
                    }
                });
            
                const tableData = Object.entries(crosstabData).map(([departmentName, values]) => ({
                    departmentName,
                    ...values,
                    total: Object.values(values).reduce((sum, v) => sum + v, 0),
                })).sort((a,b) => a.departmentName.localeCompare(b.departmentName, 'th'));
            
                const columnTotals = productCategories.reduce((acc, cat) => ({...acc, [cat]: tableData.reduce((sum, row) => sum + row[cat], 0)}), {} as Record<ProductCategory, number>);
                const grandTotal = tableData.reduce((sum, row) => sum + row.total, 0);

                const totalRow = { departmentName: 'รวม', ...columnTotals, total: grandTotal };
                
                setPreviewData([{
                    id: 'crosstabUsage',
                    title: `รายงานสรุปยอดใช้จ่าย (ตารางไขว้) (${startDate} - ${endDate})`,
                    tables: [{
                        title: `ประเภทหน่วยงาน: ${departmentTypes.find(dt => dt.value === deptTypeFilter)?.label || 'ทั้งหมด'}`,
                        columns: [
                            { key: 'departmentName', label: 'หน่วยงาน', className: 'font-bold' },
                            ...productCategories.map(cat => ({ key: cat, label: cat, format: (val: number) => val === 0 ? '-' : formatCurrency(val), className: 'text-right' })),
                            { key: 'total', label: 'รวม', format: (val: number) => formatCurrency(val), className: 'text-right font-bold' },
                        ],
                        data: [...tableData, totalRow],
                    }],
                }]);
                return;
            }
            case 'offCycleRequisition': {
                const offCycleReqs = filteredReqsByDate.filter(req => req.type === 'OffCycle');
                const dataByDept: Record<string, { departmentName: string, count: number, totalValue: number }> = {};
                
                offCycleReqs.forEach(req => {
                    const deptName = departmentMap.get(req.departmentId)?.name || 'N/A';
                    if (!dataByDept[req.departmentId]) {
                        dataByDept[req.departmentId] = { departmentName: deptName, count: 0, totalValue: 0 };
                    }
                    dataByDept[req.departmentId].count++;
                    const reqValue = (req.items || []).reduce((sum, item) => {
                        const product = productMap.get(item.productId);
                        const approvedQty = item.approvedQuantity ?? item.quantity ?? 0;
                        return sum + approvedQty * (item.pricePerUnit ?? product?.pricePerUnit ?? 0);
                    }, 0);
                    dataByDept[req.departmentId].totalValue += reqValue;
                });

                const tableData = Object.values(dataByDept).sort((a,b) => b.count - a.count);
                setPreviewData([{
                    id: 'offCycleRequisition',
                    title: `รายงานการเบิกนอกรอบ (${startDate} - ${endDate})`,
                    tables: [{
                        title: 'สรุปตามหน่วยงาน',
                        columns: [
                            { key: 'departmentName', label: 'หน่วยงาน' },
                            { key: 'count', label: 'จำนวนครั้ง', className: 'text-right' },
                            { key: 'totalValue', label: 'มูลค่ารวม', format: formatCurrency, className: 'text-right' },
                        ],
                        data: tableData,
                    }],
                }]);
                return;
            }
            case 'unplannedPurchases': {
                // Fetch purchase plan for the specific selected fiscal year
                let specificPlan = purchasePlan;
                if (fiscalYearFilter) {
                    try {
                        specificPlan = await supabaseService.getPurchasePlan(fiscalYearFilter);
                    } catch (e) {
                        console.warn("Could not fetch specific plan, using default prop", e);
                    }
                }
                
                const planMap = new Map<string, number>(specificPlan.map(p => [p.productId, p.plannedQuantity]));
                
                const fiscalYearRange = getFiscalYearDateRange(fiscalYearFilter);
                const grnsInFiscalYear = (goodsReceivedNotes || []).filter(grn => {
                    const receivedDate = new Date(grn.receivedDate);
                    return grn.status === 'Completed' && receivedDate >= fiscalYearRange.start && receivedDate <= fiscalYearRange.end;
                });

                const unplannedDataMap = new Map<string, { productName: string, category: string, quantity: number, value: number, reason: string }>();

                grnsInFiscalYear.forEach(grn => {
                    grn.items.forEach(item => {
                        const product = productMap.get(item.productId);
                        if (!product) return;

                        const plannedQty = planMap.get(item.productId);
                        
                        // Check if item is "New" (Created in this fiscal year)
                        const productCreatedDate = new Date(product.createdAt || new Date(0)); // Assuming createdAt exists on product
                        const isNewItem = productCreatedDate >= fiscalYearRange.start && productCreatedDate <= fiscalYearRange.end;

                        let isUnplanned = false;
                        let reason = '';

                        if (isNewItem) {
                            isUnplanned = true;
                            reason = 'รายการใหม่ (เพิ่มระหว่างปี)';
                        } else if (plannedQty === undefined || plannedQty === 0) {
                            isUnplanned = true;
                            reason = 'ไม่อยู่ในแผนจัดซื้อ';
                        }

                        if (isUnplanned) {
                            const existing = unplannedDataMap.get(item.productId) || { 
                                productName: product.name, 
                                category: product.category, 
                                quantity: 0, 
                                value: 0, 
                                reason 
                            };
                            existing.quantity += item.quantityReceived;
                            existing.value += item.quantityReceived * (item.pricePerUnit ?? product.pricePerUnit ?? 0);
                            // Keep reason, prioritize "New Item" if mixed? Simplification: keep first reason found or specific logic
                            unplannedDataMap.set(item.productId, existing);
                        }
                    });
                });

                const tableData = Array.from(unplannedDataMap.values()).sort((a,b) => a.productName.localeCompare(b.productName, 'th'));

                 setPreviewData([{
                    id: 'unplannedPurchases',
                    title: `รายงานการจัดซื้อนอกแผนและรายการใหม่ ประจำปีงบประมาณ ${fiscalYearFilter}`,
                    tables: [{
                        title: 'รายการสินค้า',
                        columns: [
                            { key: 'productName', label: 'รายการ' },
                            { key: 'category', label: 'ประเภท' },
                            { key: 'quantity', label: 'จำนวนซื้อจริง', className: 'text-right', format: formatNumber },
                            { key: 'value', label: 'มูลค่ารวม', className: 'text-right', format: formatCurrency },
                            { key: 'reason', label: 'สถานะ/หมายเหตุ' },
                        ],
                        data: tableData,
                    }],
                    summaryStats: [
                        { title: 'จำนวนรายการ', value: tableData.length.toString() },
                        { title: 'มูลค่ารวม', value: formatCurrency(tableData.reduce((sum, item) => sum + item.value, 0)) }
                    ]
                }]);
                return;
            }
            case 'receivingSummary': {
                const valueByCategory = productCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<ProductCategory, number>);
                let totalValue = 0;

                filteredGrnsByDate.forEach(grn => {
                    grn.items.forEach(item => {
                        const product = productMap.get(item.productId);
                        if (product) {
                            const value = item.quantityReceived * (product.pricePerUnit || 0);
                            valueByCategory[product.category] += value;
                            totalValue += value;
                        }
                    });
                });
                
                const tableData = productCategories.map(cat => ({ category: cat, value: valueByCategory[cat] }));
                const totalRow = { category: 'รวมทั้งสิ้น', value: totalValue };
                
                setPreviewData([{
                    id: 'receivingSummary',
                    title: `รายงานการรับเข้าเวชภัณฑ์ (${startDate} - ${endDate})`,
                    tables: [{
                        title: 'สรุปตามประเภท',
                        columns: [
                            { key: 'category', label: 'ประเภท', className: 'font-bold' },
                            { key: 'value', label: 'มูลค่ารวม', format: formatCurrency, className: 'text-right font-bold' },
                        ],
                        data: [...tableData, totalRow],
                    }],
                }]);
                return;
            }
            case 'inventoryMovement': {
                const valueIn = productCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<ProductCategory, number>);
                filteredGrnsByDate.forEach(grn => {
                    grn.items.forEach(item => {
                        const product = productMap.get(item.productId);
                        if (product) {
                            valueIn[product.category] += item.quantityReceived * (product.pricePerUnit || 0);
                        }
                    });
                });

                const valueOut = productCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<ProductCategory, number>);
                filteredReqsByDate.forEach(req => {
                    (req.items || []).forEach(item => {
                        const product = productMap.get(item.productId);
                        const approvedQty = item.approvedQuantity ?? item.quantity ?? 0;
                        if (product && approvedQty > 0) {
                            valueOut[product.category] += approvedQty * (item.pricePerUnit ?? product.pricePerUnit ?? 0);
                        }
                    });
                });
                
                const tableData = productCategories.map(cat => ({
                    category: cat,
                    valueIn: valueIn[cat],
                    valueOut: valueOut[cat],
                    netChange: valueIn[cat] - valueOut[cat],
                }));

                setPreviewData([{
                    id: 'inventoryMovement',
                    title: `รายงานสรุปความเคลื่อนไหว (${startDate} - ${endDate})`,
                    tables: [{
                        title: 'เปรียบเทียบมูลค่า รับเข้า-จ่ายออก',
                        columns: [
                            { key: 'category', label: 'ประเภท' },
                            { key: 'valueIn', label: 'มูลค่ารับเข้า', format: formatCurrency, className: 'text-right' },
                            { key: 'valueOut', label: 'มูลค่าจ่ายออก', format: formatCurrency, className: 'text-right' },
                            { key: 'netChange', label: 'เปลี่ยนแปลงสุทธิ', format: formatCurrency, className: 'text-right' },
                        ],
                        data: tableData,
                    }],
                }]);
                return;
            }
            case 'inventoryStatus': {
                const tableData = products.map(p => ({
                    name: p.name,
                    category: p.category,
                    unit: p.unit,
                    quantity: inventory.find(i => i.productId === p.id)?.quantity || 0,
                })).sort((a,b) => a.name.localeCompare(b.name, 'th'));
                
                setPreviewData([{
                    id: 'inventoryStatus',
                    title: `รายงานสินค้าคงคลัง ณ วันที่ ${today.toLocaleDateString('th-TH')}`,
                    tables: [{
                        title: 'ยอดคงคลังทั้งหมด',
                        columns: [
                            { key: 'name', label: 'รายการ' },
                            { key: 'category', label: 'ประเภท' },
                            { key: 'unit', label: 'หน่วย' },
                            { key: 'quantity', label: 'จำนวนคงคลัง', format: formatNumber, className: 'text-right' },
                        ],
                        data: tableData,
                    }],
                }]);
                return;
            }
            case 'slowMovingStock': {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - 180);
            
                const lastTxDateMap = new Map<string, Date>();
                
                (requisitions || []).forEach(req => {
                    const reportDate = req.approvedAt || req.submittedAt || req.createdAt;
                    if (reportDate) {
                        const txDate = reportDate;
                        (req.items || []).forEach(item => {
                            const currentLastDate = lastTxDateMap.get(item.productId);
                            if (!currentLastDate || txDate > currentLastDate) {
                                lastTxDateMap.set(item.productId, txDate);
                            }
                        });
                    }
                });
                
                (goodsReceivedNotes || []).forEach(grn => {
                    const txDate = new Date(grn.receivedDate);
                    grn.items.forEach(item => {
                        const currentLastDate = lastTxDateMap.get(item.productId);
                        if (!currentLastDate || txDate > currentLastDate) {
                            lastTxDateMap.set(item.productId, txDate);
                        }
                    });
                });
            
                const slowMovingItems = inventory
                    .filter(invItem => invItem.quantity > 0)
                    .map(invItem => {
                        const lastTx = lastTxDateMap.get(invItem.productId);
                        return {
                            product: productMap.get(invItem.productId),
                            quantity: invItem.quantity,
                            lastTxDate: lastTx,
                        };
                    })
                    .filter(item => !item.lastTxDate || item.lastTxDate < cutoffDate);
            
                const tableData = slowMovingItems.map(item => ({
                    name: item.product?.name,
                    quantity: item.quantity,
                    lastTx: item.lastTxDate ? item.lastTxDate.toLocaleDateString('th-TH') : 'ไม่มีประวัติ',
                }));

                setPreviewData([{
                    id: 'slowMovingStock',
                    title: 'รายงานสินค้าค้างสต็อก (ไม่มีความเคลื่อนไหว > 180 วัน)',
                    tables: [{
                        title: 'รายการสินค้า',
                        columns: [
                            { key: 'name', label: 'รายการ' },
                            { key: 'quantity', label: 'จำนวนคงคลัง', format: formatNumber, className: 'text-right' },
                            { key: 'lastTx', label: 'เคลื่อนไหวล่าสุด' },
                        ],
                        data: tableData,
                    }],
                }]);
                return;
            }
            case 'inventoryValue': {
                const valueByCategory = productCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<ProductCategory, number>);
                let totalValue = 0;

                inventory.forEach(item => {
                    const product = productMap.get(item.productId);
                    if (product) {
                        const value = item.quantity * (product.pricePerUnit || 0);
                        valueByCategory[product.category] += value;
                        totalValue += value;
                    }
                });

                const tableData = productCategories.map(cat => ({ category: cat, value: valueByCategory[cat] }));
                const totalRow = { category: 'รวมทั้งสิ้น', value: totalValue };
                
                setPreviewData([{
                    id: 'inventoryValue',
                    title: `รายงานมูลค่าคลังสินค้า ณ วันที่ ${today.toLocaleDateString('th-TH')}`,
                    tables: [{
                        title: 'มูลค่าตามประเภท',
                        columns: [
                            { key: 'category', label: 'ประเภท', className: 'font-bold' },
                            { key: 'value', label: 'มูลค่ารวม', format: formatCurrency, className: 'text-right font-bold' },
                        ],
                        data: [...tableData, totalRow],
                    }],
                }]);
                return;
            }
            case 'priceComparison': {
                const changedItems = products.filter(p => 
                    p.pricePerUnit != null && 
                    p.previousPricePerUnit != null && 
                    p.pricePerUnit !== p.previousPricePerUnit
                );

                const tableData = changedItems.map(p => {
                    const change = (p.pricePerUnit || 0) - (p.previousPricePerUnit || 0);
                    const pctChange = (p.previousPricePerUnit || 0) === 0 ? Infinity : (change / (p.previousPricePerUnit || 1)) * 100;
                    const impact = change * (p.lastYearUsage || 0);
                    return {
                        name: p.name,
                        prevPrice: p.previousPricePerUnit,
                        currPrice: p.pricePerUnit,
                        change,
                        pctChange,
                        impact,
                    };
                });
                
                setPreviewData([{
                    id: 'priceComparison',
                    title: 'รายงานเปรียบเทียบราคา',
                    tables: [{
                        title: 'รายการที่มีการเปลี่ยนแปลงราคา',
                        columns: [
                            { key: 'name', label: 'รายการ' },
                            { key: 'prevPrice', label: 'ราคาเดิม', format: formatCurrency, className: 'text-right' },
                            { key: 'currPrice', label: 'ราคาใหม่', format: formatCurrency, className: 'text-right' },
                            { key: 'change', label: 'เปลี่ยนแปลง', format: formatCurrency, className: 'text-right' },
                            { key: 'pctChange', label: '% เปลี่ยนแปลง', format: v => `${v.toFixed(2)}%`, className: 'text-right' },
                            { key: 'impact', label: 'ผลกระทบ (โดยประมาณ)', format: formatCurrency, className: 'text-right' },
                        ],
                        data: tableData,
                    }],
                }]);
                return;
            }
            case 'stockMovementSummary': {
                const range = getFiscalYearDateRange(fiscalYearFilter);
                const now = new Date();
                
                // 1. Get transactions in the period for the report table
                const receivedInPeriod = (goodsReceivedNotes || []).filter(grn => {
                    const receivedDate = new Date(grn.receivedDate);
                    return grn.status === 'Completed' && receivedDate >= range.start && receivedDate <= range.end;
                });
                const disbursedInPeriod = (requisitions || []).filter(req => {
                    const reportDate = req.approvedAt || req.submittedAt || req.createdAt;
                    return ['Completed', 'Ready', 'PartiallyApproved', 'Picking', 'Submitted'].includes(req.status) && reportDate && reportDate >= range.start && reportDate <= range.end;
                });

                // 2. To calculate opening balance at range.start, we need all transactions from range.start to NOW
                // OpeningBalance = CurrentStock - (ReceivedSinceStart) + (DisbursedSinceStart)
                const receivedSinceStart = (goodsReceivedNotes || []).filter(grn => {
                    const receivedDate = new Date(grn.receivedDate);
                    return grn.status === 'Completed' && receivedDate >= range.start && receivedDate <= now;
                });
                const disbursedSinceStart = (requisitions || []).filter(req => {
                    const reportDate = req.approvedAt || req.submittedAt || req.createdAt;
                    return ['Completed', 'Ready', 'PartiallyApproved', 'Picking', 'Submitted'].includes(req.status) && reportDate && reportDate >= range.start && reportDate <= now;
                });

                const tableData: any[] = products.map(p => {
                    const currentStock = (inventory.find(i => i.productId === p.id)?.quantity || 0);
                    
                    const receivedQtySinceStart = receivedSinceStart.flatMap(grn => grn.items)
                        .filter(item => item.productId === p.id)
                        .reduce((sum, item) => sum + item.quantityReceived, 0);
                        
                    const disbursedQtySinceStart = disbursedSinceStart.flatMap(req => {
                        const status = req.status;
                        return (req.items || []).filter(item => item.productId === p.id).map(item => ({...item, status}));
                    }).reduce((sum, item) => {
                        const approvedQty = (['Completed', 'Ready'].includes(item.status) && (item.approvedQuantity ?? 0) > 0)
                            ? (item.approvedQuantity || 0)
                            : (item.quantity || 0);
                        return sum + approvedQty;
                    }, 0);

                    const openingBalance = Math.max(0, currentStock - receivedQtySinceStart + disbursedQtySinceStart);
                    
                    const receivedQtyInPeriod = receivedInPeriod.flatMap(grn => grn.items)
                        .filter(item => item.productId === p.id)
                        .reduce((sum, item) => sum + item.quantityReceived, 0);
                        
                    const disbursedQtyInPeriod = disbursedInPeriod.flatMap(req => {
                        const status = req.status;
                        return (req.items || []).filter(item => item.productId === p.id).map(item => ({...item, status}));
                    }).reduce((sum, item) => {
                        const approvedQty = (['Completed', 'Ready'].includes(item.status) && (item.approvedQuantity ?? 0) > 0)
                            ? (item.approvedQuantity || 0)
                            : (item.quantity || 0);
                        return sum + approvedQty;
                    }, 0);

                    // Closing balance at range.end
                    // If range.end is in the future, it's current stock
                    // If range.end is in the past, it's OpeningBalance + ReceivedInPeriod - DisbursedInPeriod
                    const closingBalance = range.end > now ? currentStock : (openingBalance + receivedQtyInPeriod - disbursedQtyInPeriod);

                    return {
                        productName: p.name,
                        unit: p.unit,
                        openingBalance,
                        receivedInPeriod: receivedQtyInPeriod,
                        totalReceived: openingBalance + receivedQtyInPeriod,
                        disbursedInPeriod: disbursedQtyInPeriod,
                        disbursedValue: disbursedQtyInPeriod * (p.pricePerUnit || 0),
                        closingBalance,
                        pricePerUnit: p.pricePerUnit || 0,
                        closingValue: closingBalance * (p.pricePerUnit || 0),
                    };
                }).sort((a, b) => a.productName.localeCompare(b.productName, 'th'));
                
                setPreviewData([{ id: reportId, title: `รายงานบัญชีรับ-จ่าย ปีงบประมาณ ${fiscalYearFilter}`, tables: [], data: tableData }]);
                return;
            }
            case 'purchasePlan':
                // Special handling for purchase plan view
                setPreviewData([{ id: reportId, title: 'Purchase Plan', tables: [], data: [] }]); // Dummy data to trigger the view switch
                return;

            case 'returns': {
                const returnedNotes = (goodsReceivedNotes || []).filter(grn => {
                    const receivedDate = new Date(grn.receivedDate);
                    return grn.sourceType === 'Return' && grn.status === 'Completed' && receivedDate >= start && receivedDate <= end;
                });
                
                const returnData = returnedNotes.flatMap(grn => 
                    grn.items.map(item => {
                        const product = productMap.get(item.productId);
                        // Extract original department from notes if possible
                        const deptMatch = grn.notes?.match(/หน่วยงาน: (.*?)\)/);
                        const departmentName = deptMatch ? deptMatch[1] : 'ไม่ระบุ';
                        return {
                            date: new Date(grn.receivedDate).toLocaleDateString('th-TH'),
                            department: departmentName,
                            product: product?.name || 'N/A',
                            quantity: item.quantityReceived,
                            unit: product?.unit || '-',
                            notes: grn.notes
                        };
                    })
                );

                const report: ReportPrintData = {
                    id: 'returns',
                    title: `รายงานการรับคืนสินค้า (${startDate} - ${endDate})`,
                    tables: [{
                        title: 'รายการรับคืน',
                        columns: [
                            { key: 'date', label: 'วันที่รับคืน' },
                            { key: 'department', label: 'หน่วยงาน' },
                            { key: 'product', label: 'รายการ' },
                            { key: 'quantity', label: 'จำนวน', className: 'text-right' },
                            { key: 'unit', label: 'หน่วย' },
                            { key: 'notes', label: 'หมายเหตุ' },
                        ],
                        data: returnData,
                    }],
                };
                setPreviewData([report]);
                return;
            }

            default:
                alert(`Report '${reportId}' is not yet fully implemented.`);
                break;
        }
    };

    // Render special reports
    if (previewData?.[0]?.id === 'stockMovementSummary') {
        return <StockMovementReportView data={previewData[0].data} fiscalYear={fiscalYearFilter} onBack={handleBack} />;
    }
    
    if (previewData?.[0]?.id === 'purchasePlan') {
        const planData = purchasePlan.map(item => {
            const product = productMap.get(item.productId);
            const surveyData = surveyResults.flatMap(sr => Object.entries(sr.quantities).map(([pid, details]) => ({productId: pid, qty: (details as any).quantity })));
            const surveyQty = surveyData.filter(sd => sd.productId === item.productId).reduce((sum, sd) => sum + sd.qty, 0);

            return {
                product: product!,
                plannedQty: item.plannedQuantity,
                currentStock: inventory.find(i => i.productId === item.productId)?.quantity || 0,
                plannedValue: item.plannedQuantity * (product?.pricePerUnit || 0),
                totalQuantity: surveyQty,
                usageHistory: productUsageHistory.filter(uh => uh.productId === item.productId).reduce((acc, uh) => { acc[uh.fiscalYear] = uh.totalQuantity; return acc; }, {} as Record<number, number>)
            };
        }).filter(item => item.product);

        return (
            <div className="flex flex-col h-full">
                <div className="flex-shrink-0 p-4 bg-slate-50 border-b flex justify-between items-center no-print">
                    <div className="flex items-center gap-2">
                        <button onClick={handleBack} className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold py-2 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 transition-colors">
                            <ArrowUturnLeftIcon className="w-5 h-5"/> กลับ
                        </button>
                        <span className="font-semibold text-slate-700">ตัวอย่างรายงานแผนการจัดซื้อ</span>
                    </div>
                    <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"><PrinterIcon className="w-5 h-5"/> พิมพ์</button>
                </div>
                <div className="flex-grow overflow-auto bg-gray-300 p-4">
                     <div className="bg-white shadow-lg mx-auto p-8" style={{ width: '210mm', minHeight: '297mm' }}>
                        <PurchasePlanPrintView planData={planData} fiscalYear={fiscalYearFilter} documentSettings={documentSettings} />
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">รายงาน</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 border dark:border-slate-600 rounded-lg">
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">ตั้งแต่</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">ถึง</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">ประเภทหน่วยงาน</label>
                    <select value={deptTypeFilter} onChange={e => setDeptTypeFilter(e.target.value as any)} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md">
                        <option value="all">ทั้งหมด</option>
                        {/* FIX: Ensure departmentTypes is properly typed/handled. Assuming it's an array of {value, label} */}
                        {[{value: 'Internal', label: 'ภายใน'}, {value: 'External', label: 'ภายนอก'}].map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">ปีงบประมาณ</label>
                    <input type="number" value={fiscalYearFilter} onChange={e => setFiscalYearFilter(Number(e.target.value))} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">เลือกหน่วยงาน</label>
                    <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md">
                        <option value="all">ทุกหน่วยงาน</option>
                        {departments.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableReports.map((report) => (
                    <div key={report.id} className="p-4 border dark:border-slate-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-slate-800/50">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{report.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 h-12">{report.description}</p>
                        <button
                            onClick={() => generateReport(report.id)}
                            className="mt-3 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                            สร้างรายงาน
                        </button>
                    </div>
                ))}
            </div>

            {previewData && previewData[0].id === 'stockMovementSummary' && (
                <div className="fixed inset-0 z-50 bg-slate-100 overflow-auto">
                    <StockMovementReportView 
                        data={previewData[0].data as any} 
                        fiscalYear={fiscalYearFilter} 
                        onBack={() => setPreviewData(null)} 
                    />
                </div>
            )}

            {previewData && previewData[0].id === 'purchasePlan' && (
                <div className="fixed inset-0 z-50 bg-slate-100 overflow-auto">
                    <PurchasePlanPrintView 
                        items={purchasePlan} 
                        fiscalYear={fiscalYearFilter} 
                        onBack={() => setPreviewData(null)} 
                    />
                </div>
            )}

            {previewData && previewData[0].id !== 'stockMovementSummary' && previewData[0].id !== 'purchasePlan' && (
                <ReportPreviewModal
                    reports={previewData}
                    onClose={() => setPreviewData(null)}
                    onPrint={handlePrint}
                    onExport={handleExport}
                />
            )}
        </div>
    );
};
