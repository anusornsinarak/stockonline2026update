
import React, { useState, useEffect, useCallback } from 'react';
import { Department, BackOrderItem, LoanItem, RequisitionItem } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PrinterIcon from '../icons/PrinterIcon';
import LoadingScreen from '../LoadingScreen';

export const DepartmentBackorderView: React.FC<{ department: Department }> = ({ department }) => {
    const [backorders, setBackorders] = useState<BackOrderItem[]>([]);
    const [loans, setLoans] = useState<LoanItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch both requisitions (to derive backorders) and all loan items for the department
            const [requisitions, allLoansFromDb] = await Promise.all([
                supabaseService.getRequisitionsForDepartment(department.id),
                supabaseService.getLoansForDepartment(department.id)
            ]);
            
            const derivedBackorders: BackOrderItem[] = [];
            const derivedLoansFromReqs: LoanItem[] = [];

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            requisitions.forEach(req => {
                const createdAt = new Date(req.createdAt);

                (req.items || []).forEach(item => {
                    // Only consider items from requisitions that have been processed
                    if (['Submitted', 'Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status)) {
                        // Backorder logic - removed date filter to show all pending backorders
                        if (item.status === 'Backordered') {
                            const backorderedQty = item.quantity - (item.approvedQuantity || 0);
                            if (backorderedQty > 0) {
                                derivedBackorders.push({
                                    id: item.id!,
                                    createdAt: createdAt,
                                    originalRequisitionId: req.id,
                                    productId: item.productId,
                                    departmentId: req.departmentId,
                                    quantity: backorderedQty,
                                    productName: item.product?.name,
                                    departmentName: department.name,
                                    requisitionNumber: req.requisitionNumber,
                                });
                            }
                        }

                        // Loan logic without date filter
                        if (item.status === 'Loaned') {
                            const loanedQty = item.approvedQuantity || 0;
                            if (loanedQty > 0) {
                                derivedLoansFromReqs.push({
                                    id: item.id!,
                                    createdAt: createdAt,
                                    originalRequisitionId: req.id,
                                    productId: item.productId,
                                    departmentId: req.departmentId,
                                    quantity: loanedQty,
                                    status: 'Pending', // For department view, assume all loans are pending fulfillment.
                                    fulfilledAt: null,
                                    isDerived: true, // Mark as derived
                                    productName: item.product?.name,
                                    departmentName: department.name,
                                    requisitionNumber: req.requisitionNumber,
                                });
                            }
                        }
                    }
                });
            });

            // Merge loans from DB with loans derived from requisitions, avoiding duplicates.
            const finalLoans: LoanItem[] = [...allLoansFromDb];
            const dbReqLoanKeys = new Set(
                allLoansFromDb
                    .filter(l => l.originalRequisitionId)
                    .map(l => `${l.originalRequisitionId}_${l.productId}`)
            );

            derivedLoansFromReqs.forEach(loanFromReq => {
                const key = `${loanFromReq.originalRequisitionId}_${loanFromReq.productId}`;
                if (!dbReqLoanKeys.has(key)) {
                    finalLoans.push(loanFromReq);
                }
            });

            setBackorders(derivedBackorders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setLoans(finalLoans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

        } catch (err) {
            setError("ไม่สามารถโหลดข้อมูลได้");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [department.id, department.name]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
     const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <LoadingScreen message="กำลังโหลดข้อมูลค้างจ่ายและยืม..." />;

    if (error) {
        return <div className="text-center p-8 text-red-500">{error}</div>;
    }

    return (
        <div className="max-w-5xl mx-auto bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">รายการค้างจ่าย/ยืมของหน่วยงาน</h2>
                <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
                    <PrinterIcon className="w-5 h-5"/> พิมพ์
                </button>
            </div>
            
            <div className="print-section space-y-8">
                {/* Backorders */}
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">รายการค้างจ่าย (Backorders)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">รายการค้างจ่ายทั้งหมดที่ยังไม่ได้รับการจัดสรร</p>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase">วันที่</th>
                                    <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase">รายการ</th>
                                    <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                    <th className="p-3 text-center text-xs font-semibold text-slate-500 uppercase">ใบเบิกเดิม</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {backorders.map(item => (
                                    <tr key={item.id}>
                                        <td className="p-3 text-sm">{new Date(item.createdAt).toLocaleDateString('th-TH')}</td>
                                        <td className="p-3 text-sm font-medium">{item.productName}</td>
                                        <td className="p-3 text-sm text-right font-bold text-sky-600">{item.quantity.toLocaleString()}</td>
                                        <td className="p-3 text-sm text-center">#{item.requisitionNumber}</td>
                                    </tr>
                                ))}
                                {backorders.length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">ไม่มีรายการค้างจ่ายในเดือนนี้</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Loans */}
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">รายการยืม (Loans)</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase">วันที่ยืม</th>
                                    <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase">รายการ</th>
                                    <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                    <th className="p-3 text-center text-xs font-semibold text-slate-500 uppercase">อ้างอิง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {loans.map(item => (
                                    <tr key={`${item.id}-${item.isDerived}`}>
                                        <td className="p-3 text-sm">{new Date(item.createdAt).toLocaleDateString('th-TH')}</td>
                                        <td className="p-3 text-sm font-medium">{item.productName}</td>
                                        <td className="p-3 text-sm text-right font-bold text-purple-600">{item.quantity.toLocaleString()}</td>
                                        <td className="p-3 text-sm text-center">{item.requisitionNumber ? `#${item.requisitionNumber}` : '(ยืมตรง)'}</td>
                                    </tr>
                                ))}
                                {loans.length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">ไม่มีรายการยืมคงค้าง</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
