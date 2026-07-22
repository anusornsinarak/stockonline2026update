


import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { SurveyEntry, Product, Department, DepartmentType, Requisition, DocumentSettings } from '../../types';
import * as XLSX from 'xlsx';
import DownloadIcon from '../icons/DownloadIcon';
import PrinterIcon from '../icons/PrinterIcon';
import TableTemplate from './TableTemplate';
import DepartmentSurveyPrintView from './DepartmentSurveyPrintView';
// FIX: Changed the import of 'supabaseService' from a default import to a named import to resolve the module resolution error.
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import ChevronUpIcon from '../icons/ChevronUpIcon';

const exportToExcel = (data: any[], fileName: string, sheetName: string = "Sheet1") => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

interface DepartmentViewProps {
    results: SurveyEntry[];
    products: Product[];
    departments: Department[];
    requisitions?: Requisition[];
    onDataChange: () => void;
    isReadOnly?: boolean;
    fiscalYear: number;
    documentSettings?: DocumentSettings | null;
}

export const DepartmentView: React.FC<DepartmentViewProps> = ({ results, products, departments, requisitions = [], onDataChange, isReadOnly, fiscalYear, documentSettings }) => {
    const [editedQuantities, setEditedQuantities] = useState<Record<string, Record<string, { quantity: number; price: number }>>>({});
    const [savingDeptId, setSavingDeptId] = useState<string | null>(null);
    const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [printingDeptId, setPrintingDeptId] = useState<string | null>(null);

    const getApprovedQuantityInFiscalYear = (deptId: string, productId: string) => {
        const targetFiscalYearBE = fiscalYear - 1;
        const yearCE = targetFiscalYearBE - 543;
        const startDate = new Date(yearCE - 1, 9, 1);
        const endDate = new Date(yearCE, 8, 30, 23, 59, 59, 999);
        
        let total = 0;
        requisitions.forEach(req => {
            if (req.departmentId !== deptId) return;
            if (!['PartiallyApproved', 'Ready', 'Completed'].includes(req.status)) return;
            const reqDate = req.createdAt ? new Date(req.createdAt) : null;
            if (!reqDate || reqDate < startDate || reqDate > endDate) return;
            
            const item = req.items?.find(i => i.productId === productId);
            if (item && item.approvedQuantity != null) {
                total += item.approvedQuantity;
            }
        });
        return total;
    };
    
    useEffect(() => {
        if (printingDeptId) {
            const timer = setTimeout(() => window.print(), 100);
            const afterPrint = () => setPrintingDeptId(null);
            window.addEventListener('afterprint', afterPrint, {once: true});
            return () => {
                clearTimeout(timer);
                window.removeEventListener('afterprint', afterPrint);
            };
        }
    }, [printingDeptId]);

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    
    const submittedDepartments = useMemo(() => {
        return departments
            .filter(d => results.some(r => r.departmentId === d.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'));
    }, [departments, results]);

    useEffect(() => {
        const initialQuantities = results.reduce((acc, result) => {
            if (result.quantities) {
                acc[result.departmentId] = JSON.parse(JSON.stringify(result.quantities));
            }
            return acc;
        }, {} as Record<string, Record<string, { quantity: number; price: number }>>);
        setEditedQuantities(initialQuantities);
        // Initially expand the first department if there are any
        if (submittedDepartments.length > 0) {
            setExpandedDepts(new Set([submittedDepartments[0].id]));
        }
    }, [results, submittedDepartments]);

    const handleQuantityChange = (deptId: string, productId: string, value: string) => {
        const numValue = parseInt(value, 10);
        setEditedQuantities(prev => {
            const newDeptQuantities = { ...(prev[deptId] || {}) };
            const product = productMap.get(productId);
            const currentItem = newDeptQuantities[productId] || { quantity: 0, price: product?.pricePerUnit || 0 };
            
            newDeptQuantities[productId] = {
                ...currentItem,
                quantity: isNaN(numValue) ? 0 : numValue,
            };
            
            return {
                ...prev,
                [deptId]: newDeptQuantities,
            };
        });
    };
    
    const handleAddProduct = (deptId: string, product: Product) => {
        setEditedQuantities(prev => {
            const newDeptQuantities = { ...(prev[deptId] || {}) };
            if (!newDeptQuantities[product.id]) {
                newDeptQuantities[product.id] = {
                    quantity: 1, // Default quantity
                    price: product.pricePerUnit || 0,
                };
            }
            return { ...prev, [deptId]: newDeptQuantities };
        });
        setSearchTerms(prev => ({ ...prev, [deptId]: '' }));
    };

    const handleRemoveProduct = (deptId: string, productId: string) => {
        if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้ออกจากแบบสำรวจ?")) return;
        setEditedQuantities(prev => {
            const newDeptQuantities = { ...(prev[deptId] || {}) };
            delete newDeptQuantities[productId];
            return { ...prev, [deptId]: newDeptQuantities };
        });
    };

    const handleSaveChanges = async (deptId: string) => {
        setSavingDeptId(deptId);
        try {
            const quantitiesToSave = editedQuantities[deptId];
            if (quantitiesToSave) {
                const originalResult = results.find(r => r.departmentId === deptId);
                const originalQuantities = originalResult?.quantities || {};
                
                const reducedProducts: string[] = [];
                Object.entries(quantitiesToSave).forEach(([productId, data]) => {
                    const oldQuantity = (originalQuantities[productId] as any)?.quantity || 0;
                    if (data.quantity < oldQuantity) {
                        const productName = productMap.get(productId)?.name || 'ไม่ทราบชื่อ';
                        reducedProducts.push(`${productName} (จาก ${oldQuantity} เหลือ ${data.quantity})`);
                    }
                });

                if (reducedProducts.length > 0) {
                    try {
                        await supabaseService.notifyDepartmentUsers(
                            deptId, 
                            `ผู้ดูแลระบบได้ปรับลดยอดสำรวจของคุณเนื่องจากเกินงบประมาณจัดซื้อ หรือเหตุผลอื่นๆ รายการ: ${reducedProducts.join(', ')}`
                        );
                    } catch (e) {
                        console.error("Failed to notify department users:", e);
                    }
                }

                await supabaseService.submitSurvey(deptId, fiscalYear, quantitiesToSave);
                alert('บันทึกข้อมูลสำเร็จ!');
                onDataChange();
            }
        } catch (error) {
            console.error("Failed to save survey data:", error);
            alert(`เกิดข้อผิดพลาดในการบันทึก: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setSavingDeptId(null);
        }
    };
    
    const handleExportAll = () => {
        const workbook = XLSX.utils.book_new();
        let exportedCount = 0;

        submittedDepartments.forEach(dept => {
            const quantitiesToExport = editedQuantities[dept.id];
            if (!quantitiesToExport) return;
            
            const exportData = Object.entries(quantitiesToExport)
                .map(([productId, surveyItem]) => ({ 
                    product: productMap.get(productId), 
                    quantity: (surveyItem as any)?.quantity || 0,
                    price: (surveyItem as any)?.price || 0
                }))
                .filter(item => item.product && Number(item.quantity) > 0)
                .sort((a,b) => a.product!.name.localeCompare(b.product!.name, 'th'))
                .map(({ product, quantity, price }) => ({
                    'รายการ': product!.name,
                    'ประเภท': product!.category,
                    'หน่วย': product!.unit,
                    'ราคา ณ วันสำรวจ': price,
                    'จำนวนที่ต้องการ': quantity,
                    'มูลค่ารวม': Number(quantity) * Number(price)
                }));
            
            if (exportData.length > 0) {
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const sheetName = dept.name.replace(/[\\/*?:"<>|]/g, '').substring(0, 31);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                exportedCount++;
            }
        });

        if (exportedCount > 0) {
            XLSX.writeFile(workbook, `ผลสำรวจรายหน่วยงาน_${new Date().toLocaleDateString('th-TH')}.xlsx`);
        } else {
            alert("ไม่มีข้อมูลสำหรับส่งออก");
        }
    };

    const toggleExpand = (deptId: string) => {
        setExpandedDepts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(deptId)) {
                newSet.delete(deptId);
            } else {
                newSet.add(deptId);
            }
            return newSet;
        });
    };

    const getSearchableProducts = (deptId: string) => {
        const searchTerm = searchTerms[deptId];
        if (!searchTerm || !searchTerm.trim()) {
            return [];
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const currentProductIds = new Set(Object.keys(editedQuantities[deptId] || {}));

        return products
            .filter(p => !currentProductIds.has(p.id) && p.name.toLowerCase().includes(lowerCaseSearchTerm))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 7);
    };

    return (
        <Fragment>
        <div className="space-y-6 print:hidden">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ตรวจสอบและแก้ไขผลสำรวจรายหน่วยงาน</h3>
                <button
                    onClick={handleExportAll}
                    className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"
                >
                    <DownloadIcon className="w-5 h-5"/>
                    <span>ส่งออกผลทั้งหมด (Excel)</span>
                </button>
            </div>

            <div className="space-y-4">
                {submittedDepartments.map(dept => {
                    const isExpanded = expandedDepts.has(dept.id);
                    const departmentSurveyItems = Object.entries(editedQuantities[dept.id] || {});

                    return (
                        <div key={dept.id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                            <div className="w-full flex justify-between items-center p-4">
                                <button
                                    onClick={() => toggleExpand(dept.id)}
                                    className="flex-1 text-left flex justify-between items-center"
                                >
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{dept.name}</h4>
                                    <div className="flex items-center gap-4 pr-4 border-r border-slate-300 dark:border-slate-600">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">{departmentSurveyItems.length} รายการ</span>
                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-slate-500" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />}
                                    </div>
                                </button>
                                <button
                                    onClick={() => setPrintingDeptId(dept.id)}
                                    className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                                    title="พิมพ์แบบสำรวจของหน่วยงานนี้"
                                >
                                    <PrinterIcon className="w-4 h-4" />
                                    <span className="text-sm font-medium">พิมพ์</span>
                                </button>
                            </div>
                            {isExpanded && (
                                <div className="p-4 border-t border-slate-200 dark:border-slate-600 space-y-4 animate-fade-in" style={{animationDuration: '0.3s'}}>
                                    {!isReadOnly && (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="ค้นหาเพื่อเพิ่มรายการ..."
                                                value={searchTerms[dept.id] || ''}
                                                onChange={e => setSearchTerms(prev => ({...prev, [dept.id]: e.target.value}))}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                            />
                                            {getSearchableProducts(dept.id).length > 0 && (
                                                <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-48 overflow-auto">
                                                    {getSearchableProducts(dept.id).map(p => (
                                                        <button key={p.id} onClick={() => handleAddProduct(dept.id, p)} className="w-full flex items-center justify-between text-left p-2 hover:bg-sky-50 dark:hover:bg-sky-900/50">
                                                            {p.name}
                                                            <PlusIcon className="w-5 h-5 text-sky-500"/>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <TableTemplate headers={['รายการ', 'หน่วย', { name: `ใช้แล้วปี ${fiscalYear - 1}`, className: 'text-right' }, { name: 'จำนวนขอเบิก', className: 'text-right' }, { name: '', className: 'w-16 text-center' }]}>
                                        {departmentSurveyItems.length > 0 ? departmentSurveyItems.sort((a,b) => (productMap.get(a[0])?.name || '').localeCompare(productMap.get(b[0])?.name || '', 'th')).map(([productId, surveyItem]) => {
                                            const product = productMap.get(productId);
                                            if (!product) return null;
                                            return (
                                                <tr key={productId}>
                                                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{product.name}</td>
                                                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{product.unit}</td>
                                                    <td className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                                                        {getApprovedQuantityInFiscalYear(dept.id, productId).toLocaleString('th-TH')}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={(surveyItem as any)?.quantity || ''}
                                                            onChange={(e) => handleQuantityChange(dept.id, productId, e.target.value)}
                                                            className="w-24 text-right p-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 disabled:opacity-75 disabled:bg-slate-50"
                                                            disabled={isReadOnly}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        {!isReadOnly && (
                                                            <button onClick={() => handleRemoveProduct(dept.id, productId)} className="text-slate-400 hover:text-red-500">
                                                                <TrashIcon className="w-5 h-5"/>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr><td colSpan={4} className="text-center p-6 text-slate-500">ไม่มีรายการในแบบสำรวจนี้</td></tr>
                                        )}
                                    </TableTemplate>
                                    {!isReadOnly && (
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleSaveChanges(dept.id)}
                                                disabled={savingDeptId === dept.id}
                                                className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                                            >
                                                {savingDeptId === dept.id ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
        
        {printingDeptId && (
            <DepartmentSurveyPrintView
                department={departments.find(d => d.id === printingDeptId)!}
                fiscalYear={fiscalYear}
                items={Object.entries(editedQuantities[printingDeptId] || {})}
                productMap={productMap}
                getApprovedQuantityInFiscalYear={getApprovedQuantityInFiscalYear}
                documentSettings={documentSettings || null}
            />
        )}
        </Fragment>
    );
};
