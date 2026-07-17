
import React, { useEffect, useRef } from 'react';
import { AppNotification } from '../types';

interface NotificationPopoverProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  onAction: (payload: AppNotification['actionPayload']) => void;
}

const timeSince = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " ปีที่แล้ว";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " เดือนที่แล้ว";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " วันที่แล้ว";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ชม.ที่แล้ว";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " นาทีที่แล้ว";
    return "เมื่อสักครู่";
};


const NotificationPopover: React.FC<NotificationPopoverProps> = ({ notifications, onClose, onMarkAsRead, onMarkAllAsRead, onAction }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    const handleNotificationClick = (notification: AppNotification) => {
        onMarkAsRead(notification.id);
        if (notification.actionPayload) {
            onAction(notification.actionPayload);
        }
        // If it's a link or specific action, we might not want to close immediately, 
        // but for now, we close it to clear the UI.
        onClose();
    };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[110] animate-fade-in overflow-hidden"
      style={{ animationDuration: '0.2s'}}
    >
        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                การแจ้งเตือน
                {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        ใหม่
                    </span>
                )}
            </h3>
            <button
                onClick={(e) => { e.stopPropagation(); onMarkAllAsRead(); }}
                disabled={notifications.every(n => n.isRead)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
            >
                อ่านทั้งหมด
            </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">ไม่มีการแจ้งเตือนในขณะนี้</p>
                </div>
            ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {notifications.map(n => (
                        <li key={n.id} className={`group ${!n.isRead ? 'bg-sky-50/50 dark:bg-sky-900/10' : 'bg-white dark:bg-slate-800'} transition-colors`}>
                            <button
                                onClick={() => handleNotificationClick(n)}
                                className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.isRead ? 'bg-sky-500 shadow-sm shadow-sky-400 animate-pulse' : 'bg-transparent'}`}></div>
                                <div className="flex-grow">
                                    <p className={`text-sm leading-relaxed ${!n.isRead ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {n.message}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {timeSince(n.createdAt)}
                                    </p>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        {notifications.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 text-center">
                <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">ปิด</button>
            </div>
        )}
    </div>
  );
};

export default NotificationPopover;
