import React, { useState, useEffect } from 'react';
import { User, AppView } from './types';
import { DashboardOverview } from './components/DashboardOverview';
import { supabaseService } from './services/supabaseService';
import ExclamationTriangleIcon from './components/icons/ExclamationTriangleIcon';
import XMarkIcon from './components/icons/XMarkIcon';
import Modal from './components/Modal';

// Icons
import ClipboardDocumentListIcon from './components/icons/ClipboardDocumentListIcon';
import DocumentChartBarIcon from './components/icons/DocumentChartBarIcon';
import DocumentTextIcon from './components/icons/DocumentTextIcon';
import ChartBarIcon from './components/icons/ChartBarIcon';
import CubeIcon from './components/icons/CubeIcon';
import ShoppingCartIcon from './components/icons/ShoppingCartIcon';
import InboxArrowDownIcon from './components/icons/InboxArrowDownIcon';
import BuildingOfficeIcon from './components/icons/BuildingOfficeIcon';
import UsersIcon from './components/icons/UsersIcon';
import MegaphoneIcon from './components/icons/MegaphoneIcon';
import ArchiveBoxIcon from './components/icons/ArchiveBoxIcon';
import CogIcon from './components/icons/CogIcon';
import HomeIcon from './components/icons/HomeIcon';
import ClipboardDocumentCheckIcon from './components/icons/ClipboardDocumentCheckIcon';
import CalculatorIcon from './components/icons/CalculatorIcon';
import CalendarDaysIcon from './components/icons/CalendarDaysIcon';
import ListBulletIcon from './components/icons/ListBulletIcon';
import UserGroupIcon from './components/icons/UserGroupIcon';
import ArchiveBoxArrowDownIcon from './components/icons/ArchiveBoxArrowDownIcon';
import PaperAirplaneIcon from './components/icons/PaperAirplaneIcon';
import SpeakerWaveIcon from './components/icons/SpeakerWaveIcon';
import DocumentPlusIcon from './components/icons/DocumentPlusIcon';
import QrCodeIcon from './components/icons/QrCodeIcon';
import ChevronDownIcon from './components/icons/ChevronDownIcon';


interface MainDashboardProps {
  user: User;
  onNavigate: (view: AppView) => void;
}

interface DashboardItemConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
  view: AppView;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ user, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [minMaxWarning, setMinMaxWarning] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });

  useEffect(() => {
    if (user.role === 'Department' && user.departmentId) {
        supabaseService.checkDepartmentMinMaxStatus(user.departmentId).then(status => {
            if (status.hasMissingMinMax) {
                setMinMaxWarning({ show: true, count: status.missingCount });
            }
        });
    }
  }, [user.role, user.departmentId]);

  const getDashboardItems = (): DashboardItemConfig[] => {
    switch (user.role) {
      case 'Department':
        return [
          { label: 'เบิกเวชภัณฑ์', icon: <ClipboardDocumentListIcon className="w-full h-full p-1" />, color: 'text-orange-500', view: { type: 'department', payload: 'requisition' } },
          { label: 'รายการค้างจ่าย/ยืม', icon: <ArchiveBoxArrowDownIcon className="w-full h-full p-1" />, color: 'text-purple-500', view: { type: 'department', payload: 'backorders' } },
          { label: 'แบบสำรวจ', icon: <DocumentTextIcon className="w-full h-full p-1" />, color: 'text-green-500', view: { type: 'department', payload: 'survey' } },
          { label: 'คลังของฉัน', icon: <ArchiveBoxIcon className="w-full h-full p-1" />, color: 'text-teal-500', view: { type: 'department', payload: 'inventory' } },
          { label: 'สแกนใช้', icon: <QrCodeIcon className="w-full h-full p-1" />, color: 'text-rose-500', view: { type: 'department', payload: 'usage_scanner' } },
          { label: 'รายงาน', icon: <DocumentChartBarIcon className="w-full h-full p-1" />, color: 'text-indigo-500', view: { type: 'department', payload: 'report' } },
          { label: 'ตั้งค่าการแจ้งเตือน', icon: <MegaphoneIcon className="w-full h-full p-1" />, color: 'text-slate-600', view: { type: 'department', payload: 'settings' } },
        ];
      case 'Warehouse':
        const warehouseItems: DashboardItemConfig[] = [
          { label: 'ใบเบิก', icon: <ClipboardDocumentListIcon className="w-full h-full p-1" />, color: 'text-orange-500', view: { type: 'warehouse', payload: 'requisitions' } },
        ];
        
        if (user.permissions?.canManageReceipts) {
            warehouseItems.push({ label: 'รับของ', icon: <InboxArrowDownIcon className="w-full h-full p-1" />, color: 'text-cyan-500', view: { type: 'warehouse', payload: 'receipts' } });
        }
        if (user.permissions?.canViewStockCard) {
            warehouseItems.push({ label: 'คลัง', icon: <CubeIcon className="w-full h-full p-1" />, color: 'text-indigo-500', view: { type: 'warehouse', payload: 'stockCard' } });
        }
        
        warehouseItems.push({ label: 'สร้างแทน', icon: <DocumentPlusIcon className="w-full h-full p-1" />, color: 'text-emerald-600', view: { type: 'warehouse', payload: 'create_for_dept' } });
        warehouseItems.push({ label: 'ระบบยืม', icon: <ClipboardDocumentCheckIcon className="w-full h-full p-1" />, color: 'text-indigo-600', view: { type: 'warehouse', payload: 'loanSystem' } });

        if (user.permissions?.canViewReports) {
            warehouseItems.push({ label: 'รายงาน', icon: <ChartBarIcon className="w-full h-full p-1" />, color: 'text-red-500', view: { type: 'warehouse', payload: 'reports' } });
        }
        return warehouseItems;
      case 'Admin':
        return [
          { label: 'เครื่องมือแอดมินทั้งหมด', icon: <HomeIcon className="w-full h-full p-1" />, color: 'text-sky-500', view: { type: 'admin', payload: 'summary' } },
          { label: 'ผลรายหน่วยงาน', icon: <DocumentTextIcon className="w-full h-full p-1" />, color: 'text-green-500', view: { type: 'admin', payload: 'departments' } },
          { label: 'วางแผนจัดซื้อ', icon: <CalculatorIcon className="w-full h-full p-1" />, color: 'text-lime-500', view: { type: 'admin', payload: 'purchasePlan' } },
          { label: 'รายการเบิก', icon: <ClipboardDocumentListIcon className="w-full h-full p-1" />, color: 'text-orange-500', view: { type: 'admin', payload: 'requisitions' } },
          { label: 'ระบบยืม-คืนสินค้า', icon: <ClipboardDocumentCheckIcon className="w-full h-full p-1" />, color: 'text-indigo-600', view: { type: 'admin', payload: 'loanSystem' } },
          { label: 'สร้างใบเบิกแทน', icon: <DocumentPlusIcon className="w-full h-full p-1" />, color: 'text-emerald-600', view: { type: 'admin', payload: 'create_for_dept' } },
          { label: 'จัดซื้อ', icon: <ShoppingCartIcon className="w-full h-full p-1" />, color: 'text-teal-500', view: { type: 'admin', payload: 'purchaseOrder' } },
          { label: 'รับของ', icon: <InboxArrowDownIcon className="w-full h-full p-1" />, color: 'text-cyan-500', view: { type: 'admin', payload: 'receipts' } },
          { label: 'คลัง/สต็อกการ์ด', icon: <CubeIcon className="w-full h-full p-1" />, color: 'text-indigo-500', view: { type: 'admin', payload: 'stockCard' } },
          { label: 'สินค้าใกล้หมดอายุ', icon: <CalendarDaysIcon className="w-full h-full p-1" />, color: 'text-amber-500', view: { type: 'admin', payload: 'expiringStock' } },
          { label: 'จัดการรายการ/บริษัท', icon: <ListBulletIcon className="w-full h-full p-1" />, color: 'text-purple-500', view: { type: 'admin', payload: 'manageItems' } },
          { label: 'จัดการ Min/Max', icon: <CogIcon className="w-full h-full p-1" />, color: 'text-pink-500', view: { type: 'admin', payload: 'manageStockLevels' } },
          { label: 'จัดการหน่วยงาน', icon: <BuildingOfficeIcon className="w-full h-full p-1" />, color: 'text-emerald-500', view: { type: 'admin', payload: 'manageDepts' } },
          { label: 'จัดการผู้ใช้', icon: <UsersIcon className="w-full h-full p-1" />, color: 'text-blue-500', view: { type: 'admin', payload: 'manageUsers' } },
          { label: 'จัดการบุคลากร', icon: <UserGroupIcon className="w-full h-full p-1" />, color: 'text-fuchsia-500', view: { type: 'admin', payload: 'managePersonnel' } },
          { label: 'จัดการประกาศข่าว', icon: <SpeakerWaveIcon className="w-full h-full p-1" />, color: 'text-gray-600', view: { type: 'admin', payload: 'manageAnnouncements' } },
          { label: 'ส่งแจ้งเตือน', icon: <PaperAirplaneIcon className="w-full h-full p-1" />, color: 'text-yellow-500', view: { type: 'admin', payload: 'notifications' } },
          { label: 'ตั้งค่าแจ้งเตือน', icon: <MegaphoneIcon className="w-full h-full p-1" />, color: 'text-green-600', view: { type: 'admin', payload: 'accountSettings' } },
          { label: 'รายงาน', icon: <ChartBarIcon className="w-full h-full p-1" />, color: 'text-red-500', view: { type: 'admin', payload: 'reports' } },
          { label: 'ตั้งค่าเอกสาร', icon: <CogIcon className="w-full h-full p-1" />, color: 'text-slate-500', view: { type: 'admin', payload: 'documentSettings' } },
          { label: 'ระบบสำรอง', icon: <ArchiveBoxIcon className="w-full h-full p-1" />, color: 'text-gray-700', view: { type: 'admin', payload: 'system' } },
          { label: 'ประวัติ', icon: <ClipboardDocumentCheckIcon className="w-full h-full p-1" />, color: 'text-gray-500', view: { type: 'admin', payload: 'logs' } },
        ];
      default:
        return [];
    }
  };

  const navItems = getDashboardItems();

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
        {minMaxWarning.show && (
            <Modal isOpen={minMaxWarning.show} onClose={() => setMinMaxWarning({ ...minMaxWarning, show: false })} title="แจ้งเตือนการตั้งค่าระบบ">
                <div className="p-4">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl">
                            <ExclamationTriangleIcon className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">ตั้งค่าพัสดุไม่สมบูรณ์</h3>
                            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">มีรายการ {minMaxWarning.count} รายการที่หน่วยงานของคุณยังไม่ได้ตั้งค่า Min/Max Stock</p>
                        </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                        กรุณาไปที่เมนู "คลังของฉัน" เพื่อตั้งค่าจำนวนสต็อกขั้นต่ำและสูงสุด (Min/Max) ให้ครบถ้วน เพื่อให้ระบบสามารถช่วยคำนวณการเบิกและแจ้งเตือนได้อย่างมีประสิทธิภาพ
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setMinMaxWarning({ ...minMaxWarning, show: false })}
                            className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            ไว้ทีหลัง
                        </button>
                        <button 
                            onClick={() => {
                                setMinMaxWarning({ ...minMaxWarning, show: false });
                                onNavigate({ type: 'department', payload: 'inventory' });
                            }}
                            className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                        >
                            ไปตั้งค่าเลย
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Mobile Menu Toggle */}
            <div className="lg:hidden flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="bg-sky-100 dark:bg-sky-900/30 p-2 rounded-lg">
                        <ListBulletIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <h2 className="font-bold text-slate-700 dark:text-slate-200">เมนูระบบ</h2>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                >
                    {isMobileMenuOpen ? <ChevronDownIcon className="w-6 h-6 rotate-180 transition-transform" /> : <ChevronDownIcon className="w-6 h-6 transition-transform" />}
                </button>
            </div>

            {/* Sidebar Navigation */}
            <aside className={`${isMobileMenuOpen ? 'grid grid-cols-2 sm:grid-cols-3 gap-2' : 'hidden'} lg:flex lg:flex-col lg:w-72 flex-shrink-0 bg-white dark:bg-slate-800 p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-fit lg:space-y-1`}>
                <h2 className="hidden lg:block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">เมนูการใช้งาน</h2>
                {navItems.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => onNavigate(item.view)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left group border border-transparent lg:border-none border-slate-100 dark:border-slate-700 bg-slate-50 lg:bg-transparent dark:bg-slate-800"
                    >
                        <div className={`w-8 h-8 rounded-lg bg-slate-200/50 dark:bg-slate-900 flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                            {React.cloneElement(item.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors leading-tight">
                            {item.label}
                        </span>
                    </button>
                ))}
            </aside>

            {/* Main Content Dashboard */}
            <main className="flex-grow min-w-0">
                <DashboardOverview user={user} />
            </main>
            
        </div>
    </div>
  );
};

export default MainDashboard;
