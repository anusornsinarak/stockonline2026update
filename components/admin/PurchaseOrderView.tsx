
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Company, Product, ProductSupplier, User, PurchaseOrder, poStatusMap, CommitteeMember, POStatus, DocumentSettings, InventoryItem, Personnel, PurchaseOrderItem, ProductCategory, productCategories } from '../../types';
import PrinterIcon from '../icons/PrinterIcon';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import Modal from '../Modal';
import PurchaseRequestPrintView from './PurchaseRequestPrintView';
import * as XLSX from 'xlsx';
import DownloadIcon from '../icons/DownloadIcon';
import TrashIcon from '../icons/TrashIcon';
import CreatePurchaseOrderModal from './CreatePurchaseOrderModal';

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

const CommitteeForm: React.FC<{ 
    committees: CommitteeMember[], 
    setCommittees: React.Dispatch<React.SetStateAction<CommitteeMember[]>>, 
    totalValue: number,
    uniqueCommittees: Personnel[],
    isReadOnly: boolean,
}> = ({ committees, setCommittees, totalValue, uniqueCommittees, isReadOnly }) => {
    const isOverThreshold = totalValue >= 100000;
    const requiredChairman = 1;
    const requiredMembers = isOverThreshold ? 2 : 0;
    
    const handleCommitteeChange = (index: number, field: 'name' | 'position', value: string) => {
        const newCommittees = [...committees];
        if (!newCommittees[index]) return;

        const currentMember = newCommittees[index];
        newCommittees[index] = { ...currentMember, [field]: value };

        if (field === 'name') {
            const matchedMember = uniqueCommittees.find(uc => uc.name === value);
            if (matchedMember) {
                newCommittees[index].position = matchedMember.position;
            }
        }
        setCommittees(newCommittees);
    };

    const renderMemberInputs = (role: 'ประธานกรรมการ' | 'กรรมการ', startIndex: number, count: number) => {
        return Array.from({ length: count }).map((_, i) => {
            const committeeIndex = startIndex + i;
            if (!committees[committeeIndex]) {
                 // Ensure the committee object exists
                 setTimeout(() => {
                    setCommittees(prev => {
                        const newCommittees = [...prev];
                        if (!newCommittees[committeeIndex]) {
                             newCommittees[committeeIndex] = { name: '', position: '', role };
                        }
                        return newCommittees;
                    });
                }, 0);
                return null;
            }
            return (
                <div key={committeeIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 border-l-4 border-slate-200 dark:border-slate-600">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">ชื่อ-สกุล ({role} {role === 'กรรมการ' ? `#${i+1}`: ''})</label>
                        <input
                            type="text"
                            list="personnel-names"
                            value={committees[committeeIndex].name}
                            onChange={(e) => handleCommitteeChange(committeeIndex, 'name', e.target.value)}
                            className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"
                            placeholder="ชื่อ-สกุล"
                            disabled={isReadOnly}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">ตำแหน่ง</label>
                        <input
                            type="text"
                            value={committees[committeeIndex].position}
                            onChange={(e) => handleCommitteeChange(committeeIndex, 'position', e.target.value)}
                            className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"
                            placeholder="ตำแหน่ง"
                            disabled={isReadOnly}
                        />
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">คณะกรรมการตรวจรับ</h4>
            {renderMemberInputs('ประธานกรรมการ', 0, requiredChairman)}
            {isOverThreshold && renderMemberInputs('กรรมการ', requiredChairman, requiredMembers)}
            <datalist id="personnel-names">
                {uniqueCommittees.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
        </div>
    );
};

const PurchaseOrderPrintView: React.FC<{
    po: PurchaseOrder;
    companyName: string;
}> = ({ po, companyName }) => {
    return (
        <div className="hidden print-only p-8 font-sarabun">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-center">ใบสั่งซื้อ / Purchase Order</h1>
            </header>
            <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                <div>
                    <p><strong>บริษัท:</strong> {companyName}</p>
                </div>
                <div className="text-right">
                    <p><strong>เลขที่:</strong> {po.poNumber || 'N/A'}</p>
                    <p><strong>วันที่:</strong> {new Date(po.orderedAt || po.createdAt).toLocaleDateString('th-TH')}</p>
                </div>
            </div>
            <table className="w-full text-left border-collapse border border-slate-400">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-sm text-center">ลำดับ</th>
                        <th className="border border-slate-300 p-2 text-sm">รายการ</th>
                        <th className="border border-slate-300 p-2 text-sm text-center">จำนวน</th>
                        <th className="border border-slate-300 p-2 text-sm text-right">ราคา/หน่วย</th>
                        <th className="border border-slate-300 p-2 text-sm text-right">รวม</th>
                    </tr>
                </thead>
                <tbody>
                    {po.items.map((item, index) => (
                        <tr key={item.id || index}>
                            <td className="border border-slate-300 p-2 text-sm text-center">{index + 1}</td>
                            <td className="border border-slate-300 p-2 text-sm">{(item as any).product?.name || 'Unknown'}</td>
                            <td className="border border-slate-300 p-2 text-sm text-center">{item.quantity}</td>
                            <td className="border border-slate-300 p-2 text-sm text-right">{(item.pricePerUnit || 0).toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 text-sm text-right">{((item.quantity || 0) * (item.pricePerUnit || 0)).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={4} className="border border-slate-300 p-2 text-right font-bold">รวมทั้งสิ้น</td>
                        <td className="border border-slate-300 p-2 text-right font-bold">{(po.totalValue || 0).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

const PurchaseOrderDetailModal: React.FC<{
    po: PurchaseOrderWithDetails;
    onClose: () => void;
    onDataChange: () => void;
    allProducts: Product[];
    purchasePlan?: { productId: string; fiscalYear: number; plannedQuantity: number; }[];
    viewFiscalYear?: number;
    uniqueCommittees: Personnel[];
    inventoryMap: Map<string, number>;
    documentSettings: DocumentSettings | null;
}> = ({ po, onClose, onDataChange, allProducts, purchasePlan, viewFiscalYear, uniqueCommittees, inventoryMap, documentSettings }) => {
    const [committees, setCommittees] = useState<CommitteeMember[]>(po.committees || []);
    const [poNumber, setPoNumber] = useState(po.poNumber || '');
    const [status, setStatus] = useState<POStatus>(po.status);
    const [isSaving, setIsSaving] = useState(false);
    const [showPrint, setShowPrint] = useState<'po' | 'request' | null>(null);

    const [items, setItems] = useState(po.items);

    const totalValue = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.pricePerUnit || 0)), 0);

    useEffect(() => {
        if (showPrint) {
            const timer = setTimeout(() => window.print(), 100);
            const afterPrint = () => setShowPrint(null);
            window.addEventListener('afterprint', afterPrint, {once: true});
            return () => {
                clearTimeout(timer);
                window.removeEventListener('afterprint', afterPrint);
            };
        }
    }, [showPrint]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const poData = {
                po_number: poNumber,
                status: status,
                total_value: totalValue,
                ordered_at: status === 'Ordered' && po.status !== 'Ordered' ? new Date().toISOString() : po.orderedAt
            };
            
            const dbItems = items.map(i => ({
                product_id: i.productId,
                quantity: i.quantity,
                price_per_unit: i.pricePerUnit
            }));

            const dbCommittees = committees.filter(c => c.name.trim() !== '').map((c, index) => ({
                name: c.name,
                position: c.position,
                role: c.role,
                ordering: index
            }));

            await supabaseService.updatePurchaseOrderDetails(po.id, poData, dbItems, dbCommittees);
            
            onDataChange();
            onClose();
        } catch (error) {
            alert('Failed to save PO');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`รายละเอียดใบสั่งซื้อ (PO)`} size="3xl">
            {showPrint === 'po' && <PurchaseOrderPrintView po={{...po, items, totalValue, poNumber, status}} companyName={po.companyName || ''} />}
            {showPrint === 'request' && <PurchaseRequestPrintView po={{...po, items, totalValue, poNumber, status, committees}} companyName={po.companyName || ''} documentSettings={documentSettings} inventoryMap={inventoryMap} purchasePlan={purchasePlan} viewFiscalYear={viewFiscalYear} />}
            
            <div className="space-y-6 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">เลขที่ PO</label>
                        <div className="flex">
                            <span className="p-2 border border-r-0 rounded-l bg-slate-50 text-slate-500 whitespace-nowrap">ปจ 0033.201/2/</span>
                            <input type="text" value={poNumber ? poNumber.replace(/^ปจ 0033\.201\/2\//, '') : ''} onChange={e => {
                                const val = e.target.value;
                                setPoNumber(val ? `ปจ 0033.201/2/${val}` : '');
                            }} className="w-full p-2 border rounded-r focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="เช่น 14402" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">สถานะ</label>
                        <select value={status} onChange={e => setStatus(e.target.value as POStatus)} className="w-full p-2 border rounded">
                            {Object.entries(poStatusMap).map(([k, v]) => (
                                <option key={k} value={k}>{v.text}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <CommitteeForm committees={committees} setCommittees={setCommittees} totalValue={totalValue} uniqueCommittees={uniqueCommittees} isReadOnly={status === 'Completed' || status === 'Cancelled'} />

                <div>
                    <h4 className="font-semibold mb-2">รายการสินค้า</h4>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">รายการ</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">จำนวน</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">ราคา/หน่วย</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">รวม</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="px-4 py-2 text-sm">{item.product?.name}</td>
                                    <td className="px-4 py-2 text-sm text-right">{(item.quantity || 0).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-sm text-right">{(item.pricePerUnit || 0).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-sm text-right">{((item.quantity || 0) * (item.pricePerUnit || 0)).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-right mt-2 font-bold">
                        รวมทั้งสิ้น: {(totalValue || 0).toLocaleString()} บาท
                    </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                    <div className="flex gap-2">
                        <button onClick={() => setShowPrint('request')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
                            <PrinterIcon className="w-4 h-4" /> พิมพ์บันทึกข้อความ
                        </button>
                        <button onClick={() => setShowPrint('po')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
                            <PrinterIcon className="w-4 h-4" /> พิมพ์ใบสั่งซื้อ
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50">ปิด</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400">
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

interface PurchaseOrderViewProps {
    user: User;
    onDataChange: () => void;
    purchaseOrders: PurchaseOrder[];
    companies: Company[];
    productSuppliers: ProductSupplier[];
    allProducts: Product[];
    purchasePlan?: { productId: string; fiscalYear: number; plannedQuantity: number; }[];
    viewFiscalYear?: number;
    inventory: InventoryItem[];
    documentSettings: DocumentSettings | null;
    onAddProduct: () => void;
    onAddCompany: () => void;
}

export const PurchaseOrderView: React.FC<PurchaseOrderViewProps> = (props) => {
    const { user, onDataChange, purchaseOrders, companies, productSuppliers, allProducts, purchasePlan, viewFiscalYear, inventory, documentSettings, onAddProduct, onAddCompany } = props;
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
                            {poWithDetails.map((po: PurchaseOrderWithDetails) => (
                                 <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="p-3 text-sm font-semibold text-sky-700 dark:text-sky-400">{po.poNumber || '(ฉบับร่าง)'}</td>
                                    <td className="p-3 text-sm">{po.companyName}</td>
                                    <td className="p-3 text-sm text-right">{(po.totalValue || 0).toLocaleString('th-TH', {style:'currency', currency: 'THB'})}</td>
                                    <td className="p-3 text-sm"><POStatusBadge status={po.status} /></td>
                                    <td className="p-3 text-sm">{new Date(po.createdAt).toLocaleDateString('th-TH')}</td>
                                    <td className="p-3 text-right"><button onClick={() => setSelectedPO(po)} className="font-medium text-sky-600">จัดการ</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {selectedPO && (
                <PurchaseOrderDetailModal 
                    po={selectedPO} 
                    onClose={() => setSelectedPO(null)}
                    onDataChange={onDataChange}
                    allProducts={allProducts}
                    purchasePlan={purchasePlan}
                    viewFiscalYear={viewFiscalYear}
                    uniqueCommittees={personnel}
                    inventoryMap={inventoryMap}
                    documentSettings={documentSettings}
                />
            )}

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
