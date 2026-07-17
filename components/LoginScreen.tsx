import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import UserIcon from './icons/UserIcon';
import LockClosedIcon from './icons/LockClosedIcon';
import EyeIcon from './icons/EyeIcon';
import EyeSlashIcon from './icons/EyeSlashIcon';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: authError } = await supabaseService.login(username, password);
      
      if (authError) {
        if (authError.message === 'Invalid login credentials') {
            setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        } else {
            setError('เกิดข้อผิดพลาด: ' + authError.message);
        }
      }
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-10 animate-fade-in border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                เข้าสู่ระบบ
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                กรอกข้อมูลผู้ใช้งานและรหัสผ่านเพื่อเริ่มต้น
            </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
            <div>
                <label htmlFor="username" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อผู้ใช้งาน
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200 transition-all"
                        required
                        autoComplete="username"
                        autoCapitalize="none"
                        placeholder="Username"
                    />
                </div>
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    รหัสผ่าน
                </label>
                 <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200 transition-all"
                        required
                        autoComplete="current-password"
                        placeholder="Password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                    >
                        {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400 text-center animate-shake font-medium">{error}</p>}
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sky-600 text-white font-bold py-3.5 px-4 rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all duration-300 disabled:bg-slate-400 transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-sky-500/20"
            >
                {isLoading ? 'กำลังตรวจสอบข้อมูล...' : 'เข้าสู่ระบบ'}
            </button>
        </form>

        <p className="mt-10 text-center text-sm text-slate-600 dark:text-slate-400">
            ยังไม่มีบัญชีใช้งาน?{' '}
            <button
                onClick={onSwitchToRegister}
                className="font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-500 hover:underline"
            >
                ลงทะเบียนที่นี่
            </button>
        </p>
    </div>
  );
};

export default LoginScreen;
