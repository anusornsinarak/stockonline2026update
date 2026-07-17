
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Department, Product, PurchasePlanItem, SurveyEntry } from '../types';
import { supabaseService } from '../services/supabaseService';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import * as XLSX from 'xlsx';
import DownloadIcon from './icons/DownloadIcon';
import PrinterIcon from './icons/PrinterIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

interface SurveyFormProps {
  department: Department;
  isSurveyOpen: boolean;
  title: string;
  purchasePlan: PurchasePlanItem[];
  allSurveyResults: SurveyEntry[];
}

const exportToExcel = (data: any[], fileName: string, sheetName: string = "Sheet1") => {
    if (!data || data.length === 0) {
        alert("אין מידע לייצא");
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const SurveyForm: React.FC<SurveyFormProps> = ({ department, isSurveyOpen, title, purchasePlan, allSurveyResults }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, { quantity: number; price: number }>>({});
  const [prevYearUsage, setPrevYearUsage] = useState<Record<string, number>>({});
  const [prevYearSurvey, setPrevYearSurvey] = useState<Record<string, number>>({});
  const [lockedProducts, setLockedProducts] = useState<Record<string, string>>({});
  const [fySettings, setFySettings] = useState({ fy_survey_open: false, fy_survey_year: 2570, fy_previous_year: 2569 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedProductIds, setAssignedProductIds] = useState<Set<string>>(new Set());

  const planMap = useMemo(() => new Map(purchasePlan.map(p => [p.productId, p.plannedQuantity])), [purchasePlan]);

  const totalSurveyedMap = useMemo(() => {
    const totalMap = new Map<string, number>();
    allSurveyResults.forEach(result => {
      Object.entries(result.quantities).forEach(([productId, details]) => {
        const currentQty = totalMap.get(productId) || 0;
        totalMap.set(productId, currentQty + (details as { quantity: number }).quantity);
      });
    });
    return totalMap;
  }, [allSurveyResults]);

  const fetchProducts = useCallback(async () => {
    if (!department) return;
    setIsLoading(true);
    try {
      const settings = await supabaseService.getFySurveySettings();
      setFySettings(settings);

      const [fetchedProducts, surveyData, prevSurveyData, usageData, lockedData] = await Promise.all([
        supabaseService.getProductsForDepartment(department.id),
        supabaseService.getSurveyForDepartment(department.id, settings.fy_survey_year),
        supabaseService.getSurveyForDepartment(department.id, settings.fy_previous_year),
        supabaseService.getDepartmentUsageForFiscalYear(department.id, settings.fy_previous_year),
        supabaseService.getLockedProductsWithReasons(department.id)
      ]);
      
      setProducts(fetchedProducts);
      setAssignedProductIds(new Set(fetchedProducts.map(p => p.id)));
      setPrevYearUsage(usageData);
      setLockedProducts(lockedData);

      if (prevSurveyData?.quantities) {
        const prevQuantities: Record<string, number> = {};
        Object.entries(prevSurveyData.quantities).forEach(([pid, details]) => {
          prevQuantities[pid] = (details as { quantity: number }).quantity || 0;
        });
        setPrevYearSurvey(prevQuantities);
      }
      
      // If we have current survey data, use it. 
      if (surveyData?.quantities) {
        setQuantities(surveyData.quantities);
      }
      
      // Auto-add items that had usage last year or were in the previous survey but aren't in fetchedProducts
      const usageProductIds = Object.keys(usageData);
      const prevSurveyProductIds = prevSurveyData?.quantities ? Object.keys(prevSurveyData.quantities) : [];
      const currentSurveyProductIds = surveyData?.quantities ? Object.keys(surveyData.quantities) : [];
      const currentProductIds = new Set(fetchedProducts.map(p => p.id));
      
      const missingIds = [...new Set([...usageProductIds, ...prevSurveyProductIds, ...currentSurveyProductIds])].filter(id => !currentProductIds.has(id));
      
      if (missingIds.length > 0) {
          const allProds = await supabaseService.getProducts();
          const missingProds = allProds.filter(p => missingIds.includes(p.id));
          setProducts(prev => {
              const existingIds = new Set(prev.map(p => p.id));
              const uniqueMissing = missingProds.filter(p => !existingIds.has(p.id));
              return [...prev, ...uniqueMissing].sort((a,b) => a.name.localeCompare(b.name, 'th'));
          });
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [department]);

  useEffect(() => {
    // Fetch all products for the search functionality, once on mount.
    supabaseService.getProducts()
        .then(setAllProducts)
        .catch(err => console.error("Failed to fetch all products:", err));
  }, []);

  useEffect(() => {
    // Fetch department-specific products on initial load and when department changes.
    fetchProducts();
  }, [fetchProducts]);

  const searchableProducts = useMemo(() => {
    if (!searchTerm.trim()) {
        return [];
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const currentProductIds = new Set(products.map(p => p.id));
    
    return allProducts
        .filter(p => 
            !currentProductIds.has(p.id) && 
            p.name.toLowerCase().includes(lowerCaseSearchTerm)
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'th'))
        .slice(0, 7); // Show top 7 results
  }, [allProducts, products, searchTerm]);
  
  const handleAddProduct = async (product: Product) => {
    setProducts(prev => [...prev, product].sort((a,b) => a.name.localeCompare(b.name, 'th')));
    setSearchTerm('');
    alert(`เพิ่ม '${product.name}' ในแบบฟอร์มชั่วคราว \nหากต้องการเพิ่มถาวร กรุณาติดต่อผู้ดูแลระบบ`);
  };

  const handleRemoveTemporaryProduct = (productIdToRemove: string) => {
    setProducts(prev => prev.filter(p => p.id !== productIdToRemove));
    setQuantities(prev => {
        const newQuantities = {...prev};
        delete newQuantities[productIdToRemove];
        return newQuantities;
    });
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const numValue = parseInt(value, 10);
    const productPrice = products.find(p => p.id === productId)?.pricePerUnit || 0;
    setQuantities(prev => ({
      ...prev,
      [productId]: {
          quantity: isNaN(numValue) ? 0 : numValue,
          price: prev[productId]?.price || productPrice // Keep existing price or use current product price as default
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSurveyOpen) return; // Extra safety check
    setIsSubmitting(true);
    setSubmissionStatus('idle');

    const quantitiesForSubmit: Record<string, { quantity: number; price: number }> = {};
    Object.entries(quantities).forEach(([productId, surveyItem]) => {
        const product = products.find(p => p.id === productId);
        // Only include items that are on the form and have a quantity
        const typedSurveyItem = surveyItem as { quantity: number; price: number };
        if (product && typedSurveyItem && typedSurveyItem.quantity > 0) {
            quantitiesForSubmit[productId] = {
                quantity: typedSurveyItem.quantity,
                price: product.pricePerUnit || 0 // Always use the latest price from the product master on submission
            };
        }
    });

    try {
      await supabaseService.submitSurvey(department.id, fySettings.fy_survey_year, quantitiesForSubmit);
      setSubmissionStatus('success');
      setTimeout(() => setSubmissionStatus('idle'), 3000);
    } catch (error) {
      console.error("Failed to submit survey:", error);
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleExport = () => {
    const exportData = products
        .map(product => ({
            product,
            quantity: quantities[product.id]?.quantity || 0,
        }))
        .filter(item => item.quantity > 0)
        .sort((a,b) => a.product.name.localeCompare(b.product.name, 'th'))
        .map(({ product, quantity }) => ({
            'รายการเวชภัณฑ์': product.name,
            'หน่วย': product.unit,
            'จำนวนที่ต้องการใช้ทั้งปี': quantity,
        }));
    
    exportToExcel(exportData, `แบบสำรวจ_${department.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('th-TH')}`);
  };

  if (isLoading) {
    return <div className="text-center p-8">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg print-container">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h2>
        <p className="text-slate-600 dark:text-slate-300 mb-8">สำหรับหน่วยงาน: <span className="font-semibold">{department.name}</span></p>

        {!isSurveyOpen && (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-lg text-center">
                <h3 className="font-bold">ปิดรับการสำรวจแล้ว</h3>
                <p className="text-sm">คุณสามารถดูข้อมูลที่ส่งไปแล้วได้ แต่ไม่สามารถแก้ไขได้อีก กรุณาติดต่อผู้ดูแลระบบหากต้องการแก้ไข</p>
            </div>
        )}

        <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg no-print">
            <label htmlFor="search-product" className="block text-md font-medium text-slate-700 dark:text-slate-200 mb-2">
                ค้นหาและเพิ่มรายการจากคลังกลาง
            </label>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">หากต้องการเพิ่มรายการถาวรในแบบฟอร์มของท่าน กรุณาติดต่อผู้ดูแลระบบ</p>
            <div className="relative">
                <input
                    id="search-product"
                    type="text"
                    placeholder="พิมพ์ชื่อเวชภัณฑ์เพื่อค้นหา..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 dark:disabled:bg-slate-700/50"
                    autoComplete="off"
                    disabled={!isSurveyOpen}
                />
                {searchTerm && isSurveyOpen && (
                    <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                        {searchableProducts.length > 0 ? (
                            <ul>
                                {searchableProducts.map(p => (
                                    <li key={p.id} className="border-b dark:border-slate-700 last:border-b-0">
                                        <button
                                            onClick={() => handleAddProduct(p)}
                                            className="w-full text-left px-4 py-3 hover:bg-sky-50 dark:hover:bg-sky-900/50 flex justify-between items-center transition-colors"
                                            aria-label={`เพิ่ม ${p.name}`}
                                        >
                                            <div>
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                                                <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">({p.unit})</span>
                                            </div>
                                            <PlusIcon className="w-5 h-5 text-sky-500" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-sm text-slate-500 dark:text-slate-400 text-center">ไม่พบรายการที่ค้นหา หรือรายการนี้มีอยู่ในแบบสำรวจแล้ว</p>
                        )}
                    </div>
                )}
            </div>
        </div>

        <form onSubmit={handleSubmit}>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg print:overflow-visible">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">รายการเวชภัณฑ์ / หน่วย</th>
                            <th scope="col" className="px-4 py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">แผนเก่า ({fySettings.fy_previous_year})</th>
                            <th scope="col" className="px-4 py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ใช้จริงปี {fySettings.fy_previous_year}</th>
                            <th scope="col" className="px-4 py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">แนะนำ</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-40">สำรวจปี {fySettings.fy_survey_year}</th>
                            <th scope="col" className="relative px-6 py-3 w-16 no-print"><span className="sr-only">การดำเนินการ</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {products.map(product => {
                            const isTemporary = !assignedProductIds.has(product.id);
                            const totalSurveyed = totalSurveyedMap.get(product.id) || 0;
                            const hospitalPlannedQty = planMap.get(product.id) || 0; 
                            const isOverPlan = hospitalPlannedQty !== undefined && totalSurveyed > hospitalPlannedQty;
                            
                            const prevSurveyQty = prevYearSurvey[product.id] || 0;
                            const usage = prevYearUsage[product.id] || 0;
                            const recommended = Math.ceil(usage * 1.1); // Default 10% buffer
                            const lockReason = lockedProducts[product.id];
                            const isLocked = !!lockReason;

                            return (
                            <tr key={product.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/50 ${isLocked ? 'opacity-75 bg-slate-50/30' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-start gap-2">
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-slate-200 flex items-center gap-2">
                                                {product.name}
                                                {isLocked && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                        LOCKED
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">หน่วย: {product.unit}</div>
                                            {isLocked && <div className="text-[10px] text-red-500 font-medium mt-0.5 italic">เหตุผล: {lockReason}</div>}
                                        </div>
                                        {isOverPlan && (
                                            <div title="ยอดสำรวจรวมทุกหน่วยงานเกินแผนจัดซื้อ" className="pt-0.5">
                                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-slate-500 dark:text-slate-500">
                                    {prevSurveyQty.toLocaleString()}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-slate-600 dark:text-slate-400 font-medium">
                                    {usage.toLocaleString()}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                    <button 
                                        type="button"
                                        disabled={!isSurveyOpen || isLocked}
                                        onClick={() => handleQuantityChange(product.id, recommended.toString())}
                                        className="px-2 py-1 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 rounded text-xs font-bold hover:bg-sky-100 transition-colors border border-sky-100 dark:border-sky-800"
                                    >
                                        {recommended.toLocaleString()}
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    <input
                                        type="number"
                                        min="0"
                                        className={`w-32 px-3 py-2 text-right bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition disabled:bg-slate-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed ${isLocked ? 'border-red-300' : ''}`}
                                        value={quantities[product.id]?.quantity || ''}
                                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                        aria-label={`จำนวนที่ต้องการสำหรับ ${product.name}`}
                                        disabled={!isSurveyOpen || isLocked}
                                        placeholder={isLocked ? "ระงับ" : "0"}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium no-print">
                                    {isTemporary && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTemporaryProduct(product.id)}
                                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed"
                                            title="ลบรายการที่เพิ่มเองนี้ออกจากแบบฟอร์ม"
                                            disabled={!isSurveyOpen}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )})}
                         {products.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center text-slate-500 dark:text-slate-400 py-8">
                                    ไม่มีรายการในแบบสำรวจนี้ <br/>
                                    คุณสามารถค้นหาและเพิ่มรายการจากคลังกลางได้ หรือติดต่อผู้ดูแลระบบเพื่อกำหนดรายการสำหรับหน่วยงานของคุณ
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end items-center gap-4 flex-wrap no-print">
                 {submissionStatus === 'success' && <p className="text-green-600 dark:text-green-400">ส่งข้อมูลสำเร็จ!</p>}
                 {submissionStatus === 'error' && <p className="text-red-600 dark:text-red-400">เกิดข้อผิดพลาดในการส่งข้อมูล</p>}
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={products.length === 0}
                    className="bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors flex items-center gap-2"
                >
                    <DownloadIcon className="w-5 h-5"/>
                    <span>Excel</span>
                </button>
                <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={products.length === 0}
                    className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors flex items-center gap-2"
                >
                    <PrinterIcon className="w-5 h-5"/>
                    <span>พิมพ์</span>
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || products.length === 0 || !isSurveyOpen}
                    className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors"
                >
                    {isSubmitting ? 'กำลังส่ง...' : (allSurveyResults.some(r => r.departmentId === department.id) ? 'อัปเดตข้อมูลการสำรวจ' : 'ส่งข้อมูล')}
                </button>
            </div>
        </form>
    </div>
  );
};

export default SurveyForm;
