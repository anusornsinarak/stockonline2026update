
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Department } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PaperAirplaneIcon from '../icons/PaperAirplaneIcon';

export const SendNotificationView: React.FC<{ currentUser: User, allUsers: User[], departments: Department[] }> = ({ currentUser, allUsers, departments }) => {
    const [message, setMessage] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isSendToAll, setIsSendToAll] = useState(false);
    const [sendToLine, setSendToLine] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

    const availableUsers = useMemo(() => {
        // Admins should only send notifications to non-admin users.
        // This also prevents the sender from receiving their own notification.
        return allUsers
            .filter(u => u.role !== 'Admin')
            .sort((a, b) => a.username.localeCompare(b.username, 'th'));
    }, [allUsers]);

    const filteredAvailableUsers = useMemo(() => {
        return availableUsers.filter(u =>
            u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            (u.departmentId && departmentMap.get(u.departmentId)?.toLowerCase().includes(userSearchTerm.toLowerCase()))
        );
    }, [availableUsers, userSearchTerm, departmentMap]);

    const handleToggleUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleSend = async () => {
        if (!message.trim()) {
            setStatus({ type: 'error', text: 'กรุณาใส่ข้อความที่ต้องการส่ง' });
            return;
        }
    
        const recipientsSelected = isSendToAll || selectedUserIds.size > 0;
        if (!recipientsSelected) {
            setStatus({ type: 'error', text: 'กรุณาเลือกผู้รับอย่างน้อยหนึ่งคน' });
            return;
        }
    
        setIsSending(true);
        setStatus(null);
    
        try {
            // Fetch fresh user data on every send action to prevent stale data issues.
            const freshUsers = await supabaseService.getUsers();
            
            let recipientIds: string[];
    
            if (isSendToAll) {
                // "Send to all" means all non-admin users from the fresh list.
                recipientIds = freshUsers
                    .filter(u => u.role !== 'Admin')
                    .map(u => u.id);
            } else {
                // For manual selection, we still filter against the fresh list of admins
                // to ensure a user's role hasn't changed since the page loaded.
                const adminIds = new Set(freshUsers.filter(u => u.role === 'Admin').map(u => u.id));
                recipientIds = (Array.from(selectedUserIds) as string[]).filter(id => !adminIds.has(id));
            }
    
            if (recipientIds.length === 0) {
                setStatus({ type: 'error', text: 'ไม่พบผู้รับที่เหมาะสม (อาจเป็น Admin ทั้งหมด หรือตัวเลือกเก่า)' });
                setIsSending(false);
                return;
            }
    
            await supabaseService.sendAdminNotification({ message, recipientIds, sendToLine });
            setStatus({ type: 'success', text: 'ส่งการแจ้งเตือนสำเร็จ!' });
            setMessage('');
            setSelectedUserIds(new Set());
            setIsSendToAll(false);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
            setStatus({ type: 'error', text: `ส่งไม่สำเร็จ: ${errorMessage}` });
        } finally {
            setIsSending(false);
        }
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const canSend = message.trim() && (isSendToAll || selectedUserIds.size > 0);

    return (
        <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-4">ส่งการแจ้งเตือนแบบกำหนดเอง</h3>
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-6">
                <div>
                    <label htmlFor="recipients" className="block text-sm font-medium text-slate-700 mb-1">
                        ผู้รับ
                    </label>
                    <div className="flex items-center gap-4">
                        {/* Custom Multi-select */}
                        <div className="relative w-full" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(prev => !prev)}
                                disabled={isSendToAll}
                                className="w-full text-left bg-white border border-slate-300 rounded-lg shadow-sm pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                <div className="flex flex-wrap gap-1.5">
                                    {Array.from(selectedUserIds).map(id => {
                                        const user = userMap.get(id as string);
                                        return (
                                            <span key={id} className="inline-flex items-center gap-1.5 bg-sky-100 text-sky-800 text-xs font-medium px-2 py-1 rounded-full">
                                                {user?.username || 'Unknown'}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleToggleUser(id as string); }}
                                                    className="w-4 h-4 text-sky-600 hover:bg-sky-200 rounded-full"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        );
                                    })}
                                    {selectedUserIds.size === 0 && <span className="text-slate-500">เลือกผู้ใช้...</span>}
                                </div>
                            </button>
                            {isDropdownOpen && !isSendToAll && (
                                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg border border-slate-200 rounded-md max-h-60 flex flex-col">
                                    <div className="p-2 border-b">
                                        <input
                                            type="text"
                                            placeholder="ค้นหาผู้ใช้..."
                                            value={userSearchTerm}
                                            onChange={e => setUserSearchTerm(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                                        />
                                    </div>
                                    <ul className="overflow-y-auto">
                                        {filteredAvailableUsers.map(user => (
                                            <li key={user.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleUser(user.id)}
                                                    className="w-full text-left px-3 py-2 hover:bg-sky-50"
                                                >
                                                    <div className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUserIds.has(user.id)}
                                                            readOnly
                                                            className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                                                        />
                                                        <div className="ml-3">
                                                            <p className="text-sm font-medium text-slate-900">{user.username}</p>
                                                            <p className="text-xs text-slate-500">{departmentMap.get(user.departmentId || '') || user.role}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center">
                            <input
                                id="sendToAll"
                                type="checkbox"
                                checked={isSendToAll}
                                onChange={e => setIsSendToAll(e.target.checked)}
                                className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                            />
                            <label htmlFor="sendToAll" className="ml-2 block text-sm text-slate-700 whitespace-nowrap">
                                ส่งหาทั้งหมด
                            </label>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                        ข้อความ
                    </label>
                    <textarea
                        id="message"
                        rows={5}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="พิมพ์ข้อความของคุณที่นี่..."
                    ></textarea>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input
                            id="sendToLine"
                            type="checkbox"
                            checked={sendToLine}
                            onChange={e => setSendToLine(e.target.checked)}
                            className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                        />
                        <label htmlFor="sendToLine" className="ml-2 block text-sm text-slate-700 whitespace-nowrap">
                            ส่งเข้า LINE ด้วย (ถ้าผู้ใช้เชื่อมต่อไว้)
                        </label>
                    </div>
                    <div className="flex justify-end items-center gap-4">
                        {status && (
                            <p className={`text-sm font-medium ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {status.text}
                            </p>
                        )}
                        <button
                            onClick={handleSend}
                            disabled={isSending || !canSend}
                            className="flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed w-36"
                        >
                            {isSending ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <PaperAirplaneIcon className="w-5 h-5"/>
                                    <span>ส่ง</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
