
import React, { useState, useMemo } from 'react';
import { User, Department } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import EditIcon from '../icons/EditIcon';
import TrashIcon from '../icons/TrashIcon';
import TableTemplate from './TableTemplate';
import Modal from '../Modal';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';

const ManageUsersView: React.FC<{ users: User[], departments: Department[], onAdd: () => void, onEdit: (user: User) => void, onDataChange: () => void }> = ({ users, departments, onAdd, onEdit, onDataChange }) => {
    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    
    // State สำหรับ Modal ยืนยันการลบ
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const handleDeleteClick = (user: User) => {
        setDeleteError(null);
        // ตรวจสอบเงื่อนไข Admin คนสุดท้ายก่อนเปิด Modal
        if (user.role === 'Admin') {
            const adminCount = users.filter(u => u.role === 'Admin').length;
            if (adminCount <= 1) {
                setDeleteError('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้');
                return;
            }
        }
        setUserToDelete(user);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        
        const targetId = userToDelete.id;
        setUserToDelete(null); // ปิด Modal ทันที
        setIsDeletingId(targetId);
        console.log('Confirmed delete for ID:', targetId);

        try {
            await supabaseService.deleteUser(targetId);
            console.log('Delete successful');
            onDataChange();
        } catch(error: any) {
            console.error('Delete error:', error);
            
            let msg = error?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล";
            
            if (error?.code === '42883' || msg.includes('delete_user_by_id')) {
                msg = "ไม่พบฟังก์ชันลบข้อมูลในฐานข้อมูล กรุณารัน SQL ที่ได้รับไปก่อนหน้านี้ใน Supabase SQL Editor";
            } else if (error?.code === '23503') {
                msg = "ไม่สามารถลบได้เนื่องจากผู้ใช้นี้มีประวัติข้อมูลค้างอยู่ในระบบ";
            }

            setDeleteError(msg);
        } finally {
            setIsDeletingId(null);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">จัดการผู้ใช้ระบบ</h3>
                <button 
                    onClick={onAdd} 
                    className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2.5 px-5 rounded-xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-500/20 active:scale-95"
                >
                    <PlusIcon className="w-5 h-5"/>
                    เพิ่มผู้ใช้
                </button>
            </div>

            {deleteError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 shadow-sm animate-shake">
                  <div className="bg-red-500 text-white p-1 rounded-full flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-sm">การลบล้มเหลว</p>
                    <p className="text-xs mt-1 leading-relaxed">{deleteError}</p>
                  </div>
                  <button onClick={() => setDeleteError(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
            )}

             <TableTemplate headers={['ชื่อผู้ใช้', 'บทบาท', 'หน่วยงาน', { name: 'การดำเนินการ', className: 'text-right' }]}>
                 {users.map(user => {
                    const isProcessing = isDeletingId === user.id;
                    return (
                        <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/50 transition-colors border-b last:border-0 dark:border-slate-700">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-slate-100">{user.username || '(ยังไม่ได้ตั้งค่า)'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 
                                    user.role === 'Warehouse' ? 'bg-amber-100 text-amber-700' : 
                                    user.role === 'Borrower' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-sky-100 text-sky-700'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{user.departmentId ? departmentMap.get(user.departmentId) || '-' : '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                <div className="flex items-center gap-x-3 justify-end">
                                    <button 
                                        onClick={() => onEdit(user)} 
                                        disabled={!!isDeletingId}
                                        className="text-slate-400 hover:text-sky-600 transition-colors p-1.5 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg disabled:opacity-30" 
                                        title="แก้ไขผู้ใช้"
                                    >
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(user)} 
                                        disabled={!!isDeletingId}
                                        className={`text-slate-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg ${isProcessing ? 'animate-pulse' : ''} disabled:opacity-30`} 
                                        title="ลบผู้ใช้"
                                    >
                                        {isProcessing ? (
                                            <div className="w-5 h-5 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin"></div>
                                        ) : (
                                            <TrashIcon className="w-5 h-5"/>
                                        )}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </TableTemplate>
            
            {users.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 mt-4">
                    <p className="text-slate-500">ไม่พบรายชื่อผู้ใช้ในระบบ</p>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            <Modal 
                isOpen={!!userToDelete} 
                onClose={() => setUserToDelete(null)} 
                title="ยืนยันการลบผู้ใช้"
                size="md"
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full">
                        <ExclamationTriangleIcon className="w-10 h-10 text-red-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            ชื่อผู้ใช้: <span className="font-bold text-red-600">{userToDelete?.username || userToDelete?.email}</span>
                        </p>
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg text-xs text-red-700 dark:text-red-300">
                            การดำเนินการนี้จะลบบัญชีล็อกอินและข้อมูลความสัมพันธ์ทั้งหมดในระบบ ไม่สามารถย้อนกลับได้
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button 
                            onClick={() => setUserToDelete(null)}
                            className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all active:scale-95"
                        >
                            ยืนยันการลบ
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ManageUsersView;
