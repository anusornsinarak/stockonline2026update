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

    const formatNumber = (val: number | undefined | null) => (val || 0) === 0 ? '-' : Math.round(val || 0).toLocaleString('th-TH');
    
    // Sort items by product name
    const sortedItems = [...items].sort((a,b) => (productMap.get(a[0])?.name || '').localeCompare(productMap.get(b[0])?.name || '', 'th'));

    return (
        <div className="hidden print-only p-4 text-black print-sarabun" style={{ fontSize: '15pt', lineHeight: '1.2' }}>
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
                        <th className="border border-black p-2 w-32">จำนวนขอเบิก<br/>ปีงบฯ {fiscalYear}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedItems.map(([productId, surveyItem], index) => {
                        const product = productMap.get(productId);
                        if (!product) return null;
                        
                        const usage = getApprovedQuantityInFiscalYear(department.id, productId);
                        
                        return (
                            <tr key={productId}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">{product.name}</td>
                                <td className="border border-black p-1 text-center">{product.unit}</td>
                                <td className="border border-black p-1 text-right pr-4">{formatNumber(usage)}</td>
                                <td className="border border-black p-1 text-right pr-4">{formatNumber(surveyItem.quantity)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            
            <div className="mt-16 flex justify-between px-10">
                <div className="text-center">
                    <p>ลงชื่อ..........................................................ผู้เสนอขอ</p>
                    <p className="mt-2">(..........................................................)</p>
                    <p>หัวหน้าหน่วยงาน {department.name}</p>
                </div>
                <div className="text-center">
                    <p>ลงชื่อ..........................................................ผู้อนุมัติ</p>
                    <p className="mt-2">(..........................................................)</p>
                    <p>ผู้อำนวยการ/ผู้มีอำนาจอนุมัติ</p>
                </div>
            </div>
        </div>
    );
};

export default DepartmentSurveyPrintView;
