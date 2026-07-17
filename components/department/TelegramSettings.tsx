
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import CogIcon from '../icons/CogIcon';

const TelegramConnect: React.FC<{ user: User }> = ({ user }) => {
    const [botToken, setBotToken] = useState('');
    const [adminChatId, setAdminChatId] = useState('');
    
    // Notification Channels
    const [enableTelegram, setEnableTelegram] = useState(true);
    const [enableLine, setEnableLine] = useState(false);
    const [lineWebhookUrl, setLineWebhookUrl] = useState('');
    const [adminLineUserId, setAdminLineUserId] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            const settings = await supabaseService.getSystemSettings();
            if (settings) {
                setBotToken(settings.telegram_bot_token || '');
                setAdminChatId(settings.telegram_admin_chat_id || '');
                setLineWebhookUrl(settings.gas_webhook_url || '');
                setAdminLineUserId(settings.admin_line_user_id || '');
                
                // Load channel settings (default: TG=true, LINE=false)
                setEnableTelegram(settings.admin_channel_telegram !== false);
                setEnableLine(settings.admin_channel_line === true);
            }
        };
        load();
    }, []);

    const validateInput = () => {
        // Validate TG inputs only if TG is enabled
        if (enableTelegram && (!botToken.trim() || !adminChatId.trim())) {
            setStatus({ type: 'error', text: 'หากเปิดใช้งาน Telegram กรุณากรอก Token และ Chat ID ให้ครบถ้วน' });
            return false;
        }
        if (enableLine) {
             if (!lineWebhookUrl.trim()) {
                 setStatus({ type: 'error', text: 'หากเปิดใช้งาน LINE กรุณากรอก Webhook URL ให้ครบถ้วน' });
                 return false;
             }
             if (!adminLineUserId.trim()) {
                 setStatus({ type: 'error', text: 'หากเปิดใช้งาน LINE กรุณากรอก Admin LINE User ID ให้ครบถ้วน' });
                 return false;
             }
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateInput()) return;
        setIsSaving(true);
        try {
            await supabaseService.saveSystemSettings({
                telegram_bot_token: botToken.trim(),
                telegram_admin_chat_id: adminChatId.trim(),
                admin_channel_telegram: enableTelegram,
                admin_channel_line: enableLine,
                gas_webhook_url: lineWebhookUrl.trim(),
                admin_line_user_id: adminLineUserId.trim()
            });
            setStatus({ type: 'success', text: 'บันทึกการตั้งค่าแล้ว' });
        } catch (error) {
            setStatus({ type: 'error', text: 'บันทึกไม่สำเร็จ' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        if (!validateInput()) return;
        
        // Save first to be safe
        await handleSave();

        setIsSaving(true);
        try {
            const timeString = new Date().toLocaleTimeString('th-TH');
            const testMessage = `🔔 ทดสอบการแจ้งเตือน (${timeString})\n\nหากคุณเห็นข้อความนี้ แสดงว่าการตั้งค่าถูกต้องครับ ✅`;

            if (enableTelegram) {
                await supabaseService.sendTelegramNotification(
                    adminChatId.trim(), 
                    testMessage,
                    botToken.trim()
                );
            }

            if (enableLine) {
                // Call notifyAdmins to test the full flow including LINE logic logic in supabaseService
                await supabaseService.notifyAdmins(`ทดสอบระบบแจ้งเตือน Admin (${timeString})`, 'test', '🔔');
            }
            
            alert(`ระบบส่งคำสั่งทดสอบไปยังช่องทางที่เปิดใช้งานแล้ว\n\n- Telegram: ${enableTelegram ? 'ส่งแล้ว' : 'ปิดอยู่'}\n- LINE: ${enableLine ? 'ส่งแล้ว (ตรวจสอบข้อความใน LINE ของคุณ)' : 'ปิดอยู่'}`);
            
            setStatus({ type: 'success', text: 'ส่งคำสั่งทดสอบแล้ว' });
        } catch (error) { 
            console.error(error);
            setStatus({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งคำสั่ง (Network Error)' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Channel Selection */}
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <CogIcon className="w-5 h-5 text-slate-500" />
                    เลือกช่องทางการแจ้งเตือนสำหรับผู้ดูแลระบบ
                </h4>
                <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="bg-sky-100 p-1.5 rounded text-sky-600 font-bold text-xs">TG</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">แจ้งเตือนผ่าน Telegram</span>
                        </div>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={enableTelegram} onChange={e => setEnableTelegram(e.target.checked)} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sky-600"></div>
                        </div>
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-green-50 dark:hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="bg-green-100 p-1.5 rounded text-green-600 font-bold text-xs">LINE</span>
                            <div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">แจ้งเตือนผ่าน LINE</span>
                                <span className="text-[10px] text-slate-500">*ต้องตั้งค่า Webhook URL และ Admin LINE User ID ก่อน</span>
                            </div>
                        </div>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={enableLine} onChange={e => setEnableLine(e.target.checked)} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                        </div>
                    </label>
                </div>
            </div>

            {/* Telegram Config (Show only if enabled) */}
            {enableTelegram && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-sm">ตั้งค่า Telegram Bot</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        กรอก Token และ Chat ID เพื่อเปิดใช้งาน (สำหรับผู้ดูแลระบบ)
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Bot Token</label>
                            <input 
                                type="text" 
                                value={botToken}
                                onChange={(e) => setBotToken(e.target.value)}
                                placeholder="123456789:ABCdef..."
                                className="block w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Admin Chat ID / Group ID</label>
                            <input 
                                type="text" 
                                value={adminChatId}
                                onChange={(e) => setAdminChatId(e.target.value)}
                                placeholder="-100xxxxxxxx"
                                className="block w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* LINE Config (Show only if enabled) */}
            {enableLine && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-sm">ตั้งค่า LINE Bot (Edge Function)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        กรอก Endpoint URL ของ Supabase Edge Function ที่คุณได้ Deploy ไว้
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Webhook URL</label>
                            <input 
                                type="text" 
                                value={lineWebhookUrl}
                                onChange={(e) => setLineWebhookUrl(e.target.value)}
                                placeholder="https://xxxxxx.supabase.co/functions/v1/line-bot"
                                className="block w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Admin LINE User ID</label>
                            <input 
                                type="text" 
                                value={adminLineUserId}
                                onChange={(e) => setAdminLineUserId(e.target.value)}
                                placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                className="block w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                                *พิมพ์คำว่า "ไอดี" ส่งไปที่ LINE Bot ของคุณเพื่อรับ User ID นี้
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {status && (
                <div className={`p-3 rounded-lg text-sm font-bold ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {status.text}
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
                <button
                    onClick={handleTest}
                    disabled={isSaving}
                    className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                    ทดสอบส่งข้อความ
                </button>
            </div>
        </div>
    );
};

export default TelegramConnect;
