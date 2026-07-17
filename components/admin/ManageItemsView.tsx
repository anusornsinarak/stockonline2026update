


import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, Company, ProductSupplier, ProductCategory, productCategories, InventoryItem } from '../../types';
// FIX: Changed the import of 'supabaseService' from a default import to a named import to resolve the module resolution error.
import { supabaseService } from '../../services/supabaseService';
import EditIcon from '../icons/EditIcon';
import TrashIcon from '../icons/TrashIcon';
import BuildingOfficeIcon from '../icons/BuildingOfficeIcon';
import PlusIcon from '../icons/PlusIcon';
import UploadIcon from '../icons/UploadIcon';
import PrinterIcon from '../icons/PrinterIcon';
import TableTemplate from './TableTemplate';
import CompanyEditModal from './CompanyEditModal';
import AssignSuppliersModal from './AssignSuppliersModal';
import CompanyPrintReport from './CompanyPrintReport';
import QrCodeIcon from '../icons/QrCodeIcon';
import ProductQrCodeModal from './ProductQrCodeModal';

const ManageItemsView: React.FC<{ 
    products: Product[],
    companies: Company[],
    productSuppliers: ProductSupplier[],
    inventory: InventoryItem[],
    onAddProduct: () => void, 
    onEditProduct: (product: Product) => void,
    onImportProducts: () => void,
    onPrintLabels: () => void,
    onCompanyAdded: (company: Company) => void,
    onCompanyUpdated: (company: Company) => void,
    onCompanyDeleted: (companyId: string) => void,
    onProductSuppliersUpdated: (productId: string, companyIds: string[]) => void,
    onProductDeleted: (productId: string) => void,
}> = ({ products, companies, productSuppliers, inventory, onAddProduct, onEditProduct, onImportProducts, onPrintLabels, onCompanyAdded, onCompanyUpdated, onCompanyDeleted, onProductSuppliersUpdated, onProductDeleted }) => {
    type ManageItemsTab = 'products' | 'companies';
    const [activeSubTab, setActiveSubTab] = useState<ManageItemsTab>('products');
    const [companyToPrint, setCompanyToPrint] = useState<Company | null>(null);
    
    // State for modals
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [productToAssign, setProductToAssign] = useState<Product | null>(null);
    const [productForQr, setProductForQr] = useState<Product | null>(null);

    // State for filtering
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    
    const [isDeleting, setIsDeleting] = useState<string | null>(null);


    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const inventoryMap = useMemo(() => new Map(inventory.map(i => [i.productId, i.quantity])), [inventory]);

    const suppliersByProduct = useMemo(() => {
        const map = new Map<string, string[]>();
        productSuppliers.forEach(ps => {
            const suppliers = map.get(ps.productId) || [];
            const companyName = companyMap.get(ps.companyId);
            if (companyName) {
                suppliers.push(companyName);
            }
            map.set(ps.productId, suppliers);
        });
        return map;
    }, [productSuppliers, companyMap]);

    const productsByCompany = useMemo(() => {
        const map = new Map<string, Product[]>();
        productSuppliers.forEach(ps => {
            const prods = map.get(ps.companyId) || [];
            const product = productMap.get(ps.productId);
            if(product) {
                prods.push(product);
            }
            map.set(ps.companyId, prods);
        });
        return map;
    }, [productSuppliers, productMap]);
    
    const filteredProducts = useMemo(() => {
        const productsByCompanyId = new Map<string, Set<string>>();
        productSuppliers.forEach(ps => {
            if (!productsByCompanyId.has(ps.companyId)) {
                productsByCompanyId.set(ps.companyId, new Set());
            }
            productsByCompanyId.get(ps.companyId)!.add(ps.productId);
        });

        return products.filter(product => {
            const nameMatch = searchTerm.trim() === '' || product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
            const companyMatch = selectedCompany === 'all' || (productsByCompanyId.get(selectedCompany)?.has(product.id) ?? false);
            
            return nameMatch && categoryMatch && companyMatch;
        });
    }, [products, searchTerm, selectedCategory, selectedCompany, productSuppliers]);

    const groupedProducts = useMemo(() => {
        return filteredProducts.reduce((acc, product) => {
            const category = product.category || 'อื่นๆ';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(product);
            acc[category].sort((a,b) => a.name.localeCompare(b.name, 'th'));
            return acc;
        }, {} as Record<string, Product[]>);
    }, [filteredProducts]);

    const handlePrint = useCallback((company: Company) => {
        setCompanyToPrint(company);
    }, []);
    
    const handleDeleteProduct = async (product: Product) => {
        if (isDeleting) return;

        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการ "${product.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) {
            return;
        }

        setIsDeleting(product.id);
        try {
            await supabaseService.deleteProduct(product.id);
            onProductDeleted(product.id);
        } catch (err) {
            const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบ";
            console.error(message);
            alert(message);
        } finally {
            setIsDeleting(null);
        }
    };


    useEffect(() => {
        if (companyToPrint) {
            const handleAfterPrint = () => {
                setCompanyToPrint(null);
                window.removeEventListener('afterprint', handleAfterPrint);
            };
            window.addEventListener('afterprint', handleAfterPrint);
            // Timeout to allow state to update and component to re-render before printing
            setTimeout(() => window.print(), 50);
        }
    }, [companyToPrint]);

    if (companyToPrint) {
        return <CompanyPrintReport company={companyToPrint} products={productsByCompany.get(companyToPrint.id) || []} />;
    }

    return (
        <div>
            <div className="border-b border-slate-200 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Sub-tabs">
                    <button onClick={() => setActiveSubTab('products')} className={`${activeSubTab === 'products' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm transition-colors`}>
                        รายการเวชภัณฑ์
                    </button>
                    <button onClick={() => setActiveSubTab('companies')} className={`${activeSubTab === 'companies' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm transition-colors`}>
                        รายชื่อบริษัท
                    </button>
                </nav>
            </div>

            {activeSubTab === 'products' && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div>
                            <label htmlFor="search-name" className="block text-sm font-medium text-slate-700">ค้นหาจากชื่อ</label>
                            <input
                                id="search-name"
                                type="text"
                                placeholder="พิมพ์ชื่อรายการ..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                        </div>
                         <div>
                            <label htmlFor="filter-category" className="block text-sm font-medium text-slate-700">ค้นหาจากประเภท</label>
                            <select
                                id="filter-category"
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value as ProductCategory | 'all')}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                                <option value="all">ทั้งหมด</option>
                                {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-company" className="block text-sm font-medium text-slate-700">ค้นหาจากบริษัท</label>
                            <select
                                id="filter-company"
                                value={selectedCompany}
                                onChange={e => setSelectedCompany(e.target.value)}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                                <option value="all">ทั้งหมด</option>
                                {companies.sort((a, b) => a.name.localeCompare(b.name, 'th')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mb-4">
                        <button onClick={onAddProduct} className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 transition-colors">
                            <PlusIcon className="w-5 h-5"/>
                            เพิ่มรายการ
                        </button>
                        <button onClick={onImportProducts} className="flex items-center gap-2 bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors">
                            <UploadIcon className="w-5 h-5"/>
                            นำเข้าจาก Excel
                        </button>
                         <button onClick={onPrintLabels} className="flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
                            <QrCodeIcon className="w-5 h-5"/>
                            พิมพ์ฉลากสินค้า (QR/Barcode)
                        </button>
                    </div>
                    <div className="space-y-8">
                        {Object.keys(groupedProducts).length > 0
                            ? Object.keys(groupedProducts).sort((a,b) => productCategories.indexOf(a as ProductCategory) - productCategories.indexOf(b as ProductCategory)).map(category => {
                                const productsInCategory = groupedProducts[category];
                                return (
                                    <div key={category}>
                                        <h3 className="text-lg font-semibold text-slate-700 mb-3">{category}</h3>
                                        <TableTemplate headers={['รายการ', 'หน่วย', 'คงคลัง', 'Min', 'Max', 'ราคาปัจจุบัน (บาท)', 'บริษัทผู้จัดหา', 'การดำเนินการ']}>
                                            {productsInCategory.map(product => {
                                                const currentStock = inventoryMap.get(product.id) ?? 0;
                                                const isLowStock = product.minStock !== null && currentStock < product.minStock;
                                                return (
                                                <tr key={product.id} className={`hover:bg-slate-50/70 ${isLowStock ? 'bg-amber-50 dark:bg-amber-900/30' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{product.unit}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-center ${isLowStock ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700'}`}>{currentStock.toLocaleString()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-center">{product.minStock ?? '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-center">{product.maxStock ?? '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-semibold text-right">{Number(product.pricePerUnit || 0).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{(suppliersByProduct.get(product.id) || []).join(', ')}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-x-4">
                                                            <button 
                                                                onClick={() => onEditProduct(product)} 
                                                                className="text-sky-600 hover:text-sky-800 transition-colors"
                                                                title="แก้ไขรายการ"
                                                            >
                                                                <EditIcon className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => {setProductToAssign(product); setIsAssignModalOpen(true)}} 
                                                                className="text-gray-500 hover:text-sky-600 transition-colors"
                                                                title="กำหนดบริษัท"
                                                            >
                                                                <BuildingOfficeIcon className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => setProductForQr(product)}
                                                                className="text-teal-600 hover:text-teal-800 transition-colors"
                                                                title="แสดง Label (QR/Barcode)"
                                                            >
                                                                <QrCodeIcon className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteProduct(product)} 
                                                                disabled={isDeleting === product.id}
                                                                className="text-red-600 hover:text-red-800 disabled:text-slate-300 transition-colors"
                                                                title="ลบรายการ"
                                                            >
                                                                <TrashIcon className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )})}
                                        </TableTemplate>
                                    </div>
                                )
                            })
                            : (
                                <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
                                    <p className="text-slate-500">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</p>
                                </div>
                            )
                        }
                    </div>
                </div>
            )}
            
            {activeSubTab === 'companies' && (
                <div>
                     <div className="flex justify-end gap-3 mb-4">
                        <button onClick={() => {setEditingCompany(null); setIsCompanyModalOpen(true);}} className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 transition-colors">
                            <PlusIcon className="w-5 h-5"/>
                            เพิ่มบริษัท
                        </button>
                    </div>
                    <TableTemplate headers={['ชื่อบริษัท', 'การดำเนินการ']}>
                        {companies.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(company => (
                             <tr key={company.id} className="hover:bg-slate-50/70">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{company.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-x-6">
                                        <button onClick={() => {setEditingCompany(company); setIsCompanyModalOpen(true);}} className="text-sky-600 hover:text-sky-800 transition-colors" title="แก้ไข"><EditIcon className="w-5 h-5"/></button>
                                        <button onClick={async () => {
                                            if (window.confirm(`ต้องการลบบริษัท "${company.name}"?`)) {
                                                try {
                                                    await supabaseService.deleteCompany(company.id);
                                                    onCompanyDeleted(company.id);
                                                } catch(err) {
                                                    alert("เกิดข้อผิดพลาด: " + (err instanceof Error ? err.message : String(err)));
                                                }
                                            }
                                        }} className="text-red-600 hover:text-red-800 transition-colors" title="ลบ"><TrashIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handlePrint(company)} className="text-blue-600 hover:text-blue-800 transition-colors" title="พิมพ์รายการของบริษัทนี้"><PrinterIcon className="w-5 h-5"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </TableTemplate>
                </div>
            )}
            
            <CompanyEditModal 
                isOpen={isCompanyModalOpen}
                onClose={() => setIsCompanyModalOpen(false)}
                company={editingCompany}
                onSave={(company) => {
                    if (editingCompany) {
                        onCompanyUpdated(company);
                    } else {
                        onCompanyAdded(company);
                    }
                    setIsCompanyModalOpen(false);
                    setEditingCompany(null);
                }}
            />

            {productToAssign && (
                <AssignSuppliersModal
                    isOpen={isAssignModalOpen}
                    onClose={() => {setIsAssignModalOpen(false); setProductToAssign(null);}}
                    product={productToAssign}
                    allCompanies={companies}
                    productSuppliers={productSuppliers}
                    onSave={(productId, companyIds) => {
                        onProductSuppliersUpdated(productId, companyIds);
                        setIsAssignModalOpen(false);
                        setProductToAssign(null);
                    }}
                />
            )}

            {productForQr && (
                <ProductQrCodeModal
                    isOpen={!!productForQr}
                    onClose={() => setProductForQr(null)}
                    product={productForQr}
                />
            )}
        </div>
    );
};

export default ManageItemsView;
