
import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import { PublicChatMessage, User } from '../types';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import UserIcon from './icons/UserIcon';
import RefreshIcon from './icons/RefreshIcon';
import TrashIcon from './icons/TrashIcon';

interface PublicChatProps {
    user: User | null;
}

const PublicChat: React.FC<PublicChatProps> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [tempDisplayName, setTempDisplayName] = useState('');
    const [messages, setMessages] = useState<PublicChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [hasUnread, setHasUnread] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processedMsgIds = useRef<Set<number>>(new Set());
    const isOpenRef = useRef(isOpen);

    // Sync ref for callback usage
    useEffect(() => {
        isOpenRef.current = isOpen;
        if (isOpen) {
            setHasUnread(false);
            setTimeout(() => scrollToBottom(true), 50);
        }
    }, [isOpen]);

    const scrollToBottom = (instant = false) => {
        messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
    };

    // ฟังก์ชันปลดล็อคเสียง (ต้องเรียกจาก User Interaction)
    const initAudio = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    // เพิ่ม Global Listener เพื่อปลดล็อคเสียงจากการคลิกครั้งแรกของผู้ใช้
    useEffect(() => {
        const unlock = () => {
            initAudio();
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('touchstart', unlock);
        return () => {
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
        };
    }, [initAudio]);

    const playNotificationSound = useCallback(() => {
        const ctx = audioContextRef.current;
        if (!ctx || ctx.state === 'suspended') return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            oscillator.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.1); // A5
            
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio playback error", e);
        }
    }, []);

    useEffect(() => {
        if (user) {
            setDisplayName(user.username);
        } else {
            const savedName = sessionStorage.getItem('publicChatDisplayName');
            if (savedName) setDisplayName(savedName);
        }
    }, [user]);
    
    const handleRefresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const freshMessages = await supabaseService.getPublicChatMessages();
            setMessages(freshMessages);
            processedMsgIds.current = new Set(freshMessages.map(m => m.id));
        } catch (err) {
            console.error(err);
            setError('ไม่สามารถโหลดข้อความได้');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        handleRefresh();

        const channel = supabase.channel('public-chat-room')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'public_chat_messages' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const raw = payload.new;
                        if (processedMsgIds.current.has(raw.id)) return;
                        processedMsgIds.current.add(raw.id);

                        const newMsg: PublicChatMessage = {
                            id: raw.id,
                            createdAt: new Date(raw.created_at),
                            username: raw.username,
                            message: raw.message,
                            userId: raw.user_id
                        };

                        setMessages(prev => [...prev, newMsg]);
                        
                        // ถ้ายูทเซอร์ไม่ได้เปิดแชทอยู่ ให้แจ้งเตือน
                        if (!isOpenRef.current) {
                            setHasUnread(true);
                            playNotificationSound();
                        }
                    } else if (payload.eventType === 'DELETE') {
                        // ดึง ID จาก payload.old (ในบางกรณีอาจอยู่ในที่อื่น)
                        const deletedId = payload.old?.id || (payload as any).errors?.[0]?.message?.match(/\d+/)?.[0];
                        if (deletedId) {
                            const idNum = parseInt(deletedId, 10);
                            setMessages(prev => prev.filter(m => m.id !== idNum));
                            processedMsgIds.current.delete(idNum);
                        } else {
                            // ถ้าหา ID ไม่ได้จริงๆ ให้รีเฟรชรายการทั้งหมด
                            handleRefresh();
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [handleRefresh, playNotificationSound]);

    const toggleChat = () => {
        initAudio();
        setIsOpen(prev => !prev);
    };

    const handleSetDisplayName = (e: FormEvent) => {
        e.preventDefault();
        if (tempDisplayName.trim()) {
            initAudio();
            sessionStorage.setItem('publicChatDisplayName', tempDisplayName.trim());
            setDisplayName(tempDisplayName.trim());
        }
    };

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !displayName || isSending) return;

        setIsSending(true);
        const msgText = newMessage;
        setNewMessage('');
        
        try {
            await supabaseService.sendPublicChatMessage(user, displayName, msgText);
            scrollToBottom();
        } catch (err) {
            setError('ส่งไม่สำเร็จ');
            setNewMessage(msgText);
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (id: number) => {
        if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อความนี้?')) return;
        
        // Optimistic update: ลบออกจากหน้าจอทันทีเพื่อความรวดเร็ว
        setMessages(prev => prev.filter(m => m.id !== id));
        processedMsgIds.current.delete(id);

        try {
            await supabaseService.deletePublicChatMessage(id);
        } catch (err) {
            alert('ลบข้อความไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'Unknown error'));
            handleRefresh(); // รีโหลดข้อมูลกลับมาถ้าลบไม่สำเร็จจริงๆ
        }
    };

    return (
        <>
            {/* Chat Floating Button */}
             <button
                onClick={toggleChat}
                className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-sky-600 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:bg-sky-700 transition-all z-50 no-print hover:scale-110 active:scale-95 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
                aria-label="แชท"
            >
                <span className="text-sm font-black uppercase tracking-tighter transform -rotate-12">Chat</span>
                {hasUnread && (
                    <span className="absolute top-0 right-0 flex h-6 w-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500 border-2 border-white shadow-sm"></span>
                    </span>
                )}
            </button>

            {/* Chat Overlay */}
            {isOpen && (
                <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-[380px] h-[550px] max-h-[80vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden animate-fade-in origin-bottom-right">
                    {!displayName ? (
                        <div className="flex flex-col justify-center items-center h-full p-8 text-center bg-slate-50 dark:bg-slate-900">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">ยินดีต้อนรับสู่ห้องแชท</h3>
                            <p className="text-sm text-slate-500 mb-6">กรุณาระบุชื่อที่ต้องการใช้แสดงในห้องแชท</p>
                            <form onSubmit={handleSetDisplayName} className="w-full space-y-4">
                                <input
                                    type="text"
                                    value={tempDisplayName}
                                    onChange={(e) => setTempDisplayName(e.target.value)}
                                    className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    placeholder="ชื่อของคุณ..."
                                    maxLength={20}
                                    required
                                />
                                <button type="submit" className="w-full bg-sky-600 text-white font-bold py-4 rounded-2xl hover:bg-sky-700 shadow-lg shadow-sky-500/20 transition-all active:scale-95">
                                    เริ่มพูดคุย
                                </button>
                            </form>
                            <button onClick={toggleChat} className="mt-6 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">ปิดหน้าต่าง</button>
                        </div>
                    ) : (
                        <>
                            <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                                <div>
                                     <h3 className="font-bold text-slate-800 dark:text-slate-100">ห้องแชทกลาง</h3>
                                     <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                        ออนไลน์: {displayName}
                                     </p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={handleRefresh} className="p-2 text-slate-400 hover:text-sky-600 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all">
                                        <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button onClick={toggleChat} className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </header>

                            <div className="flex-grow p-4 overflow-y-auto bg-slate-50 dark:bg-slate-900/20 space-y-4">
                                {messages.map(msg => {
                                    const isMe = msg.username === displayName;
                                    const canDelete = (user?.role === 'Admin') || (user && msg.userId === user.id) || (!user && isMe);

                                    return (
                                        <div key={msg.id} className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''} animate-fade-in`}>
                                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-[10px] shadow-sm ${isMe ? 'bg-sky-600' : 'bg-slate-400'}`}>
                                                {msg.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : ''}`}>
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{msg.username}</span>
                                                    <span className="text-[9px] text-slate-400">{new Date(msg.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {canDelete && (
                                                        <button 
                                                            onClick={() => handleDeleteMessage(msg.id)} 
                                                            className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                                                            title="ลบข้อความ"
                                                        >
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className={`p-3 rounded-2xl text-sm shadow-sm border ${isMe ? 'bg-sky-600 text-white border-sky-500 rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-100 dark:border-slate-700 rounded-tl-none'}`}>
                                                    <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700">
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="flex-grow p-3 bg-slate-100 dark:bg-slate-700 border-none rounded-2xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                        placeholder="เขียนข้อความ..."
                                        disabled={isSending}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || isSending}
                                        className="bg-sky-600 text-white p-3 rounded-2xl hover:bg-sky-700 disabled:bg-slate-300 disabled:shadow-none transition-all shadow-lg shadow-sky-500/20 active:scale-90 flex-shrink-0"
                                    >
                                        <PaperAirplaneIcon className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default PublicChat;
