
import React, { useState, useEffect, useRef } from 'react';
import { User, Department } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import ExclamationCircleIcon from '../icons/ExclamationCircleIcon';

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    departments: Department[];
    onSave: () => void;
}

interface UserFormData {
  username: string;
  password?: string;
  email?: string;
  role: User['role'];
  departmentId: string;
  permissions: any;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, user, departments, onSave }) => {
    const hasInitialized = useRef(false);
    
    const [formData, setFormData] = useState<UserFormData>({ 
        username: '', 
        role: 'Department', 
        departmentId: '', 
        permissions: {} 
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const isNewUser = !user;

    const warehousePermissions = [
        { key: 'canManageReceipts', label: 'จัดการการรับของ (Goods Receiving)' },
        { key: 'canViewInventory', label: 'ดูข้อมูลคลังสินค้าทั้งหมด (Inventory)' },
        { key: 'canViewStockCard', label: 'ดูประวัติสต็อก (Stock Card)' },
        { key: 'canViewReports', label: 'ดูรายงาน (Reports)' },
    ];

    useEffect(() => {
        if (!isOpen) {
            hasInitialized.current = false;
            return;
        }

        if (user) {
            setFormData({
                username: user.username || '',
                email: user.email || '',
                role: user.role || 'Department',
                departmentId: user.departmentId || '',
                permissions: user.permissions || {},
            });
            hasInitialized.current = true;
        } else if (!hasInitialized.current && departments.length > 0) {
            setFormData(prev => ({ 
                ...prev,
                departmentId: departments[0].id,
                role: 'Department'
            }));
            hasInitialized.current = true;
        }
    }, [user, isOpen, departments]);

    const handlePermissionChange = (key: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: checked,
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.username.trim()) {
            setError("กรุณากรอกชื่อผู้ใช้");
            return;
        }

        if (isNewUser && (!formData.password || formData.password.trim() === '')) {
            setError("กรุณากรอกรหัสผ่าน");
            return;
        }

        const finalRole = formData.role || 'Department';
        const finalDeptId = (finalRole === 'Admin' || finalRole === 'Borrower') ? null : (formData.departmentId || null);

        if (finalRole !== 'Admin' && finalRole !== 'Borrower' && !finalDeptId && departments.length > 0) {
             setError("กรุณาเลือกหน่วยงาน");
             return;
        }

        setIsSaving(true);
        setError('');
        
        try {
            if (isNewUser) {
                await supabaseService.addUser({
                    username: formData.username.trim(),
                    password: formData.password?.trim(),
                    email: formData.email?.trim(),
                    role: finalRole,
                    departmentId: finalDeptId || undefined,
                    permissions: formData.permissions
                });
            } else {
                await supabaseService.updateUser({
                    id: user!.id,
                    username: formData.username.trim(),
                    email: formData.email?.trim(),
                    role: finalRole,
                    departmentId: finalDeptId || undefined,
                    permissions: formData.permissions
                });
            }
            onSave();
        } catch (err: any) {
            console.error('Save user error:', err);
            // ดักจับ Error เฉพาะเจาะจงจาก Supabase/Postgres
            if (err?.code === '42704' || err?.message?.includes('does not exist')) {
                setError("ข้อผิดพลาดทางเทคนิค: ขาดการกำหนดประเภทข้อมูล 'user_role' ในฐานข้อมูล กรุณารันคำสั่ง SQL สำหรับสร้าง TYPE ก่อน");
            } else if (err?.code === '23505' || err?.message?.includes('unique constraint')) {
                setError("ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบข้อมูลอีกครั้ง");
            } else if (err?.code === '23502' || err?.message?.includes('violates not-null constraint')) {
                setError(`ข้อมูลไม่ครบถ้วน: ฐานข้อมูลแจ้งว่าค่า '${err?.message?.includes('role') ? 'บทบาท (Role)' : 'บางส่วน'}' หายไป กรุณาลองเลือกบทบาทและหน่วยงานใหม่อีกครั้ง`);
            } else {
                setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={user ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ชื่อผู้ใช้ (Username)</label>
                    <input 
                        type="text" 
                        value={formData.username} 
                        onChange={e => setFormData({...formData, username: e.target.value})} 
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500" 
                        required 
                    />
                </div>
                 {isNewUser && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">รหัสผ่าน</label>
                        <input 
                            type="password" 
                            value={formData.password} 
                            onChange={e => setFormData({...formData, password: e.target.value})} 
                            className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500" 
                            required 
                        />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">อีเมล (Email - ไม่บังคับ)</label>
                    <input 
                        type="email" 
                        value={formData.email || ''} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500" 
                        placeholder="example@hospital.com"
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">บทบาท (Role)</label>
                    <select 
                        value={formData.role} 
                        onChange={e => setFormData({...formData, role: e.target.value as User['role']})} 
                        className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500" 
                        required
                    >
                        <option value="Department">Department (หน่วยงานเบิก)</option>
                        <option value="Admin">Admin (ผู้ดูแลระบบ)</option>
                        <option value="Warehouse">Warehouse (คลังเวชภัณฑ์)</option>
                        <option value="Borrower">Borrower (ผู้ยืมสินค้าทั่วไป)</option>
                    </select>
                </div>
                {formData.role !== 'Admin' && formData.role !== 'Borrower' && (
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">หน่วยงาน</label>
                        <select 
                            value={formData.departmentId} 
                            onChange={e => setFormData({...formData, departmentId: e.target.value})} 
                            className="mt-1 block w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500" 
                            required
                        >
                             <option value="" disabled>-- เลือกหน่วยงาน --</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                )}
                {formData.role === 'Warehouse' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">สิทธิ์การใช้งานเพิ่มเติม</label>
                        <div className="mt-2 space-y-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                            {warehousePermissions.map(perm => (
                                <label key={perm.key} className="flex items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 p-1.5 rounded transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={!!formData.permissions?.[perm.key]}
                                        onChange={e => handlePermissionChange(perm.key, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                    />
                                    <span className="ml-3 text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-r-lg animate-fade-in flex items-center gap-2">
                        <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
                        <span className="font-bold">{error}</span>
                    </div>
                )}
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 px-6 rounded-xl hover:bg-slate-300 transition-colors">ยกเลิก</button>
                    <button type="submit" disabled={isSaving} className="bg-sky-600 text-white font-bold py-2.5 px-8 rounded-xl hover:bg-sky-700 disabled:bg-slate-400 transition-all active:scale-95 shadow-lg shadow-sky-500/20">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
