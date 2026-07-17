
import React, { useState, useMemo } from 'react';
import { User, AppNotification } from '../types';
import LogoutIcon from './icons/LogoutIcon';
import BellIcon from './icons/BellIcon';
import NotificationPopover from './NotificationPopover';
import ArrowUturnLeftIcon from './icons/ArrowUturnLeftIcon';
import MoonIcon from './icons/MoonIcon';
import SunIcon from './icons/SunIcon';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  title: string;
  className?: string;
  notifications: AppNotification[];
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  onNotificationAction: (payload: AppNotification['actionPayload']) => void;
  showBackButton: boolean;
  onBack: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, title, className, notifications, onMarkAsRead, onMarkAllAsRead, onNotificationAction, showBackButton, onBack, theme, onToggleTheme }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    
    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    const getUserDisplay = () => {
        if (!user) return null;
        if (user.role === 'Admin') {
            return <span className="font-semibold text-sky-400">Admin ({user.username})</span>;
        }
        if (user.role === 'Borrower') {
            return <span className="font-semibold text-emerald-400">ผู้ยืม ({user.username})</span>;
        }

        const departmentName = (user as any).departmentName || 'Unknown Dept.';
        return (
            <>
                <span className="font-semibold text-sky-400">{departmentName}</span>
                <span className="text-slate-400 text-sm ml-1">({user.username})</span>
            </>
        );
    }

  return (
    // CHANGE: Changed relative to sticky top-0 and added high z-index [100].
    <header className={`sticky top-0 z-[100] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-md dark:shadow-none dark:border-b dark:border-slate-700 w-full p-4 mb-4 no-print ${className || ''}`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
        
        {/* Left side: Back button */}
        <div className="flex-1 flex items-center min-w-0">
          {showBackButton && (
            <button onClick={onBack} aria-label="กลับไปที่แดชบอร์ด" title="กลับไปที่แดชบอร์ด" className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0">
              <ArrowUturnLeftIcon className="w-6 h-6"/>
              <span className="hidden lg:inline font-medium">แดชบอร์ด</span>
            </button>
          )}
        </div>

        {/* Centered Title */}
        <div className="flex-grow text-center min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
            {title}
          </h1>
        </div>
        
        {/* Right-aligned User Info */}
        <div className="flex-1 flex justify-end min-w-0">
            {user && (
            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={onToggleTheme}
                    className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
                    aria-label={`เปลี่ยนเป็นธีม${theme === 'light' ? 'มืด' : 'สว่าง'}`}
                >
                    {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                </button>

                <div className="relative flex-shrink-0">
                     <button
                        onClick={() => setIsPopoverOpen(prev => !prev)}
                        className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                        aria-label={`คุณมี ${unreadCount} การแจ้งเตือนใหม่`}
                    >
                        <BellIcon className="w-6 h-6"/>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center">
                                    {unreadCount}
                                </span>
                            </span>
                        )}
                    </button>
                    {isPopoverOpen && (
                        <NotificationPopover 
                            notifications={notifications}
                            onClose={() => setIsPopoverOpen(false)}
                            onMarkAsRead={onMarkAsRead}
                            onMarkAllAsRead={onMarkAllAsRead}
                            onAction={onNotificationAction}
                        />
                    )}
                </div>
               
                <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-600 flex-shrink-0"></div>

                <span className="hidden md:flex items-center gap-1 text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden text-sm">
                    <span className="flex-shrink-0">ผู้ใช้:</span> 
                    <span className="truncate max-w-[120px] lg:max-w-none">{getUserDisplay()}</span>
                </span>
                
                <button
                    type="button"
                    onClick={onLogout}
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer relative z-[110]"
                    aria-label="ออกจากระบบ"
                >
                    <LogoutIcon className="w-5 h-5"/>
                    <span className="hidden lg:inline font-bold">ออกจากระบบ</span>
                </button>
            </div>
            )}
        </div>

      </div>
    </header>
  );
};

export default Header;
