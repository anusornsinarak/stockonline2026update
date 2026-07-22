
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, SurveyEntry, Department, User, Company, ProductSupplier, Requisition, RequisitionStatus, requisitionStatusMap, RequisitionItem, PurchaseOrder, GoodsReceivedNote, SystemLog, InventoryItem, DocumentSettings, PurchasePlanItem, ExpiringStockItem, Personnel, BackOrderItem, LoanItem, ProductUsageHistory, ProductCategory, productCategories } from '../types';
import { supabaseService } from '../services/supabaseService';
import Modal from './Modal';
import PlusIcon from './icons/PlusIcon';
import UploadIcon from './icons/UploadIcon';
import EditIcon from './icons/EditIcon';
import TrashIcon from './icons/TrashIcon';
import ListBulletIcon from './icons/ListBulletIcon';
import PrinterIcon from './icons/PrinterIcon';
import DownloadIcon from './icons/DownloadIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import ClipboardDocumentListIcon from './icons/ClipboardDocumentListIcon';
import { ManageRequisitionsView } from './admin/ManageRequisitionsView';
import MegaphoneIcon from './icons/MegaphoneIcon';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import ShoppingCartIcon from './icons/ShoppingCartIcon';
import { PurchaseOrderView } from './admin/PurchaseOrderView';
import ChartBarIcon from './icons/ChartBarIcon';
import { ReportsView } from './ReportsView';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import { GoodsReceivingView } from './GoodsReceivingView';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ClipboardDocumentCheckIcon from './icons/ClipboardDocumentCheckIcon';
import CogIcon from './icons/CogIcon';
import ClockIcon from './icons/ClockIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import LoadingScreen from './LoadingScreen';

import { SummaryView } from './admin/SummaryView';
import { DepartmentView } from './admin/DepartmentView';
import ManageItemsView from './admin/ManageItemsView';
import ManageDepartmentsView from './admin/ManageDepartmentsView';
import ManageUsersView from './admin/ManageUsersView';
import { SendNotificationView } from './admin/SendNotificationView';
import DocumentSettingsView from './admin/DocumentSettingsView';
import { ProductEditModal } from './admin/ProductEditModal';
import DepartmentEditModal from './admin/DepartmentEditModal';
import { UserEditModal } from './admin/UserEditModal';
import AssignProductsModal from './admin/AssignProductsModal';
import CubeIcon from './icons/CubeIcon';
import CreateRequisitionForDeptModal from './admin/CreateRequisitionForDeptModal';
import ProductLabelsPrintView from './admin/ProductLabelsPrintView';
import SystemLogsView from './admin/SystemLogsView';
import { PurchasePlanView } from './admin/PurchasePlanView';
import CalculatorIcon from './icons/CalculatorIcon';
import ExpiringStockView from './admin/ExpiringStockView';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import StockCardView from './admin/StockCardView';
import UserGroupIcon from './icons/UserGroupIcon';
import ManagePersonnelView from './admin/ManagePersonnelView';
import PersonnelEditModal from './admin/PersonnelEditModal';
import ArchiveBoxArrowDownIcon from './icons/ArchiveBoxArrowDownIcon';
import AccountSettingsPortal from './AccountSettingsPortal';
import ChevronDownIcon from './icons/ChevronDownIcon';
import UsersIcon from './icons/UsersIcon';
import PickingView from './PickingView';
import IntraMonthReturnModal from './admin/IntraMonthReturnModal';
import ManageBackordersView from './admin/ManageBackordersView';
import ManageStockLevelsView from './admin/ManageStockLevelsView';
import ManageAnnouncementsView from './admin/ManageAnnouncementsView';
import { ManageSurveyView } from './admin/ManageSurveyView';
import { SystemSettingsView } from './admin/SystemSettingsView';
import CompanyEditModal from './admin/CompanyEditModal';
import DocumentPlusIcon from './icons/DocumentPlusIcon';

import { LoanSystemView } from './admin/LoanSystemView';
import { LoanQRCodeView } from './admin/LoanQRCodeView';

type Tab = 'summary' | 'departments' | 'purchasePlan' | 'requisitions' | 'purchaseOrder' | 'receipts' | 'stockCard' | 'expiringStock' | 'reports' | 'manageItems' | 'manageStockLevels' | 'manageDepts' | 'manageUsers' | 'managePersonnel' | 'notifications' | 'system' | 'logs' | 'documentSettings' | 'accountSettings' | 'manageAnnouncements' | 'loanSystem' | 'loanQRCode' | 'manageSurvey';

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

const navGroups: Record<string, { icon: React.ReactNode; items: Partial<Record<Tab, string>> }> = {
  'ภาพรวมและการวางแผน': {
    icon: <ChartBarIcon className="w-5 h-5"/>,
    items: { summary: 'สรุปผลรวม', departments: 'ผลรายหน่วยงาน', purchasePlan: 'วางแผนจัดซื้อ', reports: 'รายงาน' },
  },
  'ปฏิบัติการคลัง': {
    icon: <CubeIcon className="w-5 h-5"/>,
    items: { requisitions: 'รายการเบิก', loanSystem: 'ระบบยืม-คืนสินค้า', loanQRCode: 'สร้าง QR Code ระบบยืม', purchaseOrder: 'จัดซื้อ', receipts: 'รับของเข้าระบบ', stockCard: 'คลังและสต็อกการ์ด', expiringStock: 'สินค้าใกล้หมดอายุ' },
  },
  'การจัดการ': {
    icon: <UsersIcon className="w-5 h-5"/>,
    items: { manageItems: 'จัดการรายการและบริษัท', manageStockLevels: 'จัดการ Min/Max Stock', manageDepts: 'จัดการหน่วยงาน', manageUsers: 'จัดการผู้ใช้', managePersonnel: 'จัดการบุคลากร' },
  },
  'ระบบและการตั้งค่า': {
    icon: <CogIcon className="w-5 h-5"/>,
    items: { manageAnnouncements: 'จัดการประกาศข่าว', notifications: 'ส่งการแจ้งเตือน', accountSettings: 'ตั้งค่าการแจ้งเตือน', documentSettings: 'ตั้งค่าเอกสาร', manageSurvey: 'จัดการแบบสำรวจความพึงพอใจ', system: 'สำรองและกู้คืน', logs: 'ประวัติระบบ (Logs)' },
  }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { user, initialTab, documentSettings, nextFiscalYearBE, onDataChange, onSettingsChange, currentFiscalYearBE, stopAlert } = props;
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(Object.keys(navGroups)[0]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({ 
    products: [], 
    departments: [], 
    requisitions: [], 
    inventory: [], 
    companies: [], 
    personnel: [], 
    productSuppliers: [], 
    surveySubmissions: [], 
    systemLogs: [], 
    purchasePlan: [], 
    expiringStock: [], 
    loans: [], 
    productUsageHistory: [], 
    goodsReceivedNotes: [],
    purchaseOrders: []
  });
  const [budget, setBudget] = useState<number | null>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);

  // Modals States
  const [requisitionForPicking, setRequisitionForPicking] = useState<Requisition | null>(null);
  const [isPickingPreview, setIsPickingPreview] = useState(false);
  const [returnModalReq, setReturnModalReq] = useState<Requisition | null>(null);
  const [isCreateForDeptOpen, setIsCreateForDeptOpen] = useState(false);
  const [createForDeptPurpose, setCreateForDeptPurpose] = useState<'requisition' | 'loan'>('requisition');

  // Management state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [deptToAssign, setDeptToAssign] = useState<Department | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);

  const lastProcessedInitialTabRef = useRef<string | null>(null);

  const [viewFiscalYear, setViewFiscalYear] = useState<number>(nextFiscalYearBE);

  const fetchBudget = useCallback(async () => {
    setIsLoadingBudget(true);
    try {
        const b = await supabaseService.getBudgetForFiscalYear(viewFiscalYear);
        setBudget(b);
    } catch (e) {
        console.error("Error fetching budget", e);
    } finally {
        setIsLoadingBudget(false);
    }
  }, [viewFiscalYear]);
  
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
        setIsLoading(true);
    }
    
    try {
      const dashboardData = await supabaseService.getAdminDashboardData(viewFiscalYear);
      const extraData = await Promise.all([
          supabaseService.getInventory(),
          supabaseService.getPurchasePlan(viewFiscalYear),
          supabaseService.getExpiringStock(),
          supabaseService.getLoansForAdmin(),
          supabaseService.getProductUsageHistory(),
          supabaseService.getGoodsReceivedNotesWithDetails(),
          supabaseService.getPurchaseOrdersForAdmin(),
          supabaseService.getCompanies(),
          supabaseService.getPersonnel(),
          supabaseService.getUsers(),
          supabaseService.getProductSuppliers()
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
          purchaseOrders: extraData[6],
          companies: extraData[7],
          personnel: extraData[8],
          users: extraData[9],
          productSuppliers: extraData[10]
      }));
      await fetchBudget();
    } catch (e) { 
        console.error(e); 
    } finally {
        setIsLoading(false);
    }
  }, [viewFiscalYear, fetchBudget]);

  useEffect(() => { 
      fetchData(); 
      supabaseService.logSystemEvent({
          level: 'INFO',
          event: 'ADMIN_DASHBOARD_MOUNT',
          message: `Admin ${user.username} mounted the dashboard`
      }).catch(console.error);
  }, [fetchData, user.username]);

  useEffect(() => {
    if (initialTab) {
        const tab = typeof initialTab === 'string' ? initialTab : initialTab.tab;
        const tabString = JSON.stringify(initialTab);
        
        if (tabString !== lastProcessedInitialTabRef.current) {
            lastProcessedInitialTabRef.current = tabString;

            if (tab === 'create_for_dept') {
                setActiveTab('requisitions');
                setIsCreateForDeptOpen(true);
                setOpenNavGroup('ปฏิบัติการคลัง');
            } else if (tab && tab !== activeTab) {
                setActiveTab(tab as Tab);
                const group = Object.keys(navGroups).find(g => navGroups[g].items[tab as Tab]);
                if (group) setOpenNavGroup(group);
            }
        }
    }
  }, [initialTab, activeTab]);

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
            // If status is explicitly 'Backordered', treat the entire quantity as backordered 
            // if approvedQuantity equals quantity (user marked full item as backorder)
            // Otherwise calculate difference (partial backorder logic, though usually partials are split)
            const backorderedQty = (i.status === 'Backordered' && (i.approvedQuantity || 0) === i.quantity)
                ? i.quantity
                : i.quantity - (i.approvedQuantity || 0);
            
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
      const isReadOnly = viewFiscalYear !== nextFiscalYearBE;
      
      switch (activeTab) {
          case 'summary': return <SummaryView data={aggregatedSurveyData} requisitions={data.requisitions} fiscalYear={viewFiscalYear} budget={budget} isLoadingBudget={isLoadingBudget} onBudgetChange={() => fetchData(true)} />;
          case 'departments': return <DepartmentView results={data.surveySubmissions} products={data.products} departments={data.departments} requisitions={data.requisitions} onDataChange={() => fetchData(true)} isReadOnly={isReadOnly} fiscalYear={viewFiscalYear} documentSettings={documentSettings} />;
          case 'purchasePlan': return <PurchasePlanView products={data.products} fiscalYear={viewFiscalYear} currentFiscalYearBE={currentFiscalYearBE} budget={budget} aggregatedSurveyData={aggregatedSurveyData} initialPlan={data.purchasePlan} onPlanSave={() => fetchData(true)} inventory={data.inventory} documentSettings={documentSettings} productUsageHistory={data.productUsageHistory} isReadOnly={isReadOnly} />;
          case 'reports': return <ReportsView requisitions={data.requisitions} products={data.products} departments={data.departments} inventory={data.inventory} goodsReceivedNotes={data.goodsReceivedNotes} purchasePlan={data.purchasePlan} surveyResults={data.surveySubmissions} productUsageHistory={data.productUsageHistory} documentSettings={documentSettings} />;
          case 'requisitions': return <ManageRequisitionsView user={user} requisitions={data.requisitions} departments={data.departments} allProducts={data.products} inventory={data.inventory} backorders={derivedBackorders} onDataChange={() => fetchData(true)} documentSettings={documentSettings} onViewPickingList={handleViewPicking} onOpenReturnModal={setReturnModalReq} onOpenCreateForDeptModal={handleOpenCreateForDept} />;
          case 'loanSystem': return <LoanSystemView departments={data.departments} allProducts={data.products} currentUser={user} />;
          case 'loanQRCode': return <LoanQRCodeView />;
          case 'purchaseOrder': return <PurchaseOrderView user={user} onDataChange={() => fetchData(true)} purchaseOrders={data.purchaseOrders || []} companies={data.companies || []} productSuppliers={data.productSuppliers || []} allProducts={data.products} purchasePlan={data.purchasePlan} viewFiscalYear={viewFiscalYear} inventory={data.inventory} documentSettings={documentSettings} onAddProduct={() => {}} onAddCompany={() => {}} />;
          case 'receipts': return <GoodsReceivingView user={user} allProducts={data.products} onDataChange={() => fetchData(true)} />;
          case 'stockCard': return <StockCardView allProducts={data.products} inventory={data.inventory} goodsReceivedNotes={data.goodsReceivedNotes} purchaseOrders={data.purchaseOrders || []} companies={data.companies || []} onDataChange={() => fetchData(true)} />;
          case 'expiringStock': return <ExpiringStockView expiringStock={data.expiringStock} />;
          case 'manageItems': return <ManageItemsView products={data.products} companies={data.companies || []} productSuppliers={data.productSuppliers || []} inventory={data.inventory} onAddProduct={() => { setEditingProduct(null); setIsProductModalOpen(true); }} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true); }} onImportProducts={() => {}} onPrintLabels={() => {}} onCompanyAdded={() => fetchData(true)} onCompanyUpdated={() => fetchData(true)} onCompanyDeleted={() => fetchData(true)} onProductSuppliersUpdated={() => fetchData(true)} onProductDeleted={() => fetchData(true)} />;
          case 'manageStockLevels': return <ManageStockLevelsView products={data.products} purchasePlan={data.purchasePlan} inventory={data.inventory} onSave={() => fetchData(true)} companies={data.companies || []} productSuppliers={data.productSuppliers || []} onSwitchToTab={(t) => setActiveTab(t)} />;
          case 'manageDepts': return <ManageDepartmentsView departments={data.departments} users={data.users} onAdd={() => { setEditingDept(null); setIsDeptModalOpen(true); }} onEdit={(d) => { setEditingDept(d); setIsDeptModalOpen(true); }} onAssign={(d) => { setDeptToAssign(d); setIsAssignModalOpen(true); }} onDataChange={() => fetchData(true)} />;
          case 'manageUsers': return <ManageUsersView users={data.users} departments={data.departments} onAdd={() => {setEditingUser(null); setIsUserModalOpen(true);}} onEdit={(u) => {setEditingUser(u); setIsUserModalOpen(true);}} onDataChange={() => fetchData(true)} />;
          case 'managePersonnel': return <ManagePersonnelView personnel={data.personnel || []} onAdd={() => { setEditingPersonnel(null); setIsPersonnelModalOpen(true); }} onEdit={(p) => { setEditingPersonnel(p); setIsPersonnelModalOpen(true); }} onDataChange={() => fetchData(true)} />;
          case 'manageAnnouncements': return <ManageAnnouncementsView />;
          case 'notifications': return <SendNotificationView currentUser={user} allUsers={data.users} departments={data.departments} />;
          case 'accountSettings': return <AccountSettingsPortal user={user} />;
          case 'documentSettings': return <DocumentSettingsView initialSettings={documentSettings} onSave={() => { fetchData(true); onSettingsChange(); }} />;
          case 'manageSurvey': return <ManageSurveyView />;
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
            personnel={data.personnel}
          />
      );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg no-print">
            <div className="flex items-center gap-3">
                <div className="bg-sky-100 dark:bg-sky-900/30 p-2 rounded-lg">
                    <ListBulletIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <h2 className="font-bold text-slate-700 dark:text-slate-200">เมนูจัดการระบบ</h2>
            </div>
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
            >
                {isMobileMenuOpen ? <ChevronDownIcon className="w-6 h-6 rotate-180 transition-transform" /> : <ChevronDownIcon className="w-6 h-6 transition-transform" />}
            </button>
        </div>

        <nav className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block flex-shrink-0 md:w-64 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg no-print h-fit`}>
            {Object.entries(navGroups).map(([groupName, group]) => (
                <div key={groupName} className="mb-4">
                    <button onClick={() => setOpenNavGroup(openNavGroup === groupName ? null : groupName)} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-sky-500">{group.icon}</span>
                            <h2 className="font-bold text-slate-700 dark:text-slate-200">{groupName}</h2>
                        </div>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${openNavGroup === groupName ? 'rotate-180' : ''}`} />
                    </button>
                    {openNavGroup === groupName && (
                        <div className="mt-2 space-y-1 pl-4 animate-fade-in">
                            {Object.entries(group.items).map(([tabKey, tabName]) => (
                                <button 
                                    key={tabKey} 
                                    onClick={() => { 
                                        setActiveTab(tabKey as Tab); 
                                        if(tabKey === 'requisitions') stopAlert(); 
                                        setIsMobileMenuOpen(false);
                                    }} 
                                    className={`w-full text-left py-2 px-3 rounded-md text-sm font-medium transition-colors ${activeTab === tabKey ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    {tabName}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </nav>
        <main className="flex-grow min-w-0 bg-white dark:bg-slate-800 print:bg-transparent print:p-0 print:shadow-none p-6 rounded-xl shadow-lg min-h-[80vh]">
            <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-slate-700 print:hidden">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {Object.values(navGroups).flatMap(g => Object.entries(g.items)).find(([k]) => k === activeTab)?.[1] || 'Dashboard'}
                </h1>
                
                <div className="flex items-center gap-3">
                    <label htmlFor="fiscal-year-select" className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        ปีงบประมาณ:
                    </label>
                    <select
                        id="fiscal-year-select"
                        value={viewFiscalYear}
                        onChange={(e) => setViewFiscalYear(parseInt(e.target.value))}
                        className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2"
                    >
                        <option value={nextFiscalYearBE}>{nextFiscalYearBE} (ปีปัจจุบัน)</option>
                        <option value={currentFiscalYearBE}>{currentFiscalYearBE}</option>
                        <option value={currentFiscalYearBE - 1}>{currentFiscalYearBE - 1}</option>
                        <option value={currentFiscalYearBE - 2}>{currentFiscalYearBE - 2}</option>
                    </select>
                </div>
            </div>

            {renderContent()}
        </main>
        
        {/* Modals Section */}
        {returnModalReq && (
            <IntraMonthReturnModal 
                isOpen={!!returnModalReq} 
                onClose={() => setReturnModalReq(null)} 
                requisition={returnModalReq} 
                onSave={() => { setReturnModalReq(null); fetchData(true); }}
            />
        )}

        {isCreateForDeptOpen && (
            <CreateRequisitionForDeptModal 
                isOpen={isCreateForDeptOpen}
                onClose={() => setIsCreateForDeptOpen(false)}
                departments={data.departments}
                allProducts={data.products}
                allLoans={finalLoans}
                inventoryMap={new Map(data.inventory.map((i: any) => [i.productId, i.quantity]))}
                onSave={() => { fetchData(true); }}
                initialPurpose={createForDeptPurpose}
            />
        )}

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
                allCompanies={data.companies || []}
                productSuppliers={data.productSuppliers || []}
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
