import React from 'react';

const QrCodeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M3.75 4.5A.75.75 0 014.5 3.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5zM3.75 15A.75.75 0 014.5 14.25h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5zM15 3.75A.75.75 0 0014.25 3h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 00.75.75h4.5a.75.75 0 00.75-.75v-4.5zM19.5 19.5a.75.75 0 01-.75-.75v-4.5a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-.75zM15 14.25h.75a.75.75 0 01.75.75v.75a.75.75 0 01-1.5 0V15a.75.75 0 01.75-.75zM19.5 9h.75a.75.75 0 01.75.75v.75a.75.75 0 01-1.5 0V9.75a.75.75 0 01.75-.75z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5h.75m.75 0h.75m1.5 0h.75m1.5 0h.75m1.5 0h.75m.75 0h.75m-3.75-3.75h.75m.75 0h.75" />
  </svg>
);

export default QrCodeIcon;