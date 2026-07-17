import React from 'react';
import ArrowDownOnSquareIcon from './icons/ArrowDownOnSquareIcon';

interface InstallPromptProps {
    onInstall: () => void;
    onDismiss: () => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onInstall, onDismiss }) => {
    return (
        <div 
            className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md bg-gradient-to-r from-sky-600 to-indigo-700 text-white p-4 z-[100] rounded-lg shadow-2xl animate-fade-in no-print"
            role="dialog"
            aria-labelledby="install-title"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <ArrowDownOnSquareIcon className="w-10 h-10 flex-shrink-0" />
                    <div>
                        <h4 id="install-title" className="font-bold">ติดตั้งแอพพลิเคชั่น</h4>
                        <p className="text-sm text-sky-100">ติดตั้งแอพนี้บนอุปกรณ์ของคุณเพื่อการเข้าถึงที่รวดเร็วและประสบการณ์ที่ดีที่สุด</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
                     <button 
                        onClick={onInstall} 
                        className="bg-white text-sky-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-100 transition-colors w-full sm:w-auto order-first sm:order-last"
                    >
                        ติดตั้ง
                    </button>
                    <button 
                        onClick={onDismiss} 
                        className="text-sm font-medium hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto"
                    >
                        ภายหลัง
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
