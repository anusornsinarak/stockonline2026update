
import React, { useState } from 'react';
import { SystemLog } from '../../types';
import TableTemplate from './TableTemplate';
import ArrowPathIcon from '../icons/ArrowPathIcon';
import { supabaseService } from '../../services/supabaseService';

const SystemLogsView: React.FC<{ logs: SystemLog[] }> = ({ logs: initialLogs }) => {
    const [logs, setLogs] = useState<SystemLog[]>(initialLogs);
    const [isRefreshing, setIsRefreshing] = useState(false);

    React.useEffect(() => {
        setLogs(initialLogs);
    }, [initialLogs]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const newLogs = await supabaseService.getSystemLogs();
            setLogs(newLogs);
        } catch (error) {
            console.error("Failed to refresh logs", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const levelStyles: Record<SystemLog['level'], { bg: string, text: string }> = {
        INFO: { bg: 'bg-sky-100 dark:bg-sky-900/50', text: 'text-sky-800 dark:text-sky-300' },
        WARN: { bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-800 dark:text-amber-300' },
        ERROR: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
    };

    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ประวัติการทำงานของระบบ (Logs)</h3>
                 <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            await supabaseService.logSystemEvent({ level: 'INFO', event: 'MANUAL_TEST', message: 'User triggered a manual test log' });
                            handleRefresh();
                        }}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                    >
                        ส่ง Log ทดสอบ
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
                    </button>
                 </div>
             </div>
             <TableTemplate headers={['เวลา', 'ผู้ใช้', 'ระดับ', 'เหตุการณ์', 'ข้อความ']}>
                {logs.map(log => (
                    <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                           {new Date(log.createdAt).toLocaleString('th-TH')}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                           {log.username || 'System'}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${levelStyles[log.level].bg} ${levelStyles[log.level].text}`}>
                                {log.level}
                            </span>
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                           {log.event}
                        </td>
                         <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 break-words max-w-md">
                           {log.message}
                        </td>
                    </tr>
                ))}
                 {logs.length === 0 && (
                    <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-500 dark:text-slate-400">ยังไม่มีประวัติในระบบ</td>
                    </tr>
                )}
             </TableTemplate>
        </div>
    )
}

export default SystemLogsView;