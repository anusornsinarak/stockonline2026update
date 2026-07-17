
import React, { useState, useEffect } from 'react';
import LoginScreen from './LoginScreen';
import RegistrationScreen from './RegistrationScreen';
import DocumentTextIcon from './icons/DocumentTextIcon';
import PublicProductScannerModal from './PublicProductScannerModal';
import PublicProductSearchModal from './PublicProductSearchModal';
import { supabaseService } from '../services/supabaseService';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';

interface AuthPortalProps {
    appTitle: string;
    appSubtitle: string;
}

const AuthPortal: React.FC<AuthPortalProps> = ({ appTitle, appSubtitle }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [announcement, setAnnouncement] = useState<{ content: string; enabled: boolean } | null>(null);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

    useEffect(() => {
        const fetchAnnouncement = async () => {
            try {
                const settings = await supabaseService.getAnnouncementSettings();
                if (settings && settings.enabled) {
                    // ตรวจสอบว่าวันนี้ผู้ใช้สั่งปิดประกาศไปแล้วหรือยัง
                    const todayStr = new Date().toISOString().split('T')[0];
                    const lastDismissedDate = localStorage.getItem('announcement_dismissed_date');
                    
                    if (lastDismissedDate !== todayStr) {
                        setAnnouncement(settings);
                        setShowAnnouncementModal(true);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch announcement:", error);
            }
        };
        fetchAnnouncement();
    }, []);

    const handleDismissAnnouncement = (dontShowAgain: boolean) => {
        if (dontShowAgain) {
            const todayStr = new Date().toISOString().split('T')[0];
            localStorage.setItem('announcement_dismissed_date', todayStr);
        }
        setShowAnnouncementModal(false);
    };

    return (
        <div className="flex-grow w-full grid grid-cols-1 md:grid-cols-2 relative h-screen overflow-hidden">
            {/* Announcement Full Screen Modal */}
            {announcement && showAnnouncementModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 no-print">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in"
                        onClick={() => handleDismissAnnouncement(false)}
                    ></div>
                    
                    {/* Modal Content */}
                    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in border border-white/20">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-5 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <SpeakerWaveIcon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-bold">ประกาศข่าวสารระบบ</h3>
                            </div>
                            <button 
                                onClick={() => handleDismissAnnouncement(false)}
                                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto flex-grow bg-slate-50/50 dark:bg-slate-900/30">
                            <div 
                                className="prose prose-sky dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: announcement.content }}
                            />
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button
                                onClick={() => handleDismissAnnouncement(true)}
                                className="text-sm font-semibold text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 transition-colors flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                                ไม่ต้องแสดงประกาศนี้อีกในวันนี้
                            </button>
                            <button
                                onClick={() => handleDismissAnnouncement(false)}
                                className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-10 rounded-2xl shadow-lg shadow-sky-500/30 transition-all active:scale-95"
                            >
                                ตกลง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Branding Panel */}
            <div className="hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600 p-12 text-white text-center relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0 100 C 20 0 50 0 100 100 Z" fill="currentColor" />
                    </svg>
                </div>
                
                <div className="relative z-10">
                    <DocumentTextIcon className="w-24 h-24 mb-6 mx-auto drop-shadow-lg" />
                    <h1 className="text-4xl font-bold leading-tight drop-shadow-md">
                        {appTitle}
                    </h1>
                    <p className="mt-4 text-lg text-sky-100 max-w-md mx-auto">
                        {appSubtitle}
                    </p>
                </div>
            </div>

            {/* Form Panel */}
            <div className="flex flex-col justify-center items-center p-4 sm:p-8 bg-slate-100 dark:bg-slate-900 overflow-y-auto">
                {isRegistering ? (
                    <RegistrationScreen onSwitchToLogin={() => setIsRegistering(false)} />
                ) : (
                    <LoginScreen 
                        onSwitchToRegister={() => setIsRegistering(true)} 
                        onScanClick={() => setIsScannerOpen(true)} 
                        onSearchClick={() => setIsSearchModalOpen(true)}
                    />
                )}
            </div>

            {/* Modals */}
            {isScannerOpen && (
                <PublicProductScannerModal onClose={() => setIsScannerOpen(false)} />
            )}

            {isSearchModalOpen && (
                <PublicProductSearchModal onClose={() => setIsSearchModalOpen(false)} />
            )}

        </div>
    );
};

export default AuthPortal;
