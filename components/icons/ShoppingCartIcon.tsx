
import React from 'react';

const ShoppingCartIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l1.823-6.836a.75.75 0 00-.54-.92l-1.636-.453a.75.75 0 00-.92.54l-1.823 6.836H6.75M7.5 14.25h11.218"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 21a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm12.75 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

export default ShoppingCartIcon;
