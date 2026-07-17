
export type UserRole = 'Admin' | 'Department' | 'Warehouse' | 'Borrower';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  departmentId?: string;
  email?: string | null;
  permissions?: {
    canManageReceipts?: boolean;
    canViewInventory?: boolean;
    canViewStockCard?: boolean;
    canViewReports?: boolean;
    [key: string]: boolean | undefined;
  };
}

export type DepartmentType = 'Internal' | 'External';

export const departmentTypes: { value: DepartmentType; label: string }[] = [
    { value: 'Internal', label: 'ภายใน' },
    { value: 'External', label: 'ภายนอก' },
];

export interface Department {
  id: string;
  name: string;
  type?: DepartmentType;
  telegramChatId?: string | null;
}

export interface AppNotification {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: Date;
  actionPayload?: any;
}

export type ProductCategory = 'วัสดุการแพทย์ทั่วไป' | 'วัสดุเภสัชกรรม' | 'ของสนับสนุน' | 'ของแถม';
export const productCategories: ProductCategory[] = ['วัสดุการแพทย์ทั่วไป', 'วัสดุเภสัชกรรม', 'ของสนับสนุน', 'ของแถม'];

export interface Product {
  id: string;
  name: string;
  unit: string;
  category: ProductCategory;
  pricePerUnit: number | null;
  previousPricePerUnit: number | null;
  minStock: number | null;
  maxStock: number | null;
  lastYearUsage: number | null;
  zone?: string | null;
  createdAt?: string | Date;
}

export interface PurchasePlanItem {
    productId: string;
    fiscalYear: number;
    plannedQuantity: number;
}

export interface SurveyEntry {
    id: number;
    departmentId: string;
    submittedAt: string;
    quantities: Record<string, { quantity: number, price: number }>;
}

export interface Company {
    id: string;
    name: string;
}

export interface ProductSupplier {
    id: number;
    productId: string;
    companyId: string;
}

export type RequisitionStatus = 'Draft' | 'Submitted' | 'PartiallyApproved' | 'Rejected' | 'Ready' | 'Completed' | 'Picking' | 'Cancelled';

export const requisitionStatusMap: Record<RequisitionStatus, { text: string; color: string; warehouseText?: string }> = {
    Draft: { text: 'แบบร่าง', color: 'bg-gray-100 text-gray-800' },
    Submitted: { text: 'รออนุมัติ', color: 'bg-yellow-100 text-yellow-800' },
    Picking: { text: 'กำลังจัดของ', color: 'bg-blue-100 text-blue-800' },
    PartiallyApproved: { text: 'อนุมัติบางส่วน', color: 'bg-orange-100 text-orange-800' },
    Ready: { text: 'ของพร้อมจ่ายให้หน่วยงาน', color: 'bg-green-100 text-green-800', warehouseText: 'ของพร้อมจ่ายให้หน่วยงาน' },
    Completed: { text: 'รับของแล้ว', color: 'bg-emerald-100 text-emerald-800' },
    Rejected: { text: 'ไม่อนุมัติ', color: 'bg-red-100 text-red-800' },
    Cancelled: { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
};

export type RequisitionItemStatus = 'Pending' | 'Approved' | 'Backordered' | 'Loaned' | 'Rejected' | 'Fulfilled' | 'LoanFulfilled';

export const requisitionItemStatusMap: Record<RequisitionItemStatus, { text: string; color: string }> = {
    Pending: { text: 'รอพิจารณา', color: 'bg-gray-100 text-gray-800' },
    Approved: { text: 'อนุมัติ', color: 'bg-green-100 text-green-800' },
    Backordered: { text: 'ค้างจ่าย', color: 'bg-orange-100 text-orange-800' },
    Loaned: { text: 'ยืม', color: 'bg-purple-100 text-purple-800' },
    Rejected: { text: 'ไม่อนุมัติ', color: 'bg-red-100 text-red-800' },
    Fulfilled: { text: 'ได้รับแล้ว', color: 'bg-emerald-100 text-emerald-800' },
    LoanFulfilled: { text: 'คืนแล้ว', color: 'bg-blue-100 text-blue-800' }
};

export interface RequisitionItem {
    id?: number;
    requisitionId: string;
    productId: string;
    quantity: number;
    pricePerUnit?: number | null;
    approvedQuantity: number | null;
    status: RequisitionItemStatus;
    departmentStockOnSubmit: number | null;
    returnedQuantity: number | null;
    rejectReason?: string | null;
    lockProduct?: boolean;
    product?: Product;
    minStock?: number | null;
    maxStock?: number | null;
    lastApprovedQty?: number;
}

export interface Requisition {
    id: string;
    requisitionNumber: string | null;
    departmentId: string;
    departmentName?: string;
    name: string;
    status: RequisitionStatus;
    type: 'Normal' | 'OffCycle' | 'Urgent';
    urgentReason?: string | null;
    createdAt: Date;
    submittedAt: Date | null;
    approvedAt: Date | null;
    items?: RequisitionItem[];
    requesterName?: string | null;
    requesterPosition?: string | null;
    approverName?: string | null;
    approverPosition?: string | null;
    receiverName?: string | null;
    totalValue?: number;
    rejectionReason?: string | null;
}

export type POStatus = 'Draft' | 'Ordered' | 'PartiallyReceived' | 'Completed' | 'Cancelled';

export const poStatusMap: Record<POStatus, { text: string; color: string }> = {
    Draft: { text: 'แบบร่าง', color: 'bg-gray-100 text-gray-800' },
    Ordered: { text: 'สั่งซื้อแล้ว', color: 'bg-blue-100 text-blue-800' },
    PartiallyReceived: { text: 'รับบางส่วน', color: 'bg-orange-100 text-orange-800' },
    Completed: { text: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
    Cancelled: { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
};

export interface PurchaseOrderItem {
    id?: number;
    productId: string;
    quantity: number;
    pricePerUnit: number;
    product?: Product;
}

export interface CommitteeMember {
    id?: number;
    name: string;
    position: string;
    role: 'ประธานกรรมการ' | 'กรรมการ';
    ordering?: number;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string | null;
    companyId: string;
    companyName?: string;
    status: POStatus;
    totalValue: number;
    createdAt: Date;
    orderedAt: Date | null;
    items: PurchaseOrderItem[];
    committees?: CommitteeMember[];
}

export interface ProductAssignment {
    id?: number;
    departmentId: string;
    productId: string;
}

export type GRNStatus = 'Pending Approval' | 'Completed' | 'Cancelled';

export const grnStatusMap: Record<GRNStatus, { text: string; color: string }> = {
    'Pending Approval': { text: 'รอตรวจสอบ', color: 'bg-yellow-100 text-yellow-800' },
    'Completed': { text: 'สำเร็จ', color: 'bg-green-100 text-green-800' },
    'Cancelled': { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
};

export interface GoodsReceivedItem {
    id?: number;
    productId: string;
    quantityReceived: number;
    expiryDate: Date | null;
    lotNumber: string | null;
    product?: Product;
    pricePerUnit?: number;
}

export interface GoodsReceivedNote {
    id: string;
    grnNumber: string | null;
    sourceType: 'PO' | 'Return' | 'Other';
    purchaseOrderId?: string;
    poNumber?: string;
    receivedDate: Date;
    status: GRNStatus;
    items: GoodsReceivedItem[];
    notes?: string | null;
}

export interface SystemLog {
    id: number;
    level: 'INFO' | 'WARN' | 'ERROR';
    event: string;
    message: string;
    userId?: string | null;
    username?: string;
    createdAt: Date;
}

export interface InventoryItem {
    productId: string;
    quantity: number;
    updatedAt: Date;
}

export interface DocumentSettings {
    hospitalName?: string | null;
    hospitalLogoUrl?: string | null;
    documentApproverName?: string | null;
    documentApproverPosition?: string | null;
    documentIssuerName?: string | null;
    documentIssuerPosition?: string | null;
    documentDisbursementApproverName?: string | null;
    documentDisbursementApproverPosition?: string | null;
    documentReceiverName?: string | null;
    documentReceiverPosition?: string | null;
}

export type ProductIssueType = 'FOR_RESOLUTION' | 'REQUEST_REPLACEMENT';
export type ProductIssueStatus = 'SUBMITTED' | 'REPLACEMENT_READY' | 'REPLACEMENT_UNAVAILABLE' | 'ACKNOWLEDGED';

export const productIssueStatusMap: Record<ProductIssueStatus, { text: string; color: string }> = {
    SUBMITTED: { text: 'แจ้งปัญหาแล้ว', color: 'bg-yellow-100 text-yellow-800' },
    REPLACEMENT_READY: { text: 'มีของเปลี่ยน', color: 'bg-green-100 text-green-800' },
    REPLACEMENT_UNAVAILABLE: { text: 'ไม่มีของเปลี่ยน', color: 'bg-red-100 text-red-800' },
    ACKNOWLEDGED: { text: 'รับทราบแล้ว', color: 'bg-blue-100 text-blue-800' }
};

export interface ProductIssue {
    id: string;
    requisition_item_id: number;
    department_id: string;
    departmentName?: string;
    product_id: string;
    productName?: string;
    lotNumber: string;
    issueType: ProductIssueType;
    quantity: number;
    description: string;
    reporterName: string;
    reporterPosition: string;
    status: ProductIssueStatus;
    warehouseNotes?: string | null;
    createdAt: Date;
}

export interface ExpiringStockItem {
    id: number;
    productId: string;
    product?: Product;
    quantityRemaining: number;
    expiryDate: Date | null;
    company?: Company;
}

export interface Personnel {
    id: string;
    name: string;
    position: string;
    signatureImage?: string | null;
}

export interface BackOrderItem {
    id: number;
    createdAt: Date;
    originalRequisitionId: string;
    productId: string;
    departmentId: string;
    quantity: number;
    productName?: string;
    departmentName?: string;
    requisitionNumber?: string | null;
}

export interface LoanItem {
    id: number;
    createdAt: Date;
    originalRequisitionId: string;
    productId: string;
    departmentId: string;
    quantity: number;
    status: 'Pending' | 'Fulfilled';
    fulfilledAt: Date | null;
    isDerived: boolean;
    productName?: string;
    departmentName?: string;
    requisitionNumber?: string | null;
}

export interface LoanTransactionItem {
    id: number;
    loanTransactionId: string;
    productId: string;
    quantity: number;
    returnedQuantity: number;
    product?: Product;
    isDerived?: boolean;
    originalRequisitionItemId?: number;
}

export interface LoanTransaction {
    id: string;
    transactionNumber: string;
    departmentId: string;
    departmentName?: string;
    borrowerName: string;
    lenderName: string;
    reason?: string;
    status: 'Active' | 'Completed' | 'Cancelled';
    createdAt: Date;
    updatedAt: Date;
    items?: LoanTransactionItem[];
    isDerived?: boolean;
}

export interface ProductUsageHistory {
    productId: string;
    fiscalYear: number;
    totalQuantity: number;
}

export interface P2PExchangePosting {
    id: string;
    postingDepartmentId: string;
    productId: string;
    quantity: number;
    postType: 'OFFER' | 'REQUEST';
    status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
    notes?: string | null;
    fulfilledByDepartmentId?: string | null;
    fulfilledAt?: Date | null;
    createdAt: Date;
    product?: Product;
    department?: Department;
}

export const p2pPostStatusMap: Record<string, { text: string, color: string }> = {
    ACTIVE: { text: 'ประกาศอยู่', color: 'bg-green-100 text-green-800' },
    FULFILLED: { text: 'สำเร็จแล้ว', color: 'bg-blue-100 text-blue-800' },
    CANCELLED: { text: 'ยกเลิก', color: 'bg-gray-100 text-gray-800' }
};

export type AppView = 
  | { type: 'dashboard' }
  | { type: 'admin'; payload?: any }
  | { type: 'department'; payload?: any }
  | { type: 'warehouse'; payload?: any };

export type WarehouseTab = 'requisitions' | 'receipts' | 'stockCard' | 'reports';

export interface LineUserProfile {
    userId: string;
    lineUserId: string;
    displayName: string;
    pictureUrl?: string | null;
    settings: any;
}

export interface PublicProductInfo {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    minStock: number | null;
    maxStock: number | null;
    zone: string | null;
}

export interface DepartmentInventoryLot {
    id?: number;
    departmentId: string;
    productId: string;
    quantity: number;
    lotNumber: string | null;
    expiryDate: string | null;
}

export interface DepartmentInventoryItem {
    departmentId: string;
    productId: string;
    quantity: number;
    minStock: number | null;
    maxStock: number | null;
    updatedAt?: Date;
}

export interface DepartmentProductUsage {
    departmentId: string;
    productId: string;
    totalApprovedQuantity: number;
}

export interface PublicChatMessage {
  id: number;
  createdAt: Date;
  username: string;
  message: string;
  userId?: string | null;
}

export interface ProductTransaction {
    transactionDate: Date;
    transactionType: string;
    referenceDocument: string;
    departmentName?: string | null;
    quantityIn: number;
    quantityOut: number;
    balance: number;
}

export interface SurveyConfig {
    id: string;
    roundName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface SurveyQuestion {
    id: string;
    configId: string;
    questionText: string;
    questionType: 'rating' | 'text';
    orderIndex: number;
    createdAt: Date;
}

export interface SurveyResponse {
    id: string;
    configId: string;
    departmentId: string;
    userId?: string | null;
    submittedAt: Date;
    answers: Record<string, any>;
}
