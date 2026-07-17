
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Company, Product, ProductSupplier, User, PurchaseOrder, poStatusMap, CommitteeMember, POStatus, DocumentSettings, InventoryItem, Personnel, PurchaseOrderItem, ProductCategory, productCategories } from './types';
import PrinterIcon from './components/icons/PrinterIcon';
import { supabaseService } from './services/supabaseService';
import PlusIcon from './components/icons/PlusIcon';
import Modal from './components/Modal';
import PurchaseRequestPrintView from './components/admin/PurchaseRequestPrintView';
import * as XLSX from 'xlsx';
import DownloadIcon from './components/icons/DownloadIcon';
import TrashIcon from './components/icons/TrashIcon';
import CreatePurchaseOrderModal from './components/admin/CreatePurchaseOrderModal';

type ViewMode = 'list' | 'planner';

interface PurchaseOrderWithDetails extends PurchaseOrder {
    companyName?: string;
    items: (PurchaseOrderItem & { product?: Product })[];
}

// --- Reusable Components ---
const POStatusBadge: React.FC<{ status: POStatus }> = ({ status }) => {
    const statusInfo = poStatusMap[status] || { text: 'ไม่ทราบ', color: 'bg-gray-200 text-gray-800' };
    return <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>;
};

interface PurchaseOrderViewProps {
    user: User;
    onDataChange: () => void;
    purchaseOrders: PurchaseOrder[];
    companies: Company[];
    productSuppliers: ProductSupplier[];
    allProducts: Product[];
    inventory: InventoryItem[];
    documentSettings: DocumentSettings | null;
    onAddProduct: () => void;
    onAddCompany: () => void;
}

export const PurchaseOrderView: React.FC<PurchaseOrderViewProps> = (props) => {
    const { user, onDataChange, purchaseOrders = [], companies = [], productSuppliers = [], allProducts = [], inventory = [], documentSettings, onAddProduct, onAddCompany } = props;
    const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithDetails | null>(null);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        supabaseService.getPersonnel().then(setPersonnel);
    }, []);

    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);
    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
    const inventoryMap = useMemo(() => new Map<string, number>(inventory.map(i => [i.productId, i.quantity])), [inventory]);
    
    const poWithDetails = useMemo<PurchaseOrderWithDetails[]>(() => {
        // FIX: เพิ่มการตรวจสอบ purchaseOrders
        if (!purchaseOrders || !Array.isArray(purchaseOrders)) return [];
        return purchaseOrders.map((po: PurchaseOrder) => ({
            ...po,
            companyName: companyMap.get(po.companyId) || po.companyName,
            items: (po.items || []).map((item: PurchaseOrderItem) => ({...item, product: productMap.get(item.productId)}))
        }));
    }, [purchaseOrders, productMap, companyMap]);

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const detailsData = poWithDetails.map((po: PurchaseOrderWithDetails) =>
            (po.items || []).map(item => ({
                'เลขที่ PO': po.poNumber || '(ฉบับร่าง)',
                'บริษัท': po.companyName,
                'สถานะ': poStatusMap[po.status]?.text || po.status,
                'วันที่สร้าง': new Date(po.createdAt).toLocaleDateString('th-TH'),
                'รายการ': item.product?.name,
                'จำนวน': item.quantity,
                'ราคา/หน่วย': item.pricePerUnit,
                'มูลค่ารายการ': item.quantity * item.pricePerUnit
            }))
        ).flat();
        const ws_details = XLSX.utils.json_to_sheet(detailsData);
        XLSX.utils.book_append_sheet(wb, ws_details, "Details");
        XLSX.writeFile(wb, `PurchaseOrders_${new Date().toLocaleDateString('th-TH')}.xlsx`);
    };
    
    return (
        <div>
            <div className="no-print">
                <div className="flex justify-between items-center mb-6 no-print">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">รายการใบสั่งซื้อ (Purchase Orders)</h3>
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setIsCreateModalOpen(true)} 
                            className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700"
                         >
                            <PlusIcon className="w-5 h-5"/><span>สร้างใบสั่งซื้อ</span>
                         </button>
                         <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"><DownloadIcon className="w-5 h-5"/><span>Excel</span></button>
                    </div>
                </div>
                 <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
                     <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 po-table">
                        <thead className="bg-slate-100 dark:bg-slate-800/50">
                            <tr>
                                <th className="p-3 text-left text-sm font-semibold">เลขที่ PO</th>
                                <th className="p-3 text-left text-sm font-semibold">บริษัท</th>
                                <th className="p-3 text-right text-sm font-semibold">มูลค่ารวม</th>
                                <th className="p-3 text-left text-sm font-semibold">สถานะ</th>
                                <th className="p-3 text-left text-sm font-semibold">วันที่สร้าง</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="dark:bg-slate-800">
                            {poWithDetails.length > 0 ? poWithDetails.map((po: PurchaseOrderWithDetails) => (
                                 <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="p-3 text-sm font-semibold text-sky-700 dark:text-sky-400">{po.poNumber || '(ฉบับร่าง)'}</td>
                                    <td className="p-3 text-sm">{po.companyName}</td>
                                    <td className="p-3 text-sm text-right">{(po.totalValue || 0).toLocaleString('th-TH', {style:'currency', currency: 'THB'})}</td>
                                    <td className="p-3 text-sm"><POStatusBadge status={po.status} /></td>
                                    <td className="p-3 text-sm">{new Date(po.createdAt).toLocaleDateString('th-TH')}</td>
                                    <td className="p-3 text-right"><button onClick={() => setSelectedPO(po)} className="font-medium text-sky-600">จัดการ</button></td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500 italic">ไม่พบข้อมูลใบสั่งซื้อ</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal components logic remains the same */}
            {isCreateModalOpen && (
                <CreatePurchaseOrderModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    companies={companies}
                    products={allProducts}
                    productSuppliers={productSuppliers}
                    inventoryMap={inventoryMap}
                    onSave={onDataChange}
                />
            )}
        </div>
    );
};
