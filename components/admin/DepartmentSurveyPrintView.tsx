import React from 'react';
import { Department, Product } from '../../types';

interface DepartmentSurveyPrintViewProps {
    department: Department;
    fiscalYear: number;
    items: [string, { quantity: number; price: number }][];
    productMap: Map<string, Product>;
    getApprovedQuantityInFiscalYear: (deptId: string, productId: string) => number;
}

const DepartmentSurveyPrintView: React.FC<DepartmentSurveyPrintViewProps> = ({ department, fiscalYear, items, productMap, getApprovedQuantityInFiscalYear }) => {
    const formatDateThai = (date: Date) => {
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543;
        return `${day} ${month} พ.ศ. ${year}`;
    };

    // Use en-US to ensure Arabic numerals are always used across different environments/browsers
    const formatNumber = (val: number | undefined | null) => (val || 0) === 0 ? '-' : Math.round(val || 0).toLocaleString('en-US');
    const formatCurrency = (val: number | undefined | null) => (val || 0) === 0 ? '-' : (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Sort items by product name
    const sortedItems = [...items].sort((a,b) => (productMap.get(a[0])?.name || '').localeCompare(productMap.get(b[0])?.name || '', 'th'));

    let totalBudget = 0;

    return (
        <div className="hidden print-only p-4 text-black print-sarabun" style={{ fontSize: '12pt', lineHeight: '1.2' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
                @font-face {
                    font-family: 'TH SarabunPSK';
                    src: local('TH SarabunPSK'), local('THSarabunPSK');
                }
                .print-sarabun {
                    font-family: 'TH SarabunPSK', 'Sarabun', sans-serif;
                }
                @media print {
                    @page {
                        size: A4;
                        margin: 1cm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
            
            <div className="text-center font-bold text-xl mb-4">
                รายงานสรุปการสำรวจความต้องการเวชภัณฑ์มิใช่ยา<br/>
                ประจำปีงบประมาณ {fiscalYear}<br/>
                หน่วยงาน: {department.name}
            </div>

            <table className="w-full border-collapse border border-black text-sm mt-4">
                <thead>
                    <tr className="text-center font-bold bg-gray-100">
                        <th className="border border-black p-2 w-12">ลำดับ</th>
                        <th className="border border-black p-2">รายการคุณลักษณะเฉพาะของเวชภัณฑ์มิใช่ยา</th>
                        <th className="border border-black p-2 w-24">หน่วย</th>
                        <th className="border border-black p-2 w-32">จำนวนเบิกใช้จริง<br/>ปีงบฯ {fiscalYear - 1}</th>
                        <th className="border border-black p-2 w-28">จำนวนขอเบิก<br/>ปีงบฯ {fiscalYear}</th>
                        <th className="border border-black p-2 w-28">ราคา/หน่วย</th>
                        <th className="border border-black p-2 w-32">มูลค่ารวม (บาท)</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedItems.map(([productId, surveyItem], index) => {
                        const product = productMap.get(productId);
                        if (!product) return null;
                        
                        const usage = getApprovedQuantityInFiscalYear(department.id, productId);
                        const price = product.pricePerUnit || 0;
                        const itemTotal = surveyItem.quantity * price;
                        totalBudget += itemTotal;
                        
                        return (
                            <tr key={productId}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">{product.name}</td>
                                <td className="border border-black p-1 text-center">{product.unit}</td>
                                <td className="border border-black p-1 text-right pr-4">{formatNumber(usage)}</td>
                                <td className="border border-black p-1 text-right pr-4">{formatNumber(surveyItem.quantity)}</td>
                                <td className="border border-black p-1 text-right pr-4">{formatCurrency(price)}</td>
                                <td className="border border-black p-1 text-right pr-4">{formatCurrency(itemTotal)}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="font-bold">
                        <td className="border border-black p-2 text-right pr-4" colSpan={6}>รวมมูลค่าทั้งสิ้น</td>
                        <td className="border border-black p-2 text-right pr-4">{formatCurrency(totalBudget)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div className="mt-16 flex justify-between px-10">
                <div className="text-center w-1/2 flex flex-col items-center">
                    <div className="flex flex-col items-start inline-block">
                        <p>ลงชื่อ..........................................................ผู้เสนอขอ</p>
                        <p className="mt-2 self-center">(..........................................................)</p>
                        <p className="self-center">หัวหน้าหน่วยงาน {department.name}</p>
                    </div>
                </div>
                <div className="text-center w-1/2 flex flex-col items-center">
                    <div className="flex flex-col items-start inline-block">
                        <p>ลงชื่อ..........................................................ผู้อนุมัติ</p>
                        <p className="mt-2 self-center">(..........................................................)</p>
                        <p className="self-center">ผู้อำนวยการ/ผู้มีอำนาจอนุมัติ</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DepartmentSurveyPrintView;
