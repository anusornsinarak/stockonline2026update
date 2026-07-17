
import React, { useMemo, useState, useEffect } from 'react';
import { Product, ProductCategory, productCategories, Requisition } from '../../types';
import * as XLSX from 'xlsx';
import DownloadIcon from '../icons/DownloadIcon';
import PrinterIcon from '../icons/PrinterIcon';
import TableTemplate from './TableTemplate';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import CurrencyDollarIcon from '../icons/CurrencyDollarIcon';
import { getFiscalYearBE } from '../../utils';

const exportToExcel = (data: any[], fileName: string, sheetName: string = "Sheet1") => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

interface SummaryViewProps {
    data: { product: Product, totalQuantity: number, totalValue: number }[];
    requisitions: Requisition[];
    fiscalYear: number;
    budget: number | null;
    isLoadingBudget: boolean;
    onBudgetChange: () => void;
    isReadOnly?: boolean;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ data, requisitions, fiscalYear, budget, isLoadingBudget, onBudgetChange, isReadOnly }) => {
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');
    const [isSavingBudget, setIsSavingBudget] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
     useEffect(() => {
        if (budget !== null) {
            setBudgetInput(String(budget));
        } else {
            setBudgetInput('');
        }
    }, [budget]);

    const formatNumber = (num: number) => {
        return num.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    const filteredData = useMemo(() => {
        if (!searchTerm) {
            return data;
        }
        return data.filter(({ product }) => 
            product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);


    const { totalSurveyValue, categorySummary } = useMemo(() => {
        const summary = productCategories.reduce((acc, cat) => {
            acc[cat] = { requestedItemCount: 0, totalValue: 0, totalItemCount: 0 };
            return acc;
        }, {} as Record<ProductCategory, { requestedItemCount: number; totalValue: number; totalItemCount: number }>);

        let overallTotalValue = 0;

        data.forEach(({ product, totalValue }) => {
            if (product.category && summary[product.category]) {
                summary[product.category].totalItemCount += 1;
            }
            
            if (totalValue > 0) {
                if (product.category && summary[product.category]) {
                    summary[product.category].requestedItemCount += 1;
                    summary[product.category].totalValue += totalValue;
                }
                overallTotalValue += totalValue;
            }
        });

        const categories = Object.entries(summary).map(([name, values]) => ({
            name: name as ProductCategory,
            ...values
        }));

        return {
            totalSurveyValue: overallTotalValue,
            categorySummary: categories,
        };
    }, [data]);
    
    const totalApprovedValue = useMemo(() => {
        return (requisitions || [])
            .filter(r => {
                if (!['Ready', 'PartiallyApproved', 'Completed', 'Picking', 'Submitted'].includes(r.status)) return false;
                
                // Use fallback date for fiscal year budget calculation
                const reportDate = r.approvedAt || r.submittedAt || r.createdAt;
                if (!reportDate) return false;
                
                const approvedDate = new Date(reportDate);
                return getFiscalYearBE(approvedDate) === fiscalYear;
            })
            .reduce((sum, req) => {
                // If totalValue is not calculated in DB, calculate it from items
                const reqValue = req.totalValue ?? (req.items || []).reduce((itemSum, item) => {
                    const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? 0;
                    return itemSum + ((item.approvedQuantity ?? 0) * price);
                }, 0);
                return sum + reqValue;
            }, 0);
    }, [requisitions, fiscalYear]);

    const remainingBudget = budget !== null ? budget - totalApprovedValue : null;

    const handleExport = () => {
        if (filteredData.length === 0) {
            alert("ไม่มีข้อมูลสำหรับส่งออก");
            return;
        }
        const exportData = filteredData.map(({ product, totalQuantity, totalValue }) => ({
            'รายการ': product.name,
            'ประเภท': product.category,
            'หน่วย': product.unit,
            'ราคาต่อหน่วย (บาท)': product.pricePerUnit || 0,
            'จำนวนรวม': totalQuantity,
            'มูลค่ารวม (บาท)': totalValue,
        }));
        exportToExcel(exportData, `สรุปผลรวมความต้องการ_${new Date().toLocaleDateString('th-TH')}`);
    };

    const handleSaveBudget = async () => {
        setIsSavingBudget(true);
        const newBudget = parseFloat(budgetInput.replace(/,/g, ''));
        if (isNaN(newBudget) || newBudget < 0) {
            alert("กรุณากรอกจำนวนเงินที่ถูกต้อง");
            setIsSavingBudget(false);
            return;
        }
        try {
            await supabaseService.setBudgetForFiscalYear(fiscalYear, newBudget);
            onBudgetChange();
            setIsBudgetModalOpen(false);
        } catch (error) {
            alert("ไม่สามารถบันทึกงบประมาณได้");
        } finally {
            setIsSavingBudget(false);
        }
    };

    return (
      <div>
        <div className="mb-8 p-6 bg-gradient-to-r from-sky-500 to-indigo-500 text-white border border-slate-200 rounded-2xl shadow-lg print-section">
            <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold mb-4">สรุปงบประมาณปี {fiscalYear}</h3>
                {!isReadOnly && (
                    <button 
                        onClick={() => setIsBudgetModalOpen(true)}
                        className="bg-white/20 hover:bg-white/30 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors no-print"
                    >
                        ตั้ง/แก้ไขงบประมาณ
                    </button>
                )}
            </div>
            {isLoadingBudget ? <p>กำลังโหลดข้อมูลงบประมาณ...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/10 p-4 rounded-xl">
                    <p className="text-sm opacity-80">งบประมาณประจำปี</p>
                    <p className="text-2xl font-bold">{budget !== null ? formatNumber(budget) : 'ยังไม่ได้ตั้งค่า'}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-xl">
                    <p className="text-sm opacity-80">ยอดเบิกจ่ายที่อนุมัติ</p>
                    <p className="text-2xl font-bold">{formatNumber(totalApprovedValue)}</p>
                </div>
                 <div className="bg-white/10 p-4 rounded-xl">
                    <p className="text-sm opacity-80">งบประมาณคงเหลือ</p>
                    <p className={`text-2xl font-bold ${remainingBudget !== null && remainingBudget < 0 ? 'text-red-300' : ''}`}>
                         {remainingBudget !== null ? formatNumber(remainingBudget) : 'N/A'}
                    </p>
                </div>
            </div>
            )}
        </div>

        <div className="print-section">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">สรุปผลรวมความต้องการจากแบบสำรวจ</h3>
                    <p className="text-slate-600 dark:text-slate-400">มูลค่ารวมที่สำรวจทั้งหมด: <span className="font-semibold text-sky-600 dark:text-sky-400">{formatNumber(totalSurveyValue)}</span> บาท</p>
                </div>
                <div className="flex gap-3 no-print">
                    <input type="text" placeholder="ค้นหารายการ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:w-auto px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm" />
                    <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                        <DownloadIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                        <PrinterIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
             <TableTemplate 
                headers={['ประเภท', {name: 'จำนวนรายการที่ขอ', className: 'text-right'}, {name: 'จำนวนรายการทั้งหมด', className: 'text-right'}, {name: 'มูลค่ารวม (บาท)', className: 'text-right'}]}
                className="mb-8"
            >
                {categorySummary.map(cat => (
                    <tr key={cat.name}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-200">{cat.name}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 text-right">{cat.requestedItemCount.toLocaleString('th-TH')}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 text-right">{cat.totalItemCount.toLocaleString('th-TH')}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200 font-semibold text-right">{formatNumber(cat.totalValue)}</td>
                    </tr>
                ))}
            </TableTemplate>
             <TableTemplate headers={['รายการ', 'หน่วย', {name: 'ราคา/หน่วย (บาท)', className: 'text-right'}, {name: 'จำนวนรวม', className: 'text-right'}, {name: 'มูลค่ารวม (บาท)', className: 'text-right'}]}>
                {filteredData.map(({ product, totalQuantity, totalValue }) => (
                    <tr key={product.id}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-200">{product.name}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{product.unit}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 text-right">{formatNumber(product.pricePerUnit || 0)}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 text-right">{totalQuantity.toLocaleString('th-TH')}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200 font-semibold text-right">{formatNumber(totalValue)}</td>
                    </tr>
                ))}
                 {filteredData.length === 0 && (
                    <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-500 dark:text-slate-400">ไม่พบรายการ</td>
                    </tr>
                )}
            </TableTemplate>
        </div>
        
        <Modal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} title={`ตั้งงบประมาณปี ${fiscalYear}`}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="budget-input" className="block text-sm font-medium text-slate-700 dark:text-slate-200">งบประมาณ (บาท)</label>
                    <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <CurrencyDollarIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            id="budget-input"
                            type="text"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            className="block w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 pl-10 shadow-sm focus:border-sky-500 focus:ring-sky-500"
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => setIsBudgetModalOpen(false)} className="bg-slate-100 dark:bg-slate-600 font-bold py-2 px-4 rounded-lg">ยกเลิก</button>
                    <button onClick={handleSaveBudget} disabled={isSavingBudget} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400">
                        {isSavingBudget ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </Modal>
      </div>
    );
};
