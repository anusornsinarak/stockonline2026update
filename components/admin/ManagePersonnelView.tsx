
import React from 'react';
import { Personnel } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import EditIcon from '../icons/EditIcon';
import TrashIcon from '../icons/TrashIcon';
import TableTemplate from './TableTemplate';

interface ManagePersonnelViewProps {
    personnel: Personnel[];
    onAdd: () => void;
    onEdit: (person: Personnel) => void;
    onDataChange: () => void;
}

const ManagePersonnelView: React.FC<ManagePersonnelViewProps> = ({ personnel = [], onAdd, onEdit, onDataChange }) => {

    const handleDelete = async (person: Personnel) => {
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${person.name}" ออกจากรายชื่อหลัก?`)) return;

        try {
            await supabaseService.deletePersonnel(person.id);
            onDataChange();
        } catch(error) {
            alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        }
    };

    // Ensure personnel is an array before trying to render
    const displayList = personnel ?? [];

    return (
        <div className="animate-fade-in">
            <div className="flex justify-end gap-3 mb-4">
                 <button onClick={onAdd} className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 transition-colors shadow-sm active:scale-95">
                    <PlusIcon className="w-5 h-5"/>
                    เพิ่มบุคลากร
                </button>
            </div>
             <TableTemplate headers={['ชื่อ-สกุล', 'ตำแหน่ง', 'การดำเนินการ']}>
                 {displayList.length > 0 ? displayList.map(person => (
                    <tr key={person.id} className="hover:bg-slate-50/70 transition-colors border-b last:border-b-0 dark:border-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{person.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{person.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                           <div className="flex items-center gap-x-6 justify-end">
                             <button onClick={() => onEdit(person)} className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 transition-colors p-1" title="แก้ไข">
                                <EditIcon className="w-5 h-5"/>
                             </button>
                             <button onClick={() => handleDelete(person)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1" title="ลบ">
                                <TrashIcon className="w-5 h-5"/>
                             </button>
                           </div>
                        </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 italic">
                            ไม่พบข้อมูลบุคลากรในระบบ
                        </td>
                    </tr>
                )}
            </TableTemplate>
        </div>
    );
};

export default ManagePersonnelView;
