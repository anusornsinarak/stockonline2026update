


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Department, Product, ProductIssue, Requisition, RequisitionItem, productIssueStatusMap, ProductIssueType } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import Modal from '../Modal';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import InboxIcon from '../icons/InboxIcon';

// Report Issue Modal
const ReportIssueModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    department: Department;
    onSave: () => void;
}> = ({ isOpen, onClose, department, onSave }) => {
    const [step, setStep] = useState(1); // 1: Select Requisition, 2: Select Item, 3: Fill Form
    const [completedRequisitions, setCompletedRequisitions] = useState<Requisition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
    const [selectedItem, setSelectedItem] = useState<RequisitionItem | null>(null);

    // Form state
    const [lotNumber, setLotNumber] = useState('');
    const [description, setDescription] = useState('');
    const [issueType, setIssueType] = useState<ProductIssueType>('FOR_RESOLUTION');
    const [reporterName, setReporterName] = useState('');
    const [reporterPosition, setReporterPosition] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const resetForm = useCallback(() => {
        setStep(1);
        setSelectedRequisition(null);
        setSelectedItem(null);
        setLotNumber('');
        setDescription('');
        setIssueType('FOR_RESOLUTION');
        setReporterName('');
        setReporterPosition('');
        setError('');
        setIsSaving(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            resetForm();
            setIsLoading(true);
            supabaseService.getRequisitionsForDepartment(department.id)
                .then(reqs => {
                    const completed = reqs.filter(r => r.status === 'Completed' && r.items && r.items.length > 0);
                    setCompletedRequisitions(completed);
                })
                .catch(err => setError("ไม่สามารถโหลดรายการใบเบิกได้"))
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, department.id, resetForm]);

    const handleRequisitionSelect = (req: Requisition) => {
        setSelectedRequisition(req);
        setStep(2);
    };

    const handleItemSelect = (item: RequisitionItem) => {
        setSelectedItem(item);
        setStep(3);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !lotNumber.trim() || !description.trim() || !reporterName.trim() || !reporterPosition.trim()) {
            setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            // FIX: Corrected property names from camelCase to snake_case to match the database schema.
            await supabaseService.createProductIssue({
                requisition_item_id: selectedItem.id!,
                department_id: department.id,
                product_id: selectedItem.productId,
                lot_number: lotNumber,
                issue_type: issueType,
                quantity: selectedItem.approvedQuantity || selectedItem.quantity,
                description: description,
                reporter_name: reporterName,
                reporter_position: reporterPosition,
            });
            alert('ส่งรายงานปัญหาสำเร็จ');
            onSave();
            onClose();
        } catch(err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
            setIsSaving(false);
        }
    }

    const renderContent = () => {
        if (isLoading) return <p className="text-center">กำลังโหลดข้อมูลใบเบิก...</p>;
        if (error && step === 1) return <p className="text-center text-red-500">{error}</p>;

        switch(step) {
            case 1:
                return (
                    <div>
                        <h4 className="font-semibold mb-2">ขั้นตอนที่ 1: เลือกใบเบิกที่ต้องการรายงานปัญหา</h4>
                        <ul className="max-h-60 overflow-y-auto border rounded-md divide-y">
                            {completedRequisitions.length > 0 ? completedRequisitions.map(req => (
                                <li key={req.id}>
                                    <button onClick={() => handleRequisitionSelect(req)} className="w-full text-left p-3 hover:bg-slate-50">
                                        <p className="font-medium">#{req.requisitionNumber} - {req.name}</p>
                                        <p className="text-sm text-slate-500">รับของเมื่อ: {new Date(req.approvedAt || req.submittedAt!).toLocaleDateString('th-TH')}</p>
                                    </button>
                                </li>
                            )) : <li className="p-4 text-center text-slate-500">ไม่พบใบเบิกที่รับของแล้ว</li>}
                        </ul>
                    </div>
                );
            case 2:
                return (
                    <div>
                        <button onClick={() => setStep(1)} className="text-sm text-sky-600 mb-2">{'< กลับไปเลือกใบเบิก'}</button>
                        <h4 className="font-semibold mb-2">ขั้นตอนที่ 2: เลือกรายการที่มีปัญหา</h4>
                        <ul className="max-h-60 overflow-y-auto border rounded-md divide-y">
                            {selectedRequisition?.items?.map(item => (
                                <li key={item.id}>
                                    <button onClick={() => handleItemSelect(item)} className="w-full text-left p-3 hover:bg-slate-50">
                                        <p className="font-medium">{item.product?.name}</p>
                                        <p className="text-sm text-slate-500">จำนวน: {item.approvedQuantity || item.quantity} {item.product?.unit}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 3:
                return (
                     <form onSubmit={handleSubmit} className="space-y-4">
                        <button onClick={() => setStep(2)} className="text-sm text-sky-600 mb-2">{'< กลับไปเลือกรายการ'}</button>
                        <h4 className="font-semibold">ขั้นตอนที่ 3: กรอกรายละเอียด</h4>
                        <div className="p-3 bg-slate-50 rounded-md">
                            <p><strong>รายการ:</strong> {selectedItem?.product?.name}</p>
                            <p><strong>จำนวน:</strong> {selectedItem?.approvedQuantity || selectedItem?.quantity} {selectedItem?.product?.unit} (ต้องคืน/เปลี่ยนทั้งจำนวน)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Lot Number</label>
                            <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="mt-1 w-full border-slate-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">ประเภทการรายงาน</label>
                            <div className="mt-2 space-y-2">
                                <label className="flex items-center"><input type="radio" value="FOR_RESOLUTION" checked={issueType === 'FOR_RESOLUTION'} onChange={() => setIssueType('FOR_RESOLUTION')} className="h-4 w-4" /> <span className="ml-2">แจ้งปัญหาเพื่อแก้ไข/รับทราบ</span></label>
                                <label className="flex items-center"><input type="radio" value="REQUEST_REPLACEMENT" checked={issueType === 'REQUEST_REPLACEMENT'} onChange={() => setIssueType('REQUEST_REPLACEMENT')} className="h-4 w-4" /> <span className="ml-2">ต้องการเปลี่ยนสินค้า</span></label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">รายละเอียดปัญหา</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full border-slate-300 rounded-md shadow-sm" required />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">ชื่อผู้รายงาน</label>
                            <input type="text" value={reporterName} onChange={e => setReporterName(e.target.value)} className="mt-1 w-full border-slate-300 rounded-md shadow-sm" required />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">ตำแหน่ง</label>
                            <input type="text" value={reporterPosition} onChange={e => setReporterPosition(e.target.value)} className="mt-1 w-full border-slate-300 rounded-md shadow-sm" required />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                         <div className="flex justify-end pt-4 border-t">
                            <button type="submit" disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400">
                                {isSaving ? 'กำลังส่ง...' : 'ส่งรายงาน'}
                            </button>
                        </div>
                    </form>
                );
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="รายงานปัญหาเวชภัณฑ์">
            {renderContent()}
        </Modal>
    );
}

// Main Dashboard Component
const ProductIssueDashboard: React.FC<{ department: Department }> = ({ department }) => {
    const [issues, setIssues] = useState<ProductIssue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchIssues = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // FIX: Property 'getProductIssuesForDepartment' does not exist on type 'typeof supabaseService'.
            const data = await supabaseService.getProductIssuesForDepartment(department.id);
            setIssues(data);
        } catch(err) {
            setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setIsLoading(false);
        }
    }, [department.id]);

    useEffect(() => {
        fetchIssues();
    }, [fetchIssues]);

    return (
        <div className="max-w-5xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">ประวัติการรายงานปัญหา</h2>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700">
                    <PlusIcon className="w-5 h-5"/>
                    <span>รายงานปัญหาใหม่</span>
                </button>
            </div>
            {isLoading && <p>กำลังโหลด...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {!isLoading && !error && (
                issues.length > 0 ? (
                    <div className="space-y-3">
                        {issues.map(issue => {
                            const statusInfo = productIssueStatusMap[issue.status] || { text: 'ไม่ทราบ', color: 'bg-gray-200' };
                            return (<div key={issue.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between gap-3">
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-800">{issue.productName}</p>
                                    <p className="text-sm text-slate-500">
                                        Lot: {issue.lotNumber} | แจ้งเมื่อ: {new Date(issue.createdAt).toLocaleDateString('th-TH')}
                                    </p>
                                    <p className="text-sm mt-1">
                                        <span className="font-medium">ปัญหา:</span> {issue.description}
                                    </p>
                                     {issue.warehouseNotes && <p className="text-sm mt-1 text-sky-700 bg-sky-50 p-2 rounded-md"><span className="font-medium">คลังแจ้ง:</span> {issue.warehouseNotes}</p>}
                                </div>
                                <div className="flex-shrink-0">
                                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusInfo.color}`}>
                                        {statusInfo.text}
                                    </span>
                                </div>
                            </div>);
                        })}
                    </div>
                ) : (
                     <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
                        <InboxIcon className="mx-auto h-12 w-12 text-slate-400" />
                        <h3 className="mt-2 text-lg font-medium text-slate-900">ไม่มีประวัติการรายงานปัญหา</h3>
                        <p className="mt-1 text-sm text-slate-500">คุณสามารถรายงานปัญหาโดยกดปุ่ม "รายงานปัญหาใหม่"</p>
                    </div>
                )
            )}
            <ReportIssueModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} department={department} onSave={fetchIssues} />
        </div>
    );
};

export default ProductIssueDashboard;