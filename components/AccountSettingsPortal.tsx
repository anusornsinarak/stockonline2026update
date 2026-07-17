
import React from 'react';
import { User } from '../types';
import LineConnect from './shared/LineConnect';
import TelegramConnect from './department/TelegramSettings';
import { supabaseService } from '../services/supabaseService';
import BellIcon from './icons/BellIcon';

interface AccountSettingsPortalProps {
    user: User;
}

const departmentNotificationOptions = [
    { key: 'requisition_approved', label: 'ใบเบิกได้รับการอนุมัติ' },
    { key: 'requisition_rejected', label: 'ใบเบิกถูกปฏิเสธ' },
    { key: 'requisition_ready', label: 'ของพร้อมรับ' },
    { key: 'requisition_completed', label: 'รับของแล้ว' },
    { key: 'public_chat_message', label: 'ข้อความใหม่ในแชทสาธารณะ' },
];

const adminNotificationOptions = [
    { key: 'new_requisition', label: 'มีใบเบิกใหม่' },
    { key: 'low_stock', label: 'สินค้าใกล้หมดสต็อก' },
    { key: 'backorder_filled', label: 'สินค้าค้างจ่ายมีของแล้ว' },
    { key: 'product_issue', label: 'มีรายงานปัญหาสินค้า' },
    { key: 'public_chat_message', label: 'ข้อความใหม่ในแชทสาธารณะ' },
    { key: 'custom_admin_message', label: 'ข้อความประกาศจากผู้ดูแลระบบ' },
];


const AccountSettingsPortal: React.FC<AccountSettingsPortalProps> = ({ user }) => {
    const getOptionsForRole = () => {
        switch (user.role) {
            case 'Admin':
            case 'Warehouse':
                return adminNotificationOptions;
            case 'Department':
                return departmentNotificationOptions;
            default:
                return [];
        }
    };
    const options = getOptionsForRole();

    const handleTestNotification = async () => {
        try {
            // 1. Send In-App Notification
            await supabaseService.createNotification(user.id, "✅ ระบบทดสอบการแจ้งเตือน: หากคุณเห็นข้อความนี้แสดงว่า In-App Notification ทำงานปกติ");
            
            // 2. Send LINE Notification (Test)
            await supabaseService.sendTestLineNotification(user.id);

            alert("ส่งคำขอทดสอบไปยังทั้ง แอป และ LINE แล้ว กรุณารอสักครู่...");
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการทดสอบ: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 dark:border-slate-700">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">จัดการการแจ้งเตือน</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ตั้งค่าช่องทางการรับข่าวสารและสถานะใบเบิก</p>
                </div>
                <button 
                    onClick={handleTestNotification}
                    className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-2.5 px-6 rounded-full hover:shadow-lg hover:scale-105 transition-all active:scale-95"
                >
                    <BellIcon className="w-5 h-5" />
                    ทดสอบการแจ้งเตือนในระบบ
                </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-green-600 mb-4 flex items-center gap-2">
                    <span className="bg-green-100 p-1.5 rounded-lg">LINE</span> 
                    การแจ้งเตือนผ่าน LINE
                </h3>
                <LineConnect user={user} notificationOptions={options} />
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-sky-600 mb-4 flex items-center gap-2">
                     <span className="bg-sky-100 p-1.5 rounded-lg">TG</span>
                    การแจ้งเตือนผ่าน Telegram
                </h3>
                <TelegramConnect user={user} />
            </div>
        </div>
    );
};

export default AccountSettingsPortal;
