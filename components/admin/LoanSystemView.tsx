import React, { useState, useEffect, useMemo } from 'react';
import { Department, Product, User, LoanTransaction, LoanTransactionItem } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import PrinterIcon from '../icons/PrinterIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import Modal from '../Modal';
import TrashIcon from '../icons/TrashIcon';
import ArrowUturnLeftIcon from '../icons/ArrowUturnLeftIcon';
import ClipboardDocumentListIcon from '../icons/ClipboardDocumentListIcon';
import BuildingOfficeIcon from '../icons/BuildingOfficeIcon';
import CubeIcon from '../icons/CubeIcon';

interface LoanSystemViewProps {
    departments: Department[];
    allProducts: Product[];
    currentUser: User;
    isPublicMode?: boolean;
}

export const LoanSystemView: React.FC<LoanSystemViewProps> = ({ departments: initialDepts, allProducts: initialProducts, currentUser, isPublicMode = false }) => {
    const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [transactionToPrint, setTransactionToPrint] = useState<LoanTransaction | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'by_dept' | 'total'>('list');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('Active');
    
    const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, message: string, onConfirm: () => void, isAlert?: boolean }>({ isOpen: false, message: '', onConfirm: () => {} });
    const [promptDialog, setPromptDialog] = useState<{ isOpen: boolean, message: string, defaultValue: string, onConfirm: (value: string) => void }>({ isOpen: false, message: '', defaultValue: '', onConfirm: () => {} });
    const [promptValue, setPromptValue] = useState('');

    const [departments, setDepartments] = useState<Department[]>(initialDepts);
    const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);

    useEffect(() => {
        if (isPublicMode) {
            setIsCreateModalOpen(true);
        }
    }, [isPublicMode]);

    useEffect(() => {
        if (isPublicMode) {
            // Fetch data if not provided
            const loadData = async () => {
                try {
                    const [depts, prods] = await Promise.all([
                        supabaseService.getDepartments(),
                        supabaseService.getProducts()
                    ]);
                    setDepartments(depts);
                    setAllProducts(prods);
                } catch (e) {
                    console.error("Failed to load public loan data", e);
                }
            };
            loadData();
        }
    }, [isPublicMode]);

    // Create Form State
    const [newLoanDate, setNewLoanDate] = useState(new Date().toISOString().split('T')[0]);
    const [newLoanDept, setNewLoanDept] = useState('');
    const [newLoanBorrower, setNewLoanBorrower] = useState('');
    const [newLoanLender, setNewLoanLender] = useState(currentUser.name || 'เจ้าหน้าที่คลัง');
    const [newLoanReason, setNewLoanReason] = useState('');
    const [otherReason, setOtherReason] = useState('');
    const [newLoanItems, setNewLoanItems] = useState<{ product: Product; quantity: number }[]>([]);
    const [productSearch, setProductSearch] = useState('');

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const data = await supabaseService.getLoanTransactions();
            setTransactions(data);
        } catch (error) {
            console.error('Error fetching loan transactions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProduct = (product: Product) => {
        setNewLoanItems(prev => {
            const existing = prev.find(i => i.product.id === product.id);
            if (existing) return prev;
            return [...prev, { product, quantity: 1 }];
        });
        setProductSearch('');
    };

    const handleUpdateQuantity = (productId: string, qty: number) => {
        setNewLoanItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
    };

    const handleRemoveItem = (productId: string) => {
        setNewLoanItems(prev => prev.filter(i => i.product.id !== productId));
    };

    const handleDeptChange = (deptId: string) => {
        setNewLoanDept(deptId);
        const dept = departments.find(d => d.id === deptId);
        if (dept) {
            setNewLoanBorrower(dept.name);
        }
    };

    const handleCreateLoan = async () => {
        if (!newLoanDept || !newLoanBorrower || !newLoanLender || newLoanItems.length === 0) {
            setConfirmDialog({ isOpen: true, message: 'กรุณากรอกข้อมูลให้ครบถ้วน', onConfirm: () => {}, isAlert: true });
            return;
        }

        try {
            const transactionNumber = `LOAN-${new Date().getFullYear().toString().substr(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            
            const finalReason = newLoanReason === 'อื่นๆ' ? `อื่นๆ: ${otherReason}` : newLoanReason;

            await supabaseService.createLoanTransaction({
                transactionNumber,
                departmentId: newLoanDept,
                borrowerName: newLoanBorrower,
                lenderName: newLoanLender,
                reason: finalReason,
                status: 'Active',
                createdAt: new Date(newLoanDate)
            } as any, newLoanItems.map(i => ({
                productId: i.product.id,
                quantity: i.quantity
            })) as any);

            setConfirmDialog({ isOpen: true, message: 'บันทึกการยืมเรียบร้อย', onConfirm: () => {}, isAlert: true });
            setIsCreateModalOpen(false);
            setNewLoanItems([]);
            setNewLoanBorrower('');
            setNewLoanReason('');
            setOtherReason('');
            fetchTransactions();
        } catch (error) {
            console.error('Error creating loan:', error);
            setConfirmDialog({ isOpen: true, message: 'เกิดข้อผิดพลาดในการบันทึก', onConfirm: () => {}, isAlert: true });
        }
    };

    const handleReturnItem = async (txnId: string, itemId: number, currentReturned: number, totalQty: number, isDerived?: boolean) => {
        setPromptValue((totalQty - currentReturned).toString());
        setPromptDialog({
            isOpen: true,
            message: `คืนจำนวนเท่าไหร่? (คืนแล้ว: ${currentReturned}/${totalQty})`,
            defaultValue: (totalQty - currentReturned).toString(),
            onConfirm: async (returnQtyStr: string) => {
                const returnQty = parseInt(returnQtyStr);
                if (isNaN(returnQty) || returnQty < 0) return;

                const newReturned = currentReturned + returnQty;
                if (newReturned > totalQty) {
                    setConfirmDialog({ isOpen: true, message: 'จำนวนคืนเกินจำนวนที่ยืม', onConfirm: () => {}, isAlert: true });
                    return;
                }

                try {
                    if (isDerived) {
                        await supabaseService.updateRequisitionItemReturn(itemId, newReturned);
                    } else {
                        await supabaseService.updateLoanTransactionItem(itemId, newReturned);
                    }
                    fetchTransactions();
                } catch (error: any) {
                    console.error('Error returning item:', error);
                    setConfirmDialog({ isOpen: true, message: `เกิดข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'}`, onConfirm: () => {}, isAlert: true });
                }
            }
        });
    };

    const handleEditItemQuantity = async (itemId: number, currentQty: number, returnedQty: number) => {
        setPromptValue(currentQty.toString());
        setPromptDialog({
            isOpen: true,
            message: `แก้ไขจำนวนที่ยืม (คืนแล้ว: ${returnedQty})`,
            defaultValue: currentQty.toString(),
            onConfirm: async (newQtyStr: string) => {
                const newQty = parseInt(newQtyStr);
                if (isNaN(newQty) || newQty < 1) return;

                if (newQty < returnedQty) {
                    setConfirmDialog({ isOpen: true, message: 'จำนวนที่ยืมต้องไม่น้อยกว่าจำนวนที่คืนแล้ว', onConfirm: () => {}, isAlert: true });
                    return;
                }

                try {
                    await supabaseService.updateLoanTransactionItemQuantity(itemId, newQty);
                    fetchTransactions();
                } catch (error: any) {
                    console.error('Error updating quantity:', error);
                    setConfirmDialog({ isOpen: true, message: `เกิดข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'}`, onConfirm: () => {}, isAlert: true });
                }
            }
        });
    };

    const handleDeleteItem = async (itemId: number) => {
        setConfirmDialog({
            isOpen: true,
            message: 'ยืนยันการลบรายการนี้?',
            onConfirm: async () => {
                try {
                    await supabaseService.deleteLoanTransactionItem(itemId);
                    fetchTransactions();
                } catch (error: any) {
                    console.error('Error deleting item:', error);
                    setConfirmDialog({ isOpen: true, message: `เกิดข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'}`, onConfirm: () => {}, isAlert: true });
                }
            }
        });
    };

    const handleDeleteTransaction = async (txnId: string) => {
        const isDerived = txnId.startsWith('req-');
        const message = isDerived 
            ? 'ยืนยันการลบรายการยืมนี้? การลบจะทำให้สถานะสินค้าในใบเบิกกลับเป็น "อนุมัติแล้ว" และหายไปจากระบบยืม-คืน (แต่ใบเบิกยังคงอยู่)'
            : 'ยืนยันการลบรายการยืมนี้ทั้งหมด? การลบจะไม่สามารถย้อนกลับได้';
            
        setConfirmDialog({
            isOpen: true,
            message,
            onConfirm: async () => {
                try {
                    await supabaseService.deleteLoanTransaction(txnId);
                    fetchTransactions();
                } catch (error: any) {
                    console.error('Error deleting transaction:', error);
                    setConfirmDialog({ isOpen: true, message: `เกิดข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'}`, onConfirm: () => {}, isAlert: true });
                }
            }
        });
    };

    const handleCancelTransaction = async (txnId: string) => {
        setConfirmDialog({
            isOpen: true,
            message: 'ยืนยันการยกเลิกรายการยืมนี้?',
            onConfirm: async () => {
                try {
                    await supabaseService.updateLoanTransactionStatus(txnId, 'Cancelled');
                    fetchTransactions();
                } catch (error: any) {
                    console.error('Error cancelling transaction:', error);
                    setConfirmDialog({ isOpen: true, message: `เกิดข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'}`, onConfirm: () => {}, isAlert: true });
                }
            }
        });
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            // Handle 'Returned' as 'Completed' for backward compatibility
            const normalizedStatus = t.status === 'Returned' ? 'Completed' : t.status;
            const matchesStatus = statusFilter === 'All' || normalizedStatus === statusFilter;
            if (!matchesStatus) return false;

            const matchesHeader = t.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.departmentName?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesItems = t.items?.some(item => 
                item.product?.name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            return matchesHeader || matchesItems;
        });
    }, [transactions, searchTerm, statusFilter]);

    const summaryByDept = useMemo(() => {
        const map = new Map<string, { deptName: string, items: { productName: string, unit: string, quantity: number, returned: number }[] }>();
        
        filteredTransactions.forEach(t => {
            const deptId = t.departmentId;
            if (!map.has(deptId)) {
                map.set(deptId, { deptName: t.departmentName || 'Unknown', items: [] });
            }
            const deptData = map.get(deptId)!;
            
            t.items?.forEach(item => {
                const existing = deptData.items.find(i => i.productName === item.product?.name);
                if (existing) {
                    existing.quantity += item.quantity;
                    existing.returned += item.returnedQuantity;
                } else {
                    deptData.items.push({
                        productName: item.product?.name || 'Unknown',
                        unit: item.product?.unit || '',
                        quantity: item.quantity,
                        returned: item.returnedQuantity
                    });
                }
            });
        });
        return Array.from(map.values()).sort((a, b) => a.deptName.localeCompare(b.deptName, 'th'));
    }, [filteredTransactions]);

    const summaryTotal = useMemo(() => {
        const map = new Map<string, { productName: string, unit: string, quantity: number, returned: number }>();
        
        filteredTransactions.forEach(t => {
            t.items?.forEach(item => {
                const pName = item.product?.name || 'Unknown';
                if (!map.has(pName)) {
                    map.set(pName, { productName: pName, unit: item.product?.unit || '', quantity: 0, returned: 0 });
                }
                const data = map.get(pName)!;
                data.quantity += item.quantity;
                data.returned += item.returnedQuantity;
            });
        });
        return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName, 'th'));
    }, [filteredTransactions]);

    const searchableProducts = useMemo(() => {
        if (!productSearch) return [];
        return allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [allProducts, productSearch]);

    const handlePrintSummary = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            {transactionToPrint && (
                <LoanSlipPrintView transaction={transactionToPrint} onClose={() => setTransactionToPrint(null)} />
            )}

            <div className="flex justify-between items-center no-print">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">ระบบยืม-คืนสินค้า</h2>
                <div className="flex gap-2">
                    {!isPublicMode && (
                        <button onClick={handlePrintSummary} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 font-bold shadow-sm">
                            <PrinterIcon className="w-5 h-5" />
                            พิมพ์รายงาน
                        </button>
                    )}
                    <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 font-bold shadow-md">
                        <PlusIcon className="w-5 h-5" />
                        สร้างรายการยืม
                    </button>
                </div>
            </div>

            {!isPublicMode && (
                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 no-print">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('list')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ClipboardDocumentListIcon className="w-4 h-4" />
                            รายละเอียด (List)
                        </button>
                        <button 
                            onClick={() => setActiveTab('by_dept')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${activeTab === 'by_dept' ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <BuildingOfficeIcon className="w-4 h-4" />
                            สรุปตามหน่วยงาน (By Dept)
                        </button>
                        <button 
                            onClick={() => setActiveTab('total')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${activeTab === 'total' ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <CubeIcon className="w-4 h-4" />
                            สรุปยอดรวม (Total)
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 no-print flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="ค้นหาเลขที่, ผู้ยืม, หน่วยงาน, ชื่อสินค้า..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                {activeTab === 'list' && (
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto">
                        {(['All', 'Active', 'Completed', 'Cancelled'] as const).map((status) => {
                            const count = transactions.filter(t => {
                                if (status === 'All') return true;
                                const normalizedStatus = t.status === 'Returned' ? 'Completed' : t.status;
                                return normalizedStatus === status;
                            }).length;
                            return (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-1.5 text-xs rounded-md transition-all font-bold whitespace-nowrap flex items-center gap-2 ${
                                        statusFilter === status
                                            ? 'bg-white dark:bg-slate-800 text-sky-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {status === 'All' ? 'ทั้งหมด' : 
                                     status === 'Active' ? 'ยังไม่คืน' : 
                                     status === 'Completed' ? 'คืนแล้ว' : 'ยกเลิก'}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === status ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {activeTab === 'list' && (
                <div className="grid gap-4 no-print">
                    {filteredTransactions.map(txn => (
                        <div key={txn.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{txn.transactionNumber}</h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${txn.status === 'Active' ? 'bg-amber-100 text-amber-700' : txn.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {txn.status === 'Active' ? 'กำลังยืม' : txn.status === 'Cancelled' ? 'ยกเลิกแล้ว' : 'คืนครบแล้ว'}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                                        <span className="font-bold">{txn.departmentName}</span> | ผู้ยืม: {txn.borrowerName} | ผู้ให้ยืม: {txn.lenderName}
                                    </p>
                                    <p className="text-slate-500 text-xs mt-1">วันที่: {new Date(txn.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    {txn.reason && <p className="text-slate-500 text-xs mt-1 italic">เหตุผล: {txn.reason}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setTransactionToPrint(txn)} className="text-slate-400 hover:text-blue-600 p-2" title="พิมพ์ใบยืม">
                                        <PrinterIcon className="w-5 h-5" />
                                    </button>
                                    {!isPublicMode && (
                                        <>
                                            {txn.status !== 'Completed' && txn.status !== 'Cancelled' && (
                                                <button onClick={() => handleCancelTransaction(txn.id)} className="text-slate-400 hover:text-orange-600 p-2" title="ยกเลิกรายการ">
                                                    <ArrowUturnLeftIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteTransaction(txn.id)} className="text-slate-400 hover:text-red-600 p-2" title="ลบรายการ">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-semibold">
                                        <tr>
                                            <th className="p-2 text-left">รายการ</th>
                                            <th className="p-2 text-center w-24">จำนวนยืม</th>
                                            <th className="p-2 text-center w-24">คืนแล้ว</th>
                                            <th className="p-2 text-center w-24">คงเหลือ</th>
                                            <th className="p-2 w-32"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {txn.items?.map(item => {
                                            const remaining = item.quantity - item.returnedQuantity;
                                            return (
                                                <tr key={item.id}>
                                                    <td className="p-2">{item.product?.name} ({item.product?.unit})</td>
                                                    <td className="p-2 text-center font-bold">{item.quantity}</td>
                                                    <td className="p-2 text-center text-green-600 font-bold">{item.returnedQuantity}</td>
                                                    <td className="p-2 text-center text-red-600 font-bold">{remaining}</td>
                                                    <td className="p-2 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {remaining > 0 && !isPublicMode && (
                                                                <button 
                                                                    onClick={() => handleReturnItem(txn.id, item.id, item.returnedQuantity, item.quantity, item.isDerived)}
                                                                    className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-bold"
                                                                >
                                                                    คืนของ
                                                                </button>
                                                            )}
                                                            {!item.isDerived && !isPublicMode && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => handleEditItemQuantity(item.id, item.quantity, item.returnedQuantity)}
                                                                        className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold"
                                                                    >
                                                                        แก้ไข
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteItem(item.id)}
                                                                        className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 font-bold"
                                                                    >
                                                                        ลบ
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'by_dept' && (
                <div className="space-y-6 no-print">
                    {summaryByDept.map(dept => (
                        <div key={dept.deptName} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-3 border-b dark:border-slate-700">
                                <h3 className="font-bold text-sky-600">{dept.deptName}</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="text-slate-500 font-semibold border-b dark:border-slate-700">
                                    <tr>
                                        <th className="p-4 text-left">รายการสินค้า</th>
                                        <th className="p-4 text-center w-32">จำนวนยืมรวม</th>
                                        <th className="p-4 text-center w-32">คืนแล้วรวม</th>
                                        <th className="p-4 text-center w-32">คงเหลือรวม</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {dept.items.map(item => (
                                        <tr key={item.productName}>
                                            <td className="p-4">{item.productName} ({item.unit})</td>
                                            <td className="p-4 text-center font-bold">{item.quantity}</td>
                                            <td className="p-4 text-center text-green-600 font-bold">{item.returned}</td>
                                            <td className="p-4 text-center text-red-600 font-bold">{item.quantity - item.returned}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'total' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden no-print">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-semibold border-b dark:border-slate-700">
                            <tr>
                                <th className="p-4 text-left">รายการสินค้า</th>
                                <th className="p-4 text-center w-32">จำนวนยืมทั้งหมด</th>
                                <th className="p-4 text-center w-32">คืนแล้วทั้งหมด</th>
                                <th className="p-4 text-center w-32">คงเหลือทั้งหมด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {summaryTotal.map(item => (
                                <tr key={item.productName}>
                                    <td className="p-4 font-medium">{item.productName} ({item.unit})</td>
                                    <td className="p-4 text-center font-bold">{item.quantity}</td>
                                    <td className="p-4 text-center text-green-600 font-bold">{item.returned}</td>
                                    <td className="p-4 text-center text-red-600 font-bold text-lg">{item.quantity - item.returned}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Print Summary View */}
            <div className="hidden print:block font-sarabun text-black p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold">รายงานสรุปการยืม-คืนสินค้า</h1>
                    <p className="text-sm">ข้อมูล ณ วันที่ {new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}</p>
                    {searchTerm && <p className="text-sm italic">คำค้นหา: "{searchTerm}"</p>}
                </div>

                {activeTab === 'total' || activeTab === 'list' ? (
                    <table className="w-full border-collapse border border-black">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 text-left">รายการสินค้า</th>
                                <th className="border border-black p-2 text-center w-32">จำนวนยืม</th>
                                <th className="border border-black p-2 text-center w-32">คืนแล้ว</th>
                                <th className="border border-black p-2 text-center w-32">คงเหลือ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryTotal.map(item => (
                                <tr key={item.productName}>
                                    <td className="border border-black p-2">{item.productName} ({item.unit})</td>
                                    <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                                    <td className="border border-black p-2 text-center">{item.returned}</td>
                                    <td className="border border-black p-2 text-center font-bold">{item.quantity - item.returned}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="space-y-8">
                        {summaryByDept.map(dept => (
                            <div key={dept.deptName}>
                                <h3 className="font-bold border-b border-black mb-2">{dept.deptName}</h3>
                                <table className="w-full border-collapse border border-black">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black p-2 text-left">รายการสินค้า</th>
                                            <th className="border border-black p-2 text-center w-32">จำนวนยืม</th>
                                            <th className="border border-black p-2 text-center w-32">คืนแล้ว</th>
                                            <th className="border border-black p-2 text-center w-32">คงเหลือ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dept.items.map(item => (
                                            <tr key={item.productName}>
                                                <td className="border border-black p-2">{item.productName} ({item.unit})</td>
                                                <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                                                <td className="border border-black p-2 text-center">{item.returned}</td>
                                                <td className="border border-black p-2 text-center font-bold">{item.quantity - item.returned}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="สร้างรายการยืมใหม่" size="2xl">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">วันที่ยืม</label>
                            <input type="date" value={newLoanDate} onChange={e => setNewLoanDate(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">หน่วยงานที่ยืม</label>
                            <select value={newLoanDept} onChange={e => handleDeptChange(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700">
                                <option value="">-- เลือกหน่วยงาน --</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">ชื่อผู้ยืม</label>
                            <input type="text" value={newLoanBorrower} onChange={e => setNewLoanBorrower(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700" placeholder="ระบุชื่อผู้ยืม" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">ชื่อผู้ให้ยืม</label>
                            <input type="text" value={newLoanLender} onChange={e => setNewLoanLender(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-bold mb-1">เหตุผลการยืม</label>
                            <select 
                                value={newLoanReason} 
                                onChange={e => setNewLoanReason(e.target.value)} 
                                className="w-full p-2 border rounded-lg dark:bg-slate-700"
                            >
                                <option value="">-- เลือกเหตุผล --</option>
                                <option value="ของยังไม่รับเข้า stock">1. ของยังไม่รับเข้า stock</option>
                                <option value="มีการใช้เร่งด่วน">2. มีการใช้เร่งด่วน</option>
                                <option value="อื่นๆ">3. อื่นๆ</option>
                            </select>
                            {newLoanReason === 'อื่นๆ' && (
                                <input 
                                    type="text" 
                                    placeholder="ระบุเหตุผลเพิ่มเติม..." 
                                    className="w-full mt-2 p-2 border rounded-lg dark:bg-slate-700"
                                    value={otherReason}
                                    onChange={e => setOtherReason(e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <label className="block text-sm font-bold mb-2">เพิ่มรายการสินค้า</label>
                        <div className="relative mb-4">
                            <input 
                                type="text" 
                                value={productSearch} 
                                onChange={e => setProductSearch(e.target.value)} 
                                className="w-full p-2 border rounded-lg dark:bg-slate-700 pl-10" 
                                placeholder="ค้นหาสินค้า..." 
                            />
                            <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                            {searchableProducts.length > 0 && (
                                <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border rounded-lg mt-1 shadow-lg max-h-48 overflow-auto">
                                    {searchableProducts.map(p => (
                                        <button key={p.id} onClick={() => handleAddProduct(p)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-b last:border-0">
                                            {p.name} ({p.unit})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            {newLoanItems.map(item => (
                                <div key={item.product.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 p-2 rounded-lg">
                                    <span className="text-sm font-medium">{item.product.name}</span>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => handleUpdateQuantity(item.product.id, parseInt(e.target.value))} 
                                            className="w-20 p-1 border rounded text-center dark:bg-slate-600" 
                                            min="1" 
                                        />
                                        <span className="text-xs text-slate-500">{item.product.unit}</span>
                                        <button onClick={() => handleRemoveItem(item.product.id)} className="text-red-500 hover:text-red-700">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {newLoanItems.length === 0 && <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีรายการสินค้า</p>}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t gap-2">
                        <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                        <button onClick={handleCreateLoan} className="px-6 py-2 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-700">บันทึก</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} title={confirmDialog.isAlert ? "แจ้งเตือน" : "ยืนยันการดำเนินการ"} size="md">
                <div className="p-4">
                    <p className="text-slate-700 dark:text-slate-200 mb-6">{confirmDialog.message}</p>
                    <div className="flex justify-end gap-3">
                        {!confirmDialog.isAlert && (
                            <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg">
                                ยกเลิก
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                confirmDialog.onConfirm();
                                setConfirmDialog({ ...confirmDialog, isOpen: false });
                            }} 
                            className={`px-6 py-2 text-white font-bold rounded-lg ${confirmDialog.isAlert ? 'bg-sky-600 hover:bg-sky-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {confirmDialog.isAlert ? 'ตกลง' : 'ยืนยัน'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={promptDialog.isOpen} onClose={() => setPromptDialog({ ...promptDialog, isOpen: false })} title="กรอกข้อมูล" size="md">
                <div className="p-4">
                    <p className="text-slate-700 dark:text-slate-200 mb-4">{promptDialog.message}</p>
                    <input
                        type="number"
                        className="w-full border rounded-lg p-2 mb-6 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        value={promptValue}
                        onChange={(e) => setPromptValue(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setPromptDialog({ ...promptDialog, isOpen: false })} className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg">
                            ยกเลิก
                        </button>
                        <button 
                            onClick={() => {
                                promptDialog.onConfirm(promptValue);
                                setPromptDialog({ ...promptDialog, isOpen: false });
                            }} 
                            className="px-6 py-2 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-700"
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const LoanSlipPrintView: React.FC<{ transaction: LoanTransaction; onClose: () => void }> = ({ transaction, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => window.print(), 500);
        const handleAfterPrint = () => onClose();
        window.addEventListener('afterprint', handleAfterPrint, { once: true });
        return () => { clearTimeout(timer); window.removeEventListener('afterprint', handleAfterPrint); };
    }, []);

    return (
        <div className="fixed inset-0 bg-white z-[9999] overflow-auto print-only font-sarabun text-black p-8">
            <div className="max-w-3xl mx-auto border border-black p-8 min-h-[29.7cm]">
                <header className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2">ใบยืมพัสดุ/ครุภัณฑ์</h1>
                    <p className="text-sm">เลขที่เอกสาร: {transaction.transactionNumber}</p>
                </header>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                        <p><span className="font-bold">หน่วยงานที่ยืม:</span> {transaction.departmentName}</p>
                        <p><span className="font-bold">ชื่อผู้ยืม:</span> {transaction.borrowerName}</p>
                    </div>
                    <div className="text-right">
                        <p><span className="font-bold">วันที่ยืม:</span> {new Date(transaction.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
                        <p><span className="font-bold">ผู้ให้ยืม:</span> {transaction.lenderName}</p>
                    </div>
                </div>
                
                {transaction.reason && (
                    <div className="mb-6 text-sm">
                        <p><span className="font-bold">เหตุผลการยืม:</span> {transaction.reason}</p>
                    </div>
                )}

                <table className="w-full border-collapse border border-black mb-8 text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 text-center w-12">ลำดับ</th>
                            <th className="border border-black p-2 text-left">รายการ</th>
                            <th className="border border-black p-2 text-center w-24">จำนวน</th>
                            <th className="border border-black p-2 text-center w-20">หน่วยนับ</th>
                            <th className="border border-black p-2 text-center w-32">หมายเหตุ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transaction.items?.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2">{item.product?.name}</td>
                                <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                                <td className="border border-black p-2 text-center">{item.product?.unit}</td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-16 grid grid-cols-2 gap-16 text-center">
                    <div>
                        <p className="mb-8">ลงชื่อ ........................................................ ผู้ยืม</p>
                        <p className="font-bold">({transaction.borrowerName})</p>
                        <p className="text-sm mt-1">วันที่ ........................................................</p>
                    </div>
                    <div>
                        <p className="mb-8">ลงชื่อ ........................................................ ผู้ให้ยืม/ผู้อนุมัติ</p>
                        <p className="font-bold">({transaction.lenderName})</p>
                        <p className="text-sm mt-1">วันที่ ........................................................</p>
                    </div>
                </div>
                
                <div className="mt-16 text-xs text-gray-500 text-center">
                    <p>กรุณานำใบยืมนี้มาแสดงเมื่อทำการคืนพัสดุ</p>
                </div>
            </div>
        </div>
    );
};
