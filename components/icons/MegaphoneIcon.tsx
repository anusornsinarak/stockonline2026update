import React from 'react';

const MegaphoneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M10.5 1.125a2.25 2.25 0 0 1 2.25 2.25v2.25a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 5.625v-2.25A2.25 2.25 0 0 1 4.5 1.125h6ZM10.5 1.125H3.375c-1.036 0-1.875.84-1.875 1.875v11.25c0 1.035.84 1.875 1.875 1.875h.375a3.75 3.75 0 0 1 3.75 3.75V22.5a.75.75 0 0 0 1.5 0v-2.25a3.75 3.75 0 0 1 3.75-3.75h.375c1.035 0 1.875-.84 1.875-1.875V3c0-1.036-.84-1.875-1.875-1.875H10.5Z"
    />
  </svg>
);

export default MegaphoneIcon;
