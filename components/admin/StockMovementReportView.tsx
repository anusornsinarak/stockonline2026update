

import React from 'react';
import * as XLSX from 'xlsx';
import ArrowUturnLeftIcon from '../icons/ArrowUturnLeftIcon';
import DownloadIcon from '../icons/DownloadIcon';
import PrinterIcon from '../icons/PrinterIcon';

interface ReportDataItem {
    productName: string;
    unit: string;
    openingBalance: number;
    receivedInPeriod: number;
    totalReceived: number;
    disbursedInPeriod: number;
    disbursedValue: number;
    closingBalance: number;
    pricePerUnit: number;
    closingValue: number;
}

interface StockMovementReportViewProps {
    data: ReportDataItem[];
    fiscalYear: number;
    onBack: () => void;
}

const StockMovementReportView: React.FC<StockMovementReportViewProps> = ({ data, fiscalYear, onBack }) => {

    const handlePrint = () => window.print();

    const handleExport = () => {
        const sheetData: any[][] = [];

        // Add main headers
        sheetData.push([`บัญชีรับ-จ่าย เวชภัณฑ์มิใช่ยา ตั้งแต่ 1 ตุลาคม ${fiscalYear - 1} - 30 กันยายน ${fiscalYear}`]);
        sheetData.push([]); // Spacer

        // Add table headers
        const headerRow1 = [
            'ลำดับที่', 'รายการเวชภัณฑ์มิใช่ยา', 'ขนาดบรรจุหน่วยนับ', `จำนวนรับในปีงบประมาณ ${fiscalYear}`, null, null,
            `จำนวนจ่ายในปีงบประมาณ ${fiscalYear}`, null, `คงเหลือเมื่อสิ้นปีงบประมาณ ${fiscalYear}`, null, null, 'หมายเหตุ',
        ];
        const headerRow2 = [
            null, null, null, 'ยอดยกมา', 'รับเข้า', 'รวม', 'จ่ายออก', 'มูลค่าจ่ายออก',
            'คงคลัง', 'ราคา/หน่วยนับ (บาท)', 'มูลค่าคงคลัง', null,
        ];
        sheetData.push(headerRow1, headerRow2);

        // Add data rows
        data.forEach((item, index) => {
            const row = [
                index + 1,
                item.productName,
                item.unit,
                item.openingBalance,
                item.receivedInPeriod,
                item.totalReceived,
                item.disbursedInPeriod,
                item.disbursedValue,
                item.closingBalance,
                item.pricePerUnit,
                item.closingValue,
                '/', 
            ];
            sheetData.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
            { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }, 
            { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }, 
            { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }, 
            { s: { r: 2, c: 3 }, e: { r: 2, c: 5 } }, 
            { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, 
            { s: { r: 2, c: 8 }, e: { r: 2, c: 10 } },
            { s: { r: 2, c: 11 }, e: { r: 3, c: 11 } },
        ];

        worksheet['!cols'] = [
            { wch: 5 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
            { wch: 12 }, { wch: 20 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `บัญชีรับจ่ายปี${fiscalYear}`);
        XLSX.writeFile(workbook, `บัญชีรับจ่าย_${fiscalYear}.xlsx`);
    };
    
    const formatNumber = (val: number | undefined) => (val || 0) === 0 ? '-' : (val || 0).toLocaleString('th-TH');
    const formatCurrency = (val: number | undefined) => (val || 0) === 0 ? '-' : (val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const tableContent = (
        <table className="w-full border-collapse border border-black text-xs">
            <thead>
                <tr className="text-center font-bold">
                    <th rowSpan={2} className="border border-black p-1 align-middle">ลำดับที่</th>
                    <th rowSpan={2} className="border border-black p-1 align-middle">รายการเวชภัณฑ์มิใช่ยา</th>
                    <th rowSpan={2} className="border border-black p-1 align-middle">ขนาดบรรจุหน่วยนับ</th>
                    <th colSpan={3} className="border border-black p-1">{`จำนวนรับในปีงบประมาณ ${fiscalYear}`}</th>
                    <th colSpan={2} className="border border-black p-1">{`จำนวนจ่ายในปีงบประมาณ ${fiscalYear}`}</th>
                    <th colSpan={3} className="border border-black p-1">{`คงเหลือเมื่อสิ้นปีงบประมาณ ${fiscalYear}`}</th>
                    <th rowSpan={2} className="border border-black p-1 align-middle">หมายเหตุ</th>
                </tr>
                <tr className="text-center font-bold">
                    <th className="border border-black p-1">ยอดยกมา</th>
                    <th className="border border-black p-1">รับเข้า</th>
                    <th className="border border-black p-1">รวม</th>
                    <th className="border border-black p-1">จ่ายออก</th>
                    <th className="border border-black p-1">มูลค่าจ่ายออก</th>
                    <th className="border border-black p-1">คงคลัง</th>
                    <th className="border border-black p-1">ราคา/หน่วยนับ (บาท)</th>
                    <th className="border border-black p-1">มูลค่าคงคลัง</th>
                </tr>
            </thead>
            <tbody>
                {data.map((item, index) => (
                    <tr key={index}>
                        <td className="border border-black p-1 text-center">{index + 1}</td>
                        <td className="border border-black p-1">{item.productName}</td>
                        <td className="border border-black p-1 text-center">{item.unit}</td>
                        <td className="border border-black p-1 text-right">{formatNumber(item.openingBalance)}</td>
                        <td className="border border-black p-1 text-right text-red-600">{formatNumber(item.receivedInPeriod)}</td>
                        <td className="border border-black p-1 text-right">{formatNumber(item.totalReceived)}</td>
                        <td className="border border-black p-1 text-right">{formatNumber(item.disbursedInPeriod)}</td>
                        <td className="border border-black p-1 text-right">{formatCurrency(item.disbursedValue)}</td>
                        <td className="border border-black p-1 text-right font-semibold">{formatNumber(item.closingBalance)}</td>
                        <td className="border border-black p-1 text-right">{formatCurrency(item.pricePerUnit)}</td>
                        <td className="border border-black p-1 text-right font-semibold">{formatCurrency(item.closingValue)}</td>
                        <td className="border border-black p-1 text-center">/</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const signatureSection = (
         <footer className="mt-16 text-xs print:text-[10pt] print:mt-8">
            <div className="grid grid-cols-3 gap-x-4 text-center">
                <div>
                    <p className="mb-12 print:mb-16">ลงชื่อ........................................................ประธานกรรมการ</p>
                    <p>(นายพรเทพ วัฒนศรีสาโรช)</p>
                    <p>นายแพทย์เชี่ยวชาญด้านเวชกรรม</p>
                </div>
                <div>
                    <p className="mb-12 print:mb-16">ลงชื่อ........................................................กรรมการ</p>
                    <p>(นางอ้อมใจ โยธาทิพย์)</p>
                    <p>เภสัชกรชำนาญการ</p>
                </div>
                 <div>
                    <p className="mb-12 print:mb-16">ลงชื่อ........................................................กรรมการ</p>
                    <p>(น.ส.สิริดสร สุวรรณเพ็ชร)</p>
                    <p>นักเทคนิคการแพทย์ชำนาญการ</p>
                </div>
            </div>
        </footer>
    );

    return (
        <div>
            {/* Print-only section */}
            <div className="hidden print-only font-sarabun p-4">
                <div className="text-center mb-4">
                    <h1 className="text-lg font-bold">{`บัญชีรับ-จ่าย เวชภัณฑ์มิใช่ยา ตั้งแต่ 1 ตุลาคม ${fiscalYear - 1} - 30 กันยายน ${fiscalYear}`}</h1>
                </div>
                {tableContent}
                {signatureSection}
            </div>

            {/* Screen View */}
            <div className="no-print animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-sky-600 transition-colors font-medium">
                        <ArrowUturnLeftIcon className="w-5 h-5"/>
                        <span>กลับไปหน้ารายงาน</span>
                    </button>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800">รายงานบัญชีรับ-จ่าย</h2>
                        <p className="text-slate-600">ประจำปีงบประมาณ {fiscalYear}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">
                            <DownloadIcon className="w-5 h-5"/>
                            <span>Excel</span>
                        </button>
                         <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
                            <PrinterIcon className="w-5 h-5"/>
                            <span>พิมพ์</span>
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto bg-white p-4 border rounded-lg shadow-sm">
                    {tableContent}
                </div>
            </div>
        </div>
    );
};

export default StockMovementReportView;