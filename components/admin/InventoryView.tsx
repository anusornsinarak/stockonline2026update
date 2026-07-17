import React, { useState, useMemo } from 'react';
import { InventoryItem, Product } from '../../types';
import TableTemplate from './TableTemplate';
import ClockIcon from '../icons/ClockIcon';
import ChevronUpIcon from '../icons/ChevronUpIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';

const InventoryView: React.FC<{
    products: Product[];
    inventory: InventoryItem[];
    onViewStockCard: (productId: string) => void;
}> = ({ products, inventory, onViewStockCard }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const inventoryMap = useMemo(() => new Map(inventory.map(item => [item.productId, item])), [inventory]);

    const combinedData = useMemo(() => {
        const data = products.map(product => {
            const stock = inventoryMap.get(product.id);
            return {
                product,
                quantity: stock?.quantity ?? 0,
                updatedAt: stock?.updatedAt
            };
        }).filter(item => 
            item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Sort logic
        data.sort((a, b) => {
            if (sortOrder === 'asc') {
                return a.product.name.localeCompare(b.product.name, 'th');
            } else {
                return b.product.name.localeCompare(a.product.name, 'th');
            }
        });

        return data;
    }, [products, inventoryMap, searchTerm, sortOrder]);

    const timeSince = (date?: Date): string => {
        if (!date) return 'N/A';
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " ปีที่แล้ว";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " เดือนที่แล้ว";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " วันที่แล้ว";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " ชั่วโมงที่แล้ว";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " นาทีที่แล้ว";
        return "เมื่อสักครู่";
    };

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const headers = [
        {
            name: (
                <button onClick={toggleSortOrder} className="flex items-center gap-1 group transition-colors hover:text-slate-800">
                    <span>รายการ</span>
                    {sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                </button>
            )
        },
        'หน่วย',
        { name: 'คงเหลือในคลัง', className: 'text-right'},
        'อัปเดตล่าสุด',
        'การดำเนินการ'
    ];

    return (
        <div>
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <label htmlFor="search-inventory" className="block text-sm font-medium text-slate-700">
                    ค้นหารายการ
                </label>
                <input
                    id="search-inventory"
                    type="text"
                    placeholder="พิมพ์ชื่อเวชภัณฑ์..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="mt-1 w-full md:w-1/2 px-3 py-2 border border-slate-300 rounded-lg shadow-sm"
                    autoComplete="off"
                />
            </div>

            <TableTemplate headers={headers}>
                {combinedData.map(item => (
                    <tr key={item.product.id} className={item.quantity <= 0 ? 'bg-red-50' : 'hover:bg-slate-50/70'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.product.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.product.unit}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${item.quantity <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.quantity.toLocaleString('th-TH')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{timeSince(item.updatedAt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <button 
                                onClick={() => onViewStockCard(item.product.id)} 
                                className="text-slate-500 hover:text-sky-600 transition-colors"
                                title="ดูประวัติ"
                            >
                                <ClockIcon className="w-5 h-5"/>
                            </button>
                        </td>
                    </tr>
                ))}
                 {combinedData.length === 0 && (
                    <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-500">ไม่พบรายการ</td>
                    </tr>
                )}
            </TableTemplate>
        </div>
    );
};

export default InventoryView;