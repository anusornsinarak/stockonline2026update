
import React, { useState, useMemo } from 'react';
import { Department, User, departmentTypes } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import ListBulletIcon from '../icons/ListBulletIcon';
import EditIcon from '../icons/EditIcon';
import TrashIcon from '../icons/TrashIcon';
import TableTemplate from './TableTemplate';
import ArrowPathIcon from '../icons/ArrowPathIcon';
import Modal from '../Modal';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';

interface ManageDepartmentsViewProps {
    departments: Department[];
    users: User[];
    onAdd: () => void;
    onEdit: (dept: Department) => void;
    onAssign: (dept: Department) => void;
    onDataChange: () => void;
}

const ManageDepartmentsView: React.FC<ManageDepartmentsViewProps> = ({ departments, users, onAdd, onEdit, onAssign, onDataChange }) => {
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
    const [error, setError] = useState<string | null>(null);

    const usersPerDept = useMemo(() => {
        return departments.reduce((acc, dept) => {
            acc[dept.id] = (users || []).filter(u => u.departmentId === dept.id).length;
            return acc;
        }, {} as Record<string, number>)
    }, [departments, users]);

    const handleDeleteClick = (dept: Department) => {
        setError(null);
        const userCount = usersPerDept[dept.id] || 0;
        
        if (userCount > 0) {
            setError(`ไม่สามารถลบได้: หน่วยงาน "${dept.name}" ยังมีผู้ใช้งานค้างอยู่ในระบบจำนวน ${userCount} ท่าน กรุณาย้ายหรือลบผู้ใช้งานออกก่อน`);
            return;
        }
        
        setDeptToDelete(dept);
    };

    const confirmDelete = async () => {
        if (!deptToDelete) return;
        
        const targetId = deptToDelete.id;
        setDeptToDelete(null);
        setIsDeletingId(targetId);
        setError(null);

        try {
            await supabaseService.deleteDepartment(targetId);
            onDataChange();
        } catch (err: any) {
            console.error('Delete department error:', err);
            if (err?.code === '23503') {
                setError(`ไม่สามารถลบได้: มีข้อมูลใบเบิกหรือประวัติค้างอยู่ในระบบ แนะนำให้เปลี่ยนชื่อหน่วยงานแทนการลบ`);
            } else {
                setError(`เกิดข้อผิดพลาด: ${err?.message || "โปรดลองอีกครั้ง"}`);
            }
        } finally {
            setIsDeletingId(null);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">จัดการหน่วยงาน</h3>
                <button 
                    onClick={onAdd} 
                    className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2.5 px-5 rounded-xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-500/20 active:scale-95"
                >
                    <PlusIcon className="w-5 h-5"/>
                    เพิ่มหน่วยงาน
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-l-4 border-red-500 rounded-r-xl flex items-center justify-between shadow-sm animate-shake">
                    <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            <TableTemplate headers={['ชื่อหน่วยงาน', 'ประเภท', 'จำนวนผู้ใช้', { name: 'การดำเนินการ', className: 'text-right' }]}>
                {departments.sort((a, b) => a.name.localeCompare(b.name, 'th')).map(dept => {
                    const isProcessing = isDeletingId === dept.id;
                    return (
                        <tr key={dept.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/50 transition-colors border-b last:border-0 dark:border-slate-700">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-slate-100">{dept.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                {departmentTypes.find(dt => dt.value === dept.type)?.label || 'ภายใน'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {usersPerDept[dept.id] || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                <div className="flex items-center gap-x-4 justify-end">
                                    <button 
                                        onClick={() => onAssign(dept)} 
                                        className="text-slate-400 hover:text-teal-600 transition-colors p-1.5 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg" 
                                        title="กำหนดรายการเวชภัณฑ์"
                                    >
                                        <ListBulletIcon className="w-5 h-5"/>
                                    </button>
                                    <button 
                                        onClick={() => onEdit(dept)} 
                                        className="text-slate-400 hover:text-sky-600 transition-colors p-1.5 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg" 
                                        title="แก้ไขชื่อหน่วยงาน"
                                    >
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(dept)} 
                                        disabled={!!isDeletingId}
                                        className={`text-slate-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg ${isProcessing ? 'animate-pulse' : ''} ${isDeletingId ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} 
                                        title="ลบหน่วยงาน"
                                    >
                                        {isProcessing ? (
                                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
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
            
            {departments.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 mt-4">
                    <p className="text-slate-500">ไม่พบรายชื่อหน่วยงานในระบบ</p>
                </div>
            )}

            {/* Confirmation Modal */}
            <Modal 
                isOpen={!!deptToDelete} 
                onClose={() => setDeptToDelete(null)} 
                title="ยืนยันการลบหน่วยงาน"
                size="md"
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full">
                        <ExclamationTriangleIcon className="w-10 h-10 text-red-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">คุณต้องการลบหน่วยงานนี้ใช่หรือไม่?</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            หน่วยงาน: <span className="font-bold text-red-600">{deptToDelete?.name}</span>
                        </p>
                        <p className="mt-4 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                            คำเตือน: การลบหน่วยงานไม่สามารถย้อนกลับได้ และจะทำได้ต่อเมื่อไม่มีข้อมูลที่เกี่ยวข้องค้างอยู่ในระบบเท่านั้น
                        </p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button 
                            onClick={() => setDeptToDelete(null)}
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

export default ManageDepartmentsView;
