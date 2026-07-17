
import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'กำลังโหลดข้อมูลระบบ...' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress increments to make it feel "alive"
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev; // Stay at 95 until data actually finishes
        const increment = Math.floor(Math.random() * 5) + 1;
        return Math.min(prev + increment, 95);
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 transition-colors duration-500">
      <div className="w-full max-w-sm space-y-6">
        {/* Loading Text and Percentage */}
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              Loading
              <span className="inline-block animate-pulse">....</span>
            </h2>
          </div>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
            {progress}%
          </span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full h-10 bg-white dark:bg-slate-800 border-4 border-slate-800 dark:border-slate-700 rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
          <div 
            className="h-full bg-slate-800 dark:bg-sky-500 transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>

        {/* Status Message */}
        <p className="text-center text-slate-500 dark:text-slate-400 font-medium animate-pulse">
          {message}
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
