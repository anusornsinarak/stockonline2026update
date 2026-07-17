
import React, { useRef, useState, useEffect } from 'react';
import ChatBubbleIcon from './icons/ChatBubbleIcon';

const LineContact: React.FC = () => {
    const fabRef = useRef<HTMLAnchorElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const fabPos = useRef({ x: 0, y: 0 });
    const dragDistance = useRef(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const handleToggle = (e: any) => setIsVisible(e.detail);
        window.addEventListener('toggleLineContact', handleToggle);
        return () => window.removeEventListener('toggleLineContact', handleToggle);
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        dragDistance.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY };
        if (fabRef.current) {
            fabRef.current.setPointerCapture(e.pointerId);
            fabRef.current.style.transition = 'none';
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        dragDistance.current += Math.abs(dx) + Math.abs(dy);

        fabPos.current.x += dx;
        fabPos.current.y += dy;
        
        if (fabRef.current) {
            fabRef.current.style.transform = `translate(${fabPos.current.x}px, ${fabPos.current.y}px)`;
        }
        
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        if (fabRef.current) {
            fabRef.current.releasePointerCapture(e.pointerId);
            fabRef.current.style.transition = 'transform 0.2s';
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (dragDistance.current > 10) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6 no-print">
      <a
        ref={fabRef}
        href="https://line.me/ti/p/~anusorn_s1982"
        target="_blank"
        rel="noopener noreferrer"
        title="ติดต่อสอบถาม (LINE)"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className="flex flex-col items-center justify-center w-14 h-14 bg-[#06C755] text-white rounded-full shadow-xl hover:bg-[#05b34c] border-2 border-white/30 group touch-none"
      >
        <div className="flex flex-col items-center leading-tight pointer-events-none">
          <span className="text-[10px] font-black tracking-tighter uppercase">Add</span>
          <span className="text-[10px] font-black tracking-tighter uppercase">Line</span>
        </div>
      </a>
    </div>
  );
};

export default LineContact;
