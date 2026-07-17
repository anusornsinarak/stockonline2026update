



import React, { useState, useEffect } from 'react';
import { Company } from '../../types';
// FIX: Changed the import of 'supabaseService' from a default import to a named import to resolve the module resolution error.
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

const CompanyEditModal: React.FC<{isOpen: boolean, onClose: () => void, company: Company | null, onSave: (company: Company) => void}> = ({ isOpen, onClose, company, onSave }) => {
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (company) {
            setName(company.name);
        } else {
            setName('');
        }
        setError('');
    }, [company, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsSaving(true);
        setError('');
        let savedCompany: Company | null = null;
        try {
            if (company) {
                savedCompany = await supabaseService.updateCompany(company.id, name);
            } else {
                savedCompany = await supabaseService.addCompany(name);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
            if (savedCompany) {
                onSave(savedCompany);
            }
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={company ? 'แก้ไขบริษัท' : 'เพิ่มบริษัทใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="comp-name" className="block text-sm font-medium text-slate-700">ชื่อบริษัท</label>
                    <input id="comp-name" type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm" required />
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

export default CompanyEditModal;