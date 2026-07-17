
import React from 'react';
import { User, AppView } from '../types';

// Icons
import HomeIcon from './icons/HomeIcon';
import ClipboardDocumentListIcon from './icons/ClipboardDocumentListIcon';
import ClipboardDocumentCheckIcon from './icons/ClipboardDocumentCheckIcon';
import ShoppingCartIcon from './icons/ShoppingCartIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import CubeIcon from './icons/CubeIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import ArchiveBoxArrowDownIcon from './icons/ArchiveBoxArrowDownIcon';
import DocumentPlusIcon from './icons/DocumentPlusIcon';
import QrCodeIcon from './icons/QrCodeIcon';

interface DashboardItemConfig {
  label: string;
  icon: React.ReactNode;
  view: AppView;
}

interface BottomNavBarProps {
  user: User | null;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ user, activeView, onNavigate }) => {
  if (!user) {
    return null;
  }

  const getNavItems = (): DashboardItemConfig[] => {
    switch (user.role) {
      case 'Admin':
        return [
          { label: 'แดชบอร์ด', icon: <HomeIcon className="w-6 h-6" />, view: { type: 'dashboard' } },
          { label: 'ใบเบิก', icon: <ClipboardDocumentListIcon className="w-6 h-6" />, view: { type: 'admin', payload: 'requisitions' } },
          { label: 'สร้างแทน', icon: <DocumentPlusIcon className="w-6 h-6" />, view: { type: 'admin', payload: 'create_for_dept' } },
          { label: 'ระบบยืม', icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, view: { type: 'admin', payload: 'loanSystem' } },
          { label: 'สต็อกการ์ด', icon: <CubeIcon className="w-6 h-6" />, view: { type: 'admin', payload: 'stockCard' } },
        ];
      case 'Warehouse':
        const warehouseItems: DashboardItemConfig[] = [
          { label: 'ใบเบิก', icon: <ClipboardDocumentListIcon className="w-6 h-6" />, view: { type: 'warehouse', payload: 'requisitions' } },
        ];
        
        if (user.permissions?.canManageReceipts) {
            warehouseItems.push({ label: 'รับของ', icon: <InboxArrowDownIcon className="w-6 h-6" />, view: { type: 'warehouse', payload: 'receipts' } },);
        }
        if (user.permissions?.canViewStockCard) {
            warehouseItems.push({ label: 'คลัง', icon: <CubeIcon className="w-6 h-6" />, view: { type: 'warehouse', payload: 'stockCard' } });
        }
        
        warehouseItems.push({ label: 'สร้างแทน', icon: <DocumentPlusIcon className="w-6 h-6" />, view: { type: 'warehouse', payload: 'create_for_dept' } });
        warehouseItems.push({ label: 'ระบบยืม', icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, view: { type: 'warehouse', payload: 'loanSystem' } });

        if (user.permissions?.canViewReports) {
            warehouseItems.push({ label: 'รายงาน', icon: <ChartBarIcon className="w-6 h-6" />, view: { type: 'warehouse', payload: 'reports' } });
        }
        return warehouseItems;
      case 'Department':
        return [
          { label: 'แดชบอร์ด', icon: <HomeIcon className="w-6 h-6" />, view: { type: 'dashboard' } },
          { label: 'เบิกของ', icon: <ClipboardDocumentListIcon className="w-6 h-6" />, view: { type: 'department', payload: 'requisition' } },
          { label: 'คลังฉัน', icon: <ArchiveBoxIcon className="w-6 h-6" />, view: { type: 'department', payload: 'inventory' } },
          { label: 'สแกนใช้', icon: <QrCodeIcon className="w-6 h-6" />, view: { type: 'department', payload: 'usage_scanner' } },
        ];
      default:
        return [];
    }
  };
  
  const navItems = getNavItems();

  const isViewActive = (view: AppView) => {
    if (activeView.type !== view.type) return false;
    if (view.type === 'dashboard' && activeView.type === 'dashboard') return true;
    
    // Check if both views have payload property (not 'dashboard' type)
    if ('payload' in view && 'payload' in activeView) {
        const navPayload = view.payload;
        const activePayload = activeView.payload;

        if (typeof navPayload === 'object' && navPayload !== null && typeof activePayload === 'object' && activePayload !== null) {
          // Both are objects, e.g. active is {tab: 'req', subTab: 'loans'}, nav is {tab: 'req', subTab: 'loans'}
          return (navPayload as any).tab === (activePayload as any).tab && (navPayload as any).subTab === (activePayload as any).subTab;
        }
        if (typeof navPayload === 'string' && typeof activePayload === 'string') {
          // Both are strings, e.g. active is 'requisitions', nav is 'requisitions'
          return navPayload === activePayload;
        }
    }
    // If one is string and other is object, they are not a match. This ensures only one item is active.
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-t-lg z-40 md:hidden no-print">
      <div className="flex justify-around items-stretch h-16">
        {navItems.map((item) => {
          const isActive = isViewActive(item.view);
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center justify-center flex-1 pt-1 pb-1 transition-colors ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-300'
              }`}
            >
              <div className="flex-shrink-0">{item.icon}</div>
              <span className="text-xs mt-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
