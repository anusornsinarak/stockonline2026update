import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Requisition, Product, Department, InventoryItem, AppView } from '../types';
import { supabaseService } from '../services/supabaseService';
import { getApprovedItemQuantity, getFiscalYearBE, getFiscalYearDateRange } from '../utils';
import ChartBarIcon from './icons/ChartBarIcon';
import CurrencyDollarIcon from './icons/CurrencyDollarIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import ShoppingCartIcon from './icons/ShoppingCartIcon';
import CubeIcon from './icons/CubeIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';

interface DashboardOverviewProps {
    user: User;
    onNavigate?: (view: AppView) => void;
}

interface CachedDashboardData {
    products: Product[];
    departments: Department[];
    allRequisitions: Requisition[];
    inventory: InventoryItem[];
    announcement: { content: string; enabled: boolean } | null;
    userRole: string;
    departmentId?: string;
    timestamp: number;
}

// Module-level in-memory cache to prevent flickering / full reload on page switches
let dashboardCache: CachedDashboardData | null = null;

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ user, onNavigate }) => {
    // Check if valid cache exists for current user
    const hasCache = dashboardCache !== null && 
        dashboardCache.userRole === user.role && 
        dashboardCache.departmentId === user.departmentId;

    const [isLoading, setIsLoading] = useState(!hasCache);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [allRequisitions, setAllRequisitions] = useState<Requisition[]>(hasCache ? dashboardCache!.allRequisitions : []);
    const [products, setProducts] = useState<Product[]>(hasCache ? dashboardCache!.products : []);
    const [departments, setDepartments] = useState<Department[]>(hasCache ? dashboardCache!.departments : []);
    const [inventory, setInventory] = useState<InventoryItem[]>(hasCache ? dashboardCache!.inventory : []);
    const [announcement, setAnnouncement] = useState<{ content: string; enabled: boolean } | null>(hasCache ? dashboardCache!.announcement : null);

    const [searchQuery, setSearchQuery] = useState('');
    // Default to 'FY_LATEST' as requested: แสดงข้อมูลเป็นของปีงบล่าสุดเสมอ
    const [timeRange, setTimeRange] = useState<string>('FY_LATEST');
    
    // Urgent purchase filter and search
    const [urgentFilter, setUrgentFilter] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');
    const [urgentSearch, setUrgentSearch] = useState('');
    const [showAllUrgent, setShowAllUrgent] = useState(false);

    // Fetch dashboard data silently in the background if cache exists
    const loadData = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);
        try {
            const [prods, depts, reqs, inv, activeAnnouncement] = await Promise.all([
                supabaseService.getProducts(),
                supabaseService.getDepartments(),
                user.role === 'Department' && user.departmentId
                    ? supabaseService.getRequisitionsForDepartment(user.departmentId)
                    : supabaseService.getRequisitionsForAdmin(),
                supabaseService.getInventory(),
                supabaseService.getAnnouncementSettings()
            ]);

            setProducts(prods);
            setDepartments(depts);
            setAllRequisitions(reqs);
            setInventory(inv);
            setAnnouncement(activeAnnouncement);

            // Update in-memory cache
            dashboardCache = {
                products: prods,
                departments: depts,
                allRequisitions: reqs,
                inventory: inv,
                announcement: activeAnnouncement,
                userRole: user.role,
                departmentId: user.departmentId,
                timestamp: Date.now()
            };
        } catch (e) {
            console.error('Failed to load dashboard overview data:', e);
        } finally {
            setIsLoading(false);
            if (isManualRefresh) setIsRefreshing(false);
        }
    }, [user.role, user.departmentId]);

    useEffect(() => {
        // If we don't have cache, load with initial loading indicator
        // If we have cache, refresh silently in the background
        loadData(false);
    }, [loadData]);

    const formatNumber = (num: number) => num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Determine fiscal years from current date and requisition data
    const currentFiscalYearBE = useMemo(() => getFiscalYearBE(new Date()), []);

    const availableFiscalYears = useMemo(() => {
        const years = new Set<number>();
        years.add(currentFiscalYearBE);
        allRequisitions.forEach(r => {
            const dateVal = r.approvedAt || r.submittedAt || r.createdAt;
            if (dateVal) {
                years.add(getFiscalYearBE(new Date(dateVal)));
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [allRequisitions, currentFiscalYearBE]);

    const latestFiscalYear = availableFiscalYears[0] || currentFiscalYearBE;

    // Filter requisitions based on timeRange or Fiscal Year
    const { requisitions, timeRangeLabel } = useMemo(() => {
        if (timeRange === 'ALL') {
            return { requisitions: allRequisitions, timeRangeLabel: 'ทั้งหมด' };
        }

        // Relative month ranges
        if (timeRange === '1M' || timeRange === '3M' || timeRange === '6M' || timeRange === '1Y') {
            const now = new Date();
            const cutoff = new Date(now);
            if (timeRange === '1M') cutoff.setMonth(now.getMonth() - 1);
            else if (timeRange === '3M') cutoff.setMonth(now.getMonth() - 3);
            else if (timeRange === '6M') cutoff.setMonth(now.getMonth() - 6);
            else if (timeRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);

            const labels: Record<string, string> = {
                '1M': '1 เดือนล่าสุด',
                '3M': '3 เดือนล่าสุด',
                '6M': '6 เดือนล่าสุด',
                '1Y': '1 ปีล่าสุด'
            };

            const filtered = allRequisitions.filter(r => {
                const reqDate = r.approvedAt || r.submittedAt || r.createdAt;
                if (!reqDate) return false;
                return new Date(reqDate) >= cutoff;
            });
            return { requisitions: filtered, timeRangeLabel: labels[timeRange] };
        }

        // Fiscal Year filter (Defaults to latest fiscal year)
        const targetFY = timeRange === 'FY_LATEST' 
            ? latestFiscalYear 
            : parseInt(timeRange.replace('FY_', ''), 10) || latestFiscalYear;

        const { start, end } = getFiscalYearDateRange(targetFY);

        const filtered = allRequisitions.filter(r => {
            const reqDate = r.approvedAt || r.submittedAt || r.createdAt;
            if (!reqDate) return false;
            const d = new Date(reqDate);
            return d >= start && d <= end;
        });

        return { 
            requisitions: filtered, 
            timeRangeLabel: `ปีงบประมาณ ${targetFY}` 
        };
    }, [allRequisitions, timeRange, latestFiscalYear]);

    // Top requisition stats calculation
    const stats = useMemo(() => {
        const productMap = new Map<string, Product>();
        products.forEach(p => productMap.set(p.id, p));

        const deptMap = new Map<string, Department>();
        departments.forEach(d => deptMap.set(d.id, d));

        // 1. รายการที่เบิกบ่อย (Top by frequency of requests)
        const reqFrequency = new Map<string, number>();
        // 2. เวชภัณฑ์มูลค่าสูง (Top by Total Value = Qty * Price)
        const reqValue = new Map<string, number>();
        // 3. ปริมาณการเบิกเพื่อเฝ้าระวัง (Top by total quantity)
        const reqQuantity = new Map<string, number>();
        // 4. หน่วยงานเบิกไม่ตรงรอบบ่อย
        const offCycleDepts = new Map<string, number>();

        requisitions.forEach(req => {
            if (!['Ready', 'PartiallyApproved', 'Completed', 'Picking'].includes(req.status)) return;

            if (req.type === 'OffCycle') {
                const dept = deptMap.get(req.departmentId);
                if (dept && dept.type !== 'External') {
                    offCycleDepts.set(req.departmentId, (offCycleDepts.get(req.departmentId) || 0) + 1);
                }
            }

            req.items?.forEach(item => {
                const approvedQty = getApprovedItemQuantity(req, item);

                if (approvedQty > 0) {
                    const prod = productMap.get(item.productId);
                    const price = item.pricePerUnit ?? prod?.pricePerUnit ?? 0;

                    reqFrequency.set(item.productId, (reqFrequency.get(item.productId) || 0) + 1);
                    reqQuantity.set(item.productId, (reqQuantity.get(item.productId) || 0) + approvedQty);
                    reqValue.set(item.productId, (reqValue.get(item.productId) || 0) + (approvedQty * price));
                }
            });
        });

        let filteredProducts = Array.from(productMap.values());
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredProducts = filteredProducts.filter(p => (p.name || '').toLowerCase().includes(query));
        }

        const filteredProductIds = new Set(filteredProducts.map(p => p.id));

        const topFrequent = Array.from(reqFrequency.entries())
            .filter(([id]) => filteredProductIds.has(id))
            .map(([id, count]) => ({ product: productMap.get(id), count }))
            .filter(x => x.product)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const topValue = Array.from(reqValue.entries())
            .filter(([id]) => filteredProductIds.has(id))
            .map(([id, value]) => ({ product: productMap.get(id), value }))
            .filter(x => x.product)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const topQuantityWatch = Array.from(reqQuantity.entries())
            .filter(([id]) => filteredProductIds.has(id))
            .map(([id, qty]) => ({ product: productMap.get(id), qty }))
            .filter(x => x.product)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        const topOffCycle = Array.from(offCycleDepts.entries())
            .map(([id, count]) => ({ dept: deptMap.get(id), count }))
            .filter(x => x.dept)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const totalCostThisPeriod = Array.from(reqValue.values()).reduce((sum, v) => sum + v, 0);

        return { topFrequent, topValue, topQuantityWatch, topOffCycle, totalCostThisPeriod };
    }, [requisitions, products, departments, searchQuery]);

    // Calculate items that urgently need to be purchased based on Min / Max Stock (รายการที่ควรรีบจัดซื้อ)
    const urgentPurchaseData = useMemo(() => {
        const invMap = new Map((inventory || []).map(i => [i.productId, i.quantity]));

        const allUrgent = products
            .filter(p => {
                if (p.minStock === null || p.minStock === undefined || p.minStock <= 0) return false;
                const currentStock = Number(invMap.get(p.id) ?? 0);
                return currentStock < Number(p.minStock);
            })
            .map(p => {
                const currentStock = Number(invMap.get(p.id) ?? 0);
                const min = Number(p.minStock);
                const max = (p.maxStock !== null && p.maxStock !== undefined && Number(p.maxStock) > 0) ? Number(p.maxStock) : null;
                const targetStock = (max !== null && max > currentStock) ? max : (min * 2);
                const suggestedReorder = Math.max(0, targetStock - currentStock);
                const price = Number(p.pricePerUnit || 0);
                const estimatedCost = suggestedReorder * price;
                const isOutOfStock = currentStock <= 0;
                const stockPercent = min > 0 ? Math.round((currentStock / min) * 100) : 0;
                const deficit = min - currentStock;

                return {
                    product: p,
                    currentStock,
                    minStock: min,
                    maxStock: max,
                    suggestedReorder,
                    estimatedCost,
                    isOutOfStock,
                    stockPercent,
                    deficit
                };
            })
            // Sort: 0 stock items first, then lowest stock ratio, then highest budget needed
            .sort((a, b) => {
                if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
                if (a.stockPercent !== b.stockPercent) return a.stockPercent - b.stockPercent;
                return b.estimatedCost - a.estimatedCost;
            });

        const outOfStockCount = allUrgent.filter(i => i.isOutOfStock).length;
        const lowStockCount = allUrgent.filter(i => !i.isOutOfStock).length;
        const totalEstimatedBudget = allUrgent.reduce((sum, i) => sum + i.estimatedCost, 0);

        // Apply tab filter & search
        let filtered = allUrgent;
        if (urgentFilter === 'out_of_stock') {
            filtered = filtered.filter(i => i.isOutOfStock);
        } else if (urgentFilter === 'low_stock') {
            filtered = filtered.filter(i => !i.isOutOfStock);
        }

        if (urgentSearch.trim()) {
            const q = urgentSearch.toLowerCase();
            filtered = filtered.filter(i => 
                i.product.name.toLowerCase().includes(q) || 
                (i.product.zone || '').toLowerCase().includes(q)
            );
        }

        return {
            allUrgent,
            filtered,
            outOfStockCount,
            lowStockCount,
            totalEstimatedBudget
        };
    }, [products, inventory, urgentFilter, urgentSearch]);

    // Initial load skeleton placeholder (prevents jarring full-screen wipeout)
    if (isLoading && products.length === 0) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-1/3"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                    <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                </div>
                <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
            </div>
        );
    }

    const urgentItemsToDisplay = showAllUrgent 
        ? urgentPurchaseData.filtered 
        : urgentPurchaseData.filtered.slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Top Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">ภาพรวมระบบ</h2>
                        {isRefreshing && (
                            <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                                กำลังอัปเดตข้อมูลเบื้องหลัง...
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        แสดงข้อมูลสรุปการเบิกจ่าย เวชภัณฑ์ยอดนิยม และรายการที่ควรรีบจัดซื้อ
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Fiscal Year & Time Range Selector - Defaults to latest fiscal year */}
                    <div className="relative w-full sm:w-auto">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="w-full sm:w-auto py-2 pl-3 pr-8 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                        >
                            <option value="FY_LATEST">
                                📅 ปีงบประมาณ {latestFiscalYear} (ล่าสุด)
                            </option>
                            {availableFiscalYears.filter(y => y !== latestFiscalYear).map(y => (
                                <option key={y} value={`FY_${y}`}>
                                    📅 ปีงบประมาณ {y}
                                </option>
                            ))}
                            <option disabled>──────────</option>
                            <option value="1M">1 เดือนล่าสุด</option>
                            <option value="3M">3 เดือนล่าสุด</option>
                            <option value="6M">6 เดือนล่าสุด</option>
                            <option value="1Y">1 ปีล่าสุด</option>
                            <option value="ALL">ทั้งหมด (ทุกช่วงเวลา)</option>
                        </select>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อเวชภัณฑ์..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                        />
                        <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <button
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
                        title="รีเฟรชข้อมูลล่าสุด"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI Cards (Always reflect selected period/fiscal year) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-sky-500 to-indigo-600 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                    <h3 className="font-semibold text-sky-100 flex items-center gap-2 mb-2 text-sm">
                        <CurrencyDollarIcon className="w-5 h-5" /> มูลค่าการเบิกจ่าย ({timeRangeLabel})
                    </h3>
                    <p className="text-3xl font-black tracking-tight">
                        {formatNumber(stats.totalCostThisPeriod)} <span className="text-lg font-normal text-sky-100">บาท</span>
                    </p>
                </div>

                <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                    <h3 className="font-semibold text-rose-100 flex items-center gap-2 mb-2 text-sm">
                        <ChartBarIcon className="w-5 h-5" /> จำนวนรายการเบิกทั้งหมด ({timeRangeLabel})
                    </h3>
                    <p className="text-3xl font-black tracking-tight">
                        {requisitions.filter(r => ['Ready', 'PartiallyApproved', 'Completed', 'Picking'].includes(r.status)).length.toLocaleString()} <span className="text-lg font-normal text-rose-100">บิล</span>
                    </p>
                </div>
            </div>

            {/* NEW SECTION: รายการที่ควรรีบจัดซื้อ (ใช้ข้อมูล Min / Max Stock) */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                            <ShoppingCartIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                    รายการที่ควรรีบจัดซื้อ
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                    {urgentPurchaseData.allUrgent.length} รายการ
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                วิเคราะห์จากสต็อกคงเหลือปัจจุบันในคลังกลางที่ต่ำกว่าเกณฑ์ขั้นต่ำ (Min Stock) เพื่อวางแผนจัดซื้อเติมเต็มให้ถึงเกณฑ์สูงสุด (Max Stock)
                            </p>
                        </div>
                    </div>

                    {/* Quick Metric Badges & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-bold border border-red-200 dark:border-red-800">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                            หมดคลัง: {urgentPurchaseData.outOfStockCount} รายการ
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800">
                            ต่ำกว่า Min: {urgentPurchaseData.lowStockCount} รายการ
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                            งบจัดซื้อโดยประมาณ: {formatNumber(urgentPurchaseData.totalEstimatedBudget)} ฿
                        </div>

                        {onNavigate && user.role === 'Admin' && (
                            <button
                                onClick={() => onNavigate({ type: 'admin', payload: 'purchaseOrder' })}
                                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
                            >
                                <ShoppingCartIcon className="w-3.5 h-3.5" />
                                <span>เปิดหน้าจัดซื้อ (PO)</span>
                            </button>
                        )}
                        {onNavigate && user.role === 'Admin' && (
                            <button
                                onClick={() => onNavigate({ type: 'admin', payload: 'manageStockLevels' })}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-all"
                            >
                                <span>ปรับเกณฑ์ Min/Max</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Sub-Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-2">
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <button
                            onClick={() => setUrgentFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                urgentFilter === 'all'
                                    ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            ทั้งหมด ({urgentPurchaseData.allUrgent.length})
                        </button>
                        <button
                            onClick={() => setUrgentFilter('out_of_stock')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                urgentFilter === 'out_of_stock'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                            }`}
                        >
                            เฉพาะของหมด ({urgentPurchaseData.outOfStockCount})
                        </button>
                        <button
                            onClick={() => setUrgentFilter('low_stock')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                urgentFilter === 'low_stock'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                        >
                            เฉพาะสต็อกต่ำ ({urgentPurchaseData.lowStockCount})
                        </button>
                    </div>

                    <div className="relative w-full sm:w-56">
                        <input
                            type="text"
                            placeholder="ค้นหารายการที่ต้องจัดซื้อ..."
                            value={urgentSearch}
                            onChange={(e) => setUrgentSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Urgent Items Table */}
                <div className="overflow-x-auto mt-2 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="min-w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-3 w-12 text-center">ลำดับ</th>
                                <th className="p-3">รายการเวชภัณฑ์</th>
                                <th className="p-3 text-center w-28">สถานะสต็อก</th>
                                <th className="p-3 text-center w-28">คงคลัง / Min</th>
                                <th className="p-3 text-center w-24">Max Stock</th>
                                <th className="p-3 text-right w-32">แนะนำสั่งซื้อ</th>
                                <th className="p-3 text-right w-36">ประมาณการงบประมาณ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {urgentItemsToDisplay.map((item, idx) => (
                                <tr key={item.product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                                    <td className="p-3 text-center font-bold text-slate-400">
                                        {idx + 1}
                                    </td>
                                    <td className="p-3">
                                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                                            {item.product.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                            <span>หน่วย: {item.product.unit}</span>
                                            {item.product.zone && <span>• โซน: {item.product.zone}</span>}
                                            {item.product.pricePerUnit && <span>• ราคา/หน่วย: {item.product.pricePerUnit.toLocaleString()} ฿</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {item.isOutOfStock ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                                                🚨 ของหมดคลัง
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                ⚠️ ต่ำกว่า Min (-{item.deficit})
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="font-bold">
                                            <span className={item.isOutOfStock ? 'text-red-600 dark:text-red-400 text-sm font-black' : 'text-amber-600 dark:text-amber-400'}>
                                                {item.currentStock.toLocaleString()}
                                            </span>
                                            <span className="text-slate-400 font-normal"> / {item.minStock.toLocaleString()}</span>
                                        </div>
                                        <div className="w-20 mx-auto bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${item.isOutOfStock ? 'bg-red-500 w-0' : 'bg-amber-500'}`}
                                                style={{ width: `${Math.min(100, item.stockPercent)}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-3 text-center text-slate-600 dark:text-slate-300 font-medium">
                                        {item.maxStock !== null ? item.maxStock.toLocaleString() : '-'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="font-black text-sky-600 dark:text-sky-400 text-sm">
                                            +{item.suggestedReorder.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium">
                                            {item.product.unit} (เติมถึง Max)
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">
                                            {item.estimatedCost > 0 ? `${formatNumber(item.estimatedCost)} ฿` : '-'}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {urgentItemsToDisplay.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <CubeIcon className="w-10 h-10 text-emerald-500 mb-2" />
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                ยอดเยี่ยม! ไม่มีเวชภัณฑ์ใดที่สต็อกต่ำกว่าเกณฑ์ Min
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                สต็อกเวชภัณฑ์ทุกรายการมีปริมาณเพียงพอและอยู่เหนือระดับเกณฑ์ความปลอดภัย
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Show All / Collapse Toggle */}
                {urgentPurchaseData.filtered.length > 5 && (
                    <div className="pt-3 text-center border-t border-slate-100 dark:border-slate-700 mt-3">
                        <button
                            type="button"
                            onClick={() => setShowAllUrgent(!showAllUrgent)}
                            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 hover:underline px-4 py-1.5"
                        >
                            {showAllUrgent 
                                ? '▲ ย่อแสดงเพียง 5 รายการ' 
                                : `▼ ดูรายการที่ต้องรีบจัดซื้อทั้งหมด (${urgentPurchaseData.filtered.length} รายการ)`}
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom 4 Analytics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-sky-500" />
                        5 อันดับ รายการที่เบิกบ่อยที่สุด ({timeRangeLabel})
                    </h3>
                    <div className="space-y-3">
                        {stats.topFrequent.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.product?.name}</div>
                                </div>
                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.count} <span className="font-normal text-slate-500">ครั้ง</span></div>
                            </div>
                        ))}
                        {stats.topFrequent.length === 0 && <p className="text-center text-slate-500 py-4">ไม่มีข้อมูลในช่วงเวลานี้</p>}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <CurrencyDollarIcon className="w-5 h-5 text-emerald-500" />
                        5 อันดับ เวชภัณฑ์มูลค่าสูง (เบิกเยอะสุด) ({timeRangeLabel})
                    </h3>
                    <div className="space-y-3">
                        {stats.topValue.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.product?.name}</div>
                                </div>
                                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(item.value)} <span className="font-normal text-slate-500">บาท</span></div>
                            </div>
                        ))}
                        {stats.topValue.length === 0 && <p className="text-center text-slate-500 py-4">ไม่มีข้อมูลในช่วงเวลานี้</p>}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                        รายการที่มีปริมาณเบิกสูง (ควรเฝ้าระวัง) ({timeRangeLabel})
                    </h3>
                    <div className="space-y-3">
                        {stats.topQuantityWatch.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.product?.name}</div>
                                </div>
                                <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{item.qty.toLocaleString()} <span className="font-normal text-slate-500">{item.product?.unit}</span></div>
                            </div>
                        ))}
                        {stats.topQuantityWatch.length === 0 && <p className="text-center text-slate-500 py-4">ไม่มีข้อมูลในช่วงเวลานี้</p>}
                    </div>
                </div>

                {user.role !== 'Department' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <BuildingOfficeIcon className="w-5 h-5 text-purple-500" />
                        การเบิกนอกยอด/ไม่ตรงรอบ (บ่อยที่สุด) ({timeRangeLabel})
                    </h3>
                    <div className="space-y-3">
                        {stats.topOffCycle.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.dept?.name}</div>
                                </div>
                                <div className="text-sm font-bold text-purple-600 dark:text-purple-400">{item.count} <span className="font-normal text-slate-500">บิล</span></div>
                            </div>
                        ))}
                        {stats.topOffCycle.length === 0 && <p className="text-center text-slate-500 py-4">ไม่มีการเบิกนอกยอดในช่วงเวลานี้</p>}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};
