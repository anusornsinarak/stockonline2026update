


import React, { useState, useEffect } from 'react';
import { Department, DepartmentType, departmentTypes } from '../../types';
// FIX: Changed the import of 'supabaseService' from a default import to a named import to resolve the module resolution error.
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

const DepartmentEditModal: React.FC<{isOpen: boolean, onClose: () => void, department: Department | null, onSave: () => void}> = ({ isOpen, onClose, department, onSave }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<DepartmentType>('Internal');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (department) {
            setName(department.name);
            setType(department.type || 'Internal');
        } else {
            setName('');
            setType('Internal');
        }
        setError('');
    }, [department, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsSaving(true);
        setError('');
        try {
            if (department) {
                await supabaseService.updateDepartment(department.id, name, type);
            } else {
                await supabaseService.addDepartment(name, type);
            }
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={department ? 'แก้ไขหน่วยงาน' : 'เพิ่มหน่วยงานใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="dept-name" className="block text-sm font-medium text-slate-700">ชื่อหน่วยงาน</label>
                    <input id="dept-name" type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm" required />
                </div>
                 <div>
                    <label htmlFor="dept-type" className="block text-sm font-medium text-slate-700">ประเภทหน่วยงาน</label>
                    <select 
                        id="dept-type" 
                        value={type} 
                        onChange={e => setType(e.target.value as DepartmentType)} 
                        className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                    >
                        {departmentTypes.map(dt => (
                            <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                    </select>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">ยกเลิก</button>
                    <button type="submit" disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 transition-colors">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DepartmentEditModal;
