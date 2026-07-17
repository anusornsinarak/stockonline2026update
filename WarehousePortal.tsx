
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Product, Department, Requisition, User, InventoryItem, GoodsReceivedNote, RequisitionItem, SystemLog, WarehouseTab, PurchaseOrder, PurchasePlanItem, SurveyEntry, ProductUsageHistory, DocumentSettings, RequisitionStatus, requisitionStatusMap, RequisitionItemStatus, BackOrderItem, LoanItem, Company } from './types';
import { supabaseService } from './services/supabaseService';
import { supabase } from './supabaseClient';
import { ManageRequisitionsView } from './components/admin/ManageRequisitionsView';
import PickingView from './components/PickingView';
import { GoodsReceivingView } from './components/GoodsReceivingView';
import StockCardView from './components/admin/StockCardView';
import { ReportsView } from './components/ReportsView';
import ClipboardDocumentListIcon from './components/icons/ClipboardDocumentListIcon';
import InboxArrowDownIcon from './components/icons/InboxArrowDownIcon';
import CubeIcon from './components/icons/CubeIcon';
import ClockIcon from './components/icons/ClockIcon';
import ChartBarIcon from './components/icons/ChartBarIcon';
import CogIcon from './components/icons/CogIcon';
import AccountSettingsPortal from './components/AccountSettingsPortal';
import ArrowPathIcon from './components/icons/ArrowPathIcon';
import CreateRequisitionForDeptModal from './components/admin/CreateRequisitionForDeptModal';
import DocumentPlusIcon from './components/icons/DocumentPlusIcon';
import LoadingScreen from './components/LoadingScreen';

import { LoanSystemView } from './components/admin/LoanSystemView';

type MergedWarehouseTab = 'requisitions' | 'receipts' | 'stockCard' | 'reports' | 'loanSystem';

interface WarehousePortalProps {
    user: User;
    nextFiscalYearBE: number;
    initialTab?: MergedWarehouseTab | { tab: MergedWarehouseTab, subTab: string, action?: string } | 'create_for_dept';
    stopAlert: () => void;
}

const WarehousePortal: React.FC<WarehousePortalProps> = ({ user, nextFiscalYearBE, initialTab, stopAlert }) => {
    const [activeTab, setActiveTab] = useState<MergedWarehouseTab>('requisitions');
    const [initialSubTab, setInitialSubTab] = useState<string | null>(null);
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [purchasePlan, setPurchasePlan] = useState<PurchasePlanItem[]>([]);
    const [surveyResults, setSurveyResults] = useState<SurveyEntry[]>([]);
    const [productUsageHistory, setProductUsageHistory] = useState<ProductUsageHistory[]>([]);
    const [documentSettings, setDocumentSettings] = useState<DocumentSettings | null>(null);
    const [backorders, setBackorders] = useState<BackOrderItem[]>([]);
    const [loans, setLoans] = useState<LoanItem[]>([]);
    const [goodsReceivedNotes, setGoodsReceivedNotes] = useState<GoodsReceivedNote[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requisitionForPickingView, setRequisitionForPickingView] = useState<Requisition | null>(null);
    const [isPickingPreview, setIsPickingPreview] = useState(false);
    const [showRefreshBanner, setShowRefreshBanner] = useState(false);
    const [isCreateForDeptModalOpen, setIsCreateForDeptModalOpen] = useState(false);
    const [createForDeptInitialPurpose, setCreateForDeptInitialPurpose] = useState<'requisition' | 'loan'>('requisition');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const lastProcessedInitialTabRef = useRef<string | null>(null);

    const handleOpenCreateForDeptModal = (purpose: 'requisition' | 'loan' = 'requisition') => {
        setCreateForDeptInitialPurpose(purpose);
        setIsCreateForDeptModalOpen(true);
    };

    useEffect(() => {
        if (initialTab) {
            const tabString = JSON.stringify(initialTab);
            if (tabString === lastProcessedInitialTabRef.current) return;
            
            lastProcessedInitialTabRef.current = tabString;

            if (typeof initialTab === 'object' && initialTab !== null && 'tab' in initialTab) {
                setActiveTab(initialTab.tab);
                setInitialSubTab((initialTab as any).subTab);
                if ((initialTab as any).action === 'openFulfillLoanModal') {
                    handleOpenCreateForDeptModal('loan');
                }
            } else if (typeof initialTab === 'string') {
                if (initialTab === 'create_for_dept') {
                    handleOpenCreateForDeptModal();
                    setActiveTab('requisitions');
                } else {
                    setActiveTab(initialTab as MergedWarehouseTab);
                }
                setInitialSubTab(null);
            }
        }
    }, [initialTab]);

    const fetchData = useCallback(async (isBackground: boolean = false) => {
        if (!isBackground) setIsLoading(true);
        setError(null);
        try {
            const [reqs, depts, prods, inv, pos, plan, surveys, usage, settings, allLoansFromDb, grns, comps] = await Promise.all([
                supabaseService.getRequisitionsForAdmin(),
                supabaseService.getDepartments(),
                supabaseService.getProducts(),
                supabaseService.getInventory(),
                supabaseService.getPurchaseOrdersForAdmin(),
                supabaseService.getPurchasePlan(nextFiscalYearBE),
                supabaseService.getSurveySubmissions(nextFiscalYearBE),
                supabaseService.getProductUsageHistory(),
                supabaseService.getSystemSettings(),
                supabaseService.getLoansForAdmin(),
                supabaseService.getGoodsReceivedNotesWithDetails(),
                supabaseService.getCompanies(),
            ]);

            setRequisitions(reqs);
            setDepartments(depts);
            setProducts(prods);
            setInventory(inv);
            setPurchaseOrders(pos);
            setPurchasePlan(plan);
            setSurveyResults(surveys);
            setProductUsageHistory(usage);
            setGoodsReceivedNotes(grns);
            setCompanies(comps);
            
            const derivedBackorders = reqs
                .flatMap(r => {
                    const departmentName = depts.find(d => d.id === r.departmentId)?.name;
                    return r.items?.filter(i => i.status === 'Backordered').map(i => {
                        const backorderedQty = i.quantity - (i.approvedQuantity || 0);
                        if (backorderedQty <= 0) return null;
                        return {
                            id: i.id!,
                            createdAt: new Date(r.createdAt),
                            originalRequisitionId: r.id,
                            productId: i.productId,
                            departmentId: r.departmentId,
                            quantity: backorderedQty,
                            productName: i.product?.name,
                            departmentName: departmentName,
                            requisitionNumber: r.requisitionNumber,
                        };
                    }) || [];
                })
                .filter((item): item is NonNullable<typeof item> => item !== null)
                .map((item): BackOrderItem => ({
                    ...item,
                    productName: item.productName || undefined,
                    departmentName: item.departmentName || undefined,
                }));
            setBackorders(derivedBackorders);

            const derivedLoansFromReqs = reqs
                .flatMap(r => {
                    const departmentName = depts.find(d => d.id === r.departmentId)?.name;
                    return r.items?.filter(i => i.status === 'Loaned').map(i => {
                        const loanedQty = i.approvedQuantity !== null && i.approvedQuantity !== undefined ? i.approvedQuantity : i.quantity;
                        if (loanedQty <= 0) return null;
                        const loanItem: LoanItem = {
                            id: i.id!,
                            createdAt: new Date(r.createdAt),
                            originalRequisitionId: r.id,
                            productId: i.productId,
                            departmentId: r.departmentId,
                            quantity: loanedQty,
                            status: 'Pending',
                            fulfilledAt: null,
                            isDerived: true,
                            productName: i.product?.name,
                            departmentName: departmentName,
                            requisitionNumber: r.requisitionNumber,
                        };
                        return loanItem;
                    }) || [];
                })
                .filter((item): item is LoanItem => item !== null);

            const finalLoans = [...allLoansFromDb];
            const dbReqLoanKeys = new Set(
                allLoansFromDb
                    .filter(l => l.originalRequisitionId)
                    .map(l => `${l.originalRequisitionId}_${l.productId}`)
            );
            derivedLoansFromReqs.forEach(loanFromReq => {
                const key = `${loanFromReq.originalRequisitionId}_${loanFromReq.productId}`;
                if (!dbReqLoanKeys.has(key)) {
                    finalLoans.push(loanFromReq);
                }
            });
            setLoans(finalLoans);

            setDocumentSettings({ 
                hospitalName: settings.hospital_name, 
                documentApproverName: settings.document_approver_name, 
                documentApproverPosition: settings.document_approver_position,
                documentIssuerName: settings.document_issuer_name,
                documentIssuerPosition: settings.document_issuer_position,
                documentDisbursementApproverName: settings.document_disbursement_approver_name,
                documentDisbursementApproverPosition: settings.document_disbursement_approver_position,
                documentReceiverName: settings.document_receiver_name,
                documentReceiverPosition: settings.document_receiver_position
            });
        } catch (err) {
            console.error(err);
            setError("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleBannerRefresh = () => { setShowRefreshBanner(false); fetchData(true); };

    const handleViewPickingList = (req: Requisition, isPreview: boolean) => {
        const deptName = departments.find(d => d.id === req.departmentId)?.name;
        setRequisitionForPickingView({ ...req, departmentName: deptName });
        setIsPickingPreview(isPreview);
    };

    const handleClosePickingView = () => {
        setRequisitionForPickingView(null);
        setIsPickingPreview(false);
        fetchData(true);
    };

    const handleProcessRequisition = async (newItemsFromPicker: RequisitionItem[], editReason?: string | null) => {
        if (!requisitionForPickingView) return;

        setIsProcessing(requisitionForPickingView.id);
        const originalItems = requisitionForPickingView.items || [];
        const originalStatus = requisitionForPickingView.status;

        const stockAdjustments: { productId: string, delta: number }[] = [];
        const allProductIds = new Set([...originalItems.map(i => i.productId), ...newItemsFromPicker.map(i => i.productId)]);

        for (const productId of allProductIds) {
            const originalItem = originalItems.find(i => i.productId === productId);
            const newItem = newItemsFromPicker.find(i => i.productId === productId);
            
            const oldApprovedQty = (originalStatus === 'Submitted' || originalStatus === 'Picking') ? 0 : (originalItem?.approvedQuantity ?? 0);
            const newApprovedQty = newItem ? (newItem.approvedQuantity ?? 0) : 0;
            
            const delta = oldApprovedQty - newApprovedQty;

            if (delta !== 0) stockAdjustments.push({ productId, delta });
        }

        const appliedAdjustments: { productId: string, delta: number }[] = [];
        try {
            for (const adj of stockAdjustments) {
                await supabaseService.adjustStockQuantity(adj.productId, adj.delta, `แก้ไขใบเบิก #${requisitionForPickingView.requisitionNumber}: ${editReason || 'อนุมัติ'}`);
                appliedAdjustments.push(adj);
            }

            await supabaseService.updateProcessedRequisitionItems(requisitionForPickingView.id, newItemsFromPicker, editReason || null);
            
            // เมื่อกดตัดสต็อกให้เป็น Ready (พร้อมจ่าย/อนุมัติแล้ว) เสมอ
            await supabaseService.updateRequisitionStatus(requisitionForPickingView.id, 'Ready');
            alert('อนุมัติและตัดสต็อกใบเบิกสำเร็จ');
            
            handleClosePickingView();
        } catch (error: any) {
            for (const applied of appliedAdjustments.reverse()) {
                try {
                    await supabaseService.adjustStockQuantity(applied.productId, -applied.delta, `ROLLBACK: แก้ไขใบเบิก #${requisitionForPickingView.requisitionNumber} ล้มเหลว`);
                } catch (rollbackError) {
                    console.error(`CRITICAL: Rollback failed!`, rollbackError);
                }
            }
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleSimpleApproval = async (items: RequisitionItem[]) => {
        if (!requisitionForPickingView) return;
        setIsProcessing(requisitionForPickingView.id);
        try {
            const hasLoansOrBackorders = items.some(i => i.status === 'Loaned' || i.status === 'Backordered');
            const hasApprovedItems = items.some(i => (i.approvedQuantity || 0) > 0 && ['Approved', 'Fulfilled', 'Pending'].includes(i.status));
            const allAreRejected = items.every(i => i.status === 'Rejected');
            
            let finalStatus: RequisitionStatus;
            
            if (allAreRejected) {
                finalStatus = 'Rejected';
            } else if (hasLoansOrBackorders || (hasApprovedItems && items.some(i => i.status === 'Rejected'))) {
                finalStatus = 'PartiallyApproved';
            } else {
                // บังคับสถานะเป็น Ready (อนุมัติแล้ว/พร้อมจ่าย) เสมอเพื่อให้ผู้เบิกมองเห็นยอดอนุมัติได้ทันที
                finalStatus = 'Ready';
            }

            await supabaseService.saveSimpleApproval(requisitionForPickingView.id, items, finalStatus);
            alert('บันทึกการอนุมัติสำเร็จ! (สถานะ: อนุมัติแล้ว/พร้อมจ่าย)');
            handleClosePickingView();
        } catch (error: any) {
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleChangeTab = (tab: MergedWarehouseTab) => {
        if (tab === 'requisitions') stopAlert();
        setActiveTab(tab);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'requisitions': return <ManageRequisitionsView user={user} requisitions={requisitions} departments={departments} allProducts={products} inventory={inventory} backorders={backorders} loans={loans} onDataChange={() => fetchData(true)} onViewPickingList={handleViewPickingList} onOpenCreateForDeptModal={handleOpenCreateForDeptModal} initialSubTab={initialSubTab} documentSettings={documentSettings} />;
            case 'receipts': return <GoodsReceivingView user={user} allProducts={products} onDataChange={() => fetchData(true)} />;
            case 'stockCard': return <StockCardView allProducts={products} inventory={inventory} goodsReceivedNotes={goodsReceivedNotes} purchaseOrders={purchaseOrders} companies={companies} onDataChange={() => fetchData(true)} />;
            case 'reports': return <ReportsView requisitions={requisitions} products={products} departments={departments} inventory={inventory} goodsReceivedNotes={goodsReceivedNotes} purchasePlan={purchasePlan} surveyResults={surveyResults} productUsageHistory={productUsageHistory} documentSettings={documentSettings} />;
            case 'loanSystem': return <LoanSystemView departments={departments} allProducts={products} currentUser={user} />;
            default: return null;
        }
    };

    if (isLoading) return <LoadingScreen message="กำลังโหลดข้อมูลพื้นฐาน..." />;
    if (error) return <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg text-center text-red-600">{error}</div>;

    if (requisitionForPickingView) {
        return (
            <PickingView
                requisition={requisitionForPickingView}
                allProducts={products}
                inventoryMap={new Map(inventory.map(i => [i.productId, i.quantity]))}
                onClose={handleClosePickingView}
                isPreview={isPickingPreview}
                onItemsUpdated={() => fetchData(true)}
                onProcessRequisitionWithStock={handleProcessRequisition}
                onProcessSimple={handleSimpleApproval}
                documentSettings={documentSettings}
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg">
             {showRefreshBanner && (
                <div className="sticky top-0 z-10 mb-4 animate-fade-in -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 p-2">
                    <div className="bg-sky-100 dark:bg-sky-900 border-b border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 px-4 py-3 shadow-lg flex items-center justify-between rounded-t-2xl">
                        <span className="font-medium">มีข้อมูลใหม่เข้ามาในระบบ!</span>
                        <button onClick={handleBannerRefresh} className="flex items-center gap-2 bg-sky-50 text-white font-bold py-1 px-4 rounded-lg"><ArrowPathIcon className="w-4 h-4" />รีเฟรช</button>
                    </div>
                </div>
            )}
            <div className="border-b border-slate-200 dark:border-slate-700 mb-6 no-print">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => handleChangeTab('requisitions')} className={`${activeTab === 'requisitions' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors`}><ClipboardDocumentListIcon className="w-5 h-5 mr-2" />รายการเบิก</button>
                    {user.permissions?.canManageReceipts && <button onClick={() => handleChangeTab('receipts')} className={`${activeTab === 'receipts' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors`}><InboxArrowDownIcon className="w-5 h-5 mr-2" />รับของ</button>}
                    {user.permissions?.canViewStockCard && <button onClick={() => handleChangeTab('stockCard')} className={`${activeTab === 'stockCard' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors`}><CubeIcon className="w-5 h-5 mr-2" />คลัง/สต็อกการ์ด</button>}
                    <button onClick={() => handleChangeTab('loanSystem')} className={`${activeTab === 'loanSystem' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors`}><ArrowPathIcon className="w-5 h-5 mr-2" />ระบบยืม-คืน</button>
                    {user.permissions?.canViewReports && <button onClick={() => handleChangeTab('reports')} className={`${activeTab === 'reports' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors`}><ChartBarIcon className="w-5 h-5 mr-2" />รายงาน</button>}
                </nav>
            </div>
            {renderContent()}
            {isCreateForDeptModalOpen && (
                <CreateRequisitionForDeptModal
                    isOpen={isCreateForDeptModalOpen}
                    onClose={() => setIsCreateForDeptModalOpen(false)}
                    departments={departments}
                    allProducts={products}
                    allLoans={loans}
                    inventoryMap={new Map(inventory.map(i => [i.productId, i.quantity]))}
                    onSave={(shouldClose) => { if (shouldClose) setIsCreateForDeptModalOpen(false); fetchData(true); }}
                    initialPurpose={createForDeptInitialPurpose}
                />
            )}
        </div>
    );
};

export default WarehousePortal;
