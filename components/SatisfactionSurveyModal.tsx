
import React, { useState, useEffect } from 'react';
import { User, SurveyConfig, SurveyQuestion } from '../types';
import { supabaseService } from '../services/supabaseService';
import Modal from './Modal';
import StarIcon from './icons/StarIcon';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';

interface SatisfactionSurveyModalProps {
    user: User;
    onComplete: () => void;
}

const SatisfactionSurveyModal: React.FC<SatisfactionSurveyModalProps> = ({ user, onComplete }) => {
    const [config, setConfig] = useState<SurveyConfig | null>(null);
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkSurvey = async () => {
            if (!user.departmentId) {
                setIsLoading(false);
                return;
            }
            
            try {
                const activeConfig = await supabaseService.getActiveSurveyConfig();
                if (activeConfig) {
                    const hasAnswered = await supabaseService.checkDepartmentSurveyStatus(activeConfig.id, user.departmentId);
                    if (!hasAnswered) {
                        const qData = await supabaseService.getSurveyQuestions(activeConfig.id);
                        if (qData.length > 0) {
                            setConfig(activeConfig);
                            setQuestions(qData);
                            setIsOpen(true);
                        }
                    }
                }
            } catch (error) {
                // Suppress internal network errors that don't affect core functionality
                if (!(error instanceof TypeError && error.message.includes('fetch'))) {
                    console.error("Survey check failed", error);
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkSurvey();
    }, [user.departmentId]);

    const handleRatingChange = (questionId: string, rating: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: rating }));
    };

    const handleTextChange = (questionId: string, text: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: text }));
    };

    const handleSubmit = async () => {
        // Validate: all rating questions must be answered
        const ratingQuestions = questions.filter(q => q.questionType === 'rating');
        const allAnswered = ratingQuestions.every(q => answers[q.id] !== undefined);
        
        if (!allAnswered) {
            alert("กรุณาให้คะแนนให้ครบทุกข้อก่อนส่งแบบสำรวจ");
            return;
        }

        if (!config || !user.departmentId) return;

        setIsSubmitting(true);
        try {
            await supabaseService.submitSurveyResponse({
                configId: config.id,
                departmentId: user.departmentId,
                userId: user.id,
                answers
            });
            setIsOpen(false);
            onComplete();
            alert("ขอบคุณสำหรับข้อมูล! ความเห็นของคุณมีค่าต่อการพัฒนาระบบของเรา");
        } catch (error) {
            alert("ไม่สามารถส่งแบบสำรวจได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={() => {}} // Force completion
            title={config?.roundName || 'แบบสำรวจความพึงพอใจ'}
            size="2xl"
        >
            <div className="space-y-6 md:space-y-8 py-2 md:py-4">
                <div className="bg-sky-50 dark:bg-sky-900/20 p-3 md:p-4 rounded-xl border border-sky-100 dark:border-sky-800 text-sky-800 dark:text-sky-200 text-xs md:text-sm">
                    <p className="font-bold mb-1">เรียน ผู้ใช้งานระบบทุกท่าน</p>
                    <p>เพื่อพัฒนาประสิทธิภาพการทำงานของระบบเบิกเวชภัณฑ์มิใช่ยาให้ดียิ่งขึ้น รบกวนท่านสละเวลาสั้นๆ เพื่อประเมินความพึงพอใจในการใช้งาน (ข้อมูลจะถูกเก็บเป็นความลับในระดับหน่วยงาน)</p>
                </div>

                <div className="space-y-8 md:space-y-10">
                    {questions.map((q, idx) => (
                        <div key={q.id} className="space-y-3">
                            <h4 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex gap-2 md:gap-3">
                                <span className="text-sky-500">{idx + 1}.</span>
                                {q.questionText}
                            </h4>
                            
                            {q.questionType === 'rating' ? (
                                <div className="flex justify-center gap-2 md:gap-4 py-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => handleRatingChange(q.id, star)}
                                            className="group flex flex-col items-center gap-1 transition-transform hover:scale-110"
                                        >
                                            <StarIcon 
                                                className={`w-10 h-10 md:w-12 md:h-12 transition-colors ${
                                                    (answers[q.id] || 0) >= star 
                                                    ? 'text-amber-400 fill-amber-400' 
                                                    : 'text-slate-200 dark:text-slate-700 hover:text-amber-200'
                                                }`} 
                                            />
                                            <span className={`text-[10px] md:text-xs font-bold ${answers[q.id] === star ? 'text-sky-600' : 'text-slate-400'}`}>
                                                {star === 1 ? 'น้อยที่สุด' : star === 5 ? 'มากที่สุด' : ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <textarea
                                    value={answers[q.id] || ''}
                                    onChange={e => handleTextChange(q.id, e.target.value)}
                                    placeholder="พิมพ์ข้อเสนอแนะเพิ่มเติม..."
                                    rows={3}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 md:p-4 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-sky-500 outline-none transition-all text-sm"
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-4 rounded-xl hover:bg-sky-700 shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                        {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งแบบสำรวจความพึงพอใจ'}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-4">ขอบพระคุณสำหรับความร่วมมือ</p>
                </div>
            </div>
        </Modal>
    );
};

export default SatisfactionSurveyModal;
