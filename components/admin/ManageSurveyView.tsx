
import React, { useState, useEffect, useMemo } from 'react';
import { SurveyConfig, SurveyQuestion } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import EditIcon from '../icons/EditIcon';
import ChartBarIcon from '../icons/ChartBarIcon';
import ArrowPathIcon from '../icons/ArrowPathIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PrinterIcon from '../icons/PrinterIcon';

export const ManageSurveyView: React.FC = () => {
    const [configs, setConfigs] = useState<SurveyConfig[]>([]);
    const [selectedConfig, setSelectedConfig] = useState<SurveyConfig | null>(null);
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [responses, setResponses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'edit' | 'summary'>('list');
    
    const [newRoundName, setNewRoundName] = useState('');
    const [isCreatingRound, setIsCreatingRound] = useState(false);

    const fetchConfigs = async () => {
        setIsLoading(true);
        try {
            const data = await supabaseService.getAllSurveyConfigs();
            setConfigs(data);
            if (data.length > 0 && !selectedConfig) {
                // Default to active or first
                const active = data.find(c => c.isActive) || data[0];
                setSelectedConfig(active);
            }
        } catch (error) {
            console.error("Failed to fetch survey configs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    useEffect(() => {
        if (selectedConfig && viewMode !== 'list') {
            fetchDetails();
        }
    }, [selectedConfig, viewMode]);

    const fetchDetails = async () => {
        if (!selectedConfig) return;
        try {
            const [qData, rData] = await Promise.all([
                supabaseService.getSurveyQuestions(selectedConfig.id),
                supabaseService.getSurveySummary(selectedConfig.id)
            ]);
            setQuestions(qData);
            setResponses(rData);
        } catch (error) {
            console.error("Failed to fetch survey details", error);
        }
    };

    const handleCreateRound = async () => {
        if (!newRoundName.trim()) return;
        setIsCreatingRound(true);
        try {
            const newRound = await supabaseService.startNewSurveyRound(newRoundName);
            await fetchConfigs();
            setNewRoundName('');
            setIsCreatingRound(false);
            alert("เปิดรอบการประเมินใหม่สำเร็จ!");
        } catch (error) {
            alert("ไม่สามารถเปิดรอบการประเมินได้");
            setIsCreatingRound(false);
        }
    };

    const handleToggleActive = async (config: SurveyConfig) => {
        try {
            await supabaseService.toggleSurveyStatus(config.id, !config.isActive);
            await fetchConfigs();
        } catch (error) {
            alert("ไม่สามารถเปลี่ยนสถานะได้");
        }
    };

    const handleDeleteRound = async (id: string) => {
        if (!window.confirm("ยืนยันการลบการสำรวจนี้? ข้อมูลคำถามและคำตอบทั้งหมดจะถูกลบถาวร")) return;
        try {
            await supabaseService.deleteSurveyRound(id);
            await fetchConfigs();
            if (selectedConfig?.id === id) setSelectedConfig(null);
        } catch (error) {
            alert("ไม่สามารถลบได้");
        }
    };

    const handleAddQuestion = () => {
        const newQ: any = {
            id: 'temp-' + Date.now(),
            questionText: '',
            questionType: 'rating',
            orderIndex: questions.length
        };
        setQuestions([...questions, newQ]);
    };

    const handleRemoveQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleQuestionChange = (id: string, field: string, value: any) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const handleSaveQuestions = async () => {
        if (!selectedConfig) return;
        setIsSaving(true);
        try {
            await supabaseService.saveSurveyQuestions(selectedConfig.id, questions);
            alert("บันทึกคำถามสำเร็จ!");
            setViewMode('list');
        } catch (error) {
            alert("ไม่สามารถบันทึกคำถามได้");
        } finally {
            setIsSaving(false);
        }
    };

    const summaryData = useMemo(() => {
        if (!questions.length || !responses.length) return [];
        
        return questions.filter(q => q.questionType === 'rating').map(q => {
            const scores = responses.map(r => r.answers[q.id]).filter(v => typeof v === 'number');
            const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
            return {
                name: q.questionText,
                score: parseFloat(avg as string),
                count: scores.length
            };
        });
    }, [questions, responses]);

    const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e'];

    if (isLoading) return <div className="p-10 text-center">กำลังโหลดข้อมูล...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {viewMode === 'list' && (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">จัดการรอบการสำรวจความพึงพอใจ</h3>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                             <input 
                                type="text" 
                                value={newRoundName}
                                onChange={e => setNewRoundName(e.target.value)}
                                placeholder="ชื่อรอบการสำรวจใหม่..."
                                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 flex-grow"
                            />
                            <button
                                onClick={handleCreateRound}
                                disabled={isCreatingRound || !newRoundName.trim()}
                                className="flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                            >
                                <PlusIcon className="w-4 h-4" />
                                เปิดรอบประเมินใหม่
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {configs.map(config => (
                            <div key={config.id} className={`p-6 border rounded-xl shadow-sm transition-all ${config.isActive ? 'border-sky-500 bg-sky-50/30 dark:bg-sky-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">{config.roundName}</h4>
                                            {config.isActive ? (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">กำลังเปิดรับประเมิน</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">ปิดแล้ว</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">สร้างเมื่อ: {config.createdAt.toLocaleDateString('th-TH')}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setSelectedConfig(config); setViewMode('summary'); }}
                                            className="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors"
                                            title="ดูสรุปผล"
                                        >
                                            <ChartBarIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedConfig(config); setViewMode('edit'); }}
                                            className="p-2 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title="แก้ไขคำถาม"
                                        >
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(config)}
                                            className={`p-2 rounded-lg transition-colors ${config.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                                            title={config.isActive ? "ปิดการประเมิน" : "เปิดการประเมิน"}
                                        >
                                            <ArrowPathIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRound(config.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="ลบ"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {configs.length === 0 && (
                            <div className="text-center py-20 text-slate-500">ยังไม่มีรอบการสำรวจในระบบ</div>
                        )}
                    </div>
                </>
            )}

            {viewMode === 'edit' && selectedConfig && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <button onClick={() => setViewMode('list')} className="text-sm text-sky-600 hover:underline mb-1">← กลับไปหน้ารายการ</button>
                            <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">แก้ไขคำถาม: {selectedConfig.roundName}</h3>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleAddQuestion}
                                className="flex-grow md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                เพิ่มคำถาม
                            </button>
                            <button
                                onClick={handleSaveQuestions}
                                disabled={isSaving}
                                className="flex-grow md:flex-none flex items-center justify-center gap-2 bg-sky-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-sky-700 shadow-md disabled:opacity-50"
                            >
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึกคำถาม'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex gap-4 items-start">
                                <div className="bg-slate-100 dark:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-grow space-y-3">
                                    <input 
                                        type="text"
                                        value={q.questionText}
                                        onChange={e => handleQuestionChange(q.id, 'questionText', e.target.value)}
                                        placeholder="พิมพ์คำถามที่นี่..."
                                        className="w-full border-b border-slate-200 dark:border-slate-700 bg-transparent py-2 text-lg focus:border-sky-500 outline-none transition-colors"
                                    />
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                checked={q.questionType === 'rating'} 
                                                onChange={() => handleQuestionChange(q.id, 'questionType', 'rating')}
                                                className="text-sky-600"
                                            />
                                            ให้คะแนน (1-5 ดาว)
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                checked={q.questionType === 'text'} 
                                                onChange={() => handleQuestionChange(q.id, 'questionType', 'text')}
                                                className="text-sky-600"
                                            />
                                            ข้อความอิสระ
                                        </label>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveQuestion(q.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                        {questions.length === 0 && (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
                                ยังไม่มีคำถาม กรุณากดปุ่มเพิ่มคำถาม
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'summary' && selectedConfig && (
                <div className="space-y-6">
                     <div className="flex justify-between items-center no-print">
                        <div>
                            <button onClick={() => setViewMode('list')} className="text-sm text-sky-600 hover:underline mb-1">← กลับไปหน้ารายการ</button>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">สรุปผลการประเมิน: {selectedConfig.roundName}</h3>
                        </div>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <PrinterIcon className="w-4 h-4" />
                            พิมพ์รายงาน / PDF
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                        <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <p className="text-sm text-slate-500 uppercase tracking-wider font-bold">จำนวนผู้ทำแบบสำรวจ</p>
                            <p className="text-3xl font-bold text-sky-600 mt-2">{responses.length} หน่วยงาน</p>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <p className="text-sm text-slate-500 uppercase tracking-wider font-bold">คะแนนเฉลี่ยรวม</p>
                            <p className="text-3xl font-bold text-indigo-600 mt-2">
                                {summaryData.length > 0 ? (summaryData.reduce((a, b) => a + b.score, 0) / summaryData.length).toFixed(2) : '0.00'} / 5.00
                            </p>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <p className="text-sm text-slate-500 uppercase tracking-wider font-bold">สถานะปัจจุบัน</p>
                            <p className={`text-xl font-bold mt-2 ${selectedConfig.isActive ? 'text-green-600' : 'text-slate-500'}`}>
                                {selectedConfig.isActive ? 'กำลังเปิดรับข้อมูล' : 'ปิดรับข้อมูลแล้ว'}
                            </p>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-6">คะแนนเฉลี่ยรายหัวข้อ</h4>
                        <div className="h-[300px] md:h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summaryData} layout="vertical" margin={{ left: window.innerWidth < 768 ? 20 : 150, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" domain={[0, 5]} />
                                    <YAxis dataKey="name" type="category" width={window.innerWidth < 768 ? 80 : 140} tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                                        {summaryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">ข้อเสนอแนะเพิ่มเติม</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {responses.flatMap(r => 
                                questions.filter(q => q.questionType === 'text').map(q => {
                                    const val = r.answers[q.id];
                                    if (!val) return null;
                                    return (
                                        <div key={`${r.id}-${q.id}`} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">{q.questionText}</p>
                                            <p className="text-slate-700 dark:text-slate-300 italic">"{val}"</p>
                                        </div>
                                    );
                                })
                            ).filter(Boolean)}
                            {responses.length === 0 && <p className="text-center py-10 text-slate-500">ยังไม่มีข้อเสนอแนะ</p>}
                        </div>
                    </div>

                    {/* Print-only header */}
                    <div className="hidden print:block">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-bold">รายงานสรุปผลการสำรวจความพึงพอใจ</h2>
                            <p className="text-lg">{selectedConfig.roundName}</p>
                            <p className="text-sm text-slate-500">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')}</p>
                        </div>
                        <div className="mb-8">
                            <h3 className="font-bold border-b pb-2 mb-4">สรุปภาพรวม</h3>
                            <p>จำนวนผู้ทำแบบสำรวจ: {responses.length} หน่วยงาน</p>
                            <p>คะแนนเฉลี่ยรวม: {summaryData.length > 0 ? (summaryData.reduce((a, b) => a + b.score, 0) / summaryData.length).toFixed(2) : '0.00'} / 5.00</p>
                        </div>
                        <div className="mb-8">
                            <h3 className="font-bold border-b pb-2 mb-4">คะแนนรายข้อ</h3>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="border p-2">คำถาม</th>
                                        <th className="border p-2 text-center">คะแนนเฉลี่ย</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.map((d, i) => (
                                        <tr key={i}>
                                            <td className="border p-2">{d.name}</td>
                                            <td className="border p-2 text-center font-bold">{d.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
