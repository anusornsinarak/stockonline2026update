
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Department, Product, Requisition, InventoryItem, productCategories, GoodsReceivedNote, DepartmentType, PurchasePlanItem, SurveyEntry, ProductUsageHistory, DocumentSettings, ProductCategory, departmentTypes } from './types';
import PrinterIcon from './components/icons/PrinterIcon';
import * as XLSX from 'xlsx';
import DownloadIcon from './components/icons/DownloadIcon';
import Modal from './components/Modal';
import StockMovementReportView from './components/admin/StockMovementReportView';
import PurchasePlanPrintView from './components/admin/PurchasePlanPrintView';
import { supabaseService } from './services/supabaseService';
import ArrowUturnLeftIcon from './components/icons/ArrowUturnLeftIcon';

// --- Type definitions & Constants ---
type ReportId = 'usageSummary' | 'inventoryStatus' | 'inventoryValue' | 'priceComparison' | 'receivingSummary' | 'inventoryMovement' | 'crosstabUsage' | 'slowMovingStock' | 'offCycleRequisition' | 'stockMovementSummary' | 'purchasePlan' | 'returns' | 'unplannedPurchases';

interface ReportDefinition {
    id: ReportId;
    name: string;
    description: string;
    needsFiscalYearFilter?: boolean;
    needsDateRangeFilter?: boolean;
    needsDeptTypeFilter?: boolean;
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
        start: new Date(gregorianYearStart, 9, 1),
        end: new Date(gregorianYearEnd, 8, 30, 23, 59, 59),
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
    data?: any;
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
    const [startDate, setStartDate] = useState(toISODateString(startOfMonth));
    const [endDate, setEndDate] = useState(toISODateString(today));
    const [deptTypeFilter, setDeptTypeFilter] = useState<DepartmentType | 'all'>('all');
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
            const submittedAt = req.submittedAt ? new Date(req.submittedAt) : null;
            return ['Completed', 'Ready', 'PartiallyApproved'].includes(req.status) &&
                   submittedAt && submittedAt >= start && submittedAt <= end;
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
                        const approvedQty = item.approvedQuantity || 0;
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
                            if (product && item.approvedQuantity && item.approvedQuantity > 0) {
                                const value = item.approvedQuantity * (item.pricePerUnit ?? product.pricePerUnit ?? 0);
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
            case 'stockMovementSummary': {
                const range = getFiscalYearDateRange(fiscalYearFilter);
                const receivedInPeriod = (goodsReceivedNotes || []).filter(grn => {
                    const receivedDate = new Date(grn.receivedDate);
                    return grn.status === 'Completed' && receivedDate >= range.start && receivedDate <= range.end;
                });
                const disbursedInPeriod = (requisitions || []).filter(req => {
                    const submittedDate = req.submittedAt ? new Date(req.submittedAt) : null;
                    return ['Completed', 'Ready', 'PartiallyApproved'].includes(req.status) && submittedDate && submittedDate >= range.start && submittedDate <= range.end;
                });

                const data: any[] = products.map(p => {
                    const openingBalance = 0;
                    const receivedQty = receivedInPeriod.flatMap(grn => grn.items).filter(item => item.productId === p.id).reduce((sum, item) => sum + item.quantityReceived, 0);
                    const disbursedQty = disbursedInPeriod.flatMap(req => req.items || []).filter(item => item.productId === p.id).reduce((sum, item) => sum + (item.approvedQuantity || 0), 0);
                    const closingBalance = (inventory.find(i => i.productId === p.id)?.quantity || 0);

                    return {
                        productName: p.name,
                        unit: p.unit,
                        openingBalance,
                        receivedInPeriod: receivedQty,
                        totalReceived: openingBalance + receivedQty,
                        disbursedInPeriod: disbursedQty,
                        disbursedValue: disbursedQty * (p.pricePerUnit || 0),
                        closingBalance,
                        pricePerUnit: p.pricePerUnit || 0,
                        closingValue: closingBalance * (p.pricePerUnit || 0),
                    };
                });
                
                setPreviewData([{ id: reportId, title: '', tables: [], data }]);
                return;
            }
            case 'purchasePlan':
                setPreviewData([{ id: reportId, title: 'Purchase Plan', tables: [], data: [] }]);
                return;
            default:
                alert(`Report '${reportId}' is not yet fully implemented.`);
                break;
        }
    };

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
                        <option value="Internal">ภายใน</option>
                        <option value="External">ภายนอก</option>
                    </select>
                </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">ปีงบประมาณ</label>
                    <input type="number" value={fiscalYearFilter} onChange={e => setFiscalYearFilter(Number(e.target.value))} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md"/>
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

            {previewData && (
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
