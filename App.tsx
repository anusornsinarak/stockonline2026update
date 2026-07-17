
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { User, Department, AppNotification, AppView, DocumentSettings } from './types';
import { AdminDashboard } from './components/AdminDashboard';
import Header from './components/Header';
import { supabaseService } from './services/supabaseService';
import { supabase } from './supabaseClient';
import type { Session, RealtimeChannel } from '@supabase/supabase-js';
import { DepartmentPortal } from './components/department/DepartmentPortal';
import WarehousePortal from './WarehousePortal';
import AuthPortal from './components/AuthPortal';
import MainDashboard from './MainDashboard';
import { LoanSystemView } from './components/admin/LoanSystemView';
import LineContact from './components/LineContact';
import BottomNavBar from './components/BottomNavBar';
import LoadingScreen from './components/LoadingScreen';
import { getFiscalYearBE } from './utils';
import SatisfactionSurveyModal from './components/SatisfactionSurveyModal';
import LineCallback from './components/LineCallback';
import { AuthContext } from './contexts/AuthContext';
import InstallPWA from './components/shared/InstallPWA';

const AlertBanner: React.FC<{ message: string; onMute: () => void; }> = ({ message, onMute }) => {
    return (
        // CHANGE: Moved from top to bottom (bottom-24) to keep header area clear.
        // Reduced z-index to 90 so Header (z-100) is always on top.
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md z-[90] animate-fade-in no-print pointer-events-none px-4">
            <div className="bg-yellow-400 text-yellow-900 px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between border-2 border-yellow-500 pointer-events-auto">
                <div className="flex items-center">
                    <span className="font-bold text-sm">{message}</span>
                </div>
                <button 
                    type="button"
                    onClick={onMute} 
                    className="ml-4 text-xs font-black bg-yellow-900/10 hover:bg-yellow-900/20 p-2 rounded-lg transition-colors uppercase tracking-tighter"
                >
                    ปิด
                </button>
            </div>
        </div>
    );
};

const appSubtitle = "สำหรับหน่วยงานภายในโรงพยาบาลและ รพ.สต.";

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [fySettings, setFySettings] = useState({ fy_survey_open: false, fy_survey_force: false, fy_survey_year: 2570, fy_previous_year: 2569 });
  const [isRequisitionOpen] = useState(true);
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings | null>(null);

  const fetchFySettings = useCallback(async () => {
    try {
        const settings = await supabaseService.getFySurveySettings();
        setFySettings(settings);
    } catch (e) {
        console.error("Failed to fetch FY settings", e);
    }
  }, []);

  useEffect(() => {
    fetchFySettings();
  }, [fetchFySettings]);
  const [activeView, setActiveView] = useState<AppView>({ type: 'dashboard' });
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const lastFetchedNotificationId = useRef<number | null>(null);

  const currentFiscalYearBE = useMemo(() => getFiscalYearBE(new Date()), []);
  const planningFiscalYearBE = 2569;
  const appTitle = `ระบบเบิกเวชภัณฑ์มิใช่ยา ปีงบประมาณ ${planningFiscalYearBE}`;

  const fetchNotifications = useCallback(async (isSilent = false) => {
      if (!user?.id) return;
      try {
          const notifs = await supabaseService.getNotifications(user.id);
          const newestUnread = notifs.find(n => !n.isRead);
          if (newestUnread && newestUnread.id !== lastFetchedNotificationId.current && !isSilent) {
              lastFetchedNotificationId.current = newestUnread.id;
              setAlertMessage(newestUnread.message);
              if (audioRef.current) {
                  audioRef.current.play().catch(() => {});
              }
              if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("แจ้งเตือนระบบเบิกเวชภัณฑ์", { body: newestUnread.message });
              }
          }
          setNotifications(notifs);
      } catch (e) {
          console.error("Failed to fetch notifications", e);
      }
  }, [user?.id]);

  const fetchDocumentSettings = useCallback(async () => {
      try {
          const settings = await supabaseService.getDocumentSettings();
          setDocumentSettings(settings);
      } catch (e) {
          console.error("Failed to fetch document settings", e);
      }
  }, []);

  useEffect(() => {
    fetchDocumentSettings();
  }, [fetchDocumentSettings]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
           if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
               supabaseService.getUserProfile(session.user.id).then(u => {
                   setUser(prev => (prev && prev.id === u?.id && prev.role === u?.role) ? prev : u);
                   if(u?.departmentId) supabaseService.getDepartments().then(ds => {
                       const found = ds.find(d => d.id === u.departmentId) || null;
                       setDepartment(prev => (prev && prev.id === found?.id) ? prev : found);
                   });
               });
           }
      } else {
        setUser(null);
        setDepartment(null);
        setNotifications([]);
      }
      setIsLoading(false);
    });
    
    supabase.auth.getSession().then(({ data: { session }}) => {
        setSession(session);
         if (session?.user) {
           supabaseService.getUserProfile(session.user.id).then(u => {
               setUser(prev => (prev && prev.id === u?.id && prev.role === u?.role) ? prev : u);
               if(u?.departmentId) supabaseService.getDepartments().then(ds => {
                   const found = ds.find(d => d.id === u.departmentId) || null;
                   setDepartment(prev => (prev && prev.id === found?.id) ? prev : found);
               });
           });
      }
        setIsLoading(false);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
      if (user?.id) {
          fetchNotifications(true);
          const interval = setInterval(() => {
              fetchNotifications();
          }, 60000);
          return () => clearInterval(interval);
      }
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
      if (!user?.id) {
          if (activeChannelRef.current) {
              supabase.removeChannel(activeChannelRef.current);
              activeChannelRef.current = null;
          }
          return;
      }

      if (activeChannelRef.current) {
          supabase.removeChannel(activeChannelRef.current);
      }

      const channel = supabase.channel(`notifications-user-${user.id}`)
          .on('postgres_changes', { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'notifications', 
              filter: `recipient_id=eq.${user.id}` 
          },
          (payload) => {
              fetchNotifications();
          }
          ).subscribe();

      activeChannelRef.current = channel;
      return () => { 
          if (activeChannelRef.current) supabase.removeChannel(activeChannelRef.current); 
      };
  }, [user?.id, fetchNotifications]);
  
  const handleThemeToggle = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    window.dispatchEvent(new Event('themeChanged'));
  };

  const handleLogout = async () => {
    try {
        setAlertMessage(null);
        await supabase.auth.signOut();
        // Clear session to ensure UI refreshes immediately
        setSession(null);
        setUser(null);
    } catch (e) {
        console.error("Logout failed", e);
    }
  };

  const renderContent = () => {
    if (user?.role === 'Borrower') {
        return <LoanSystemView departments={[]} allProducts={[]} currentUser={user} isPublicMode={true} />;
    }
    if (activeView.type === 'dashboard') return <MainDashboard user={user!} onNavigate={setActiveView} />;
    if (user?.role === 'Admin' && activeView.type === 'admin') {
      return <AdminDashboard 
                user={user} 
                isSurveyManuallyOpen={fySettings.fy_survey_open}
                isSurveyAutoOpen={false}
                onToggleSurvey={() => {}}
                isRequisitionOpen={isRequisitionOpen}
                onToggleRequisition={() => {}}
                onDataChange={() => {
                    fetchNotifications(true);
                    fetchFySettings();
                }}
                onSettingsChange={fetchDocumentSettings}
                initialTab={activeView.payload}
                documentSettings={documentSettings}
                currentFiscalYearBE={currentFiscalYearBE}
                nextFiscalYearBE={fySettings.fy_survey_year}
                stopAlert={() => setAlertMessage(null)}
             />;
    }
    if (user?.role === 'Department' && department && activeView.type === 'department') {
      return <DepartmentPortal 
                user={user}
                department={department}
                isSurveyOpen={fySettings.fy_survey_open}
                isSurveyForce={fySettings.fy_survey_force}
                surveyTitle={`แบบสำรวจความต้องการเวชภัณฑ์มิใช่ยา ประจำปีงบประมาณ ${fySettings.fy_survey_year}`}
                isRequisitionOpen={isRequisitionOpen}
                initialTab={activeView.payload}
                documentSettings={documentSettings}
                nextFiscalYearBE={fySettings.fy_survey_year}
                stopAlert={() => setAlertMessage(null)}
                onDataChange={() => fetchNotifications(true)}
             />;
    }
    if (user?.role === 'Warehouse' && activeView.type === 'warehouse') {
        return <WarehousePortal user={user} nextFiscalYearBE={fySettings.fy_survey_year} initialTab={activeView.payload} stopAlert={() => setAlertMessage(null)} />;
    }
    return <MainDashboard user={user!} onNavigate={setActiveView} />;
  };
  
  const getHeaderTitle = () => {
    if (user?.role === 'Borrower') return 'ระบบยืม-คืนสินค้า';
    if (activeView.type === 'dashboard') return 'แดชบอร์ด';
    if (user?.role === 'Admin') return 'ผู้ดูแลระบบ';
    if (user?.role === 'Department') return 'หน่วยงาน';
    if (user?.role === 'Warehouse') return 'คลังเวชภัณฑ์';
    return 'ระบบเบิกเวชภัณฑ์';
  }

  const markRead = async (id: number) => {
      try {
          await supabaseService.markNotificationAsRead(id);
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
      if (!user?.id) return;
      try {
          await supabaseService.markAllNotificationsAsRead(user.id);
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      } catch (e) { console.error(e); }
  };

  if (isLoading) return <LoadingScreen message="กำลังเริ่มต้นระบบ..." />;

  return (
    <AuthContext.Provider value={{ user }}>
      <div className="flex flex-col min-h-screen">
        <Routes>
          <Route path="/line-callback" element={<LineCallback />} />
          <Route path="*" element={
            !session || !user ? (
              <AuthPortal appTitle={appTitle} appSubtitle={appSubtitle} />
            ) : (
              <>
                <Header
                  user={user}
                  onLogout={handleLogout}
                  title={getHeaderTitle()}
                  notifications={notifications}
                  onMarkAsRead={markRead}
                  onMarkAllAsRead={markAllRead}
                  onNotificationAction={() => setAlertMessage(null)}
                  showBackButton={activeView.type !== 'dashboard'}
                  onBack={() => setActiveView({ type: 'dashboard' })}
                  theme={localStorage.getItem('theme') as 'light' | 'dark' || 'light'}
                  onToggleTheme={handleThemeToggle}
                />
                {alertMessage && <AlertBanner message={alertMessage} onMute={() => setAlertMessage(null)} />}
                <main className="flex-grow w-full px-2 sm:px-4 pb-20 md:pb-4">
                   {renderContent()}
                </main>
                <SatisfactionSurveyModal user={user} onComplete={() => {}} />
                <BottomNavBar user={user} activeView={activeView} onNavigate={setActiveView} />
              </>
            )
          } />
        </Routes>
        <LineContact />
        <InstallPWA />
        <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" className="hidden"></audio>
      </div>
    </AuthContext.Provider>
  );
};

export default App;
