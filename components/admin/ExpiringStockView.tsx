
import React from 'react';
import { ExpiringStockItem } from '../../types';
import TableTemplate from './TableTemplate';
import DownloadIcon from '../icons/DownloadIcon';
import * as XLSX from 'xlsx';

const exportToExcel = (data: any[], fileName: string, sheetName: string = "Sheet1") => {
    if (!data || data.length === 0) {
        alert("ไม่มีข้อมูลสำหรับส่งออก");
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const getExpiryHighlightColor = (expiryDate: Date | null | undefined): string => {
    if (!expiryDate) return '';
    const now = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(now.getDate() + 30);
    const ninetyDays = new Date();
    ninetyDays.setDate(now.getDate() + 90);

    const date = new Date(expiryDate);
    if (date < thirtyDays) return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
    if (date < ninetyDays) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200';
    return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200';
};


const ExpiringStockView: React.FC<{ expiringStock: ExpiringStockItem[] }> = ({ expiringStock }) => {

    const handleExport = () => {
        const exportData = expiringStock.map(item => ({
            'รายการ': item.product?.name || 'N/A',
            'บริษัท': item.company?.name || 'ไม่ระบุ',
            'จำนวนคงเหลือ': item.quantityRemaining || 0,
            'วันหมดอายุ': item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('th-TH') : 'N/A',
        }));
        
        exportToExcel(exportData, `รายการสินค้าใกล้หมดอายุ_${new Date().toLocaleDateString('th-TH')}`);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">รายการสินค้าใกล้หมดอายุ</h3>
                    <p className="text-slate-600 dark:text-slate-300">แสดงรายการที่ Lot Number จะหมดอายุภายใน 6 เดือนข้างหน้า</p>
                </div>
                 <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                    <DownloadIcon className="w-5 h-5"/>
                    <span>ส่งออก (Excel)</span>
                </button>
            </div>
            
             <TableTemplate headers={['รายการ', 'บริษัท', 'จำนวนคงเหลือ', 'วันหมดอายุ']}>
                {expiringStock.map(item => (
                    <tr key={item.id} className={getExpiryHighlightColor(item.expiryDate)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.product?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{item.company?.name || 'ไม่ระบุ'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">{(item.quantityRemaining || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric'}) : 'N/A'}</td>
                    </tr>
                ))}
                {expiringStock.length === 0 && (
                     <tr>
                        <td colSpan={4} className="text-center py-10 text-slate-500 dark:text-slate-400">ไม่พบรายการสินค้าที่ใกล้หมดอายุ</td>
                    </tr>
                )}
             </TableTemplate>
        </div>
    )
};

export default ExpiringStockView;
