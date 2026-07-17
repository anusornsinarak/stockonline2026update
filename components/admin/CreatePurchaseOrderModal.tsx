
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Company, Product, ProductSupplier } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';
import CalculatorIcon from '../icons/CalculatorIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';

interface CreatePurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    companies: Company[];
    products: Product[];
    productSuppliers: ProductSupplier[];
    onSave: () => void;
    inventoryMap: Map<string, number>;
}

interface PoItemRow {
    productId: string;
    quantity: number;
    pricePerUnit: number;
    searchQuery: string;
    isDropdownOpen: boolean;
}

const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
    isOpen,
    onClose,
    companies,
    products,
    productSuppliers,
    onSave,
    inventoryMap,
}) => {
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [items, setItems] = useState<PoItemRow[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isFallbackProductList, setIsFallbackProductList] = useState(false);

    const availableProducts = useMemo(() => {
        if (!selectedCompanyId) {
            setIsFallbackProductList(false);
            return [];
        }

        const suppliedProductIds = new Set(
            productSuppliers
                .filter(ps => ps.companyId === selectedCompanyId)
                .map(ps => ps.productId)
        );

        if (suppliedProductIds.size > 0) {
            setIsFallbackProductList(false);
            return products
                .filter(p => suppliedProductIds.has(p.id))
                .sort((a, b) => a.name.localeCompare(b.name, 'th'));
        }

        setIsFallbackProductList(true);
        return products.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    }, [selectedCompanyId, products, productSuppliers]);


    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const lowStockProducts = useMemo(() => {
        return availableProducts.filter(p => {
            const currentStock = inventoryMap.get(p.id) || 0;
            return p.minStock !== null && currentStock <= p.minStock;
        });
    }, [availableProducts, inventoryMap]);

    useEffect(() => {
        if (isOpen) {
            setSelectedCompanyId('');
            setItems([]);
            setError('');
            setIsSaving(false);
            setIsFallbackProductList(false);
        }
    }, [isOpen]);

    const handleAddItem = () => {
        setItems(prev => [...prev, { productId: '', quantity: 1, pricePerUnit: 0, searchQuery: '', isDropdownOpen: false }]);
    };
    
    const handleAddProductToOrder = (product: Product, quantity: number) => {
        if (items.some(i => i.productId === product.id)) return;

        setItems(prev => [...prev, { 
            productId: product.id, 
            quantity: quantity, 
            pricePerUnit: product.pricePerUnit || 0,
            searchQuery: product.name,
            isDropdownOpen: false
        }]);
    };

    const handleAddAllLowStock = () => {
        const newItems: PoItemRow[] = [];
        const currentIds = new Set(items.map(i => i.productId));

        lowStockProducts.forEach(p => {
            if (!currentIds.has(p.id)) {
                const currentStock = inventoryMap.get(p.id) || 0;
                const targetStock = p.maxStock || (p.minStock ? p.minStock * 2 : 0) || 10;
                const quantityNeeded = Math.max(1, targetStock - currentStock);
                
                newItems.push({
                    productId: p.id,
                    quantity: quantityNeeded,
                    pricePerUnit: p.pricePerUnit || 0,
                    searchQuery: p.name,
                    isDropdownOpen: false
                });
            }
        });
        setItems(prev => [...prev, ...newItems]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof PoItemRow, value: any) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            return { ...item, [field]: value };
        }));
    };

    const handleProductSelect = (index: number, product: Product) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            return {
                ...item,
                productId: product.id,
                searchQuery: product.name,
                pricePerUnit: product.pricePerUnit || 0,
                isDropdownOpen: false
            };
        }));
    };

    const handleSubmit = async () => {
        if (!selectedCompanyId) {
            setError('กรุณาเลือกบริษัท');
            return;
        }

        const validItems = items.filter(i => i.productId && i.quantity > 0);
        if (validItems.length === 0) {
            setError('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const company = companies.find(c => c.id === selectedCompanyId);
            if (!company) throw new Error('Company not found');

            const basket = {
                [selectedCompanyId]: {
                    companyName: company.name,
                    items: validItems.map(item => ({
                        product: {
                            ...productMap.get(item.productId)!,
                            pricePerUnit: item.pricePerUnit
                        },
                        quantity: item.quantity,
                    }))
                }
            };
            
            await supabaseService.createPurchaseOrders(basket);
            alert('สร้างใบสั่งซื้อสำเร็จ');
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };

    const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="สร้างใบสั่งซื้อใหม่" size="2xl">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">เลือกบริษัท</label>
                    <select
                        value={selectedCompanyId}
                        onChange={e => {
                            if (items.length > 0 && !window.confirm('การเปลี่ยนบริษัทจะล้างรายการที่เลือกไว้ ยืนยัน?')) return;
                            setSelectedCompanyId(e.target.value);
                            setItems([]);
                        }}
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md shadow-sm p-2"
                    >
                        <option value="">-- กรุณาเลือกบริษัท --</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {selectedCompanyId && isFallbackProductList && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg text-sm">
                        ไม่พบรายการที่ผูกกับบริษัทนี้โดยตรง จึงแสดงรายการสินค้าทั้งหมด
                    </div>
                )}


                {selectedCompanyId && (
                    <div className="space-y-6">
                        {/* Recommendations Section */}
                        {lowStockProducts.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold">
                                        <ExclamationTriangleIcon className="w-5 h-5" />
                                        <span>รายการแนะนำ (สินค้าใกล้หมด)</span>
                                    </div>
                                    <button 
                                        onClick={handleAddAllLowStock}
                                        className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-full font-medium transition-colors"
                                    >
                                        เพิ่มทั้งหมด
                                    </button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {lowStockProducts.map(p => {
                                        const currentStock = inventoryMap.get(p.id) || 0;
                                        const isAdded = items.some(i => i.productId === p.id);
                                        const targetStock = p.maxStock || (p.minStock ? p.minStock * 2 : 0) || 10;
                                        const qtyToOrder = Math.max(1, targetStock - currentStock);

                                        return (
                                            <div key={p.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-600 text-sm">
                                                <div className="flex-grow">
                                                    <span className="font-medium">{p.name}</span>
                                                    <div className="text-xs text-slate-500">
                                                        คงเหลือ: <span className="text-red-600 font-bold">{currentStock}</span> 
                                                        / Min: {p.minStock} / Max: {p.maxStock || '-'}
                                                    </div>
                                                </div>
                                                {isAdded ? (
                                                    <span className="text-green-600 flex items-center gap-1 text-xs font-bold px-2">
                                                        <CheckCircleIcon className="w-4 h-4"/> เพิ่มแล้ว
                                                    </span>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleAddProductToOrder(p, qtyToOrder)}
                                                        className="bg-sky-50 text-sky-600 hover:bg-sky-100 px-3 py-1 rounded text-xs font-medium flex items-center gap-1"
                                                    >
                                                        <PlusIcon className="w-3 h-3"/> เพิ่ม ({qtyToOrder})
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h4 className="font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <CalculatorIcon className="w-5 h-5 text-slate-500"/>
                                    รายการสินค้าในใบสั่งซื้อ
                                </h4>
                                <button 
                                    onClick={handleAddItem} 
                                    className="flex items-center gap-1 text-sm bg-sky-50 text-sky-600 px-3 py-1 rounded-full hover:bg-sky-100"
                                >
                                    <PlusIcon className="w-4 h-4" /> เพิ่มรายการเอง
                                </button>
                            </div>

                            <div className="border rounded-lg overflow-visible dark:border-slate-600">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">สินค้า (พิมพ์ค้นหา)</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">จำนวน</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-32">ราคา/หน่วย</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-32">รวม</th>
                                            <th className="px-4 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-700">
                                        {items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-4 py-2 relative">
                                                    <div className="relative">
                                                        <input 
                                                            type="text"
                                                            value={item.searchQuery}
                                                            onChange={(e) => handleItemChange(index, 'searchQuery', e.target.value)}
                                                            onFocus={() => handleItemChange(index, 'isDropdownOpen', true)}
                                                            placeholder="พิมพ์ชื่อสินค้า..."
                                                            className="w-full p-1 border-none bg-transparent focus:ring-0 text-sm outline-none"
                                                        />
                                                        {item.isDropdownOpen && (
                                                            <div className="absolute z-[100] left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                                {availableProducts
                                                                    .filter(p => !item.searchQuery || p.name.toLowerCase().includes(item.searchQuery.toLowerCase()))
                                                                    .map(p => (
                                                                        <button
                                                                            key={p.id}
                                                                            onClick={() => handleProductSelect(index, p)}
                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/30 border-b dark:border-slate-700 last:border-0"
                                                                        >
                                                                            <p className="font-medium">{p.name}</p>
                                                                            <p className="text-[10px] text-slate-500">คงเหลือ: {inventoryMap.get(p.id) || 0} {p.unit}</p>
                                                                        </button>
                                                                    ))
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                                        className="w-full text-right p-1 border rounded bg-slate-50 dark:bg-slate-600 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.pricePerUnit}
                                                        onChange={e => handleItemChange(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                                                        className="w-full text-right p-1 border rounded bg-slate-50 dark:bg-slate-600 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-right text-sm font-medium">
                                                    {(item.quantity * item.pricePerUnit).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                                                    ยังไม่มีรายการสินค้า เลือกจาก "รายการแนะนำ" ด้านบน หรือกด "เพิ่มรายการเอง"
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-sm">รวมทั้งสิ้น</td>
                                            <td className="px-4 py-2 text-right text-sm">{totalValue.toLocaleString()}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-600">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200">ยกเลิก</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSaving || !selectedCompanyId || items.length === 0}
                        className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:bg-slate-400"
                    >
                        {isSaving ? 'กำลังบันทึก...' : 'สร้างใบสั่งซื้อ'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CreatePurchaseOrderModal;
