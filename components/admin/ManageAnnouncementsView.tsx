
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import EditIcon from '../icons/EditIcon';
import TrashIcon from '../icons/TrashIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';
import MegaphoneIcon from '../icons/MegaphoneIcon';

interface AnnouncementItem {
    id: string;
    title: string;
    content: string;
}

interface ActiveAnnouncement {
    id: string | null;
    content: string;
    enabled: boolean;
    isOffCycleWeek?: boolean;
}

const ManageAnnouncementsView: React.FC = () => {
    const [library, setLibrary] = useState<AnnouncementItem[]>([]);
    const [activeConfig, setActiveConfig] = useState<ActiveAnnouncement>({ id: null, content: '', enabled: false, isOffCycleWeek: false });
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<AnnouncementItem>({ id: '', title: '', content: '' });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [fySettings, setFySettings] = useState({ fy_survey_open: false, fy_survey_force: false, fy_survey_year: 2570, fy_previous_year: 2569 });
    const [surveyProgress, setSurveyProgress] = useState({ submitted: 0, total: 0 });

    useEffect(() => {
        fetchData();
        fetchFySettings();
    }, []);

    const fetchFySettings = async () => {
        const settings = await supabaseService.getFySurveySettings();
        setFySettings(settings);
        
        // Fetch progress
        try {
            const [depts, submissions] = await Promise.all([
                supabaseService.getDepartments(),
                supabaseService.getSurveySubmissions(settings.fy_survey_year)
            ]);
            // Only count active departments if possible, or all
            setSurveyProgress({
                submitted: submissions.length,
                total: depts.length
            });
        } catch (error) {
            console.error("Failed to fetch survey progress", error);
        }
    };

    const handleFyToggle = async () => {
        const newSettings = { ...fySettings, fy_survey_open: !fySettings.fy_survey_open };
        setFySettings(newSettings);
        await supabaseService.saveFySurveySettings(newSettings);
        setStatusMessage({ type: 'success', text: `บันทึกการตั้งค่าแผนสำรวจปี ${fySettings.fy_survey_year} เรียบร้อย` });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleFyForceToggle = async () => {
        const newSettings = { ...fySettings, fy_survey_force: !fySettings.fy_survey_force };
        setFySettings(newSettings);
        await supabaseService.saveFySurveySettings(newSettings);
        setStatusMessage({ type: 'success', text: `บันทึกการตั้งค่าบังคับสำรวจปี ${fySettings.fy_survey_year} เรียบร้อย` });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedLibrary, fetchedActive] = await Promise.all([
                supabaseService.getAnnouncementLibrary(),
                supabaseService.getAnnouncementSettings()
            ]);
            setLibrary(fetchedLibrary);
            setActiveConfig(fetchedActive);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLibrary = async (newLibrary: AnnouncementItem[]) => {
        setIsSaving(true);
        try {
            await supabaseService.saveAnnouncementLibrary(newLibrary);
            setLibrary(newLibrary);
            setStatusMessage({ type: 'success', text: 'บันทึกคลังประกาศสำเร็จ' });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'ไม่สามารถบันทึกข้อมูลได้' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleMaster = async () => {
        const newEnabled = !activeConfig.enabled;
        const newConfig = { ...activeConfig, enabled: newEnabled };
        setActiveConfig(newConfig);
        await supabaseService.saveAnnouncementSettings(newConfig as any);
    };

    const handleSetActive = async (item: AnnouncementItem) => {
        const newConfig = { id: item.id, content: item.content, enabled: true };
        setActiveConfig(newConfig);
        await supabaseService.saveAnnouncementSettings(newConfig as any);
        setStatusMessage({ type: 'success', text: `เริ่มแสดงประกาศ: ${item.title}` });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleCreateNew = () => {
        setEditForm({ id: Date.now().toString(), title: '', content: '' });
        setIsEditing(true);
    };

    const handleEdit = (item: AnnouncementItem) => {
        setEditForm({ ...item });
        setIsEditing(true);
    };

    const handleDelete = (id: string) => {
        if (!window.confirm('ยืนยันการลบประกาศชุดนี้ออกจากคลัง?')) return;
        const newLibrary = library.filter(i => i.id !== id);
        handleSaveLibrary(newLibrary);
        if (activeConfig.id === id) {
            const resetActive = { id: null, content: '', enabled: false };
            setActiveConfig(resetActive);
            supabaseService.saveAnnouncementSettings(resetActive as any);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const exists = library.find(i => i.id === editForm.id);
        let newLibrary: AnnouncementItem[];
        if (exists) {
            newLibrary = library.map(i => i.id === editForm.id ? editForm : i);
        } else {
            newLibrary = [...library, editForm];
        }
        handleSaveLibrary(newLibrary);
        setIsEditing(false);
        
        // ถ้ากำลังแก้ไขตัวที่กำลัง Online อยู่ ให้ Update ตัว Online ด้วย
        if (activeConfig.id === editForm.id) {
            const newActive = { ...activeConfig, content: editForm.content };
            setActiveConfig(newActive);
            supabaseService.saveAnnouncementSettings(newActive as any);
        }
    };

    if (isLoading) return <p className="p-8 text-center">กำลังโหลดข้อมูล...</p>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <MegaphoneIcon className="w-6 h-6 text-sky-500" />
                        คลังประกาศข่าวสาร
                    </h3>
                    <p className="text-sm text-slate-500">สร้างและเลือกประกาศที่จะให้แสดงที่หน้าเข้าสู่ระบบ</p>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[280px]">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">เปิดการแสดงผลประกาศระบบ</span>
                        <button
                            onClick={handleToggleMaster}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${activeConfig.enabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${activeConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`}/>
                        </button>
                    </div>
                    <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-700/50 shadow-sm min-w-[280px]">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">โหมด "ไม่ใช่สัปดาห์เบิก"</span>
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">บังคับระบุเหตุผลการเบิกนอกรอบ</span>
                        </div>
                        <button
                            onClick={async () => {
                                const newConfig = { ...activeConfig, isOffCycleWeek: !activeConfig.isOffCycleWeek };
                                setActiveConfig(newConfig);
                                await supabaseService.saveAnnouncementSettings(newConfig as any);
                                setStatusMessage({ type: 'success', text: 'บันทึกการตั้งค่าสัปดาห์เบิกเรียบร้อยแล้ว' });
                                setTimeout(() => setStatusMessage(null), 3000);
                            }}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 ml-4 ${activeConfig.isOffCycleWeek ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${activeConfig.isOffCycleWeek ? 'translate-x-5' : 'translate-x-0'}`}/>
                        </button>
                    </div>
                    <div className="flex justify-between items-center bg-sky-50 dark:bg-sky-900/20 p-3 rounded-xl border border-sky-200 dark:border-sky-700/50 shadow-sm min-w-[280px]">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-sky-800 dark:text-sky-300">เปิดระบบสำรวจปีงบ {fySettings.fy_survey_year}</span>
                            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">ความคืบหน้า: {surveyProgress.submitted}/{surveyProgress.total} หน่วยงาน</span>
                        </div>
                        <button
                            onClick={handleFyToggle}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ml-4 ${fySettings.fy_survey_open ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${fySettings.fy_survey_open ? 'translate-x-5' : 'translate-x-0'}`}/>
                        </button>
                    </div>

                    <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-200 dark:border-rose-700/50 shadow-sm min-w-[280px]">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-rose-800 dark:text-rose-300">บังคับสำรวจ</span>
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">ระงับการใช้งานจนกว่าจะสำรวจเสร็จ</span>
                        </div>
                        <button
                            onClick={handleFyForceToggle}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 ml-4 ${fySettings.fy_survey_force ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${fySettings.fy_survey_force ? 'translate-x-5' : 'translate-x-0'}`}/>
                        </button>
                    </div>
                </div>
            </div>

            {statusMessage && (
                <div className={`p-3 rounded-lg text-sm font-bold text-center ${statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {statusMessage.text}
                </div>
            )}

            {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add New Card */}
                    <button 
                        onClick={handleCreateNew}
                        className="h-full min-h-[200px] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-sky-500 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 transition-all group"
                    >
                        <PlusIcon className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-bold">สร้างประกาศใหม่</span>
                    </button>

                    {library.map(item => {
                        const isLive = activeConfig.id === item.id;
                        return (
                            <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-3xl border-2 transition-all p-5 flex flex-col justify-between ${isLive ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}>
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate pr-2">{item.title}</h4>
                                        {isLive && (
                                            <span className="bg-sky-100 text-sky-600 text-[10px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse"></div>
                                                LIVE
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-4 h-20 overflow-hidden mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700" 
                                         dangerouslySetInnerHTML={{ __html: item.content }} />
                                </div>
                                
                                <div className="flex items-center justify-between gap-2 mt-2">
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-xl transition-all" title="แก้ไข">
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-xl transition-all" title="ลบ">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    {!isLive ? (
                                        <button 
                                            onClick={() => handleSetActive(item)}
                                            className="bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-800 text-xs font-bold py-2 px-4 rounded-xl hover:bg-slate-700 dark:hover:bg-white transition-all shadow-sm active:scale-95"
                                        >
                                            แสดงหน้านี้
                                        </button>
                                    ) : (
                                        <div className="text-sky-600 flex items-center gap-1 text-xs font-bold">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            กำลังแสดงผล
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-fade-in">
                    <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-4">
                            <h4 className="font-bold text-lg">แก้ไขรายละเอียดประกาศ</h4>
                            <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">ปิด</button>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">ชื่อหัวข้อ (ใช้อ้างอิงในระบบ)</label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none"
                                placeholder="เช่น ประกาศแจ้งปิดปรับปรุงระบบคืนวันอาทิตย์..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">เนื้อหาประกาศ (แสดงให้ผู้ใช้เห็น)</label>
                            <textarea
                                rows={8}
                                value={editForm.content}
                                onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none font-sarabun text-lg"
                                placeholder="พิมพ์ข้อความที่ต้องการประกาศ... (รองรับ HTML)"
                                required
                            />
                            <p className="text-[10px] text-slate-400 mt-2 italic">* รองรับแท็ก HTML พื้นฐาน เช่น &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;br&gt;</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-10 py-3 bg-sky-600 text-white font-bold rounded-2xl hover:bg-sky-700 shadow-lg shadow-sky-500/20 disabled:bg-slate-400 transition-all active:scale-95"
                            >
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึกเข้าคลัง'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ManageAnnouncementsView;
