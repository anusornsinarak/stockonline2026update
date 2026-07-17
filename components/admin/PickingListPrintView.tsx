
import React, { useMemo } from 'react';
import { Requisition, RequisitionItem, DocumentSettings, Personnel } from '../../types';

interface PickingListPrintViewProps {
    requisition: Requisition;
    departmentName: string;
    documentSettings: DocumentSettings | null;
    personnel?: Personnel[];
}

export const PickingListPrintView: React.FC<PickingListPrintViewProps> = ({ requisition, departmentName, documentSettings, personnel }) => {
    const items = requisition.items || [];

    const sortLogic = (a: RequisitionItem, b: RequisitionItem) => {
        const productA = a.product;
        const productB = b.product;
        if (!productA || !productB) return 0;

        const zoneA = productA.zone || 'Ω'; // Put items without zone at the end
        const zoneB = productB.zone || 'Ω';
        const zoneCompare = zoneA.localeCompare(zoneB, undefined, { numeric: true });
        if (zoneCompare !== 0) return zoneCompare;

        return productA.name.localeCompare(b.product!.name, 'th');
    };

    const approvedItemsToPick = useMemo(() => items.filter(item => (item.status === 'Approved' || item.status === 'Pending' || item.status === 'Fulfilled') && (item.approvedQuantity || 0) > 0).sort(sortLogic), [items]);
    const loanedItemsToPick = useMemo(() => items.filter(item => item.status === 'Loaned' && (item.approvedQuantity || 0) > 0).sort(sortLogic), [items]);
    const backorderedItems = useMemo(() => items.filter(item => item.status === 'Backordered').sort(sortLogic), [items]);

    const calculateTotal = (itemsToSum: RequisitionItem[], useBackorderQty = false) => {
        return itemsToSum.reduce((sum, item) => {
            const price = item.pricePerUnit ?? item.product?.pricePerUnit ?? 0;
            let qty = item.approvedQuantity || 0;
            if (useBackorderQty) {
                qty = item.quantity - (item.approvedQuantity || 0);
            }
            return sum + (qty * price);
        }, 0);
    };

    const SignatureFooter = ({ itemCount, totalValue }: { itemCount: number, totalValue: number }) => (
        <div className="mt-4">
            <p className="text-right font-bold border-b border-black pb-2 mb-8">
                จำนวนที่อนุมัติทั้งหมด: {itemCount} รายการ | รวมมูลค่า: {totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </p>
            <footer className="grid grid-cols-2 gap-x-16 gap-y-8 text-sm print-avoid-break text-center mt-8">
                 <div className="print-signature-box flex flex-col items-center">
                    <div className="h-4"></div>
                    <p className="font-bold">({requisition.requesterName || '........................................................'})</p>
                    <p className="text-xs mt-1">{requisition.requesterPosition || '........................................................'}</p>
                    <p className="mt-1">ผู้เบิก</p>
                </div>
                <div className="print-signature-box flex flex-col items-center">
                    <div className="h-4"></div>
                    <p className="font-bold">({documentSettings?.documentIssuerName || '........................................................'})</p>
                    <p className="text-xs mt-1">{documentSettings?.documentIssuerPosition || '........................................................'}</p>
                    <p className="mt-1">ผู้จ่าย</p>
                </div>
                 <div className="print-signature-box flex flex-col items-center">
                    <div className="h-4"></div>
                    <p className="font-bold">({documentSettings?.documentDisbursementApproverName || '........................................................'})</p>
                    <p className="text-xs mt-1">{documentSettings?.documentDisbursementApproverPosition || '........................................................'}</p>
                    <p className="mt-1">ผู้อนุมัติเบิกจ่าย</p>
                </div>
                <div className="print-signature-box flex flex-col items-center">
                    <div className="h-4"></div>
                    <p className="font-bold">({requisition.receiverName || '........................................................'})</p>
                    <p className="text-xs mt-1">........................................................</p>
                    <p className="mt-1">ผู้รับ</p>
                </div>
            </footer>
        </div>
    );

    const hasPrintedApproved = approvedItemsToPick.length > 0;
    const hasPrintedApprovedOrLoaned = hasPrintedApproved || loanedItemsToPick.length > 0;

    return (
        <div className="print-only p-8 font-sarabun">
            <div className="print-page-footer"></div>

            {/* Page 1: Approved Items (Picking List) */}
            {approvedItemsToPick.length > 0 && (
                <div className="print-section">
                    <header className="text-center mb-6">
                        <h2 className="text-xl font-bold">ใบจัดของ (Picking List)</h2>
                        <p className="text-base">เลขที่: {requisition.requisitionNumber} ({requisition.name})</p>
                        <p className="text-base">หน่วยงาน: {departmentName}</p>
                    </header>
                    
                    <h3 className="font-semibold mt-4">รายการอนุมัติ</h3>
                    <table className="w-full text-left border-collapse border border-slate-400 table-fixed">
                        <thead><tr className="bg-slate-100"><th className="p-2 border w-[10%]">Zone</th><th className="p-2 border w-[30%]">รายการ</th><th className="p-2 border text-center w-[10%]">Min/Max</th><th className="p-2 border text-center w-[10%]">อนุมัติก่อน</th><th className="p-2 border text-center w-[15%]">จำนวนอนุมัติ</th><th className="p-2 border text-center w-[15%]">คงคลังหน่วย</th><th className="p-2 border text-center w-[10%]">เช็ค</th></tr></thead>
                        <tbody>
                            {approvedItemsToPick.map(item => (
                                <tr key={item.id}><td className="p-2 border">{item.product?.zone}</td><td className="p-2 border">{item.product?.name} ({item.product?.unit})</td><td className="p-2 border text-center text-xs">{item.minStock ?? '-'}/{item.maxStock ?? '-'}</td><td className="p-2 border text-center text-xs">{item.lastApprovedQty || '-'}</td><td className="p-2 border text-center font-bold">{item.approvedQuantity}</td><td className="p-2 border text-center">{item.departmentStockOnSubmit}</td><td className="p-2 border"></td></tr>
                            ))}
                        </tbody>
                    </table>
                    <SignatureFooter itemCount={approvedItemsToPick.length} totalValue={calculateTotal(approvedItemsToPick)} />
                </div>
            )}
            
            {/* Page 2: Loaned Items */}
            {loanedItemsToPick.length > 0 && (
                <div className={`print-section ${hasPrintedApproved ? 'page-break-before' : ''}`}>
                    <header className="text-center mb-6">
                        <h2 className="text-xl font-bold">ใบยืม (Loan List)</h2>
                        <p className="text-base">จากใบเบิกเลขที่: {requisition.requisitionNumber} ({requisition.name})</p>
                        <p className="text-base">หน่วยงาน: {departmentName}</p>
                    </header>
                    <h3 className="font-semibold mt-6">รายการยืม</h3>
                    <table className="w-full text-left border-collapse border border-slate-400 table-fixed">
                        <thead><tr className="bg-slate-100"><th className="p-2 border w-[10%]">Zone</th><th className="p-2 border w-[40%]">รายการ</th><th className="p-2 border text-center w-[10%]">Min/Max</th><th className="p-2 border text-center w-[10%]">อนุมัติก่อน</th><th className="p-2 border text-center w-[15%]">จำนวนที่ยืม</th><th className="p-2 border text-center w-[15%]">เช็ค</th></tr></thead>
                        <tbody>
                            {loanedItemsToPick.map(item => (
                                <tr key={item.id}><td className="p-2 border">{item.product?.zone}</td><td className="p-2 border">{item.product?.name} ({item.product?.unit})</td><td className="p-2 border text-center text-xs">{item.minStock ?? '-'}/{item.maxStock ?? '-'}</td><td className="p-2 border text-center text-xs">{item.lastApprovedQty || '-'}</td><td className="p-2 border text-center font-bold">{item.approvedQuantity}</td><td className="p-2 border"></td></tr>
                            ))}
                        </tbody>
                    </table>
                    <SignatureFooter itemCount={loanedItemsToPick.length} totalValue={calculateTotal(loanedItemsToPick)} />
                </div>
            )}
            
            {/* Page 3: Backordered Items */}
            {backorderedItems.length > 0 && (
                 <div className={`print-section ${hasPrintedApprovedOrLoaned ? 'page-break-before' : ''}`}>
                    <header className="text-center mb-6">
                        <h2 className="text-xl font-bold">รายการค้างจ่าย (Back Order)</h2>
                        <p className="text-base">เลขที่: {requisition.requisitionNumber} ({requisition.name})</p>
                        <p className="text-base">หน่วยงาน: {departmentName}</p>
                    </header>
                    <table className="w-full text-left border-collapse border border-slate-400 table-fixed">
                        <thead><tr className="bg-slate-100"><th className="p-2 border w-[40%]">รายการ</th><th className="p-2 border text-center w-[10%]">Min/Max</th><th className="p-2 border text-center w-[10%]">อนุมัติก่อน</th><th className="p-2 border text-center w-[20%]">จำนวนที่ขอ</th><th className="p-2 border text-center w-[20%]">จำนวนค้างจ่าย</th></tr></thead>
                        <tbody>
                            {backorderedItems.map(item => {
                                const backorderedQty = (item.status === 'Backordered' && (item.approvedQuantity || 0) === item.quantity)
                                    ? item.quantity
                                    : item.quantity - (item.approvedQuantity || 0);
                                return (<tr key={item.id}><td className="p-2 border">{item.product?.name} ({item.product?.unit})</td><td className="p-2 border text-center text-xs">{item.minStock ?? '-'}/{item.maxStock ?? '-'}</td><td className="p-2 border text-center text-xs">{item.lastApprovedQty || '-'}</td><td className="p-2 border text-center">{item.quantity}</td><td className="p-2 border text-center font-bold">{backorderedQty}</td></tr>);
                            })}
                        </tbody>
                    </table>
                     <div className="mt-4 text-right">
                        <p className="font-bold">รวม {backorderedItems.length} รายการ</p>
                     </div>
                     <footer className="mt-12 grid grid-cols-2 gap-x-16 gap-y-8 text-sm print-avoid-break text-center">
                        <div className="print-signature-box">
                            <p className="mb-8">........................................................</p>
                            <p>ผู้จัดทำ</p>
                        </div>
                    </footer>
                </div>
            )}
        </div>
    );
};
