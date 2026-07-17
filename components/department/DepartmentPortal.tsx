
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Department, DocumentSettings, PurchasePlanItem, SurveyEntry, User, Personnel } from '../../types';
import RequisitionDashboard from '../RequisitionDashboard';
import SurveyForm from '../SurveyForm';
import ClipboardDocumentListIcon from '../icons/ClipboardDocumentListIcon';
import DocumentTextIcon from '../icons/DocumentTextIcon';
import { supabaseService } from '../../services/supabaseService';
import ArchiveBoxIcon from '../icons/ArchiveBoxIcon';
import DepartmentInventoryView from './DepartmentInventoryView';
import MegaphoneIcon from '../icons/MegaphoneIcon';
import AccountSettingsPortal from '../AccountSettingsPortal';
import ArchiveBoxArrowDownIcon from '../icons/ArchiveBoxArrowDownIcon';
import Modal from '../Modal';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import { DepartmentBackorderView } from './DepartmentBackorderView';
import DepartmentUsageScanner from './DepartmentUsageScanner';
import DepartmentReportView from './DepartmentReportView';
import QrCodeIcon from '../icons/QrCodeIcon';
import DocumentChartBarIcon from '../icons/DocumentChartBarIcon';
import LoadingScreen from '../LoadingScreen';
import Bars3Icon from '../icons/Bars3Icon';
import XMarkIcon from '../icons/XMarkIcon';

type Tab = 'requisition' | 'survey' | 'inventory' | 'backorders' | 'settings' | 'usage_scanner' | 'report';

interface DepartmentPortalProps {
    user: User;
    department: Department;
    isSurveyOpen: boolean;
    isSurveyForce?: boolean;
    surveyTitle: string;
    isRequisitionOpen: boolean;
    initialTab?: Tab;
    documentSettings: DocumentSettings | null;
    nextFiscalYearBE: number;
    stopAlert: () => void;
    onDataChange: () => void;
}

export const DepartmentPortal: React.FC<DepartmentPortalProps> = ({
    user,
    department,
    isSurveyOpen,
    isSurveyForce,
    surveyTitle,
    isRequisitionOpen,
    initialTab,
    documentSettings,
    nextFiscalYearBE,
    stopAlert,
    onDataChange,
}) => {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'requisition');
    const [purchasePlan, setPurchasePlan] = useState<PurchasePlanItem[]>([]);
    const [allSurveyResults, setAllSurveyResults] = useState<SurveyEntry[]>([]);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [isLoadingTabData, setIsLoadingTabData] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const lastProcessedInitialTabRef = useRef<string | null>(null);

    const fetchCommonData = useCallback(async () => {
        setIsLoadingTabData(true);
        try {
            const [plan, results, pers] = await Promise.all([
                supabaseService.getPurchasePlan(nextFiscalYearBE),
                supabaseService.getSurveySubmissions(nextFiscalYearBE),
                supabaseService.getPersonnel(),
            ]);
            setPurchasePlan(plan);
            setAllSurveyResults(results);
            setPersonnel(pers);
        } catch (error) {
            console.error("Failed to fetch department portal data:", error);
        } finally {
            setIsLoadingTabData(false);
        }
    }, [nextFiscalYearBE]);

    const hasSubmittedSurvey = allSurveyResults.some(r => r.departmentId === department.id);
    const isLocked = isSurveyForce && !hasSubmittedSurvey && !isLoadingTabData;
    const [showLockModal, setShowLockModal] = useState(false);
    const [hasAcknowledgedLock, setHasAcknowledgedLock] = useState(false);

    useEffect(() => {
        if (isLocked && activeTab !== 'survey' && !hasAcknowledgedLock) {
            setShowLockModal(true);
        } else if (!isLocked) {
            setShowLockModal(false);
        }
    }, [isLocked, activeTab, hasAcknowledgedLock]);

    const handleAcknowledgeLock = () => {
        setShowLockModal(false);
        setHasAcknowledgedLock(true);
        setActiveTab('survey');
    };

    useEffect(() => {
        fetchCommonData();
    }, [fetchCommonData]);

    useEffect(() => {
        if (initialTab && initialTab !== lastProcessedInitialTabRef.current) {
            setActiveTab(initialTab);
            lastProcessedInitialTabRef.current = initialTab;
        }
    }, [initialTab]);

    const handleTabClick = (tab: Tab) => {
        if (isLocked && tab !== 'survey' && tab !== 'inventory') {
            alert('กรุณาทำแบบสำรวจความต้องการใช้งานประจำปีงบประมาณให้เสร็จสิ้นก่อนใช้งานเมนูอื่น');
            return;
        }
        if (tab === 'requisition') {
            stopAlert();
        }
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    const TABS: { key: Tab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
        { key: 'requisition', label: 'เบิกเวชภัณฑ์', icon: <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />, disabled: isLocked },
        { key: 'survey', label: 'แบบสำรวจ', icon: <DocumentTextIcon className="w-5 h-5 mr-2" /> },
        { key: 'inventory', label: 'คลังของฉัน', icon: <ArchiveBoxIcon className="w-5 h-5 mr-2" /> },
        { key: 'usage_scanner', label: 'สแกนใช้ของ', icon: <QrCodeIcon className="w-5 h-5 mr-2" />, disabled: isLocked },
        { key: 'backorders', label: 'ค้างจ่าย/ยืม', icon: <ArchiveBoxArrowDownIcon className="w-5 h-5 mr-2" />, disabled: isLocked },
        { key: 'report', label: 'รายงานการเบิก', icon: <DocumentChartBarIcon className="w-5 h-5 mr-2" />, disabled: isLocked },
        { key: 'settings', label: 'ตั้งค่าการแจ้งเตือน', icon: <MegaphoneIcon className="w-5 h-5 mr-2" />, disabled: isLocked },
    ];
    
    const renderContent = () => {
        switch (activeTab) {
            case 'requisition':
                return (
                    <RequisitionDashboard 
                        department={department} 
                        isRequisitionOpen={isRequisitionOpen} 
                        documentSettings={documentSettings} 
                        personnel={personnel} 
                        onNavigateToSettings={() => handleTabClick('settings')}
                        nextFiscalYearBE={nextFiscalYearBE}
                    />
                );
            case 'survey':
                return <SurveyForm department={department} isSurveyOpen={isSurveyOpen} title={surveyTitle} purchasePlan={purchasePlan} allSurveyResults={allSurveyResults} />;
            case 'inventory':
                return <DepartmentInventoryView department={department} />;
            case 'usage_scanner':
                return <DepartmentUsageScanner department={department} />;
            case 'report':
                return <DepartmentReportView department={department} />;
            case 'backorders':
                return <DepartmentBackorderView department={department} />;
            case 'settings':
                return <AccountSettingsPortal user={user} />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto relative">
            <Modal isOpen={showLockModal} onClose={() => {}} title="แจ้งเตือนการบังคับสำรวจความต้องการใช้งาน" size="md">
                <div className="p-4">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl flex-shrink-0">
                            <ExclamationTriangleIcon className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">ระบบถูกระงับการใช้งานชั่วคราว</h3>
                        </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                        กรุณาดำเนินการสำรวจความต้องการเวชภัณฑ์มิใช่ยาประจำปีงบประมาณ {nextFiscalYearBE} ให้แล้วเสร็จ และกดยืนยันส่งข้อมูล 
                        เพื่อให้สามารถใช้งานระบบเบิกเวชภัณฑ์ได้ตามปกติ
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={handleAcknowledgeLock}
                            className="px-6 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                        >
                            รับทราบ และไปหน้าสำรวจ
                        </button>
                    </div>
                </div>
            </Modal>

            {isLocked && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 mb-6 rounded-r-lg shadow-sm">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <DocumentTextIcon className="h-5 w-5 text-rose-400" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-rose-800">
                                ระงับการใช้งานชั่วคราว
                            </h3>
                            <div className="mt-2 text-sm text-rose-700">
                                <p>
                                    กรุณาดำเนินการตามขั้นตอนต่อไปนี้ เพื่อปลดล็อคการใช้งานระบบ:
                                </p>
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                    <li>ไปที่แท็บ <strong>แบบสำรวจ</strong> เพื่อกรอกและส่งแบบสำรวจความต้องการใช้งานสำหรับปีงบประมาณ {nextFiscalYearBE} ให้เสร็จสมบูรณ์</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Menu Header */}
            <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm mb-4 border border-slate-200 dark:border-slate-700 no-print">
                <div className="flex items-center font-medium text-slate-800 dark:text-slate-200">
                    {TABS.find(t => t.key === activeTab)?.icon}
                    <span className="ml-2">{TABS.find(t => t.key === activeTab)?.label}</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                    {isMobileMenuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 right-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden no-print">
                    <nav className="flex flex-col">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => handleTabClick(tab.key)}
                                disabled={tab.disabled}
                                className={`${
                                    activeTab === tab.key
                                    ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-l-4 border-sky-500'
                                    : tab.disabled 
                                        ? 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed border-l-4 border-transparent'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-transparent'
                                } flex items-center w-full px-4 py-3 text-left font-medium text-sm transition-colors`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.disabled && <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">ล็อค</span>}
                            </button>
                        ))}
                    </nav>
                </div>
            )}

            {/* Desktop Tabs */}
            <div className="hidden md:block border-b border-slate-200 dark:border-slate-700 mb-6 no-print">
                <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                    {TABS.map(tab => (
                         <button
                            key={tab.key}
                            onClick={() => handleTabClick(tab.key)}
                            disabled={tab.disabled}
                            className={`${
                                activeTab === tab.key
                                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                                : tab.disabled
                                    ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors relative`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.disabled && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">ล็อค</span>}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="mt-6">
                {isLoadingTabData ? <LoadingScreen message="กำลังโหลดข้อมูล..." /> : renderContent()}
            </div>
        </div>
    );
};
