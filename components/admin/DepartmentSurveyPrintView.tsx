import React from 'react';
import { Department, Product, DocumentSettings } from '../../types';

interface DepartmentSurveyPrintViewProps {
    department: Department;
    fiscalYear: number;
    items: [string, { quantity: number; price: number }][];
    productMap: Map<string, Product>;
    getApprovedQuantityInFiscalYear: (deptId: string, productId: string) => number;
    documentSettings: DocumentSettings | null;
}

const DepartmentSurveyPrintView: React.FC<DepartmentSurveyPrintViewProps> = ({ department, fiscalYear, items, productMap, getApprovedQuantityInFiscalYear, documentSettings }) => {
    const formatDateThai = (date: Date) => {
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543;
        return `${day} ${month} พ.ศ. ${year}`;
    };

    // Use en-US to ensure Arabic numerals are always used
    const formatNumber = (val: number | undefined | null) => (val || 0) === 0 ? '-' : Math.round(val || 0).toLocaleString('en-US');
    const formatCurrency = (val: number | undefined | null) => (val || 0) === 0 ? '-' : (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Sort items by product name
    const sortedItems = [...items].sort((a,b) => (productMap.get(a[0])?.name || '').localeCompare(productMap.get(b[0])?.name || '', 'th'));

    let totalRequestValue = 0;

    return (
        <div className="hidden print-only text-black bg-white" style={{ fontFamily: '"TH SarabunPSK", "TH Sarabun New", sans-serif', fontSize: '12pt', lineHeight: '1.2' }}>
            <style>{`
                @font-face {
                    font-family: 'TH SarabunPSK';
                    src: local('TH SarabunPSK'), local('THSarabunPSK'), url('https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew.woff2') format('woff2');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'TH SarabunPSK';
                    src: local('TH SarabunPSK Bold'), local('THSarabunPSK-Bold'), url('https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew-Bold.woff2') format('woff2');
                    font-weight: bold;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'TH Sarabun New';
                    src: url('https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew.woff2') format('woff2');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'TH Sarabun New';
                    src: url('https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew-Bold.woff2') format('woff2');
                    font-weight: bold;
                    font-style: normal;
                }
                @media print {
                    @page {
                        size: A4;
                        margin: 1.5cm 1.5cm 1.5cm 2.5cm; /* Standard margins */
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
                .memo-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12pt; /* Smaller font for table to fit */
                }
                .memo-table th, .memo-table td {
                    border: 1px solid black;
                    padding: 4px;
                    vertical-align: top;
                }
                .memo-table th {
                    text-align: center;
                    font-weight: bold;
                }
            `}</style>
            
            <div className="flex justify-center mb-8 relative">
                <div className="absolute left-0 -top-4 w-20 h-20">
                    {documentSettings?.hospitalLogoUrl && documentSettings.hospitalLogoUrl.startsWith('http') ? (
                        <img src={documentSettings.hospitalLogoUrl} alt="โลโก้หน่วยงาน" className="w-full h-full object-contain grayscale" />
                    ) : (
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c3/Garuda_of_Thailand.svg" alt="ตราครุฑ" className="w-full h-full object-contain grayscale" />
                    )}
                </div>
                <div className="text-center font-bold text-[29pt] leading-none mt-6">บันทึกข้อความ</div>
            </div>

            <div className="flex items-baseline mb-1">
                <div className="font-bold text-[16pt] mr-4 whitespace-nowrap">ส่วนราชการ</div>
                <div className="flex-1 leading-tight">{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} กลุ่มงานเภสัชกรรม (คลังเวชภัณฑ์) โทร. 0-3728-8169-7 ต่อ 6159</div>
            </div>

            <div className="flex items-baseline mb-1">
                <div className="font-bold text-[16pt] mr-4 whitespace-nowrap">ที่</div>
                <div className="w-64 leading-tight">ปจ 0033.201/2/........</div>
                <div className="font-bold text-[16pt] mr-4 whitespace-nowrap">วันที่</div>
                <div className="flex-1 leading-tight">{formatDateThai(new Date())}</div>
            </div>

            <div className="flex items-baseline mb-1">
                <div className="font-bold text-[16pt] mr-4 whitespace-nowrap">เรื่อง</div>
                <div className="flex-1 leading-tight">ขออนุมัติจัดซื้อ เวชภัณฑ์มิใช่ยา</div>
            </div>

            <div className="flex items-baseline mb-6">
                <div className="font-bold text-[16pt] mr-4 whitespace-nowrap">เรียน</div>
                <div className="flex-1 leading-tight">ผู้อำนวยการ{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'}</div>
            </div>

            <div className="mb-4" style={{ textIndent: '3rem' }}>
                ด้วย กลุ่มงานเภสัชกรรม {documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} มีความประสงค์ขออนุมัติซื้อ เวชภัณฑ์มิใช่ยา จำนวน {items.length} รายการ เพื่อใช้ในการให้บริการกับผู้ป่วย โดยขออนุมัติใช้เงินบำรุง{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} ดังนี้
            </div>

            <table className="memo-table mb-4">
                <thead>
                    <tr>
                        <th rowSpan={2} className="w-10">ลำดับ<br/>ที่</th>
                        <th rowSpan={2}>รายการคุณลักษณะเฉพาะของ<br/>เวชภัณฑ์มิใช่ยา</th>
                        <th colSpan={2}>ประมาณการใช้ต่อปี</th>
                        <th colSpan={2}>ปริมาณที่ใช้แล้วในปีงบ</th>
                        <th colSpan={2}>อัตราการใช้ต่อเดือน</th>
                        <th rowSpan={2}>คงคลัง</th>
                        <th colSpan={2}>ปริมาณขอซื้อ</th>
                    </tr>
                    <tr>
                        <th className="w-16">จำนวน</th>
                        <th className="w-20">มูลค่า</th>
                        <th className="w-16">จำนวน</th>
                        <th className="w-20">มูลค่า</th>
                        <th className="w-16">จำนวน</th>
                        <th className="w-20">มูลค่า</th>
                        <th className="w-16">จำนวน</th>
                        <th className="w-24">มูลค่า</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedItems.map(([productId, surveyItem], index) => {
                        const product = productMap.get(productId);
                        if (!product) return null;
                        
                        const price = product.pricePerUnit || 0;
                        const requestQty = surveyItem.quantity;
                        const requestValue = requestQty * price;
                        totalRequestValue += requestValue;
                        
                        const usedQty = getApprovedQuantityInFiscalYear(department.id, productId);
                        const usedValue = usedQty * price;
                        
                        return (
                            <tr key={productId}>
                                <td className="text-center">{index + 1}</td>
                                <td>{product.name}</td>
                                <td className="text-right">-</td>
                                <td className="text-right">-</td>
                                <td className="text-right">{usedQty > 0 ? formatNumber(usedQty) : '-'}</td>
                                <td className="text-right">{usedValue > 0 ? formatCurrency(usedValue) : '-'}</td>
                                <td className="text-right">-</td>
                                <td className="text-right">-</td>
                                <td className="text-right">-</td>
                                <td className="text-right">{requestQty > 0 ? formatNumber(requestQty) : '-'}</td>
                                <td className="text-right">{requestValue > 0 ? formatCurrency(requestValue) : '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={10} className="text-right font-bold pr-2">รวมมูลค่าทั้งสิ้น</td>
                        <td className="text-right font-bold">{formatCurrency(totalRequestValue)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div className="mb-16" style={{ textIndent: '3rem' }}>
                จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติและมอบพัสดุดำเนินการต่อไป
            </div>

            <div className="grid grid-cols-2 gap-y-12 gap-x-8 mt-12 text-[12pt]">
                <div className="text-center flex flex-col items-center">
                    <div className="flex items-baseline justify-center whitespace-nowrap">
                        <span>(ลงชื่อ)</span>
                        <span className="w-40 border-b border-dotted border-black/80 mx-2"></span>
                        <span>หัวหน้าหน่วยพัสดุ</span>
                    </div>
                    <div className="mt-2">({documentSettings?.documentIssuerName || 'นายอนุสรณ์ สินารักษ์'})</div>
                    <div>{documentSettings?.documentIssuerPosition || 'เจ้าพนักงานเภสัชกรรมชำนาญงาน'}</div>
                </div>

                <div className="text-center flex flex-col items-center">
                    <div className="flex items-baseline justify-center whitespace-nowrap">
                        <span>(ลงชื่อ)</span>
                        <span className="w-40 border-b border-dotted border-black/80 mx-2"></span>
                    </div>
                    <div className="mt-2">({documentSettings?.documentReceiverName || 'นางสาวอุไรวรรณ มาประเสริฐ'})</div>
                    <div>{documentSettings?.documentReceiverPosition || 'เภสัชกรชำนาญการพิเศษ'}</div>
                    <div>หัวหน้ากลุ่มงานเภสัชกรรม</div>
                </div>

                <div className="text-center flex flex-col items-center">
                    <div className="mb-2 font-bold text-[16pt]">เห็นควรอนุมัติ</div>
                    <div className="flex items-baseline justify-center whitespace-nowrap">
                        <span>(ลงชื่อ)</span>
                        <span className="w-40 border-b border-dotted border-black/80 mx-2"></span>
                    </div>
                    <div className="mt-2">({documentSettings?.documentDisbursementApproverName || 'นายธวัช เจียมรัตนจรัส'})</div>
                    <div className="whitespace-pre-line leading-tight">{documentSettings?.documentDisbursementApproverPosition || 'นายแพทย์ชำนาญการพิเศษ\nหัวหน้ากลุ่มภารกิจด้านบริการทุติยภูมิและตติยภูมิ'}</div>
                </div>

                <div className="text-center flex flex-col items-center">
                    <div className="mb-2 font-bold text-[16pt]">อนุมัติ</div>
                    <div className="flex items-baseline justify-center whitespace-nowrap">
                        <span>(ลงชื่อ)</span>
                        <span className="w-40 border-b border-dotted border-black/80 mx-2"></span>
                    </div>
                    <div className="mt-2">({documentSettings?.documentApproverName || 'นายศิวบูลย์ ชัยสงคราม'})</div>
                    <div>{documentSettings?.documentApproverPosition || 'ผู้อำนวยการโรงพยาบาลกบินทร์บุรี'}</div>
                </div>
            </div>
        </div>
    );
};

export default DepartmentSurveyPrintView;
