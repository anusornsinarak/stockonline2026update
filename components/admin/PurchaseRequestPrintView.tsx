
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
        <div className="hidden print-only p-8 font-sarabun text-black" style={{ fontSize: '16pt', lineHeight: '1.6' }}>
            <div className="flex justify-center h-24 mb-4">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Garuda_emblem_of_Thailand.svg/200px-Garuda_emblem_of_Thailand.svg.png" alt="Garuda" className="h-24"/>
            </div>

            <h1 className="font-bold text-center mb-6" style={{fontSize: '24pt'}}>บันทึกข้อความ</h1>
            
            <div className="space-y-2">
                <p>
                    <span className="font-bold inline-block w-32">ส่วนราชการ</span>
                    <span>{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} กลุ่มงานเภสัชกรรม (คลังเวชภัณฑ์) โทร. 0-3728-8169-7 ต่อ 6159</span>
                </p>
                <div className="flex justify-between">
                    <p><span className="font-bold inline-block w-32">ที่</span>{`ปจ ๐๐๓๓.๒๐๑/๒/${po.poNumber || '.........'}`}</p>
                    <p><span className="font-bold mr-4">วันที่</span> {formatDateThai(new Date(po.createdAt))}</p>
                </div>
                <p><span className="font-bold inline-block w-32">เรื่อง</span> ขออนุมัติจัดซื้อเวชภัณฑ์มิใช่ยา</p>
                <p><span className="font-bold inline-block w-32">เรียน</span> ผู้อำนวยการ{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'}</p>
            </div>

            <p className="mt-6" style={{ textIndent: '4rem' }}>
                ด้วย กลุ่มงานเภสัชกรรม {documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} มีความประสงค์ขออนุมัติซื้อ เวชภัณฑ์มิใช่ยา จำนวน {po.items.length} รายการ เพื่อใช้ในการให้บริการกับผู้ป่วย โดยขออนุมัติใช้เงินบำรุง{documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'} ดังนี้
            </p>

            <table className="w-full border-collapse border border-black mt-4" style={{fontSize: '10pt', tableLayout: 'fixed', wordBreak: 'break-word'}}>
                 <colgroup>
                    <col style={{width: '4%'}} />
                    <col style={{width: '24%'}} />
                    <col style={{width: '7%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '7%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '7%'}} />
                    <col style={{width: '9%'}} />
                    <col style={{width: '6%'}} />
                    <col style={{width: '7%'}} />
                    <col style={{width: '9%'}} />
                </colgroup>
                <thead>
                    <tr className="text-center font-bold">
                        <th rowSpan={2} className="border border-black p-0.5 align-middle">ลำดับที่</th>
                        <th rowSpan={2} className="border border-black p-0.5 align-middle">รายการคุณลักษณะเฉพาะของเวชภัณฑ์มิใช่ยา</th>
                        <th colSpan={2} className="border border-black p-0.5">ประมาณการใช้ต่อปี</th>
                        <th colSpan={2} className="border border-black p-0.5">ปริมาณที่ใช้แล้วในปิงบ</th>
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
                        <th colSpan={10} className="border border-black p-1 text-right font-bold">รวมเป็นเงินทั้งสิ้น</th>
                        <td className="border border-black p-1 text-right font-bold">{formatCurrency(totalValue)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <p className="mt-6" style={{ textIndent: '4rem' }}>
                โดยขอแต่งตั้งคณะกรรมการตรวจรับพัสดุประกอบด้วยบุคคลดังต่อไปนี้
            </p>
            <div className="pl-16 mt-2 space-y-2">
                {(po.committees || []).map((member, index) => (
                    <div key={member.id || index} className="flex items-end gap-2 flex-nowrap" style={{fontSize: '16pt', lineHeight: '1.5'}}>
                        <span className="flex-shrink-0">{String(index + 1)}.</span>
                        <span className="border-b border-dotted border-black flex-grow text-center pb-1 min-w-[150px]">{member.name || ''}</span>
                        <span className="flex-shrink-0">ตำแหน่ง</span>
                        <span className="border-b border-dotted border-black flex-grow text-center pb-1 min-w-[150px]">{member.position || ''}</span>
                        <span className="font-bold flex-shrink-0">{member.role}</span>
                    </div>
                ))}
            </div>
            
            <div className="mt-12 text-center" style={{ fontSize: '14pt', lineHeight: '1.6' }}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-16">
                    <div>
                        <p className="mb-8">(ลงชื่อ)........................................................</p>
                        <p>(นายอนุสรณ์ สินารักษ์)</p>
                        <p style={{fontSize: '12pt'}}>เจ้าพนักงานเภสัชกรรมชำนาญงาน</p>
                        <p style={{fontSize: '12pt'}}>หัวหน้าหน่วยพัสดุ</p>
                        <p className="font-bold">เห็นควรอนุมัติ</p>
                    </div>
                    <div>
                        <p className="mb-8">(ลงชื่อ)........................................................</p>
                        <p>(นางสาวอุไรวรรณ มาประเสริฐ)</p>
                        <p style={{fontSize: '12pt'}}>เภสัชกรชำนาญการพิเศษ</p>
                        <p style={{fontSize: '12pt'}}>หัวหน้ากลุ่มงานเภสัชกรรม</p>
                        <p className="font-bold">อนุมัติ</p>
                    </div>
                    <div>
                        <p className="mb-8">(ลงชื่อ)........................................................</p>
                        <p>(นายธวัช เจียมรัตนจรัส)</p>
                        <p style={{fontSize: '12pt'}}>นายแพทย์ชำนาญการพิเศษ</p>
                        <p style={{fontSize: '12pt'}}>หัวหน้ากลุ่มภารกิจด้านบริการทุติยภูมิและตติยภูมิ</p>
                    </div>
                    <div>
                        <p className="mb-8">(ลงชื่อ)........................................................</p>
                        <p>({documentSettings?.documentApproverName || 'นายแพทย์ศิวบูลย์ ชัยสงคราม'})</p>
                        <p style={{fontSize: '12pt'}}>{documentSettings?.documentApproverPosition || `ผู้อำนวยการ${documentSettings?.hospitalName || 'โรงพยาบาลกบินทร์บุรี'}`}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseRequestPrintView;
