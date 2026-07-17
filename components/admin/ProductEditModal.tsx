
import React, { useState, useEffect } from 'react';
import { Product, ProductCategory, productCategories, Company, ProductSupplier } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

interface ProductEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSave: (product: Product, companyIds: string[]) => void;
    allCompanies: Company[];
    productSuppliers: ProductSupplier[];
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({ isOpen, onClose, product, onSave, allCompanies, productSuppliers }) => {
    const [formData, setFormData] = useState<Omit<Product, 'id'>>({
        name: '',
        category: 'วัสดุการแพทย์ทั่วไป',
        unit: '',
        pricePerUnit: null,
        previousPricePerUnit: null,
        lastYearUsage: null,
        zone: null,
        minStock: null,
        maxStock: null,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            if (product) {
                setFormData({
                    name: product.name,
                    category: product.category,
                    unit: product.unit,
                    pricePerUnit: product.pricePerUnit,
                    previousPricePerUnit: product.previousPricePerUnit,
                    lastYearUsage: product.lastYearUsage,
                    zone: product.zone,
                    minStock: product.minStock,
                    maxStock: product.maxStock,
                });
                const currentSuppliers = productSuppliers
                    .filter(ps => ps.productId === product.id)
                    .map(ps => ps.companyId);
                setSelectedCompanyIds(new Set(currentSuppliers));
            } else {
                setFormData({
                    name: '',
                    category: 'วัสดุการแพทย์ทั่วไป',
                    unit: '',
                    pricePerUnit: 0,
                    previousPricePerUnit: 0,
                    lastYearUsage: 0,
                    zone: '',
                    minStock: 0,
                    maxStock: 0,
                });
                setSelectedCompanyIds(new Set());
            }
            setError('');
        }
    }, [product, isOpen, productSuppliers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumberField = ['pricePerUnit', 'previousPricePerUnit', 'lastYearUsage', 'minStock', 'maxStock'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumberField ? (value === '' ? null : Number(value)) : value }));
    };

    const handleCompanyToggle = (companyId: string) => {
        setSelectedCompanyIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(companyId)) {
                newSet.delete(companyId);
            } else {
                newSet.add(companyId);
            }
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        try {
            let savedProduct: Product;
            if (product) {
                // FIX: supabaseService.updateProduct now explicitly returns Promise<Product>
                savedProduct = await supabaseService.updateProduct({ id: product.id, ...formData });
            } else {
                // FIX: supabaseService.addProduct now explicitly returns Promise<Product>
                savedProduct = await supabaseService.addProduct(formData);
            }
            
            const companyIdsToSave = [...selectedCompanyIds];
            await supabaseService.setSuppliersForProduct(savedProduct.id, companyIdsToSave);
            onSave(savedProduct, companyIdsToSave);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ชื่อรายการ</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ประเภท</label>
                    <select name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                        {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">หน่วย</label>
                    <input type="text" name="unit" value={formData.unit} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ราคาปัจจุบัน/หน่วย</label>
                    <input type="number" step="0.01" name="pricePerUnit" value={formData.pricePerUnit ?? ''} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">บริษัทผู้จัดหา</label>
                    <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2 bg-slate-50 dark:bg-slate-700/50 dark:border-slate-600">
                        {allCompanies.length > 0 ? allCompanies.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(company => (
                            <label key={company.id} className="flex items-center p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600/50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCompanyIds.has(company.id)}
                                    onChange={() => handleCompanyToggle(company.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="ml-3 text-sm text-slate-900 dark:text-slate-300">{company.name}</span>
                            </label>
                        )) : <p className="text-sm text-slate-500 p-2">ไม่มีบริษัทในระบบ</p>}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Zone</label>
                    <input type="text" name="zone" value={formData.zone ?? ''} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Min Stock</label>
                        <input type="number" name="minStock" value={formData.minStock ?? ''} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Max Stock</label>
                        <input type="number" name="maxStock" value={formData.maxStock ?? ''} onChange={handleChange} className="mt-1 w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg" />
                    </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">ยกเลิก</button>
                    <button type="submit" disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
