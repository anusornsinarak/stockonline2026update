
import React, { useState } from 'react';
import { ProductIssue, productIssueStatusMap, ProductIssueStatus } from '../../types';
import Modal from '../Modal';
import { supabaseService } from '../../services/supabaseService';
import TableTemplate from './TableTemplate';

const IssueDetailModal: React.FC<{
    issue: ProductIssue;
    isOpen: boolean;
    onClose: () => void;
    onDataChange: () => void;
}> = ({ issue, isOpen, onClose, onDataChange }) => {
    const [status, setStatus] = useState<ProductIssueStatus>(issue.status);
    const [warehouseNotes, setWarehouseNotes] = useState(issue.warehouseNotes || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            await supabaseService.updateProductIssueStatus(issue.id, status, warehouseNotes);
            alert('อัปเดตสถานะสำเร็จ');
            onDataChange();
            onClose();
        } catch(err) {
            setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`จัดการปัญหาสินค้า #${issue.id.substring(0, 6)}`}>
            <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-md space-y-2 text-sm">
                    <p><strong>หน่วยงาน:</strong> {issue.departmentName}</p>
                    <p><strong>สินค้า:</strong> {issue.productName}</p>
                    <p><strong>Lot Number:</strong> {issue.lotNumber}</p>
                    <p><strong>จำนวน:</strong> {issue.quantity}</p>
                    <p><strong>ประเภท:</strong> {issue.issueType === 'REQUEST_REPLACEMENT' ? 'ขอเปลี่ยนสินค้า' : 'แจ้งเพื่อแก้ไข'}</p>
                    <p><strong>ผู้รายงาน:</strong> {issue.reporterName} ({issue.reporterPosition})</p>
                    <p><strong>รายละเอียด:</strong> {issue.description}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium">อัปเดตสถานะ</label>
                    <select value={status} onChange={e => setStatus(e.target.value as ProductIssueStatus)} className="mt-1 w-full border-slate-300 rounded-md shadow-sm">
                        {Object.entries(productIssueStatusMap).map(([key, value]) => (
                            <option key={key} value={key}>{value.text}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">หมายเหตุจากคลัง (ถ้ามี)</label>
                    <textarea value={warehouseNotes} onChange={e => setWarehouseNotes(e.target.value)} rows={2} className="mt-1 w-full border-slate-300 rounded-md shadow-sm"/>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end pt-4 border-t">
                    <button onClick={handleSave} disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg disabled:bg-slate-400">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ManageProductIssuesView: React.FC<{
    issues: ProductIssue[];
    onDataChange: () => void;
}> = ({ issues, onDataChange }) => {
    const [selectedIssue, setSelectedIssue] = useState<ProductIssue | null>(null);
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

    const openIssues = issues.filter(i => i.status === 'SUBMITTED');
    const closedIssues = issues.filter(i => i.status !== 'SUBMITTED');

    const issuesToShow = activeTab === 'open' ? openIssues : closedIssues;

    return (
        <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4">จัดการปัญหาสินค้า</h3>
             <div className="border-b border-slate-200 mb-4">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setActiveTab('open')} className={`${activeTab === 'open' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} pb-2 border-b-2 font-medium`}>
                        ปัญหาใหม่ ({openIssues.length})
                    </button>
                    <button onClick={() => setActiveTab('closed')} className={`${activeTab === 'closed' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'} pb-2 border-b-2 font-medium`}>
                        ประวัติทั้งหมด ({closedIssues.length})
                    </button>
                </nav>
            </div>
            <TableTemplate headers={['วันที่แจ้ง', 'หน่วยงาน', 'สินค้า', 'ประเภท', 'สถานะ', '']}>
                {issuesToShow.map(issue => {
                    const statusInfo = productIssueStatusMap[issue.status] || { text: 'ไม่ทราบ', color: 'bg-gray-200' };
                    return (<tr key={issue.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(issue.createdAt).toLocaleDateString('th-TH')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{issue.departmentName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{issue.productName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{issue.issueType === 'REQUEST_REPLACEMENT' ? 'ขอเปลี่ยน' : 'แจ้งเพื่อแก้ไข'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                             <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                                {statusInfo.text}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            <button onClick={() => setSelectedIssue(issue)} className="font-medium text-sky-600 hover:text-sky-800">จัดการ</button>
                        </td>
                    </tr>);
                })}
            </TableTemplate>
             {issuesToShow.length === 0 && (
                <p className="text-center py-8 text-slate-500">ไม่พบรายการ</p>
            )}
            {selectedIssue && (
                <IssueDetailModal issue={selectedIssue} isOpen={!!selectedIssue} onClose={() => setSelectedIssue(null)} onDataChange={onDataChange} />
            )}
        </div>
    );
};

export default ManageProductIssuesView;
