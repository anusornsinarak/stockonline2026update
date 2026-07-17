

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Department, Product } from '../types';
import { supabaseService } from '../services/supabaseService';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import PrinterIcon from './icons/PrinterIcon';

interface PublicLoanRequestProps {
    appTitle: string;
}

const PrintView: React.FC<{
    departmentName: string;
    items: { productId: string; quantity: number }[];
    notes: string;
    productMap: Map<string, Product>;
}> = ({ departmentName, items, notes, productMap }) => {
    const itemsToPrint = items.filter(i => i.quantity > 0);
    return (
        <div className="hidden print-only p-8 font-sarabun">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">ใบยืมเวชภัณฑ์</h1>
                <p>หน่วยงาน: {departmentName}</p>
                <p>วันที่: {new Date().toLocaleDateString('th-TH')}</p>
            </div>
            <table className="w-full text-left border-collapse border border-slate-400">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-sm text-center">ลำดับ</th>
                        <th className="border border-slate-300 p-2 text-sm">รายการ</th>
                        <th className="border border-slate-300 p-2 text-sm text-center">หน่วย</th>
                        <th className="border border-slate-300 p-2 text-sm text-center">จำนวน</th>
                    </tr>
                </thead>
                <tbody>
                    {itemsToPrint.length > 0 ? itemsToPrint.map((item, index) => {
                        const product = productMap.get(item.productId);
                        return (
                            <tr key={item.productId}>
                                <td className="border border-slate-300 p-2 text-sm text-center">{index + 1}</td>
                                <td className="border border-slate-300 p-2 text-sm">{product?.name}</td>
                                <td className="border border-slate-300 p-2 text-sm text-center">{product?.unit}</td>
                                <td className="border border-slate-300 p-2 text-sm text-center font-bold">{item.quantity}</td>
                            </tr>
                        );
                    }) : (
                        <tr><td colSpan={4} className="text-center p-6 text-slate-500">ไม่มีรายการ</td></tr>
                    )}
                </tbody>
            </table>
            {notes && (
                <div className="mt-4">
                    <h2 className="font-semibold">หมายเหตุ:</h2>
                    <p className="p-2 border rounded bg-slate-50">{notes}</p>
                </div>
            )}
            <footer className="mt-24 grid grid-cols-2 gap-x-16 gap-y-16 text-sm">
                <div className="text-center">
                    <p className="mb-12">........................................................</p>
                    <p>(........................................................)</p>
                    <p>ผู้ยืม</p>
                </div>
                <div className="text-center">
                    <p className="mb-12">........................................................</p>
                    <p>(........................................................)</p>
                    <p>ผู้อนุมัติ/ผู้จ่าย</p>
                </div>
            </footer>
        </div>
    );
};

const PublicLoanRequest: React.FC<PublicLoanRequestProps> = ({ appTitle }) => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Form state
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const selectedDepartmentName = departmentMap.get(selectedDeptId) || '';

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [depts, products] = await Promise.all([
                supabaseService.getDepartments(),
                supabaseService.getProducts()
            ]);
            setDepartments(depts.sort((a,b) => a.name.localeCompare(b.name, 'th')));
            setAllProducts(products);
            if (depts.length > 0) {
                setSelectedDeptId(depts[0].id);
            }
        } catch (err) {
            setError("ไม่สามารถโหลดข้อมูลพื้นฐานได้ กรุณาลองรีเฟรชหน้า");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setItems([]);
        setNotes('');
        setSearchTerm('');
        if (departments.length > 0) {
            setSelectedDeptId(departments[0].id);
        }
    };

    const handleAddItem = (product: Product) => {
        if (!items.some(item => item.productId === product.id)) {
            setItems(prev => [...prev, { productId: product.id, quantity: 1 }]);
        }
        setSearchTerm('');
    };

    const handleRemoveItem = (productId: string) => {
        setItems(prev => prev.filter(item => item.productId !== productId));
    };

    const handleQuantityChange = (productId: string, value: string) => {
        const quantity = parseInt(value, 10);
        setItems(prev => prev.map(item =>
            item.productId === productId ? { ...item, quantity: isNaN(quantity) || quantity < 1 ? 1 : quantity } : item
        ));
    };

    const searchableProducts = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const currentProductIds = new Set(items.map(p => p.productId));
        return allProducts
            .filter(p => !currentProductIds.has(p.id) && p.name.toLowerCase().includes(lowerCaseSearchTerm))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 7);
    }, [allProducts, items, searchTerm]);

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.quantity > 0);
        if (!selectedDeptId || validItems.length === 0) {
            setError('กรุณาเลือกหน่วยงานและเพิ่มรายการที่ต้องการยืมอย่างน้อย 1 รายการ');
            return;
        }

        setError('');
        setIsSaving(true);
        try {
            await supabaseService.createDirectLoans(selectedDeptId, selectedDepartmentName, validItems, notes);
            setSuccessMessage('ส่งคำขอยืมสำเร็จ! เจ้าหน้าที่คลังจะดำเนินการตรวจสอบต่อไป');
            resetForm();
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งคำขอ');
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isLoading) {
        return <div className="text-center p-8">กำลังโหลดฟอร์ม...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto">
            <PrintView 
                departmentName={selectedDepartmentName}
                items={items}
                notes={notes}
                productMap={productMap}
            />
            <div className="no-print">
                <div className="text-center mb-6">
                    <DocumentTextIcon className="w-16 h-16 mx-auto text-sky-600" />
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">
                        ระบบยืมเวชภัณฑ์
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        {appTitle}
                    </p>
                </div>
                
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg space-y-6">
                    {error && <p className="p-3 bg-red-100 text-red-700 rounded-lg">{error}</p>}
                    {successMessage && <p className="p-3 bg-green-100 text-green-700 rounded-lg">{successMessage}</p>}
                    
                    <div>
                        <label htmlFor="department-select" className="block text-sm font-medium text-slate-700 dark:text-slate-200">หน่วยงานผู้ยืม</label>
                        <select
                            id="department-select"
                            value={selectedDeptId}
                            onChange={e => setSelectedDeptId(e.target.value)}
                            className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                        >
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ค้นหาและเพิ่มรายการ</label>
                        <div className="relative mt-1">
                            <input
                                type="text"
                                placeholder="พิมพ์ชื่อเวชภัณฑ์..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                            />
                            {searchableProducts.length > 0 && (
                                <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-48 overflow-auto">
                                    {searchableProducts.map(p => (
                                        <button key={p.id} onClick={() => handleAddItem(p)} className="w-full text-left px-4 py-2 hover:bg-sky-50 dark:hover:bg-sky-900/50 flex justify-between items-center">
                                            <span>{p.name} <span className="text-xs text-slate-500">({p.unit})</span></span>
                                            <PlusIcon className="w-5 h-5 text-sky-500" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">รายการที่ต้องการยืม ({items.length})</h3>
                        <div className="max-h-60 overflow-y-auto border dark:border-slate-700 rounded-lg">
                            <table className="min-w-full">
                                <thead className="bg-slate-100 dark:bg-slate-700/50 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left text-sm font-semibold text-slate-500 dark:text-slate-400">รายการ</th>
                                        <th className="p-2 text-right text-sm font-semibold text-slate-500 dark:text-slate-400">จำนวน</th>
                                        <th className="p-2 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {items.length > 0 ? items.map(item => {
                                        const product = productMap.get(item.productId);
                                        if (!product) return null;
                                        return (
                                            <tr key={item.productId}>
                                                <td className="p-2 text-sm text-slate-800 dark:text-slate-200">{product.name}</td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        value={item.quantity}
                                                        onChange={e => handleQuantityChange(item.productId, e.target.value)}
                                                        className="w-20 text-right px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md float-right"
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => handleRemoveItem(item.productId)}>
                                                        <TrashIcon className="w-5 h-5 text-slate-400 hover:text-red-500"/>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={3} className="text-center p-4 text-slate-500 dark:text-slate-400">ยังไม่มีรายการ</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">หมายเหตุ (ถ้ามี)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm"
                            placeholder="เช่น เหตุผลความจำเป็น, วันที่ต้องการใช้"
                        />
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-slate-600 gap-3">
                        <button
                            onClick={() => window.print()}
                            disabled={items.filter(i => i.quantity > 0).length === 0}
                            className="flex items-center gap-2 bg-slate-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-300"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            พิมพ์
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving || isLoading}
                            className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                        >
                            {isSaving ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยืม'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicLoanRequest;