
import React from 'react';
import { Company, Product } from '../../types';

const CompanyPrintReport: React.FC<{company: Company, products: Product[]}> = ({ company, products }) => {
    return (
        <div className="print-only">
            <h2 className="text-2xl font-bold mb-2">รายงานสรุปรายการเวชภัณฑ์</h2>
            <h3 className="text-xl font-semibold text-slate-700 mb-6">บริษัท: {company.name}</h3>
            <table className="min-w-full divide-y divide-slate-200 border border-slate-200">
                <thead className="bg-slate-100">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ลำดับ</th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ชื่อรายการ</th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ประเภท</th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-600">หน่วย</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {products.sort((a,b) => a.name.localeCompare(b.name, 'th')).map((product, index) => (
                        <tr key={product.id}>
                            <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-slate-800 font-medium">{product.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{product.category}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{product.unit}</td>
                        </tr>
                    ))}
                    {products.length === 0 && (
                        <tr>
                            <td colSpan={4} className="text-center py-6 text-slate-500">ไม่พบรายการที่กำหนดสำหรับบริษัทนี้</td>
                        </tr>
                    )}
                </tbody>
            </table>
            <div className="mt-8 text-sm text-slate-500">
                <p>พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</p>
            </div>
        </div>
    );
};

export default CompanyPrintReport;
