
import React from 'react';
import { Product, DocumentSettings, ProductCategory } from '../../types';

interface PlanDataItem {
    product: Product;
    plannedQty: number;
    currentStock: number;
    plannedValue: number;
    totalQuantity: number; // This is the surveyed quantity
    usageHistory: Record<number, number>;
}

interface PurchasePlanPrintViewProps {
    planData: PlanDataItem[];
    fiscalYear: number;
    documentSettings: DocumentSettings | null;
}

const PurchasePlanPrintView: React.FC<PurchasePlanPrintViewProps> = ({ planData, fiscalYear, documentSettings }) => {

    // Helper functions for formatting
    const formatCurrency = (val: number) => val === 0 ? '-' : (val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatNumber = (val: number) => val === 0 ? '-' : (val || 0).toLocaleString('th-TH');

    // Group data by product category to render separate tables
    const groupedData = Array.isArray(planData) ? planData.reduce((acc, item) => {
        const category = item.product.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, PlanDataItem[]>) : {};

    // Calculate the grand total value for the entire plan
    // FIX: Safely calculate total value, preventing errors if planData is not an array.
    const totalPlanValue = Array.isArray(planData) ? planData.reduce((sum, item) => sum + item.plannedValue, 0) : 0;

    return (
        <div className="p-2 font-sarabun" style={{ fontSize: '7pt', lineHeight: '1.2' }}>
            {/* Main Header */}
            <div className="text-center mb-2">
                <p className="font-bold text-[8pt]">
                    แผนปฏิบัติการจัดซื้อเวชภัณฑ์มิใช่ยา โรงพยาบาล{documentSettings?.hospitalName || 'กบินทร์บุรี'} จังหวัดปราจีนบุรี รหัสหน่วยงาน 10857
                </p>
                <p className="font-bold text-[8pt]">
                    ประจำปีงบประมาณ พ.ศ. {fiscalYear}
                </p>
            </div>
            
            {/* Render a table for each product category */}
            {/* FIX: Ensure Object.entries is only called on a valid object. */}
            {Object.entries(groupedData || {}).map(([category, items], categoryIndex) => (
                <div key={category} className={`print-section ${categoryIndex > 0 ? 'page-break-before' : ''}`}>
                    <h2 className="font-bold text-left my-1 text-[8pt]">{category}</h2>
                    <table className="w-full border-collapse border border-black text-[7pt]">
                        {/* Table Header */}
                        <thead>
                            <tr className="text-center font-bold">
                                <th rowSpan={2} className="border border-black p-px align-middle w-[3%]" scope="col">ลำดับที่</th>
                                <th rowSpan={2} className="border border-black p-px align-middle w-[20%]" scope="col">รายการเวชภัณฑ์มิใช่ยา</th>
                                <th rowSpan={2} className="border border-black p-px align-middle w-[5%]" scope="col">ขนาด บรรจุ หน่วยนับ</th>
                                <th colSpan={3} className="border border-black p-px" scope="colgroup">ปริมาณการใช้ย้อนหลัง 3 ปี</th>
                                <th rowSpan={2} className="border border-black p-px align-middle w-[5%]" scope="col">ปริมาณ คงคลัง ยกมา</th>
                                <th colSpan={4} className="border border-black p-px" scope="colgroup">ประมาณการ</th>
                                <th colSpan={4} className="border border-black p-px" scope="colgroup">ประมาณการมูลค่าจัดซื้อรายไตรมาส (บาท)</th>
                                <th rowSpan={2} className="border border-black p-px align-middle w-[6%]" scope="col">วิธีการจัดซื้อ</th>
                            </tr>
                            <tr className="text-center font-bold">
                                <th className="border border-black p-px w-[4%]" scope="col">ปี{fiscalYear - 3}</th>
                                <th className="border border-black p-px w-[4%]" scope="col">ปี{fiscalYear - 2}</th>
                                <th className="border border-black p-px w-[4%]" scope="col">ปี{fiscalYear - 1}</th>
                                <th className="border border-black p-px w-[5%]" scope="col">ปริมาณใช้ ในปี{fiscalYear}</th>
                                <th className="border border-black p-px w-[5%]" scope="col">ปริมาณซื้อ ในปี{fiscalYear}</th>
                                <th className="border border-black p-px w-[6%]" scope="col">ราคา/หน่วย (บาท)</th>
                                <th className="border border-black p-px w-[7%]" scope="col">มูลค่าจัดซื้อปี{fiscalYear} (บาท)</th>
                                <th className="border border-black p-px w-[4%]" scope="col">1</th>
                                <th className="border border-black p-px w-[4%]" scope="col">2</th>
                                <th className="border border-black p-px w-[4%]" scope="col">3</th>
                                <th className="border border-black p-px w-[4%]" scope="col">4</th>
                            </tr>
                        </thead>
                        {/* Table Body */}
                        <tbody>
                            {/* FIX: Add an array check before calling .map to prevent runtime errors. */}
                            {Array.isArray(items) && items.map((item: PlanDataItem, index) => {
                                const quarterlyValue = item.plannedValue / 4;
                                // Corrected Logic: "ปริมาณใช้" (Estimated Usage) should be the total surveyed demand.
                                const estimatedUsage = item.totalQuantity;
                                // "ปริมาณซื้อ" (Purchase Quantity) is the planned purchase quantity.
                                const purchaseQty = item.plannedQty;
                                
                                return (
                                    <tr key={item.product.id}>
                                        <td className="border border-black p-px text-center">{index + 1}</td>
                                        <td className="border border-black p-px">{item.product.name}</td>
                                        <td className="border border-black p-px text-center">{item.product.unit}</td>
                                        <td className="border border-black p-px text-center">{formatNumber(item.usageHistory[fiscalYear - 3] || 0)}</td>
                                        <td className="border border-black p-px text-center">{formatNumber(item.usageHistory[fiscalYear - 2] || 0)}</td>
                                        <td className="border border-black p-px text-center">{formatNumber(item.usageHistory[fiscalYear - 1] || 0)}</td>
                                        <td className="border border-black p-px text-center">{formatNumber(item.currentStock)}</td>
                                        <td className="border border-black p-px text-center">{formatNumber(estimatedUsage)}</td>
                                        <td className="border border-black p-px text-center">{formatNumber(purchaseQty)}</td>
                                        <td className="border border-black p-px text-right">{formatCurrency(item.product.pricePerUnit || 0)}</td>
                                        <td className="border border-black p-px text-right">{formatCurrency(item.plannedValue)}</td>
                                        <td className="border border-black p-px text-right">{formatCurrency(quarterlyValue)}</td>
                                        <td className="border border-black p-px text-right">{formatCurrency(quarterlyValue)}</td>
                                        <td className="border border-black p-px text-right">{formatCurrency(quarterlyValue)}</td>
                                        <td className="border border-black p-px text-right">{formatCurrency(quarterlyValue)}</td>
                                        <td className="border border-black p-px text-center">เฉพาะเจาะจง</td>
                                    </tr>
                                );
                            })}
                            {/* Category Total Row */}
                            <tr>
                                <th colSpan={10} className="border border-black p-px text-right font-bold" scope="row">รวม {category}</th>
                                {/* FIX: Add an array check before calling .reduce to prevent runtime errors. */}
                                <td className="border border-black p-px text-right font-bold">{formatCurrency(Array.isArray(items) ? items.reduce((sum, i) => sum + i.plannedValue, 0) : 0)}</td>
                                <td colSpan={5} className="border border-black p-px"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ))}
            
            {/* Grand Total Table */}
            <table className="w-full border-collapse border-black text-[7pt] mt-1">
                <tbody>
                    <tr>
                        <th colSpan={10} className="border border-black p-px text-right font-bold" scope="row">รวมเป็นเงินทั้งสิ้น</th>
                        <td className="border border-black p-px text-right font-bold">{formatCurrency(totalPlanValue)}</td>
                        <td colSpan={5} className="border border-black p-px"></td>
                    </tr>
                </tbody>
            </table>

            {/* Signature Footer */}
            <div className="mt-6 space-y-6 text-center" style={{ fontSize: '8pt', lineHeight: '1.3' }}>
                <div className="grid grid-cols-4 gap-x-4">
                    <div>
                        <p className="mb-10">ลงชื่อ........................................................ผู้จัดทำ</p>
                        <p>(นางสาวอุไรวรรณ มาประเสริฐ)</p>
                        <p>ตำแหน่งเจ้าหน้าที่</p>
                    </div>
                     <div>
                        <p className="mb-10">ลงชื่อ........................................................ผู้เสนอ</p>
                        <p>(นางสาวสิริรัตน์ โกรไศยก์)</p>
                        <p>ผู้อำนวยการโรงพยาบาลกบินทร์บุรี</p>
                    </div>
                     <div>
                        <p className="mb-10">ลงชื่อ........................................................ผู้เห็นชอบ</p>
                        <p>(นายอรรถรัตน์ จันทร์เพ็ญ)</p>
                        <p>นายแพทย์สาธารณสุขจังหวัดปราจีนบุรี</p>
                    </div>
                     <div>
                        <p className="mb-10">ลงชื่อ........................................................ผู้อนุมัติ</p>
                        <p>({documentSettings?.documentApproverName || '...................................'})</p>
                        <p>{documentSettings?.documentApproverPosition || '...................................'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchasePlanPrintView;
