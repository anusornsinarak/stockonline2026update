

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
      className={`fixed print:absolute print:inset-0 inset-0 bg-black bg-opacity-50 print:bg-white z-50 flex justify-center items-center print:items-start print:justify-start print:p-0 ${size === 'fullscreen' ? '' : 'p-4'} ${wrapperClassName || ''}`}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-800 print:bg-transparent print:dark:bg-transparent shadow-xl print:shadow-none w-full print:w-full print:max-w-none print:max-h-none ${sizeClasses[size]} ${size === 'fullscreen' ? 'flex flex-col' : 'rounded-2xl print:rounded-none flex flex-col max-h-[95vh] md:max-h-[90vh] print:h-auto print:max-h-none'} animate-fade-in print:animate-none print:border-none print:m-0`}
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: '0.3s' }}
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b dark:border-slate-700 print:hidden">
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
        <div className={`p-4 md:p-6 print:p-0 print:block ${size === 'fullscreen' ? 'flex-grow overflow-y-auto print:overflow-visible' : 'overflow-y-auto print:overflow-visible'}`}>
            {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;