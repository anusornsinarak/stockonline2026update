
import React, { useState, useEffect } from 'react';
import { Personnel } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';

interface PersonnelEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    personnel: Personnel | null;
    onSave: () => void;
}

const PersonnelEditModal: React.FC<PersonnelEditModalProps> = ({ isOpen, onClose, personnel, onSave }) => {
    const [name, setName] = useState('');
    const [position, setPosition] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (personnel) {
            setName(personnel.name);
            setPosition(personnel.position);
        } else {
            setName('');
            setPosition('');
        }
        setError('');
    }, [personnel, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !position.trim()) {
            setError('กรุณากรอกชื่อและตำแหน่ง');
            return;
        }
        setIsSaving(true);
        setError('');

        try {
            if (personnel) {
                // FIX: Property 'updatePersonnel' does not exist on type 'typeof supabaseService'.
                await supabaseService.updatePersonnel(personnel.id, { name, position });
            } else {
                // FIX: Property 'addPersonnel' does not exist on type 'typeof supabaseService'.
                await supabaseService.addPersonnel({ name, position });
            }
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={personnel ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="personnel-name" className="block text-sm font-medium text-slate-700">ชื่อ-สกุล</label>
                    <input 
                        id="personnel-name" 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm" 
                        required 
                    />
                </div>
                <div>
                    <label htmlFor="personnel-position" className="block text-sm font-medium text-slate-700">ตำแหน่ง</label>
                    <input 
                        id="personnel-position" 
                        type="text" 
                        value={position} 
                        onChange={e => setPosition(e.target.value)} 
                        className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm" 
                        required 
                    />
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

export default PersonnelEditModal;
