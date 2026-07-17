
import React from 'react';

interface DashboardItemProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

const DashboardItem: React.FC<DashboardItemProps> = ({ label, icon, color, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center text-center p-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${color}`}
    >
      <div className="w-12 h-12 md:w-20 md:h-20 text-white flex items-center justify-center">
        {icon}
      </div>
      <p className="mt-2 text-white font-bold text-[10px] sm:text-xs md:text-base leading-tight">
        {label}
      </p>
    </button>
  );
};

export default DashboardItem;
