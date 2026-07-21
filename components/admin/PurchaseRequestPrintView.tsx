
import React from 'react';
import { PurchaseOrder, DocumentSettings } from '../../types';

const PurchaseRequestPrintView: React.FC<{
    po: PurchaseOrder;
    companyName: string;
    documentSettings: DocumentSettings | null;
    inventoryMap: Map<string, number>;
}> = ({ po, documentSettings, inventoryMap }) => {

    const formatDateThai = (date: Date) => {
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543;
        return `${day} ${month} พ.ศ. ${year}`;
    };

    const formatCurrency = (val: number | undefined | null) => (val || 0) === 0 ? '-' : (val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatNumber = (val: number | undefined | null) => (val || 0) === 0 ? '-' : Math.round(val || 0).toLocaleString('th-TH');

    const totalValue = po.items.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);

    return (
        <div className="hidden print-only p-8 text-black print-sarabun" style={{ fontSize: '16pt', lineHeight: '1.2' }}>
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
                        margin: 1.5cm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
            
            <div className="flex items-start mb-6 relative">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Garuda_emblem_of_Thailand.svg/200px-Garuda_emblem_of_Thailand.svg.png" alt="Garuda" className="h-16 absolute left-0 top-0 object-contain grayscale" style={{ filter: 'grayscale(100%)' }} />
                 <h1 className="font-bold text-center w-full mt-4" style={{fontSize: '29pt'}}>บันทึกข้อความ</h1>
            </div>
            
            <div className="space-y-1 mt-2">
                <p>
                    <span className="font-bold" style={{ fontSize: '20pt', display: 'inline-block', width: '3.5cm' }}>ส่วนราชการ</span>
                    <span>{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} กลุ่มงานเภสัชกรรม (คลังเวชภัณฑ์) โทร. 0-3728-8169-7 ต่อ 6159</span>
                </p>
                <div className="flex justify-between items-baseline">
                    <p className="flex-1">
                        <span className="font-bold" style={{ fontSize: '20pt', display: 'inline-block', width: '3.5cm' }}>ที่</span>
                        <span>{`ปจ 0033.201/2/${po.poNumber || '.........'}`}</span>
                    </p>
                    <p className="flex-1 pl-8">
                        <span className="font-bold" style={{ fontSize: '20pt', marginRight: '1rem' }}>วันที่</span>
                        <span>{po.createdAt ? formatDateThai(new Date(po.createdAt)) : '...... เดือน ............ พ.ศ 2569'}</span>
                    </p>
                </div>
                <p>
                    <span className="font-bold" style={{ fontSize: '20pt', display: 'inline-block', width: '3.5cm' }}>เรื่อง</span>
                    <span>ขออนุมัติจัดซื้อ เวชภัณฑ์มิใช่ยา</span>
                </p>
                <p>
                    <span className="font-bold" style={{ fontSize: '20pt', display: 'inline-block', width: '3.5cm' }}>เรียน</span>
                    <span>ผู้อำนวยการ{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'}</span>
                </p>
            </div>

            <p className="mt-4" style={{ textIndent: '3.5cm', textAlign: 'justify' }}>
                ด้วย กลุ่มงานเภสัชกรรม {documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} มีความประสงค์ขออนุมัติซื้อ เวชภัณฑ์มิใช่ยา จำนวน {po.items.length} รายการ เพื่อใช้ในการให้บริการกับผู้ป่วย โดยขออนุมัติใช้เงินบำรุง{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} ดังนี้
            </p>

            <table className="w-full border-collapse border border-black mt-4" style={{fontSize: '12pt', tableLayout: 'fixed', wordBreak: 'break-word'}}>
                 <colgroup>
                    <col style={{width: '6%'}} />
                    <col style={{width: '28%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '8%'}} />
                    <col style={{width: '8%'}} />
                    <col style={{width: '7%'}} />
                    <col style={{width: '8%'}} />
                    <col style={{width: '9%'}} />
                </colgroup>
                <thead>
                    <tr className="text-center font-bold">
                        <th rowSpan={2} className="border border-black p-0.5 align-middle">ลำดับ<br/>ที่</th>
                        <th rowSpan={2} className="border border-black p-0.5 align-middle">รายการคุณลักษณะเฉพาะของเวชภัณฑ์มิใช่ยา</th>
                        <th colSpan={2} className="border border-black p-0.5">ประมาณการใช้ต่อปี</th>
                        <th colSpan={2} className="border border-black p-0.5">ปริมาณที่ใช้แล้วในปีงบ</th>
                        <th colSpan={2} className="border border-black p-0.5">อัตราการใช้ต่อเดือน</th>
                        <th rowSpan={2} className="border border-black p-0.5 align-middle">คงคลัง</th>
                        <th colSpan={2} className="border border-black p-0.5">ปริมาณขอซื้อ</th>
                    </tr>
                    <tr className="text-center font-bold">
                        <th className="border border-black p-0.5">จำนวน</th>
                        <th className="border border-black p-0.5">มูลค่า</th>
                        <th className="border border-black p-0.5">จำนวน</th>
                        <th className="border border-black p-0.5">มูลค่า</th>
                        <th className="border border-black p-0.5">จำนวน</th>
                        <th className="border border-black p-0.5">มูลค่า</th>
                        <th className="border border-black p-0.5">จำนวน</th>
                        <th className="border border-black p-0.5">มูลค่า</th>
                    </tr>
                </thead>
                <tbody>
                    {po.items.map((item, index) => {
                        const product = (item as any).product;
                        if (!product) return null;
                        const lastYearUsage = product.lastYearUsage || 0;
                        const price = item.pricePerUnit;
                        const annualValue = lastYearUsage * price;
                        const monthlyUsage = lastYearUsage / 12;
                        const monthlyValue = monthlyUsage * price;
                        const stock = inventoryMap.get(product.id);
                        const purchaseValue = item.quantity * price;

                        return (
                            <tr key={item.id || product.id}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">{product.name}</td>
                                <td className="border border-black p-1 text-right">{formatNumber(lastYearUsage)}</td>
                                <td className="border border-black p-1 text-right">{formatCurrency(annualValue)}</td>
                                <td className="border border-black p-1 text-center">-</td>
                                <td className="border border-black p-1 text-center">-</td>
                                <td className="border border-black p-1 text-right">{formatNumber(monthlyUsage)}</td>
                                <td className="border border-black p-1 text-right">{formatCurrency(monthlyValue)}</td>
                                <td className="border border-black p-1 text-right">{stock !== undefined ? formatNumber(stock) : '-'}</td>
                                <td className="border border-black p-1 text-right">{formatNumber(item.quantity)}</td>
                                <td className="border border-black p-1 text-right">{formatCurrency(purchaseValue)}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={10} className="border-b border-r-0 border-l-0 p-1 text-right">&nbsp;</td>
                        <td className="border border-black p-1 text-right">{formatCurrency(totalValue)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <p className="mt-6 mb-8" style={{ textIndent: '3.5cm' }}>
                จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติและมอบพัสดุดำเนินการต่อไป
            </p>
            
            <div className="mt-8 text-center" style={{ fontSize: '16pt', lineHeight: '1.4' }}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-16">
                    <div>
                        <div className="flex items-center justify-center mb-2">
                            <span>(ลงชื่อ)</span>
                            <span className="inline-block border-b border-dotted border-black w-48 mx-2"></span>
                            <span>หัวหน้าหน่วยพัสดุ</span>
                        </div>
                        <p>(นายอนุสรณ์ สินารักษ์)</p>
                        <p>เจ้าพนักงานเภสัชกรรมชำนาญงาน</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-center mb-2">
                            <span>(ลงชื่อ)</span>
                            <span className="inline-block border-b border-dotted border-black w-48 mx-2"></span>
                        </div>
                        <p>(นางสาวอุไรวรรณ มาประเสริฐ)</p>
                        <p>เภสัชกรชำนาญการพิเศษ</p>
                        <p>หัวหน้ากลุ่มงานเภสัชกรรม</p>
                    </div>
                    <div>
                        <p className="mb-2">เห็นควรอนุมัติ</p>
                        <div className="flex items-center justify-center mb-2">
                            <span>(ลงชื่อ)</span>
                            <span className="inline-block border-b border-dotted border-black w-48 mx-2"></span>
                        </div>
                        <p>(นายธวัช เจียมรัตนจรัส)</p>
                        <p>นายแพทย์ชำนาญการพิเศษ</p>
                        <p>หัวหน้ากลุ่มภารกิจด้านบริการทุติยภูมิและตติยภูมิ</p>
                    </div>
                    <div>
                        <p className="mb-2">อนุมัติ</p>
                        <div className="flex items-center justify-center mb-2">
                            <span>(ลงชื่อ)</span>
                            <span className="inline-block border-b border-dotted border-black w-48 mx-2"></span>
                        </div>
                        <p>({documentSettings?.documentApproverName || 'นายศิวบูลย์ ชัยสงคราม'})</p>
                        <p>{documentSettings?.documentApproverPosition || `ผู้อำนวยการ${documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'}`}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseRequestPrintView;
