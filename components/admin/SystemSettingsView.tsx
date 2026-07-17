
import React, { useState } from 'react';
import { Product, SurveyEntry, Department, User, Company, ProductAssignment, ProductSupplier, Requisition, PurchaseOrder, GoodsReceivedNote, SystemLog, ProductIssue } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import * as XLSX from 'xlsx';
import DownloadIcon from '../icons/DownloadIcon';
import UploadIcon from '../icons/UploadIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import ArrowPathIcon from '../icons/ArrowPathIcon';
import CalculatorIcon from '../icons/CalculatorIcon';

export const SystemSettingsView: React.FC<{
    allData: {
        products: Product[];
        departments: Department[];
        users: User[];
        companies: Company[];
        productAssignments: ProductAssignment[];
        productSuppliers: ProductSupplier[];
        requisitions: Requisition[];
        purchaseOrders: PurchaseOrder[];
        surveySubmissions: SurveyEntry[];
        goodsReceivedNotes: GoodsReceivedNote[];
        systemLogs: SystemLog[];
        productIssues: ProductIssue[];
    };
    onRestoreSuccess: () => void;
}> = ({ allData, onRestoreSuccess }) => {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreError, setRestoreError] = useState('');
    const [confirmationText, setConfirmationText] = useState('');
    
    const [isFixingNumbers, setIsFixingNumbers] = useState(false);
    const [isRepairingData, setIsRepairingData] = useState(false);

    const CONFIRMATION_PHRASE = "ยืนยันการกู้คืนข้อมูล";

    const handleBackupAllData = async () => {
        setIsBackingUp(true);
        try {
            const productMap = new Map(allData.products.map(p => [p.id, p]));
            const departmentMap = new Map(allData.departments.map(d => [d.id, d.name]));
            const companyMap = new Map(allData.companies.map(c => [c.id, c.name]));
    
            const wb = XLSX.utils.book_new();
    
            const createSheet = (data: any[], name: string) => {
                if (data && data.length > 0) {
                    const sheet = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, sheet, name);
                }
            };
    
            createSheet(allData.products, "products");
            createSheet(allData.departments, "departments");
            createSheet(allData.companies, "companies");
            createSheet(allData.users.map(u => ({
                id: u.id, username: u.username, email: u.email, role: u.role,
                department_name: u.departmentId ? departmentMap.get(u.departmentId) : null,
            })), "users");
    
            createSheet(allData.productAssignments.map(pa => ({
                department_name: departmentMap.get(pa.departmentId),
                product_name: (productMap.get(pa.productId) as Product | undefined)?.name,
            })), "product_assignments");
    
            createSheet(allData.productSuppliers.map(ps => ({
                product_name: (productMap.get(ps.productId) as Product | undefined)?.name,
                company_name: companyMap.get(ps.companyId),
            })), "product_suppliers");
    
            const flatSurveys = allData.surveySubmissions.flatMap(s =>
                Object.entries(s.quantities).map(([productId, details]) => ({
                    department_name: departmentMap.get(s.departmentId),
                    submitted_at: s.submittedAt,
                    product_name: (productMap.get(productId) as Product | undefined)?.name,
                    quantity: (details as any).quantity,
                    price_at_submission: (details as any).price,
                }))
            );
            createSheet(flatSurveys, "survey_submissions");
    
            createSheet(allData.requisitions.map(r => ({
                id: r.id, requisition_number: r.requisitionNumber,
                department_name: departmentMap.get(r.departmentId),
                name: r.name, status: r.status, type: r.type,
                created_at: r.createdAt, submitted_at: r.submittedAt,
            })), "requisitions");
    
            const flatReqItems = allData.requisitions.flatMap(r =>
                (r.items || []).map(item => ({
                    requisition_id: r.id,
                    product_name: (productMap.get(item.productId) as Product | undefined)?.name,
                    quantity: item.quantity,
                    price_per_unit: item.pricePerUnit,
                }))
            );
            createSheet(flatReqItems, "requisition_items");
    
            createSheet(allData.purchaseOrders.map(p => ({
                id: p.id, po_number: p.poNumber,
                company_name: companyMap.get(p.companyId),
                total_value: p.totalValue, status: p.status,
                created_at: p.createdAt, ordered_at: p.orderedAt,
            })), "purchase_orders");
    
            const flatPoItems = allData.purchaseOrders.flatMap(p =>
                (p.items || []).map(item => ({
                    purchase_order_id: p.id,
                    product_name: (productMap.get(item.productId) as Product | undefined)?.name,
                    quantity: item.quantity,
                    price_per_unit: item.pricePerUnit,
                }))
            );
            createSheet(flatPoItems, "po_items");
    
            const flatPoCommittees = allData.purchaseOrders.flatMap(p =>
                (p.committees || []).map(c => ({
                    purchase_order_id: p.id,
                    name: c.name, position: c.position, role: c.role,
                }))
            );
            createSheet(flatPoCommittees, "po_committees");
            
            createSheet(allData.goodsReceivedNotes.map(g => ({
                id: g.id, grn_number: g.grnNumber,
                purchase_order_id: g.purchaseOrderId,
                source_type: g.source_type,
                received_date: g.receivedDate, notes: g.notes,
            })), "goods_received_notes");
            
            const flatGrnItems = allData.goodsReceivedNotes.flatMap(g =>
                (g.items || []).map(i => ({
                    grn_id: g.id,
                    product_name: (productMap.get(i.productId) as Product | undefined)?.name,
                    quantity_received: i.quantityReceived,
                }))
            );
            createSheet(flatGrnItems, "grn_items");
            
            createSheet(allData.systemLogs.map(l => ({ ...l, username: undefined })), "system_logs");
            createSheet(allData.productIssues, "product_issues");

            const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
            const fileName = `backup_data_full_${timestamp}.xlsx`;
            
            XLSX.writeFile(wb, fileName);
            
            await supabaseService.logSystemEvent({
                level: 'INFO',
                event: 'BACKUP_CREATED',
                message: `Backup file '${fileName}' created.`
            });
    
            alert(`สร้างไฟล์สำรองข้อมูลสำเร็จ!`);
            onRestoreSuccess();
        } catch (error) {
            console.error("Backup failed:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            alert("การสำรองข้อมูลล้มเหลว: " + message);
        } finally {
            setIsBackingUp(false);
        }
    };
    
    const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRestoreFile(file);
            setRestoreError('');
        }
    };

    const handleRestore = async () => {
        if (!restoreFile || confirmationText !== CONFIRMATION_PHRASE) {
            setRestoreError("เงื่อนไขการกู้คืนไม่ถูกต้อง");
            return;
        }

        setIsRestoring(true);
        setRestoreError('');

        try {
            await supabaseService.restoreFromBackup(restoreFile);
            alert("กู้คืนข้อมูลสำเร็จ!");
            onRestoreSuccess();
        } catch (error) {
            const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
            setRestoreError(`การกู้คืนล้มเหลว: ${message}`);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleFixNumbers = async () => {
        if (!window.confirm('คุณต้องการจัดระเบียบเลขที่ใบเบิกใหม่ทั้งหมดตามระบบ "พ.ศ. เดือน เลข 3 หลัก" หรือไม่? การดำเนินการนี้จะแก้ไขเลขที่ใบเบิกที่มีอยู่แล้วในระบบให้ถูกต้อง')) return;
        
        setIsFixingNumbers(true);
        try {
            const updatedCount = await supabaseService.fixAllRequisitionNumbers();
            alert(`ดำเนินการสำเร็จ! แก้ไขไปทั้งหมด ${updatedCount} รายการ`);
            onRestoreSuccess();
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการแก้ไขเลขที่ใบเบิก');
        } finally {
            setIsFixingNumbers(false);
        }
    };

    const handleRepairApprovedData = async () => {
        if (!window.confirm("ยืนยันการซ่อมแซมข้อมูล? \n\nระบบจะตรวจสอบรายการเก่าที่ 'จำนวนอนุมัติ' สูญหาย (เป็นค่าว่าง) และเติมตัวเลขให้โดยอัตโนมัติ: \n- รายการอนุมัติ/เสร็จสิ้น -> เติมเต็มจำนวน\n- รายการค้างจ่าย/ยกเลิก/ยืม -> เติม 0")) return;
        
        setIsRepairingData(true);
        try {
            const count = await supabaseService.repairLegacyApprovedQuantities();
            alert(`ซ่อมแซมข้อมูลสำเร็จ! ปรับปรุงไปทั้งหมด ${count} รายการ`);
            onRestoreSuccess();
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการซ่อมแซมข้อมูล');
        } finally {
            setIsRepairingData(false);
        }
    }

    const isRestoreDisabled = !restoreFile || isRestoring || confirmationText !== CONFIRMATION_PHRASE;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Maintenance Tools */}
            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">เครื่องมือดูแลรักษาระบบ</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-6 border border-amber-200 dark:border-amber-800 rounded-xl shadow-sm space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600">
                                <ArrowPathIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-900 dark:text-amber-200">เครื่องมือจัดการเลขที่ใบเบิก</h4>
                                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                                    จัดระเบียบเลขที่ใบเบิกใหม่ให้เป็นระบบ <strong>ปีเดือนเลข3หลัก (YYMMNNN)</strong> โดยยึดตามวันเวลาที่สร้างจริง 
                                    เพื่อแก้ไขปัญหาเลขกระโดดหรือเลขที่ไม่ได้ตามรูปแบบเดิม
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleFixNumbers}
                            disabled={isFixingNumbers}
                            className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-all shadow-md shadow-amber-600/20"
                        >
                            {isFixingNumbers ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <ArrowPathIcon className="w-5 h-5"/>}
                            จัดระเบียบเลขที่ใบเบิกใหม่
                        </button>
                    </div>

                    <div className="bg-sky-50 dark:bg-sky-900/10 p-6 border border-sky-200 dark:border-sky-800 rounded-xl shadow-sm space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-sky-100 dark:bg-sky-900/40 rounded-lg text-sky-600">
                                <CalculatorIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sky-900 dark:text-sky-200">ซ่อมแซมข้อมูลจำนวนอนุมัติ (Fix Data)</h4>
                                <p className="text-sm text-sky-700 dark:text-sky-400 mt-1">
                                    ใช้สำหรับกรณีที่ใบเบิกเก่าแสดงยอดเงินผิดพลาด (แสดงยอดเต็มทั้งที่ไม่ได้อนุมัติ) ระบบจะเติมตัวเลขจำนวนอนุมัติที่สูญหายให้ถูกต้องตามสถานะของรายการ
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleRepairApprovedData}
                            disabled={isRepairingData}
                            className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-all shadow-md shadow-sky-600/20"
                        >
                            {isRepairingData ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <CalculatorIcon className="w-5 h-5"/>}
                            ซ่อมแซมข้อมูล
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">สำรองข้อมูล</h3>
                <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        สร้างไฟล์สำรองข้อมูลทั้งหมดของระบบ (เช่น รายการ, หน่วยงาน, ผู้ใช้, ประวัติการเบิก) ในรูปแบบไฟล์ Excel (.xlsx)
                    </p>
                    <button
                        onClick={handleBackupAllData}
                        disabled={isBackingUp}
                        className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                    >
                        <DownloadIcon className="w-5 h-5"/>
                        {isBackingUp ? 'กำลังสร้างไฟล์...' : 'สร้างไฟล์สำรองข้อมูล'}
                    </button>
                </div>
            </div>

            <div>
                 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">กู้คืนข้อมูล</h3>
                 <div className="bg-white dark:bg-slate-800 p-6 border border-red-300 dark:border-red-900 rounded-xl shadow-sm space-y-4">
                     <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-l-4 border-red-500 rounded-r-lg">
                        <div className="flex items-start gap-3">
                            <ExclamationTriangleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold">คำเตือน: การกระทำนี้มีความเสี่ยงสูง</h4>
                                <p className="text-sm">การกู้คืนข้อมูลจะลบข้อมูลปัจจุบันทั้งหมดในระบบและแทนที่ด้วยข้อมูลจากไฟล์ที่ท่านอัปโหลด การดำเนินการนี้ไม่สามารถย้อนกลับได้ กรุณาแน่ใจว่าได้สำรองข้อมูลปัจจุบันไว้แล้ว</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="restore-file" className="block text-sm font-medium text-slate-700 dark:text-slate-300">เลือกไฟล์สำรอง (.xlsx)</label>
                        <input 
                            id="restore-file"
                            type="file" 
                            onChange={handleRestoreFileChange} 
                            className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                            accept=".xlsx"
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="confirm-restore" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            เพื่อยืนยัน, กรุณาพิมพ์ "<span className="font-mono text-red-700 dark:text-red-400">{CONFIRMATION_PHRASE}</span>"
                        </label>
                         <input
                            id="confirm-restore"
                            type="text"
                            value={confirmationText}
                            onChange={e => setConfirmationText(e.target.value)}
                            className="mt-1 w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg shadow-sm p-2"
                        />
                    </div>
                     {restoreError && <p className="text-sm text-red-600">{restoreError}</p>}
                    <button
                        onClick={handleRestore}
                        disabled={isRestoreDisabled}
                        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-slate-400"
                    >
                        <UploadIcon className="w-5 h-5"/>
                        {isRestoring ? 'กำลังกู้คืนข้อมูล...' : 'ยืนยันการกู้คืน'}
                    </button>
                 </div>
            </div>
        </div>
    );
};
