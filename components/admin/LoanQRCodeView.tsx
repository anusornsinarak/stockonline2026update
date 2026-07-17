
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import PrinterIcon from '../icons/PrinterIcon';
import ClipboardIcon from '../icons/ClipboardIcon';

export const LoanQRCodeView: React.FC = () => {
    const [borrowerEmail, setBorrowerEmail] = useState('borrower@hospital.com');
    const [borrowerPassword, setBorrowerPassword] = useState('borrower1234');
    
    const appUrl = window.location.origin;
    
    const handlePrint = () => {
        window.print();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(appUrl);
        alert('คัดลอกลิงก์แล้ว');
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center no-print">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">สร้าง QR Code สำหรับระบบยืม</h2>
                <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-sky-600 text-white px-6 py-2 rounded-xl hover:bg-sky-700 font-bold shadow-lg transition-all active:scale-95"
                >
                    <PrinterIcon className="w-5 h-5" />
                    พิมพ์ QR Code
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center space-y-6 print:shadow-none print:border-none">
                    <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100">
                        <QRCodeSVG value={appUrl} size={256} level="H" includeMargin={true} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">สแกนเพื่อเข้าสู่ระบบยืม</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
                            สำหรับเจ้าหน้าที่ที่ต้องการยืมเวชภัณฑ์ สามารถสแกน QR Code นี้เพื่อเข้าถึงระบบยืมได้ทันที
                        </p>
                    </div>
                    
                    <div className="w-full pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4 no-print">
                        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-400 uppercase w-12">URL</span>
                            <span className="flex-grow text-sm text-slate-600 dark:text-slate-300 truncate font-mono">{appUrl}</span>
                            <button onClick={handleCopy} className="text-slate-400 hover:text-sky-600">
                                <ClipboardIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 no-print">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            คำแนะนำการใช้งาน
                        </h4>
                        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-2 list-disc pl-5">
                            <li>สร้างบัญชีผู้ใช้ใหม่ที่มีบทบาท (Role) เป็น <b>"Borrower"</b></li>
                            <li>กำหนดรหัสผ่านที่จำง่ายสำหรับเจ้าหน้าที่ทั่วไป</li>
                            <li>พิมพ์ QR Code นี้ติดไว้ที่หน้าคลังเวชภัณฑ์</li>
                            <li>เมื่อสแกนแล้ว ระบบจะแสดงหน้าจอสำหรับยืม-คืนสินค้าโดยเฉพาะ</li>
                        </ul>
                    </div>

                    <div className="bg-sky-50 dark:bg-sky-900/20 p-6 rounded-2xl border border-sky-200 dark:border-sky-800">
                        <h4 className="font-bold text-sky-800 dark:text-sky-400 mb-3">บัญชีสำหรับผู้ยืม (ตัวอย่าง)</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-sky-600 dark:text-sky-400 uppercase mb-1">Email / Username</label>
                                <input 
                                    type="text" 
                                    value={borrowerEmail} 
                                    onChange={e => setBorrowerEmail(e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-sky-600 dark:text-sky-400 uppercase mb-1">Password</label>
                                <input 
                                    type="text" 
                                    value={borrowerPassword} 
                                    onChange={e => setBorrowerPassword(e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print View Only */}
            <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-20 text-center">
                <div className="max-w-xl mx-auto border-4 border-slate-800 p-12 rounded-[3rem] space-y-12">
                    <h1 className="text-5xl font-black text-slate-800">ระบบยืม-คืน</h1>
                    <h2 className="text-3xl font-bold text-slate-600">คลังเวชภัณฑ์มิใช่ยา</h2>
                    
                    <div className="flex justify-center">
                        <QRCodeSVG value={appUrl} size={400} level="H" includeMargin={true} />
                    </div>
                    
                    <div className="space-y-4">
                        <p className="text-2xl font-bold text-slate-700">สแกนเพื่อแจ้งยืมสินค้า</p>
                        <div className="bg-slate-100 p-6 rounded-2xl border-2 border-dashed border-slate-300">
                            <p className="text-lg text-slate-600 mb-2">บัญชีเข้าใช้งานส่วนกลาง:</p>
                            <p className="text-2xl font-mono font-bold text-sky-700">User: {borrowerEmail}</p>
                            <p className="text-2xl font-mono font-bold text-sky-700">Pass: {borrowerPassword}</p>
                        </div>
                    </div>
                    
                    <p className="text-slate-400 text-sm">โรงพยาบาลและเครือข่ายบริการสุขภาพ</p>
                </div>
            </div>
        </div>
    );
};
