
import React from 'react';

const ClipboardDocumentCheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}>
    <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M10.125 2.25h-4.5c-1.125 0-2.25 1.125-2.25 2.25v13.5c0 1.125 1.125 2.25 2.25 2.25h9c1.125 0 2.25-1.125 2.25-2.25v-9.75M14.25 9l-3.75 3.75-1.5-1.5M12 9h.008v.008H12V9z" 
    />
    <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M18.75 2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V3.375c0-.621.504-1.125 1.125-1.125h9.75z" 
    />
</svg>
);

export default ClipboardDocumentCheckIcon;
