import React from 'react';

const ChatBubbleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72.372a3.75 3.75 0 0 1-3.693-3.693l.372-3.72c.093-1.133.957-1.98 2.193-1.98H16.5c.969 0 1.813.615 2.097 1.5M15.25 8.511l-3.72-.372a3.75 3.75 0 0 0-3.693 3.693l-.372 3.72c-.093 1.133-.957 1.98-2.193 1.98H5.25c-1.136 0-2.1-.847-2.1-1.98V9.75c0-1.136.847-2.1 2.1-1.98l3.72.372a3.75 3.75 0 0 0 3.693-3.693l.372-3.72c.093-1.133.957-1.98 2.193-1.98H12.5c1.136 0 2.1.847 2.1 1.98v.283" 
    />
  </svg>
);

export default ChatBubbleIcon;
