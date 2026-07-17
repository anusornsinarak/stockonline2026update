

import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'fullscreen';
  wrapperClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', wrapperClassName }) => {
  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    'fullscreen': 'w-screen h-screen max-w-none max-h-none rounded-none',
  };

  return (
    <div
      // FIX: Corrected typo 'fullscreen' to 'fullscreen' to ensure correct styling.
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center ${size === 'fullscreen' ? '' : 'p-4'} ${wrapperClassName || ''}`}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-800 shadow-xl w-full ${sizeClasses[size]} ${size === 'fullscreen' ? 'flex flex-col' : 'rounded-2xl flex flex-col max-h-[95vh] md:max-h-[90vh]'} animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: '0.3s' }}
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={`p-4 md:p-6 ${size === 'fullscreen' ? 'flex-grow overflow-y-auto' : 'overflow-y-auto'}`}>
            {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;