
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, SurveyEntry, Department, User, Company, ProductSupplier, Requisition, RequisitionStatus, requisitionStatusMap, RequisitionItem, PurchaseOrder, GoodsReceivedNote, SystemLog, InventoryItem, DocumentSettings, PurchasePlanItem, ExpiringStockItem, Personnel, BackOrderItem, LoanItem, ProductUsageHistory, ProductCategory, productCategories } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import PlusIcon from '../icons/PlusIcon';
import UploadIcon from '../icons/UploadIcon';
import EditIcon from '../icons/EditIcon';
import TrashIcon from '../icons/TrashIcon';
import ListBulletIcon from '../icons/ListBulletIcon';
import PrinterIcon from '../icons/PrinterIcon';
import DownloadIcon from '../icons/DownloadIcon';
import BuildingOfficeIcon from '../icons/BuildingOfficeIcon';
import ClipboardDocumentListIcon from '../icons/ClipboardDocumentListIcon';
import { ManageRequisitionsView } from './ManageRequisitionsView';
import MegaphoneIcon from '../icons/MegaphoneIcon';
import PaperAirplaneIcon from '../icons/PaperAirplaneIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import ShoppingCartIcon from '../icons/ShoppingCartIcon';
import { PurchaseOrderView } from './PurchaseOrderView';
import ChartBarIcon from '../icons/ChartBarIcon';
import { ReportsView } from '../ReportsView';
import InboxArrowDownIcon from '../icons/InboxArrowDownIcon';
import { GoodsReceivingView } from '../GoodsReceivingView';
import ArchiveBoxIcon from '../icons/ArchiveBoxIcon';
import ClipboardDocumentCheckIcon from '../icons/ClipboardDocumentCheckIcon';
import CogIcon from '../icons/CogIcon';
import ClockIcon from '../icons/ClockIcon';
import ArrowPathIcon from '../icons/ArrowPathIcon';
import LoadingScreen from '../LoadingScreen';

import { SummaryView } from './SummaryView';
import { DepartmentView } from './DepartmentView';
import ManageItemsView from './ManageItemsView';
import ManageDepartmentsView from './ManageDepartmentsView';
import ManageUsersView from './ManageUsersView';
import { SendNotificationView } from './SendNotificationView';
import DocumentSettingsView from './DocumentSettingsView';
import { ProductEditModal } from './ProductEditModal';
import DepartmentEditModal from './DepartmentEditModal';
import { UserEditModal } from './UserEditModal';
import AssignProductsModal from './AssignProductsModal';
import CubeIcon from '../icons/CubeIcon';
import CreateRequisitionForDeptModal from './CreateRequisitionForDeptModal';
import ProductLabelsPrintView from './ProductLabelsPrintView';
import SystemLogsView from './SystemLogsView';
import { PurchasePlanView } from './PurchasePlanView';
import CalculatorIcon from '../icons/CalculatorIcon';
import ExpiringStockView from './ExpiringStockView';
import CalendarDaysIcon from '../icons/CalendarDaysIcon';
import StockCardView from './StockCardView';
import UserGroupIcon from '../icons/UserGroupIcon';
import ManagePersonnelView from './ManagePersonnelView';
import PersonnelEditModal from './PersonnelEditModal';
import ArchiveBoxArrowDownIcon from '../icons/ArchiveBoxArrowDownIcon';
import AccountSettingsPortal from '../AccountSettingsPortal';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import UsersIcon from '../icons/UsersIcon';
import PickingView from '../PickingView';
import IntraMonthReturnModal from './IntraMonthReturnModal';
import ManageBackordersView from './ManageBackordersView';
import ManageStockLevelsView from './ManageStockLevelsView';
import ManageAnnouncementsView from './ManageAnnouncementsView';
import { SystemSettingsView } from './SystemSettingsView';
import CompanyEditModal from './CompanyEditModal';
import DocumentPlusIcon from '../icons/DocumentPlusIcon';

interface AdminDashboardProps {
  user: User;
  isSurveyManuallyOpen: boolean;
  isSurveyAutoOpen: boolean;
  onToggleSurvey: (isOpen: boolean) => void;
  isRequisitionOpen: boolean;
  onToggleRequisition: (isOpen: boolean) => void;
  onDataChange: () => void;
  onSettingsChange: () => void;
  initialTab?: any;
  documentSettings: DocumentSettings | null;
  currentFiscalYearBE: number;
  nextFiscalYearBE: number;
  stopAlert: () => void;
}

type Tab = 'summary' | 'departments' | 'purchasePlan' | 'requisitions' | 'purchaseOrder' | 'receipts' | 'stockCard' | 'expiringStock' | 'reports' | 'manageItems' | 'manageStockLevels' | 'manageDepts' | 'manageUsers' | 'managePersonnel' | 'manageAnnouncements' | 'notifications' | 'accountSettings' | 'documentSettings' | 'system' | 'logs';

const navGroups: Record<string, { icon: React.ReactNode; items: Partial<Record<Tab, string>> }> = {
  'ภาพรวมและการวางแผน': {
    icon: <ChartBarIcon className="w-5 h-5"/>,
    items: { summary: 'สรุปผลรวม', departments: 'ผลรายหน่วยงาน', purchasePlan: 'วางแผนจัดซื้อ', reports: 'รายงาน' },
  },
  'ปฏิบัติการคลัง': {
    icon: <CubeIcon className="w-5 h-5"/>,
    items: { requisitions: 'รายการเบิก', purchaseOrder: 'จัดซื้อ', receipts: 'รับของเข้าระบบ', stockCard: 'คลังและสต็อกการ์ด', expiringStock: 'สินค้าใกล้หมดอายุ' },
  },
  'การจัดการ': {
    icon: <UsersIcon className="w-5 h-5"/>,
    items: { manageItems: 'จัดการรายการและบริษัท', manageStockLevels: 'จัดการ Min/Max Stock', manageDepts: 'จัดการหน่วยงาน', manageUsers: 'จัดการผู้ใช้', managePersonnel: 'จัดการบุคลากร' },
  },
  'ระบบและการตั้งค่า': {
    icon: <CogIcon className="w-5 h-5"/>,
    items: { manageAnnouncements: 'จัดการประกาศข่าว', notifications: 'ส่งการแจ้งเตือน', accountSettings: 'ตั้งค่าการแจ้งเตือน', documentSettings: 'ตั้งค่าเอกสาร', system: 'สำรองและกู้คืน', logs: 'ประวัติระบบ (Logs)' },
  }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { user, initialTab, documentSettings, nextFiscalYearBE, onDataChange, currentFiscalYearBE, stopAlert } = props;
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(Object.keys(navGroups)[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({ 
    products: [], 
    departments: [], 
    requisitions: [], 
    inventory: [], 
    companies: [], 
    personnel: [], 
    users: [],
    purchaseOrders: [],
    productSuppliers: [], 
    surveySubmissions: [], 
    systemLogs: [], 
    purchasePlan: [], 
    expiringStock: [], 
    loans: [], 
    productUsageHistory: [], 
    goodsReceivedNotes: [],
    productIssues: []
  });
  const [budget, setBudget] = useState<number | null>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);

  // Modals States
  const [requisitionForPicking, setRequisitionForPicking] = useState<Requisition | null>(null);
  const [isPickingPreview, setIsPickingPreview] = useState(false);
  const [returnModalReq, setReturnModalReq] = useState<Requisition | null>(null);
  const [isCreateForDeptOpen, setIsCreateForDeptOpen] = useState(false);
  const [createForDeptPurpose, setCreateForDeptPurpose] = useState<'requisition' | 'loan'>('requisition');
  
  // Department Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [deptToAssign, setDeptToAssign] = useState<Department | null>(null);

  // Product Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // User Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Personnel Modals
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);

  const lastProcessedInitialTabRef = useRef<string | null>(null);
  const hasPerformedCleanup = useRef(false);

  const fetchBudget = useCallback(async () => {
    setIsLoadingBudget(true);
    try {
        const b = await supabaseService.getBudgetForFiscalYear(nextFiscalYearBE);
        setBudget(b);
    } catch (e) {
        console.error("Error fetching budget", e);
    } finally {
        setIsLoadingBudget(false);
    }
  }, [nextFiscalYearBE]);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
        setIsLoading(true);
    }
    
    try {
      const dashboardData = await supabaseService.getAdminDashboardData(nextFiscalYearBE);
      const extraData = await Promise.all([
          supabaseService.getInventory(),
          supabaseService.getPurchasePlan(nextFiscalYearBE),
          supabaseService.getExpiringStock(),
          supabaseService.getLoansForAdmin(),
          supabaseService.getProductUsageHistory(),
          supabaseService.getGoodsReceivedNotesWithDetails(),
          supabaseService.getPersonnel(),
          supabaseService.getPurchaseOrdersForAdmin(),
          supabaseService.getCompanies(),
          supabaseService.getUsers()
      ]);

      setData((prev: any) => ({
          ...prev,
          ...dashboardData,
          inventory: extraData[0],
          purchasePlan: extraData[1],
          expiringStock: extraData[2],
          loans: extraData[3],
          productUsageHistory: extraData[4],
          goodsReceivedNotes: extraData[5],
          personnel: extraData[6],
          purchaseOrders: extraData[7],
          companies: extraData[8],
          users: extraData[9]
      }));
      await fetchBudget();
    } catch (e) { 
        console.error(e); 
    } finally {
        setIsLoading(false);
    }
  }, [nextFiscalYearBE, fetchBudget]);

  useEffect(() => { 
      fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    if (initialTab) {
        const tab = typeof initialTab === 'string' ? initialTab : initialTab.tab;
        const tabString = JSON.stringify(initialTab);
        
        if (tabString !== lastProcessedInitialTabRef.current) {
            lastProcessedInitialTabRef.current = tabString;

            if (tab === 'create_for_dept') {
                setActiveTab('requisitions');
                setIsCreateForDeptOpen(true);
            } else if (tab) {
                setActiveTab(tab as Tab);
            }
        }
    }
  }, [initialTab]);

  useEffect(() => {
    const foundGroup = Object.keys(navGroups).find(groupName => 
        Object.keys(navGroups[groupName].items).includes(activeTab)
    );
    if (foundGroup) {
        setOpenNavGroup(foundGroup);
    }
  }, [activeTab]);

  const aggregatedSurveyData = useMemo(() => {
      const productSums: Record<string, number> = {};
      const submissions: SurveyEntry[] = data.surveySubmissions || [];
      
      submissions.forEach(submission => {
          if (submission.quantities) {
              Object.entries(submission.quantities).forEach(([productId, details]) => {
                  const qty = (details as any).quantity || 0;
                  productSums[productId] = (productSums[productId] || 0) + qty;
              });
          }
      });

      return (data.products || []).map((p: Product) => {
          const totalQty = productSums[p.id] || 0;
          return {
              product: p,
              totalQuantity: totalQty,
              totalValue: totalQty * (p.pricePerUnit || 0)
          };
      }).filter((item: any) => item.totalQuantity > 0);
  }, [data.surveySubmissions, data.products]);

  const derivedBackorders = useMemo(() => {
    const reqs: Requisition[] = data.requisitions || [];
    const depts: Department[] = data.departments || [];
    return reqs.flatMap(r => {
        const departmentName = depts.find(d => d.id === r.departmentId)?.name;
        return (r.items || []).filter(i => i.status === 'Backordered').map(i => {
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
            } as BackOrderItem;
        }).filter((item): item is BackOrderItem => item !== null);
    });
  }, [data.requisitions, data.departments]);

  const finalLoans = useMemo(() => {
    const reqs: Requisition[] = data.requisitions || [];
    const depts: Department[] = data.departments || [];
    const allLoansFromDb: LoanItem[] = data.loans || [];
    
    const derivedLoansFromReqs = reqs.flatMap(r => {
        const departmentName = depts.find(d => d.id === r.departmentId)?.name;
        return (r.items || []).filter(i => i.status === 'Loaned').map(i => {
            const loanedQty = i.approvedQuantity !== null && i.approvedQuantity !== undefined ? i.approvedQuantity : i.quantity;
            if (loanedQty <= 0) return null;
            return {
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
            } as LoanItem;
        }).filter((item): item is LoanItem => item !== null);
    });

    const loans: LoanItem[] = [...allLoansFromDb];
    const dbReqLoanKeys = new Set(
        allLoansFromDb
            .filter(l => l.originalRequisitionId)
            .map(l => `${l.originalRequisitionId}_${l.productId}`)
    );
    derivedLoansFromReqs.forEach(loanFromReq => {
        const key = `${loanFromReq.originalRequisitionId}_${loanFromReq.productId}`;
        if (!dbReqLoanKeys.has(key)) {
            loans.push(loanFromReq);
        }
    });
    return loans;
  }, [data.requisitions, data.departments, data.loans]);

  const handleViewPicking = (req: Requisition, preview: boolean) => {
    const deptName = data.departments.find((d: any) => d.id === req.departmentId)?.name;
    setRequisitionForPicking({ ...req, departmentName: deptName });
    setIsPickingPreview(preview);
  };

  const handleOpenCreateForDept = (purpose: 'requisition' | 'loan' = 'requisition') => {
      setCreateForDeptPurpose(purpose);
      setIsCreateForDeptOpen(true);
  };

  const renderContent = () => {
      switch (activeTab) {
          case 'summary': return <SummaryView data={aggregatedSurveyData} requisitions={data.requisitions} fiscalYear={nextFiscalYearBE} budget={budget} isLoadingBudget={isLoadingBudget} onBudgetChange={() => fetchData(true)} />;
          case 'departments': return <DepartmentView results={data.surveySubmissions} products={data.products} departments={data.departments} onDataChange={() => fetchData(true)} fiscalYear={nextFiscalYearBE} documentSettings={documentSettings} />;
          case 'purchasePlan': return <PurchasePlanView products={data.products} fiscalYear={nextFiscalYearBE} currentFiscalYearBE={currentFiscalYearBE} budget={budget} aggregatedSurveyData={aggregatedSurveyData} initialPlan={data.purchasePlan} onPlanSave={() => fetchData(true)} inventory={data.inventory} documentSettings={documentSettings} productUsageHistory={data.productUsageHistory} />;
          case 'reports': return <ReportsView requisitions={data.requisitions} products={data.products} departments={data.departments} inventory={data.inventory} goodsReceivedNotes={data.goodsReceivedNotes} purchasePlan={data.purchasePlan} surveyResults={data.surveySubmissions} productUsageHistory={data.productUsageHistory} documentSettings={documentSettings} />;
          case 'requisitions': return <ManageRequisitionsView user={user} requisitions={data.requisitions} departments={data.departments} allProducts={data.products} inventory={data.inventory} backorders={derivedBackorders} loans={finalLoans} onDataChange={() => fetchData(true)} documentSettings={documentSettings} onViewPickingList={handleViewPicking} onOpenReturnModal={setReturnModalReq} onOpenCreateForDeptModal={handleOpenCreateForDept} />;
          case 'purchaseOrder': return <PurchaseOrderView user={user} onDataChange={() => fetchData(true)} purchaseOrders={data.purchaseOrders} companies={data.companies} productSuppliers={data.productSuppliers} allProducts={data.products} inventory={data.inventory} documentSettings={documentSettings} onAddProduct={() => {}} onAddCompany={() => {}} />;
          case 'receipts': return <GoodsReceivingView user={user} allProducts={data.products} onDataChange={() => fetchData(true)} />;
          case 'stockCard': return <StockCardView allProducts={data.products} inventory={data.inventory} goodsReceivedNotes={data.goodsReceivedNotes} purchaseOrders={data.purchaseOrders} companies={data.companies} onDataChange={() => fetchData(true)} />;
          case 'expiringStock': return <ExpiringStockView expiringStock={data.expiringStock} />;
          case 'manageItems': return <ManageItemsView products={data.products} companies={data.companies} productSuppliers={data.productSuppliers} inventory={data.inventory} onAddProduct={() => { setEditingProduct(null); setIsProductModalOpen(true); }} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true); }} onImportProducts={() => {}} onPrintLabels={() => {}} onCompanyAdded={() => fetchData(true)} onCompanyUpdated={() => fetchData(true)} onCompanyDeleted={() => fetchData(true)} onProductSuppliersUpdated={() => fetchData(true)} onProductDeleted={() => fetchData(true)} />;
          case 'manageStockLevels': return <ManageStockLevelsView products={data.products} purchasePlan={data.purchasePlan} inventory={data.inventory} onSave={() => fetchData(true)} companies={data.companies} productSuppliers={data.productSuppliers} onSwitchToTab={(t) => setActiveTab(t)} />;
          case 'manageDepts': return <ManageDepartmentsView departments={data.departments} users={data.users} onAdd={() => { setEditingDept(null); setIsDeptModalOpen(true); }} onEdit={(d) => { setEditingDept(d); setIsDeptModalOpen(true); }} onAssign={(d) => { setDeptToAssign(d); setIsAssignModalOpen(true); }} onDataChange={() => fetchData(true)} />;
          case 'manageUsers': return <ManageUsersView users={data.users} departments={data.departments} onAdd={() => {setEditingUser(null); setIsUserModalOpen(true);}} onEdit={(u) => {setEditingUser(u); setIsUserModalOpen(true);}} onDataChange={() => fetchData(true)} />;
          case 'managePersonnel': return <ManagePersonnelView personnel={data.personnel ?? []} onAdd={() => {setEditingPersonnel(null); setIsPersonnelModalOpen(true);}} onEdit={(p) => {setEditingPersonnel(p); setIsPersonnelModalOpen(true);}} onDataChange={() => fetchData(true)} />;
          case 'manageAnnouncements': return <ManageAnnouncementsView />;
          case 'notifications': return <SendNotificationView currentUser={user} allUsers={data.users} departments={data.departments} />;
          case 'accountSettings': return <AccountSettingsPortal user={user} />;
          case 'documentSettings': return <DocumentSettingsView initialSettings={documentSettings} onSave={() => fetchData(true)} />;
          case 'system': return <SystemSettingsView allData={{ ...data, productAssignments: [] }} onRestoreSuccess={() => fetchData(true)} />;
          case 'logs': return <SystemLogsView logs={data.systemLogs || []} />;
          default: return <div className="p-8 text-center text-slate-500">ส่วนงานนี้กำลังอยู่ระหว่างการพัฒนา (Tab: {activeTab})</div>;
      }
  };

  if (isLoading && data.products.length === 0) return <LoadingScreen message="กำลังโหลดข้อมูลพื้นฐาน..." />;

  if (requisitionForPicking) {
      return (
          <PickingView 
            requisition={requisitionForPicking} 
            allProducts={data.products} 
            inventoryMap={new Map(data.inventory.map((i: any) => [i.productId, i.quantity]))} 
            onClose={() => { setRequisitionForPicking(null); fetchData(true); }}
            isPreview={isPickingPreview}
            onItemsUpdated={() => fetchData(true)}
            onProcessSimple={async (items) => { await supabaseService.saveSimpleApproval(requisitionForPicking.id, items, 'Picking'); }}
            onProcessRequisitionWithStock={async (items, reason) => { await supabaseService.updateProcessedRequisitionItems(requisitionForPicking.id, items, reason); }}
            documentSettings={documentSettings}
          />
      );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
        <nav className="flex-shrink-0 md:w-72 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl no-print h-fit sticky top-4 border border-slate-100 dark:border-slate-700">
            {Object.entries(navGroups).map(([groupName, group]) => {
                const isGroupActive = Object.keys(group.items).includes(activeTab);
                const isOpen = openNavGroup === groupName;
                return (
                    <div key={groupName} className="mb-2">
                        <button onClick={() => setOpenNavGroup(isOpen ? null : groupName)} className={`w-full flex justify-between items-center text-left p-3 rounded-xl transition-all duration-200 ${isOpen || isGroupActive ? 'bg-sky-50/50 dark:bg-sky-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`${isOpen || isGroupActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`}>{group.icon}</span>
                                <h2 className={`font-bold text-sm ${isOpen || isGroupActive ? 'text-sky-900 dark:text-sky-100' : 'text-slate-700 dark:text-slate-300'}`}>{groupName}</h2>
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                            <div className="mt-1 space-y-1 pl-2 animate-fade-in origin-top">
                                {Object.entries(group.items).map(([tabKey, tabName]) => (
                                    <button key={tabKey} onClick={() => { setActiveTab(tabKey as Tab); if(tabKey === 'requisitions') stopAlert(); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold transition-all ${activeTab === tabKey ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>{tabName}</button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
        <main className="flex-grow min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl min-h-[85vh] border border-slate-100 dark:border-slate-700">{renderContent()}</main>
        
        {/* Modals Section */}
        {returnModalReq && <IntraMonthReturnModal isOpen={!!returnModalReq} onClose={() => setReturnModalReq(null)} requisition={returnModalReq} onSave={() => { setReturnModalReq(null); fetchData(true); }} />}
        {isCreateForDeptOpen && <CreateRequisitionForDeptModal isOpen={isCreateForDeptOpen} onClose={() => setIsCreateForDeptOpen(false)} departments={data.departments} allProducts={data.products} allLoans={finalLoans} inventoryMap={new Map(data.inventory.map((i: any) => [i.productId, i.quantity]))} onSave={() => { fetchData(true); }} initialPurpose={createForDeptPurpose} />}
        
        {isDeptModalOpen && (
            <DepartmentEditModal 
                isOpen={isDeptModalOpen} 
                onClose={() => setIsDeptModalOpen(false)} 
                department={editingDept} 
                onSave={() => { fetchData(true); setIsDeptModalOpen(false); }} 
            />
        )}
        
        {isAssignModalOpen && deptToAssign && (
            <AssignProductsModal 
                isOpen={isAssignModalOpen} 
                onClose={() => setIsAssignModalOpen(false)} 
                department={deptToAssign} 
                allProducts={data.products} 
                onSave={() => { fetchData(true); setIsAssignModalOpen(false); }} 
            />
        )}

        {isProductModalOpen && (
            <ProductEditModal 
                isOpen={isProductModalOpen} 
                onClose={() => setIsProductModalOpen(false)} 
                product={editingProduct} 
                onSave={() => { fetchData(true); setIsProductModalOpen(false); }} 
                allCompanies={data.companies}
                productSuppliers={data.productSuppliers}
            />
        )}

        {isUserModalOpen && (
            <UserEditModal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                user={editingUser}
                departments={data.departments}
                onSave={() => { fetchData(true); setIsUserModalOpen(false); }}
            />
        )}
        
        {isPersonnelModalOpen && (
            <PersonnelEditModal 
                isOpen={isPersonnelModalOpen} 
                onClose={() => setIsPersonnelModalOpen(false)} 
                personnel={editingPersonnel} 
                onSave={() => { fetchData(true); setIsPersonnelModalOpen(false); }} 
            />
        )}
    </div>
  );
};
