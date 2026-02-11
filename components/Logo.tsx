import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg 
    viewBox="0 0 40 40" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={`w-10 h-10 ${className}`}
  >
    <rect x="8" y="8" width="8" height="8" rx="2" className="fill-current" />
    <rect x="24" y="8" width="8" height="8" rx="2" className="fill-current" />
    <rect x="8" y="24" width="8" height="8" rx="2" className="fill-current" />
    <rect x="24" y="22" width="4" height="4" rx="1" className="fill-current opacity-60" />
    <rect x="26" y="28" width="6" height="6" rx="1.5" className="fill-current opacity-80" />
    <path d="M22 24H20V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
