
import React, { useState, useEffect, useCallback } from 'react';
import { User, LineUserProfile } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../supabaseClient';
import UserIcon from '../icons/UserIcon';
import ChatBubbleIcon from '../icons/ChatBubbleIcon';
import ClipboardDocumentListIcon from '../icons/ClipboardDocumentListIcon';
import Modal from '../Modal';
import CogIcon from '../icons/CogIcon';
import ExclamationTriangleIcon from '../icons/ExclamationTriangleIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';

import { QRCodeSVG } from 'qrcode.react';

interface LineConnectProps {
    user: User;
    notificationOptions: { key: string; label: string }[];
}

// GAS Script Template
const GAS_SCRIPT_TEMPLATE = `// -----------------------------------------------------------------------------
// LINE Bot Webhook Script for Requisition System
// -----------------------------------------------------------------------------

const LINE_CHANNEL_ACCESS_TOKEN = 'ZFty2HbPkYgWJiZmmDIr3XVGKS/et6q/DZyPeEoQwQO4pn9ReDb1AfYp5CdG/4Rc0Wd3jlNvxqMdTOBbO4wH9Ysx7hR/PffDG1uFMMNQiLyONhMq54937yYqPb41KqFJph/4uHDk0ByRSKc+Mc8AAgdB04t89/1O/w1cDnyilFU=';
const SUPABASE_URL = 'https://olfabhkhyfibanhsxwpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ3NjA3MSwiZXhwIjoyMDcwMDUyMDcxfQ.31VrBHle1yIdxQ7l9eSQdblbYZkQanIFzCNEFvpAHq0';

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    
    // 1. ตรวจสอบว่าเป็นคำสั่งส่งแจ้งเตือนจาก Server หรือไม่ (Action: Notify)
    if (contents.action === 'notify') {
      if (contents.targetUserId && contents.message) {
        sendPushMessage(contents.targetUserId, contents.message);
        return ContentService.createTextOutput("Notification Sent");
      }
      return ContentService.createTextOutput("Missing Parameters");
    }

    // 2. จัดการ Event จาก LINE (Webhook)
    const event = contents.events[0];
    if (!event) return ContentService.createTextOutput("No Event");

    const lineUserId = event.source.userId;
    const replyToken = event.replyToken;

    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      
      // ตรวจสอบรูปแบบ "เชื่อมต่อ:รหัสผู้ใช้"
      if (text.startsWith('เชื่อมต่อ:')) {
        const userId = text.split(':')[1].trim();
        const user = findUserById(userId);
        
        if (user) {
          const department = findDepartmentById(user.department_id);
          const deptName = department ? department.name : 'ไม่ระบุหน่วยงาน';
          
          // บันทึกข้อมูลลง Supabase
          const success = linkLineUserToDepartment(lineUserId, userId, user.department_id, deptName);
          if (success) {
            replyMessage(replyToken, \`✅ เชื่อมต่อสำเร็จ!\\n\\nคุณได้ลงทะเบียนเข้ากับหน่วยงาน "\${deptName}" เรียบร้อยแล้ว\\n\\nระบบจะแจ้งเตือนคุณทันทีเมื่อใบเบิกมีการอัปเดตสถานะครับ\`);
          } else {
            replyMessage(replyToken, \`❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล\\nกรุณาลองใหม่อีกครั้งในภายหลังครับ\`);
          }
        } else {
          replyMessage(replyToken, \`❌ ไม่พบข้อมูลผู้ใช้งาน\\n\\nกรุณาตรวจสอบว่าคุณได้เข้าสู่ระบบผ่านหน้าเว็บแล้ว และลองกดปุ่มเชื่อมต่อใหม่อีกครั้งครับ\`);
        }
      } else {
        // ข้อความตอบกลับทั่วไป
        replyMessage(replyToken, \`สวัสดีครับ! หากต้องการรับแจ้งเตือนสถานะใบเบิก กรุณากดปุ่ม "เชื่อมต่อ LINE" จากในระบบเว็บครับ\`);
      }
    }

    return ContentService.createTextOutput("OK");
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput("Error: " + err.message);
  }
}

// --- ฟังก์ชันติดต่อ Supabase ---

function findUserById(userId) {
  const url = \`\${SUPABASE_URL}/rest/v1/users?id=eq.\${userId}&select=*\`;
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': \`Bearer \${SUPABASE_SERVICE_ROLE_KEY}\`
    },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return data.length > 0 ? data[0] : null;
}

function findDepartmentById(id) {
  if (!id) return null;
  const url = \`\${SUPABASE_URL}/rest/v1/departments?id=eq.\${id}&select=name\`;
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': \`Bearer \${SUPABASE_SERVICE_ROLE_KEY}\`
    },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return data.length > 0 ? data[0] : null;
}

function linkLineUserToDepartment(lineUserId, userId, departmentId, departmentName) {
  try {
    // ตรวจสอบว่ามีโปรไฟล์เดิมอยู่หรือไม่
    const checkUrl = \`\${SUPABASE_URL}/rest/v1/line_user_profiles?line_user_id=eq.\${lineUserId}\`;
    const options = {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': \`Bearer \${SUPABASE_SERVICE_ROLE_KEY}\` }
    };
    const response = UrlFetchApp.fetch(checkUrl, options);
    const existing = JSON.parse(response.getContentText());
    
    const profileData = {
      user_id: userId,
      line_user_id: lineUserId,
      display_name: 'LINE User', // สามารถดึงจาก LINE API เพิ่มเติมได้
      settings: { 
        department_id: departmentId, 
        department_name: departmentName, 
        notify_status_change: true 
      }
    };

    let method = 'post';
    let targetUrl = \`\${SUPABASE_URL}/rest/v1/line_user_profiles\`;

    if (existing.length > 0) {
      // ถ้ามีอยู่แล้วให้ Update (PATCH)
      method = 'patch';
      targetUrl = \`\${SUPABASE_URL}/rest/v1/line_user_profiles?line_user_id=eq.\${lineUserId}\`;
      // รวม settings เดิมกับใหม่
      profileData.settings = Object.assign({}, existing[0].settings || {}, profileData.settings);
    } else {
      // ถ้ายังไม่มีให้สร้างใหม่
      profileData.created_at = new Date().toISOString();
    }

    const upsertOptions = {
      method: method,
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': \`Bearer \${SUPABASE_SERVICE_ROLE_KEY}\`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(profileData),
      muteHttpExceptions: true
    };
    
    const res = UrlFetchApp.fetch(targetUrl, upsertOptions);
    const responseCode = res.getResponseCode();
    
    if (responseCode >= 300) {
       console.error("Supabase Insert/Update Error:", res.getContentText());
    }
    
    return responseCode < 300;
  } catch (e) {
    console.error("Exception in linkLineUserToDepartment:", e);
    return false;
  }
}

// --- ฟังก์ชันติดต่อ LINE API ---

function sendPushMessage(to, text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: to,
    messages: [{ type: 'text', text: text }]
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': \`Bearer \${LINE_CHANNEL_ACCESS_TOKEN}\` 
    },
    payload: JSON.stringify(payload)
  });
}

function replyMessage(replyToken, text) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': \`Bearer \${LINE_CHANNEL_ACCESS_TOKEN}\` 
    },
    payload: JSON.stringify(payload)
  });
}
`;

const LineConnect: React.FC<LineConnectProps> = ({ user, notificationOptions }) => {
    const [lineProfile, setLineProfile] = useState<LineUserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'system' | 'oa'>('oa');
    const [showScriptModal, setShowScriptModal] = useState(false);
    
    // Dev Modal State
    const [showDevModal, setShowDevModal] = useState(false);
    
    // Admin Setting for Webhook URL
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isSavingUrl, setIsSavingUrl] = useState(false);
    const [departmentName, setDepartmentName] = useState('');
    const isAdmin = user.role === 'Admin' || user.role === 'Warehouse';


    const fetchProfile = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch department name if user has a department ID
            if (user.departmentId) {
                const { data: dept } = await supabase.from('departments').select('name').eq('id', user.departmentId).single();
                if (dept) {
                    setDepartmentName((dept as any).name);
                }
            }

            // 1. Check if user has LINE identity linked in Supabase Auth
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const lineIdentity = authUser?.identities?.find(id => id.provider === 'line');
            
            if (lineIdentity) {
                const lineUserId = lineIdentity.id;
                const displayName = lineIdentity.identity_data?.full_name || lineIdentity.identity_data?.name || 'LINE User';
                const pictureUrl = lineIdentity.identity_data?.avatar_url || '';
                
                // Sync to line_user_profiles table
                await (supabaseService as any).upsertLineProfile(user.id, lineUserId, displayName, pictureUrl);
            }

            // 2. Fetch the profile from our table
            const profile = await supabaseService.getLineProfile(user.id);
            setLineProfile(profile);
            
            // Only fetch webhook url if admin
            if (isAdmin) {
                const url = await (supabaseService as any).getGasUrl ? (supabaseService as any).getGasUrl() : ''; // Safety check in case type is not updated yet
                setWebhookUrl(url || '');
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user.id, isAdmin]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleConnect = async () => {
        setIsSaving(true);
        try {
            await supabaseService.initiateLineLogin();
            // The page will redirect to LINE Login
        } catch (error) {
            console.error("LINE Connect Error:", error);
            alert(`ไม่สามารถเชื่อมต่อ LINE ได้: ${error instanceof Error ? error.message : String(error)}`);
            setIsSaving(false);
        }
    };
    
    const handleDisconnect = async () => {
        if (window.confirm('คุณต้องการยกเลิกการเชื่อมต่อกับ LINE หรือไม่?')) {
            setIsSaving(true);
            try {
                // Unlink identity from Supabase Auth
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const lineIdentity = authUser?.identities?.find(id => id.provider === 'line');
                if (lineIdentity) {
                    await supabase.auth.unlinkIdentity(lineIdentity);
                }
                
                // Remove from our table
                await supabaseService.unlinkLineProfile(user.id);
                setLineProfile(null);
            } catch (error) {
                 alert(`ยกเลิกการเชื่อมต่อไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsSaving(false);
            }
        }
    };
    
    const handleSettingToggle = async (key: string, enabled: boolean) => {
        if (!lineProfile) return;
        
        const newSettings = { ...lineProfile.settings, [key]: enabled };
        const updatedProfile = { ...lineProfile, settings: newSettings };
        setLineProfile(updatedProfile); 

        try {
            await supabaseService.updateLineSettings(user.id, newSettings);
        } catch (error) {
            alert("ไม่สามารถบันทึกการตั้งค่าได้");
            const revertedSettings = { ...lineProfile.settings, [key]: !enabled };
            setLineProfile({ ...lineProfile, settings: revertedSettings });
        }
    };

    const handleSendTest = async () => {
        setIsTesting(true);
        setTestStatus(null);
        try {
            await supabaseService.sendTestLineNotification(user.id);
            setTestStatus({ type: 'success', text: 'ส่งคำขอทดสอบแล้ว!' });
        } catch (error) {
            setTestStatus({ type: 'error', text: 'ส่งคำขอทดสอบไม่สำเร็จ' });
        } finally {
            setIsTesting(false);
            setTimeout(() => setTestStatus(null), 5000);
        }
    };

    const copyScriptToClipboard = () => {
        navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE).then(() => {
            alert("คัดลอกโค้ดแล้ว! นำไปวางใน Google Apps Script ได้เลย");
        });
    };
    
    const handleSaveWebhookUrl = async () => {
        if (!webhookUrl.trim()) return;
        if (!webhookUrl.includes('script.google.com/macros/s/') && !webhookUrl.includes('supabase.co/functions/v1/')) {
            alert("รูปแบบ URL ไม่ถูกต้อง ต้องเป็น Web App URL จาก Google Apps Script (ขึ้นต้นด้วย script.google.com/macros/s/) หรือ Supabase Edge Function");
            return;
        }
        
        setIsSavingUrl(true);
        try {
             await (supabaseService as any).saveGasWebhookUrl(webhookUrl.trim());
             alert("บันทึก Webhook URL เรียบร้อยแล้ว");
        } catch (e) {
            alert("บันทึกไม่สำเร็จ");
        } finally {
            setIsSavingUrl(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header Section */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl mb-4 text-green-600 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-800">
                    <ChatBubbleIcon className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">เชื่อมต่อการแจ้งเตือน LINE</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    รับการแจ้งเตือนสถานะใบเบิกเวชภัณฑ์และข่าวสารสำคัญผ่าน LINE Official Account ของเรา
                </p>
            </div>

            {/* Tab Navigation - Only show if user might need Login (e.g. not just for notifications) */}
            {isAdmin && (
                <div className="flex items-center justify-center mb-10">
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setActiveTab('oa')}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'oa' ? 'bg-white dark:bg-slate-700 shadow-sm text-green-600 dark:text-green-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Official Account
                        </button>
                        <button 
                            onClick={() => setActiveTab('system')}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'system' ? 'bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            LINE Login
                        </button>
                    </div>
                </div>
            )}
            
            {activeTab === 'oa' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
                    {/* Left Column: QR Code & ID */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                            
                            <div className="mb-6 relative inline-block">
                                <div className="absolute -inset-4 bg-green-50 dark:bg-green-900/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative w-48 h-48 bg-white dark:bg-slate-900 rounded-3xl p-3 border-2 border-green-100 dark:border-green-900/50 shadow-inner flex items-center justify-center mx-auto">
                                    <QRCodeSVG 
                                        value={`https://line.me/R/oaMessage/@369jbtdm/?${encodeURIComponent('เชื่อมต่อ:' + user.id)}`}
                                        size={160}
                                        level="M"
                                        includeMargin={true}
                                        className="w-full h-full"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">LINE ID</p>
                                <p className="text-3xl font-black text-green-600 dark:text-green-400">@369jbtdm</p>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-700/50">
                                <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                                    "สแกนเพื่อเพิ่มเพื่อนและรับการแจ้งเตือน"
                                </p>
                            </div>
                        </div>

                        {/* Test Notification - Subtle */}
                        <div className="px-4">
                            <button
                                onClick={handleSendTest}
                                disabled={isTesting}
                                className="w-full py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                            >
                                {isTesting ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                                        กำลังส่งข้อความทดสอบ...
                                    </span>
                                ) : (
                                    <>🔔 ส่งข้อความทดสอบไปยัง LINE</>
                                )}
                            </button>
                            {testStatus && (
                                <p className={`mt-2 text-center text-xs font-bold ${testStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {testStatus.text}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Steps & Action */}
                    <div className="lg:col-span-7 space-y-8">
                        <div className="bg-green-50/50 dark:bg-green-900/5 rounded-[2.5rem] p-8 border border-green-100/50 dark:border-green-900/20">
                            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-8 flex items-center gap-2">
                                <span className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center text-sm">
                                    <CheckCircleIcon className="w-5 h-5" />
                                </span>
                                ขั้นตอนการเชื่อมต่อ
                            </h4>

                            <div className="space-y-10 relative">
                                {/* Vertical Line */}
                                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-green-200 dark:bg-green-900/30"></div>

                                {/* Step 1 */}
                                <div className="relative pl-12">
                                    <div className="absolute left-0 top-0 w-8 h-8 bg-white dark:bg-slate-800 border-2 border-green-500 rounded-full flex items-center justify-center z-10">
                                        <span className="text-green-600 dark:text-green-400 font-black text-sm">1</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">เพิ่มเพื่อน</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">สแกน QR Code หรือเพิ่มเพื่อนด้วยไอดี <span className="font-bold text-green-600">@369jbtdm</span></p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="relative pl-12">
                                    <div className="absolute left-0 top-0 w-8 h-8 bg-white dark:bg-slate-800 border-2 border-green-500 rounded-full flex items-center justify-center z-10">
                                        <span className="text-green-600 dark:text-green-400 font-black text-sm">2</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">ยืนยันหน่วยงาน</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">กดปุ่มสีเขียวด้านล่างเพื่อส่งชื่อหน่วยงานยืนยันตัวตนในแชท LINE</p>
                                        
                                        {departmentName ? (
                                            <a 
                                                href={`https://line.me/R/oaMessage/@369jbtdm/?${encodeURIComponent('เชื่อมต่อ:' + user.id)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative inline-flex items-center justify-center gap-4 w-full bg-[#06C755] text-white font-black py-5 px-8 rounded-3xl hover:bg-[#05b34c] transition-all shadow-xl shadow-green-500/30 transform active:scale-95 overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                                <ChatBubbleIcon className="w-6 h-6" />
                                                <span className="text-lg">คลิกเพื่อเชื่อมต่อทันที</span>
                                            </a>
                                        ) : (
                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-start gap-3">
                                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                                    ไม่พบชื่อหน่วยงานในระบบ กรุณาพิมพ์ชื่อหน่วยงานของท่านส่งไปในแชท LINE ด้วยตนเองเพื่อทำการเชื่อมต่อ
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="relative pl-12">
                                    <div className="absolute left-0 top-0 w-8 h-8 bg-white dark:bg-slate-800 border-2 border-green-500 rounded-full flex items-center justify-center z-10">
                                        <span className="text-green-600 dark:text-green-400 font-black text-sm">3</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">เสร็จสมบูรณ์</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">ระบบจะส่งข้อความยืนยันใน LINE และท่านจะเริ่มได้รับแจ้งเตือนทันที</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Admin Only Config Button - Very subtle */}
                        {isAdmin && (
                            <div className="flex justify-end px-4">
                                <button
                                    onClick={() => setShowScriptModal(true)}
                                    className="text-[10px] uppercase tracking-widest text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 transition-colors flex items-center gap-1.5"
                                >
                                    <CogIcon className="w-3 h-3" />
                                    Developer Settings
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="max-w-md mx-auto animate-fade-in">
                    {!lineProfile ? (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 text-center border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <UserIcon className="w-10 h-10" />
                            </div>
                            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">LINE Login</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                                เชื่อมต่อบัญชี LINE เพื่อเข้าสู่ระบบได้รวดเร็วยิ่งขึ้นโดยไม่ต้องกรอกรหัสผ่าน
                            </p>
                            <button 
                                onClick={handleConnect}
                                disabled={isSaving}
                                className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-black py-4 px-8 rounded-2xl transition-all shadow-lg shadow-green-500/20 disabled:bg-slate-300"
                            >
                                {isSaving ? 'กำลังดำเนินการ...' : 'เชื่อมต่อ LINE Login'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-600 shadow-sm">
                                    {lineProfile.pictureUrl ? (
                                        <img src={lineProfile.pictureUrl} alt="LINE Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <UserIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">{lineProfile.displayName}</p>
                                    <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">เชื่อมต่อแล้ว</p>
                                </div>
                                <button 
                                    onClick={handleDisconnect}
                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                    title="ยกเลิกการเชื่อมต่อ"
                                >
                                    <ExclamationTriangleIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="pt-6 border-t border-slate-50 dark:border-slate-700/50">
                                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">การแจ้งเตือนส่วนตัว</h5>
                                <div className="space-y-3">
                                    {notificationOptions.map(opt => (
                                        <label key={opt.key} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">{opt.label}</span>
                                            <div className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={lineProfile.settings[opt.key] ?? true} 
                                                    onChange={e => handleSettingToggle(opt.key, e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#06C755]"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Admin Webhook Config - Only for Admins */}
            {isAdmin && activeTab === 'oa' && (
                <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl shadow-slate-900/20">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center text-sky-400">
                            <CogIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg">Webhook Configuration</h4>
                            <p className="text-xs text-slate-400">Admin Only Settings</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <input 
                                type="text" 
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                placeholder="https://script.google.com/macros/s/..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-sky-400 focus:ring-2 focus:ring-sky-500 outline-none transition-all placeholder:text-slate-600"
                            />
                            <button 
                                onClick={handleSaveWebhookUrl}
                                disabled={isSavingUrl}
                                className="absolute right-2 top-2 bottom-2 bg-sky-600 hover:bg-sky-500 text-white px-6 rounded-xl text-sm font-bold transition-all disabled:bg-slate-700"
                            >
                                {isSavingUrl ? '...' : 'Save URL'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 px-2">
                            * ต้องเป็น Web App URL จาก Google Apps Script หรือ Supabase Edge Function
                        </p>
                    </div>
                </div>
            )}

            {/* Script Helper Modal */}
            <Modal isOpen={showScriptModal} onClose={() => setShowScriptModal(false)} title="LINE Bot Backend Setup" size="2xl">
                <div className="space-y-6 p-2">
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <p className="font-bold">คำแนะนำสำหรับผู้ดูแลระบบ:</p>
                            <p>โค้ดนี้ใช้สำหรับสร้าง Webhook ใน Google Apps Script เพื่อรับข้อความจาก LINE และส่งแจ้งเตือนกลับไปยังผู้ใช้</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100">ขั้นตอนการติดตั้ง:</h5>
                        <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
                            <li>สร้างโปรเจกต์ใหม่ที่ <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">script.google.com</a></li>
                            <li>คัดลอกโค้ดด้านล่างไปวางแทนที่โค้ดเดิม</li>
                            <li>ตั้งค่า <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">LINE_CHANNEL_ACCESS_TOKEN</code> และ Supabase Keys</li>
                            <li>Deploy เป็น <strong>Web App</strong> และตั้งค่าการเข้าถึงเป็น <strong>Anyone</strong></li>
                        </ol>
                    </div>

                    <div className="relative group">
                        <textarea 
                            readOnly 
                            className="w-full h-64 p-4 bg-slate-900 text-green-400 font-mono text-xs rounded-2xl shadow-inner focus:outline-none border border-slate-800"
                            value={GAS_SCRIPT_TEMPLATE}
                        />
                        <button 
                            onClick={copyScriptToClipboard}
                            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                        >
                            <ClipboardDocumentListIcon className="w-4 h-4"/> คัดลอกโค้ด
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default LineConnect;
