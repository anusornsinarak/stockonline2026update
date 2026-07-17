
import React, { useState, useMemo } from 'react';
import { P2PExchangePosting, p2pPostStatusMap, Department, Product } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import TableTemplate from './TableTemplate';
import TrashIcon from '../icons/TrashIcon';

interface P2PExchangeAdminViewProps {
    postings: P2PExchangePosting[];
    onDataChange: () => void;
    departments: Department[];
    products: Product[];
}

const P2PExchangeAdminView: React.FC<P2PExchangeAdminViewProps> = ({ 
    postings = [], 
    onDataChange, 
    departments = [], 
    products = [] 
}) => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'FULFILLED' | 'CANCELLED'>('ACTIVE');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p.name])), [products]);

    const filteredPostings = useMemo(() => {
        return (postings || []).filter(p => p.status === activeTab);
    }, [postings, activeTab]);

    const handleCancel = async (post: P2PExchangePosting) => {
        if (!window.confirm(`คุณต้องการยกเลิกประกาศนี้ใช่หรือไม่?`)) return;
        setIsProcessing(post.id);
        try {
            await supabaseService.cancelP2PPosting(post.id);
            alert('ยกเลิกประกาศสำเร็จ');
            onDataChange();
        } catch (err) {
            alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const headers = [
        'วันที่', 'หน่วยงานที่ประกาศ', 'ประเภท', 'รายการ', 'จำนวน', 
        { name: 'สถานะ', className: 'text-center' }, 
        'ผู้ตอบรับ', 'วันที่สำเร็จ',
        { name: 'ดำเนินการ', className: 'text-center' }
    ];

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">จัดการประกาศแลกเปลี่ยน (P2P)</h3>
            
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setActiveTab('ACTIVE')} className={`${activeTab === 'ACTIVE' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'} pb-2 border-b-2 font-medium`}>ประกาศอยู่</button>
                    <button onClick={() => setActiveTab('FULFILLED')} className={`${activeTab === 'FULFILLED' ? 'border-green-500 text-green-600' : 'border-transparent text-slate-500'} pb-2 border-b-2 font-medium`}>สำเร็จ</button>
                    <button onClick={() => setActiveTab('CANCELLED')} className={`${activeTab === 'CANCELLED' ? 'border-gray-500 text-gray-600' : 'border-transparent text-slate-500'} pb-2 border-b-2 font-medium`}>ยกเลิก</button>
                </nav>
            </div>

            <TableTemplate headers={headers}>
                {filteredPostings.map(post => {
                    const statusInfo = p2pPostStatusMap[post.status];
                    return (
                        <tr key={post.id}>
                            <td className="px-4 py-2 text-sm">{new Date(post.createdAt).toLocaleDateString('th-TH')}</td>
                            <td className="px-4 py-2 text-sm font-medium">{departmentMap.get(post.postingDepartmentId) || 'ไม่ทราบ'}</td>
                            <td className="px-4 py-2 text-sm">{post.postType === 'OFFER' ? 'ของเหลือ' : 'ของที่ต้องการ'}</td>
                            <td className="px-4 py-2 text-sm font-semibold">{productMap.get(post.productId) || 'ไม่ทราบ'}</td>
                            <td className="px-4 py-2 text-sm text-right">{post.quantity}</td>
                            <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>
                            </td>
                            <td className="px-4 py-2 text-sm">{post.fulfilledByDepartmentId ? departmentMap.get(post.fulfilledByDepartmentId) : '-'}</td>
                            <td className="px-4 py-2 text-sm">{post.fulfilledAt ? new Date(post.fulfilledAt).toLocaleDateString('th-TH') : '-'}</td>
                            <td className="px-4 py-2 text-center">
                                {post.status === 'ACTIVE' && (
                                    <button 
                                        onClick={() => handleCancel(post)}
                                        disabled={isProcessing === post.id}
                                        className="text-red-500 hover:text-red-700 disabled:text-slate-300"
                                        title="ยกเลิกประกาศ"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                )}
                            </td>
                        </tr>
                    )
                })}
                 {filteredPostings.length === 0 && (
                    <tr><td colSpan={headers.length} className="text-center py-8 text-slate-500">ไม่มีประกาศในสถานะนี้</td></tr>
                )}
            </TableTemplate>
        </div>
    );
};

export default P2PExchangeAdminView;
