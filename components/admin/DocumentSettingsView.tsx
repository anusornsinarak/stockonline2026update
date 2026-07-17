import React, { useState, useEffect } from 'react';
import { DocumentSettings } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import UploadIcon from '../icons/UploadIcon';

interface DocumentSettingsViewProps {
    initialSettings: DocumentSettings | null;
    onSave: () => void;
}

const DocumentSettingsView: React.FC<DocumentSettingsViewProps> = ({ initialSettings, onSave }) => {
    const [settings, setSettings] = useState<DocumentSettings>({});
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (initialSettings) {
            setSettings(initialSettings);
            setLogoPreview(initialSettings.hospitalLogoUrl || null);
        }
    }, [initialSettings]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setError('ขนาดไฟล์ต้องไม่เกิน 2MB');
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        setSuccess('');
        try {
            let updatedSettings = { ...settings };
            if (logoFile) {
                const newLogoUrl = await supabaseService.uploadLogo(logoFile);
                updatedSettings.hospitalLogoUrl = newLogoUrl;
            }
            
            await supabaseService.updateDocumentSettings(updatedSettings);
            setSuccess('บันทึกการตั้งค่าสำเร็จ!');
            onSave(); // Trigger refetch in parent
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h3 className="text-xl font-bold text-slate-800">ตั้งค่าหัวกระดาษและลายเซ็นเอกสาร</h3>
            
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-5">
                        <div>
                            <label htmlFor="hospitalName" className="block text-sm font-medium text-slate-700">ชื่อโรงพยาบาล</label>
                            <input
                                type="text"
                                id="hospitalName"
                                name="hospitalName"
                                value={settings.hospitalName || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น โรงพยาบาลตัวอย่าง"
                            />
                        </div>
                         <div>
                            <label htmlFor="documentApproverName" className="block text-sm font-medium text-slate-700">ชื่อผู้อนุมัติ (สำหรับใบสั่งซื้อ)</label>
                            <input
                                type="text"
                                id="documentApproverName"
                                name="documentApproverName"
                                value={settings.documentApproverName || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น นายแพทย์สมชาย ใจดี"
                            />
                        </div>
                        <div>
                            <label htmlFor="documentApproverPosition" className="block text-sm font-medium text-slate-700">ตำแหน่งผู้อนุมัติ</label>
                            <input
                                type="text"
                                id="documentApproverPosition"
                                name="documentApproverPosition"
                                value={settings.documentApproverPosition || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น ผู้อำนวยการโรงพยาบาล"
                            />
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <label htmlFor="documentDisbursementApproverName" className="block text-sm font-medium text-slate-700">ชื่อผู้อนุมัติเบิกจ่าย (สำหรับใบเบิก)</label>
                            <input
                                type="text"
                                id="documentDisbursementApproverName"
                                name="documentDisbursementApproverName"
                                value={settings.documentDisbursementApproverName || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น นายแพทย์สมชาย ใจดี"
                            />
                        </div>
                        <div>
                            <label htmlFor="documentDisbursementApproverPosition" className="block text-sm font-medium text-slate-700">ตำแหน่งผู้อนุมัติเบิกจ่าย</label>
                            <input
                                type="text"
                                id="documentDisbursementApproverPosition"
                                name="documentDisbursementApproverPosition"
                                value={settings.documentDisbursementApproverPosition || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น หัวหน้ากลุ่มงานเภสัชกรรม"
                            />
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <label htmlFor="documentIssuerName" className="block text-sm font-medium text-slate-700">ชื่อผู้จ่ายพัสดุ (ค่าเริ่มต้น)</label>
                            <input
                                type="text"
                                id="documentIssuerName"
                                name="documentIssuerName"
                                value={settings.documentIssuerName || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น นายสายรุ้ง สีด้วง"
                            />
                        </div>
                        <div>
                            <label htmlFor="documentIssuerPosition" className="block text-sm font-medium text-slate-700">ตำแหน่งผู้จ่ายพัสดุ</label>
                            <input
                                type="text"
                                id="documentIssuerPosition"
                                name="documentIssuerPosition"
                                value={settings.documentIssuerPosition || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น เจ้าหน้าที่พัสดุ"
                            />
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <label htmlFor="documentReceiverName" className="block text-sm font-medium text-slate-700">ชื่อผู้รับเวชภัณฑ์ (ค่าเริ่มต้น)</label>
                            <input
                                type="text"
                                id="documentReceiverName"
                                name="documentReceiverName"
                                value={settings.documentReceiverName || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น นายสมชาย รับของ"
                            />
                        </div>
                        <div>
                            <label htmlFor="documentReceiverPosition" className="block text-sm font-medium text-slate-700">ตำแหน่งผู้รับเวชภัณฑ์</label>
                            <input
                                type="text"
                                id="documentReceiverPosition"
                                name="documentReceiverPosition"
                                value={settings.documentReceiverPosition || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm"
                                placeholder="เช่น พนักงานขับรถ"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">โลโก้โรงพยาบาล</label>
                        <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo Preview" className="mx-auto h-24 w-auto object-contain mb-2" />
                                ) : (
                                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                                <div className="flex text-sm text-slate-600">
                                    <label htmlFor="logo-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-sky-600 hover:text-sky-500 focus-within:outline-none">
                                        <span>อัปโหลดไฟล์</span>
                                        <input id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/svg+xml" />
                                    </label>
                                    <p className="pl-1">หรือลากมาวาง</p>
                                </div>
                                <p className="text-xs text-slate-500">PNG, JPG, SVG ไม่เกิน 2MB</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end items-center gap-4">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:bg-slate-400"
                >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
            </div>
        </div>
    );
};

export default DocumentSettingsView;