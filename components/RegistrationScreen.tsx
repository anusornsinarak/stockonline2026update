
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Department } from '../types';
import UserPlusIcon from './icons/UserPlusIcon';
import UserIcon from './icons/UserIcon';
import LockClosedIcon from './icons/LockClosedIcon';
import AtSymbolIcon from './icons/AtSymbolIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';


interface RegistrationScreenProps {
  onSwitchToLogin: () => void;
}

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Setting loading to true for departments fetch, but not for the whole component
    supabaseService.getDepartments()
      .then(depts => {
        setDepartments(depts);
        if (depts.length > 0) {
          setDepartmentId(depts[0].id);
        }
      })
      .catch(err => {
        console.error(err);
        setError("ไม่สามารถโหลดรายชื่อหน่วยงานได้");
      });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) {
        setError("กรุณาเลือกหน่วยงาน");
        return;
    }
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const { isUnconfirmed } = await supabaseService.registerUser({ username, email, password, departmentId });
      
      if (isUnconfirmed) {
        // This case handles when "Confirm email" is ON in Supabase settings.
        setSuccessMessage("ลงทะเบียนสำเร็จ! ระบบได้ส่งอีเมลยืนยันไปแล้ว กรุณาตรวจสอบอีเมลของท่านเพื่อยืนยันบัญชี (หากไม่ได้รับ กรุณาติดต่อผู้ดูแลระบบ)");
      } else {
         // This happens if "Confirm email" is turned OFF in Supabase settings.
         setSuccessMessage("ลงทะเบียนสำเร็จ! คุณสามารถกลับไปที่หน้าเข้าสู่ระบบเพื่อใช้งานได้ทันที");
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-6">
            <div className="bg-sky-100 dark:bg-sky-900/50 p-4 rounded-full mb-4 ring-8 ring-sky-50 dark:ring-sky-900/20">
                <UserPlusIcon className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            </div>
            <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">
              สร้างบัญชีใหม่
            </h2>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-2">
              กรอกข้อมูลเพื่อลงทะเบียนใช้งาน
            </p>
        </div>

        {successMessage ? (
          <div className="text-center p-4 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-lg">
            <p className="font-semibold">สำเร็จ!</p>
            <p className="mt-2 text-sm">{successMessage}</p>
             <button onClick={onSwitchToLogin} className="mt-4 w-full bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700">
                กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
                <label htmlFor="reg-username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ชื่อผู้ใช้</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input id="reg-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200" required placeholder="username"/>
                </div>
            </div>
            <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">อีเมล</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <AtSymbolIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200" required placeholder="email@example.com"/>
                </div>
            </div>
            <div>
              <label htmlFor="reg-password"className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">รหัสผ่าน</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200" required autoComplete="new-password" placeholder="••••••••" />
              </div>
            </div>
             <div>
                <label htmlFor="reg-department" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">หน่วยงาน</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <select id="reg-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-sky-500" required disabled={departments.length === 0}>
                        {departments.length > 0 ? (
                            departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                        ) : (
                            <option disabled>กำลังโหลดหน่วยงาน...</option>
                        )}
                    </select>
                     <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                    </div>
                </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400 text-center animate-shake">{error}</p>}
            <button
              type="submit"
              disabled={isLoading || departments.length === 0}
              className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-all transform hover:scale-105"
            >
              {isLoading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
            มีบัญชีอยู่แล้ว?{' '}
            <button onClick={onSwitchToLogin} className="font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-500 focus:outline-none hover:underline">
                เข้าสู่ระบบที่นี่
            </button>
        </p>
    </div>
  );
};

export default RegistrationScreen;
