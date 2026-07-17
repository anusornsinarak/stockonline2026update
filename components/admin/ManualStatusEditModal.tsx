
import React, { useState, useEffect } from 'react';
import { Requisition, RequisitionStatus, requisitionStatusMap } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import Modal from '../Modal';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';

interface ManualStatusEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    requisition: Requisition | null;
    onSave: () => void;
}

const statusOrder: RequisitionStatus[] = [
    'Draft',
    'Submitted',
    'Picking',
    'PartiallyApproved',
    'Ready',
    'Completed',
    'Rejected',
    'Cancelled'
];

const ManualStatusEditModal: React.FC<ManualStatusEditModalProps> = ({ isOpen, onClose, requisition, onSave }) => {
    const [selectedStatus, setSelectedStatus] = useState<RequisitionStatus | ''>('');
    const [reqNumber, setReqNumber] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [shouldNotify, setShouldNotify] = useState(true);

    useEffect(() => {
        if (isOpen && requisition) {
            setSelectedStatus(requisition.status);
            setReqNumber(requisition.requisitionNumber || '');
            setRejectionReason(requisition.rejectionReason || '');
            setShouldNotify(true);
        }
    }, [isOpen, requisition]);

    const handleConfirm = async () => {
        if (!requisition) return;

        setIsSaving(true);
        try {
            // Update number if changed
            if (reqNumber !== requisition.requisitionNumber) {
                await supabaseService.updateRequisitionNumber(requisition.id, reqNumber);
            }

            // Update status if changed
            const isStatusChanged = selectedStatus !== requisition.status && selectedStatus !== '';
            const isReasonChanged = rejectionReason !== (requisition.rejectionReason || '');

            if (isStatusChanged || isReasonChanged) {
                if (selectedStatus === 'Completed') {
                    await supabaseService.confirmRequisitionReceipt(requisition.id, 'เจ้าหน้าที่คลัง (Manual Override)', true);
                } else {
                    // CHANGE: Use forceUpdateRequisitionStatus for direct table update to bypass RPC constraint issues
                    await supabaseService.forceUpdateRequisitionStatus(
                        requisition.id, 
                        (selectedStatus || requisition.status) as RequisitionStatus,
                        rejectionReason
                    );
                }

                if (shouldNotify && isStatusChanged) {
                    const statusText = requisitionStatusMap[selectedStatus as RequisitionStatus]?.text || selectedStatus;
                    let msg = `🔔 สถานะใบเบิก #${reqNumber || requisition.requisitionNumber}\n✨ "${statusText}" ✨\n📦 แจ้งจากทางคลังเวชภัณฑ์มิใช่ยา 🏥`;
                    if (rejectionReason && (selectedStatus === 'Rejected' || selectedStatus === 'Cancelled')) {
                        msg += `\n⚠️ เหตุผล: ${rejectionReason}`;
                    }
                    await supabaseService.notifyDepartmentUsers(requisition.departmentId, msg);
                }
            }
            
            onSave();
            onClose();
        } catch (error: any) {
            console.error('Manual Update Error:', error);
            alert('ไม่สามารถบันทึกได้: ' + (error?.message || 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!requisition) return null;

    const showReasonField = selectedStatus === 'Rejected' || selectedStatus === 'Cancelled';

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`แก้ไขข้อมูลใบเบิก #${requisition.requisitionNumber}`}
            size="md"
            wrapperClassName="z-[150]"
        >
            <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex gap-3 shadow-sm">
                    <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                            คำเตือน: การแก้ไขแบบ Manual
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                            ระบบจะเปลี่ยนเลขที่หรือสถานะตามที่คุณระบุโดยตรง โดยไม่ผ่านการคำนวณหรือตัดสต็อกอัตโนมัติ กรุณาใช้ด้วยความระมัดระวัง
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                        เลขที่ใบเบิก:
                    </label>
                    <input 
                        type="text" 
                        value={reqNumber}
                        onChange={e => setReqNumber(e.target.value)}
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                        placeholder="YYMMNNN"
                    />
                </div>

                <div className="max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">
                        เลือกสถานะใหม่:
                    </label>
                    <div className="space-y-2">
                        {statusOrder.map((key) => {
                            const config = requisitionStatusMap[key];
                            if (!config) return null;
                            const isActive = selectedStatus === key;
                            const isCurrent = requisition.status === key;
                            
                            return (
                                <label 
                                    key={key}
                                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                        isActive 
                                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30' 
                                            : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex items-center justify-center">
                                            <input 
                                                type="radio" 
                                                name="req-status-manual" 
                                                value={key} 
                                                checked={isActive}
                                                onChange={() => setSelectedStatus(key)}
                                                className="w-5 h-5 text-sky-600 focus:ring-sky-500 border-slate-300"
                                            />
                                        </div>
                                        <span className={`font-bold ${isActive ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {config.warehouseText || config.text}
                                        </span>
                                    </div>
                                    {isCurrent && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full uppercase">ปัจจุบัน</span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </div>

                {showReasonField && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <label className="block text-sm font-bold text-red-700 dark:text-red-400 mb-2 uppercase tracking-wider">
                            ระบุเหตุผลที่ {selectedStatus === 'Rejected' ? 'ไม่อนุมัติ' : 'ยกเลิก'}:
                        </label>
                        <textarea 
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="w-full p-3 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 rounded-xl focus:ring-2 focus:ring-red-500 outline-none min-h-[100px]"
                            placeholder="ระบุเหตุผลเพื่อให้หน่วยงานทราบ..."
                        />
                    </div>
                )}

                <div className="pt-2 border-t dark:border-slate-700">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <input 
                            type="checkbox" 
                            id="notify-dept" 
                            checked={shouldNotify} 
                            onChange={e => setShouldNotify(e.target.checked)}
                            className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <label htmlFor="notify-dept" className="text-sm font-semibold text-blue-800 dark:text-blue-300 cursor-pointer select-none">
                            ส่งการแจ้งเตือนไปยังหน่วยงาน (LINE/App)
                        </label>
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t dark:border-slate-700">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors shadow-sm"
                    >
                        ยกเลิก
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 disabled:bg-slate-400 transition-all shadow-lg active:scale-95 disabled:shadow-none"
                    >
                        {isSaving ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>กำลังบันทึก...</span>
                            </div>
                        ) : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ManualStatusEditModal;
