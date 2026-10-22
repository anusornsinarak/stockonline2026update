import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Requisition, Product, Department, InventoryItem, AppView, requisitionStatusMap } from '../types';
import { supabaseService } from '../services/supabaseService';
import { getApprovedItemQuantity, getFiscalYearBE, getFiscalYearDateRange } from '../utils';
import ChartBarIcon from './icons/ChartBarIcon';
import CurrencyDollarIcon from './icons/CurrencyDollarIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import ShoppingCartIcon from './icons/ShoppingCartIcon';
import CubeIcon from './icons/CubeIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import ClipboardDocumentListIcon from './icons/ClipboardDocumentListIcon';
import MagnifyingGlassIcon from './icons/MagnifyingGlassIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import InboxIcon from './icons/InboxIcon';
import EyeIcon from './icons/EyeIcon';
import Modal from './Modal';
import StockAdjustmentModal from './admin/StockAdjustmentModal';

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

    // Requisition list filter & search within dashboard overview
    const [reqSearch, setReqSearch] = useState('');
    const [reqStatusFilter, setReqStatusFilter] = useState<'all' | 'pending' | 'completed' | 'other'>('all');
    const [showAllReqs, setShowAllReqs] = useState(false);
    const [selectedReqForModal, setSelectedReqForModal] = useState<Requisition | null>(null);

    // Quick stock adjustment state
    const [adjustingStockItem, setAdjustingStockItem] = useState<{ product: Product; currentStock: number } | null>(null);

    const handleNavigateToRequisitions = () => {
        if (!onNavigate) return;
        if (user.role === 'Admin') {
            onNavigate({ type: 'admin', payload: 'requisitions' });
        } else if (user.role === 'Warehouse') {
            onNavigate({ type: 'warehouse', payload: 'requisitions' });
        } else if (user.role === 'Department') {
            onNavigate({ type: 'department', payload: 'requisition' });
        }
    };

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

    // Auto-refresh in background when a requisition or notification is received
    useEffect(() => {
        const handleBackgroundRefresh = () => {
            loadData(false);
        };
        window.addEventListener('app-data-refresh', handleBackgroundRefresh);
        return () => window.removeEventListener('app-data-refresh', handleBackgroundRefresh);
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

    const fiscalYearCounts = useMemo(() => {
        const counts: Record<number, number> = {};
        allRequisitions.forEach(r => {
            const dateVal = r.approvedAt || r.submittedAt || r.createdAt;
            if (dateVal) {
                const fy = getFiscalYearBE(new Date(dateVal));
                counts[fy] = (counts[fy] || 0) + 1;
            }
        });
        return counts;
    }, [allRequisitions]);

    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val || 0);

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

    const dashboardRequisitionsList = useMemo(() => {
        return requisitions.filter(r => {
            const matchesSearch = !reqSearch.trim() || 
                r.requisitionNumber?.toLowerCase().includes(reqSearch.toLowerCase()) ||
                r.name?.toLowerCase().includes(reqSearch.toLowerCase()) ||
                departmentMap.get(r.departmentId)?.toLowerCase().includes(reqSearch.toLowerCase()) ||
                r.requesterName?.toLowerCase().includes(reqSearch.toLowerCase());
            
            let matchesStatus = true;
            if (reqStatusFilter === 'pending') {
                matchesStatus = ['Submitted', 'Picking', 'Ready', 'PartiallyApproved', 'Draft'].includes(r.status);
            } else if (reqStatusFilter === 'completed') {
                matchesStatus = r.status === 'Completed';
            } else if (reqStatusFilter === 'other') {
                matchesStatus = ['Rejected', 'Cancelled'].includes(r.status);
            }

            return matchesSearch && matchesStatus;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [requisitions, reqSearch, reqStatusFilter, departmentMap]);

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

    // Items with negative stock (currentStock < 0)
    const negativeStockItems = useMemo(() => {
        const invMap = new Map(inventory.map(i => [i.productId, i.quantity]));
        return products
            .map(p => ({ product: p, currentStock: invMap.get(p.id) ?? 0 }))
            .filter(item => item.currentStock < 0);
    }, [products, inventory]);

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
                                📅 ปีงบประมาณ {latestFiscalYear} (ล่าสุด) - {fiscalYearCounts[latestFiscalYear] || 0} รายการ
                            </option>
                            {availableFiscalYears.filter(y => y !== latestFiscalYear).map(y => (
                                <option key={y} value={`FY_${y}`}>
                                    📅 ปีงบประมาณ {y} - {fiscalYearCounts[y] || 0} รายการ
                                </option>
                            ))}
                            <option disabled>──────────</option>
                            <option value="1M">1 เดือนล่าสุด</option>
                            <option value="3M">3 เดือนล่าสุด</option>
                            <option value="6M">6 เดือนล่าสุด</option>
                            <option value="1Y">1 ปีล่าสุด</option>
                            <option value="ALL">ทั้งหมด (ทุกปีงบประมาณ) - {allRequisitions.length} รายการ</option>
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

                <div 
                    onClick={() => {
                        const el = document.getElementById('recent-requisitions-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-gradient-to-br from-rose-500 to-pink-600 p-6 rounded-2xl text-white shadow-md relative overflow-hidden cursor-pointer hover:shadow-xl transition-all group"
                    title="คลิกเพื่อเลื่อนไปดูตารางรายการเบิก"
                >
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform"></div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-rose-100 flex items-center gap-2 text-sm">
                            <ChartBarIcon className="w-5 h-5" /> จำนวนรายการเบิกทั้งหมด ({timeRangeLabel})
                        </h3>
                        <span className="text-[10px] font-bold bg-white/20 group-hover:bg-white/30 px-2.5 py-1 rounded-full text-white backdrop-blur-sm transition-all flex items-center gap-1">
                            ดูตารางใบเบิก ↓
                        </span>
                    </div>
                    <p className="text-3xl font-black tracking-tight">
                        {requisitions.filter(r => ['Ready', 'PartiallyApproved', 'Completed', 'Picking'].includes(r.status)).length.toLocaleString()} <span className="text-lg font-normal text-rose-100">บิล</span>
                    </p>
                </div>
            </div>

            {/* Negative Stock Alert Banner */}
            {negativeStockItems.length > 0 && (
                <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-red-400 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-inner">
                            <ExclamationTriangleIcon className="w-7 h-7 text-yellow-300 animate-bounce" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-base tracking-wide">
                                    แจ้งเตือนสต็อกติดลบ!
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white text-red-700 shadow-sm">
                                    {negativeStockItems.length} รายการ
                                </span>
                            </div>
                            <p className="text-xs text-red-100 mt-0.5">
                                พบรายการสินค้าสต็อกติดลบ {negativeStockItems.length} รายการ ต้องการปรับสต็อกให้เป็นปัจจุบันหรือไม่?
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => setAdjustingStockItem({ product: negativeStockItems[0].product, currentStock: negativeStockItems[0].currentStock })}
                            className="px-4 py-2 bg-white hover:bg-red-50 text-red-700 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            <span>ปรับสต็อกรายการแรก ({negativeStockItems[0].product.name.slice(0, 22)}...)</span>
                        </button>
                        {onNavigate && user.role === 'Admin' && (
                            <button
                                type="button"
                                onClick={() => onNavigate({ type: 'admin', payload: 'inventory' })}
                                className="px-4 py-2 bg-red-900/60 hover:bg-red-900 text-white font-bold text-xs rounded-xl transition-all"
                            >
                                <span>ดูในคลังสินค้า</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

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
                                        {item.currentStock < 0 ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className="text-red-600 dark:text-red-400 text-sm font-black tracking-tight">
                                                        {item.currentStock.toLocaleString()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAdjustingStockItem({ product: item.product, currentStock: item.currentStock })}
                                                        className="px-2 py-0.5 text-[10px] font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-md shadow transition-all cursor-pointer"
                                                        title="คลิกเพื่อปรับสต็อกให้เป็นปัจจุบันทันที"
                                                    >
                                                        ปรับสต็อก
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-normal">Min: {item.minStock.toLocaleString()}</div>
                                            </div>
                                        ) : (
                                            <div className="font-bold">
                                                <span className={item.isOutOfStock ? 'text-red-600 dark:text-red-400 text-sm font-black' : 'text-amber-600 dark:text-amber-400'}>
                                                    {item.currentStock.toLocaleString()}
                                                </span>
                                                <span className="text-slate-400 font-normal"> / {item.minStock.toLocaleString()}</span>
                                            </div>
                                        )}
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

            {/* REQUISITION LIST SECTION (รายการใบเบิกเวชภัณฑ์) */}
            <div id="recent-requisitions-section" className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                            <ClipboardDocumentListIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                    รายการใบเบิกเวชภัณฑ์
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                    {dashboardRequisitionsList.length} รายการ
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                รายการใบเบิกเวชภัณฑ์ทั้งหมดที่บันทึกในระบบ ({timeRangeLabel}) สามารถคลิกดูรายละเอียดหรือติดตามสถานะได้ทันที
                            </p>
                        </div>
                    </div>

                    {/* Quick navigation to full module */}
                    {onNavigate && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleNavigateToRequisitions}
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                            >
                                <ClipboardDocumentListIcon className="w-4 h-4" />
                                <span>เปิดหน้าระบบเบิกเต็มรูปแบบ →</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Sub-Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setReqStatusFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                reqStatusFilter === 'all'
                                    ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            ทั้งหมด ({requisitions.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setReqStatusFilter('pending')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                reqStatusFilter === 'pending'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                        >
                            รอดำเนินการ / จัดของ ({requisitions.filter(r => ['Submitted', 'Picking', 'Ready', 'PartiallyApproved', 'Draft'].includes(r.status)).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setReqStatusFilter('completed')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                reqStatusFilter === 'completed'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                        >
                            รับของแล้ว ({requisitions.filter(r => r.status === 'Completed').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setReqStatusFilter('other')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                reqStatusFilter === 'other'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                            }`}
                        >
                            ไม่อนุมัติ / ยกเลิก ({requisitions.filter(r => ['Rejected', 'Cancelled'].includes(r.status)).length})
                        </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="ค้นหาเลขที่, ชื่อใบเบิก, หน่วยงาน..."
                            value={reqSearch}
                            onChange={(e) => setReqSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        {reqSearch && (
                            <button
                                type="button"
                                onClick={() => setReqSearch('')}
                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter info banner if search or status filter active */}
                {(reqSearch.trim() !== '' || reqStatusFilter !== 'all') && (
                    <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800 rounded-lg text-xs text-sky-800 dark:text-sky-200">
                        <span>🔍 ผลการกรอง: พบ {dashboardRequisitionsList.length} จาก {requisitions.length} รายการ</span>
                        <button
                            type="button"
                            onClick={() => { setReqSearch(''); setReqStatusFilter('all'); }}
                            className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                        >
                            ล้างตัวกรอง
                        </button>
                    </div>
                )}

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto mt-2 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="min-w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-3 w-28">เลขที่ใบเบิก</th>
                                <th className="p-3">ชื่อใบเบิก / หน่วยงาน</th>
                                <th className="p-3 text-center w-28">วันที่ขอเบิก</th>
                                <th className="p-3 text-right w-28">มูลค่าที่ขอ</th>
                                <th className="p-3 text-right w-28">มูลค่าอนุมัติ</th>
                                <th className="p-3 text-center w-36">สถานะ</th>
                                <th className="p-3 text-center w-24">รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {(showAllReqs ? dashboardRequisitionsList : dashboardRequisitionsList.slice(0, 5)).map(req => {
                                const statusConfig = requisitionStatusMap[req.status] || { text: 'N/A', color: 'bg-gray-100 text-gray-800' };
                                let requestedValue = 0;
                                let approvedValue = 0;
                                (req.items || []).forEach(item => {
                                    const product = productMap.get(item.productId);
                                    const price = item.pricePerUnit ?? product?.pricePerUnit ?? 0;
                                    requestedValue += (item.quantity * price);
                                    const showApproved = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
                                    const qty = (showApproved && item.status !== 'Backordered') ? (item.approvedQuantity || 0) : 0;
                                    approvedValue += (qty * price);
                                });
                                const canShowApprovedVal = ['Picking', 'Ready', 'Completed', 'PartiallyApproved'].includes(req.status);

                                return (
                                    <tr 
                                        key={req.id} 
                                        onClick={() => setSelectedReqForModal(req)}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors cursor-pointer group"
                                    >
                                        <td className="p-3 font-bold text-slate-700 dark:text-slate-200">
                                            {req.requisitionNumber || '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
                                                {req.name}
                                            </div>
                                            <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                                                {departmentMap.get(req.departmentId) || 'ไม่ระบุหน่วยงาน'}
                                                {req.requesterName && <span className="text-slate-400 ml-1.5">• ผู้ขอ: {req.requesterName}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                        </td>
                                        <td className="p-3 text-right text-slate-500 dark:text-slate-400">
                                            {formatCurrency(requestedValue)}
                                        </td>
                                        <td className="p-3 text-right font-black text-sky-600 dark:text-sky-400">
                                            {canShowApprovedVal ? formatCurrency(approvedValue) : '-'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${statusConfig.color}`}>
                                                {statusConfig.warehouseText || statusConfig.text}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center" onClick={(e) => { e.stopPropagation(); setSelectedReqForModal(req); }}>
                                            <button 
                                                type="button"
                                                className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-800 transition-colors inline-flex items-center justify-center"
                                                title="ดูรายละเอียดใบเบิก"
                                            >
                                                <EyeIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {dashboardRequisitionsList.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <InboxIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                ไม่พบรายการใบเบิกตามเงื่อนไขที่เลือก
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {reqSearch.trim() || reqStatusFilter !== 'all'
                                                    ? 'ลองเปลี่ยนหรือล้างคำค้นหา/ตัวกรองสถานะ'
                                                    : `ยังไม่มีรายการใบเบิกในช่วง ${timeRangeLabel}`}
                                            </p>
                                            {(reqSearch.trim() || reqStatusFilter !== 'all') && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setReqSearch(''); setReqStatusFilter('all'); }}
                                                    className="mt-3 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all"
                                                >
                                                    ล้างตัวกรองทั้งหมด
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl mt-2 overflow-hidden">
                    {(showAllReqs ? dashboardRequisitionsList : dashboardRequisitionsList.slice(0, 5)).map(req => {
                        const statusConfig = requisitionStatusMap[req.status] || { text: 'N/A', color: 'bg-gray-100 text-gray-800' };
                        let requestedValue = 0;
                        let approvedValue = 0;
                        (req.items || []).forEach(item => {
                            const product = productMap.get(item.productId);
                            const price = item.pricePerUnit ?? product?.pricePerUnit ?? 0;
                            requestedValue += (item.quantity * price);
                            const showApproved = ['Picking', 'PartiallyApproved', 'Ready', 'Completed'].includes(req.status);
                            const qty = (showApproved && item.status !== 'Backordered') ? (item.approvedQuantity || 0) : 0;
                            approvedValue += (qty * price);
                        });
                        const canShowApprovedVal = ['Picking', 'Ready', 'Completed', 'PartiallyApproved'].includes(req.status);

                        return (
                            <div 
                                key={req.id} 
                                onClick={() => setSelectedReqForModal(req)}
                                className="p-3.5 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400">
                                            #{req.requisitionNumber || 'ไม่มีเลขที่'} • {req.createdAt ? new Date(req.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                        </div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mt-0.5">
                                            {req.name}
                                        </div>
                                        <div className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                                            {departmentMap.get(req.departmentId) || 'ไม่ระบุหน่วยงาน'}
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-sm flex-shrink-0 ${statusConfig.color}`}>
                                        {statusConfig.warehouseText || statusConfig.text}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-slate-50 dark:border-slate-700/60 text-xs">
                                    <span className="text-slate-400 text-[11px]">
                                        มูลค่าขอ: {formatCurrency(requestedValue)}
                                    </span>
                                    {canShowApprovedVal && (
                                        <span className="font-bold text-sky-600 dark:text-sky-400">
                                            อนุมัติ: {formatCurrency(approvedValue)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {dashboardRequisitionsList.length === 0 && (
                        <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                            <InboxIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="font-bold text-sm">ไม่พบรายการใบเบิกตามเงื่อนไข</p>
                        </div>
                    )}
                </div>

                {/* Show All / Collapse Toggle */}
                {dashboardRequisitionsList.length > 5 && (
                    <div className="pt-3 text-center border-t border-slate-100 dark:border-slate-700 mt-3 flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => setShowAllReqs(!showAllReqs)}
                            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 hover:underline px-4 py-1.5"
                        >
                            {showAllReqs 
                                ? '▲ ย่อแสดงเพียง 5 รายการ' 
                                : `▼ ดูรายการใบเบิกทั้งหมด (${dashboardRequisitionsList.length} รายการ)`}
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

            {/* Requisition Details Modal */}
            {selectedReqForModal && (
                <Modal isOpen={!!selectedReqForModal} onClose={() => setSelectedReqForModal(null)} title="รายละเอียดใบเบิกเวชภัณฑ์" size="3xl">
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-slate-700 pb-4">
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    เลขที่: {selectedReqForModal.requisitionNumber || 'ไม่มีเลขที่ (Draft)'}
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                    {selectedReqForModal.name}
                                </h3>
                                <p className="text-sm text-sky-600 font-semibold">
                                    หน่วยงาน: {departmentMap.get(selectedReqForModal.departmentId) || 'ไม่ระบุหน่วยงาน'}
                                    {selectedReqForModal.requesterName && <span className="text-slate-500 font-normal ml-2">• ผู้ขอเบิก: {selectedReqForModal.requesterName}</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${requisitionStatusMap[selectedReqForModal.status]?.color || 'bg-gray-100'}`}>
                                    {requisitionStatusMap[selectedReqForModal.status]?.warehouseText || requisitionStatusMap[selectedReqForModal.status]?.text}
                                </span>
                            </div>
                        </div>

                        {(selectedReqForModal.status === 'Rejected' || selectedReqForModal.status === 'Cancelled') && selectedReqForModal.rejectionReason && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                <p className="text-xs font-bold text-red-800 dark:text-red-300 mb-1">
                                    เหตุผลที่{selectedReqForModal.status === 'Rejected' ? 'ไม่อนุมัติ' : 'ยกเลิก'}:
                                </p>
                                <p className="text-sm text-red-700 dark:text-red-400">
                                    {selectedReqForModal.rejectionReason}
                                </p>
                            </div>
                        )}

                        <div className="overflow-x-auto border dark:border-slate-700 rounded-xl">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300">
                                    <tr>
                                        <th className="p-3 text-left font-bold">ลำดับ</th>
                                        <th className="p-3 text-left font-bold">รายการเวชภัณฑ์</th>
                                        <th className="p-3 text-center font-bold w-20">ขอเบิก</th>
                                        <th className="p-3 text-center font-bold w-20">อนุมัติ</th>
                                        <th className="p-3 text-right font-bold w-28">ราคา/หน่วย</th>
                                        <th className="p-3 text-right font-bold w-32">มูลค่ารวม</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {(selectedReqForModal.items || []).map((item, idx) => {
                                        const product = productMap.get(item.productId);
                                        const price = item.pricePerUnit || product?.pricePerUnit || 0;
                                        const showApproved = ['Picking', 'Ready', 'Completed', 'PartiallyApproved'].includes(selectedReqForModal.status);
                                        const approvedQty = showApproved ? (item.approvedQuantity || 0) : 0;
                                        const itemTotal = showApproved ? (approvedQty * price) : (item.quantity * price);

                                        return (
                                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                                <td className="p-3 text-slate-400 font-medium">{idx + 1}</td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{product?.name || item.productId}</div>
                                                    <div className="text-[11px] text-slate-400">หน่วย: {product?.unit || '-'}</div>
                                                </td>
                                                <td className="p-3 text-center font-medium">{item.quantity}</td>
                                                <td className="p-3 text-center font-bold text-sky-600">{showApproved ? approvedQty : '-'}</td>
                                                <td className="p-3 text-right text-slate-500">{formatCurrency(price)}</td>
                                                <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(itemTotal)}</td>
                                            </tr>
                                        );
                                    })}
                                    {(selectedReqForModal.items || []).length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-6 text-center text-slate-400">
                                                ไม่มีรายการเวชภัณฑ์ในใบเบิกนี้
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                            {onNavigate && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedReqForModal(null);
                                        handleNavigateToRequisitions();
                                    }}
                                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                                >
                                    <span>ไปยังระบบจัดการใบเบิกเพื่อจัดการต่อ →</span>
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={() => setSelectedReqForModal(null)} 
                                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Quick Stock Adjustment Modal */}
            {adjustingStockItem && (
                <StockAdjustmentModal
                    isOpen={!!adjustingStockItem}
                    onClose={() => setAdjustingStockItem(null)}
                    product={adjustingStockItem.product}
                    currentStock={adjustingStockItem.currentStock}
                    onSuccess={() => {
                        setAdjustingStockItem(null);
                        loadData(true);
                    }}
                />
            )}
        </div>
    );
};
