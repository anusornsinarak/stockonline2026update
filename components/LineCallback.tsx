import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';

const LineCallback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [status, setStatus] = useState('กำลังเชื่อมต่อบัญชี LINE...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            if (!user) {
                setError('กรุณาเข้าสู่ระบบก่อนทำการเชื่อมต่อ LINE');
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            const searchParams = new URLSearchParams(location.search);
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const errorParam = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            if (errorParam) {
                setError(`เกิดข้อผิดพลาดจาก LINE: ${errorDescription || errorParam}`);
                setTimeout(() => navigate('/settings'), 3000);
                return;
            }

            const savedState = localStorage.getItem('line_oauth_state');
            if (!state || state !== savedState) {
                setError('ข้อมูล State ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                setTimeout(() => navigate('/settings'), 3000);
                return;
            }

            if (!code) {
                setError('ไม่พบ Authorization Code');
                setTimeout(() => navigate('/settings'), 3000);
                return;
            }

            try {
                // Exchange code for token
                const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: `${window.location.origin}/line-callback`,
                        client_id: '2008863486',
                        client_secret: 'ed5f05c369f4dec887d1b02781b35742',
                    }),
                });

                const tokenData = await tokenResponse.json();

                if (!tokenResponse.ok) {
                    throw new Error(tokenData.error_description || 'Failed to get access token');
                }

                // Get user profile
                const profileResponse = await fetch('https://api.line.me/v2/profile', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                    },
                });

                const profileData = await profileResponse.json();

                if (!profileResponse.ok) {
                    throw new Error(profileData.message || 'Failed to get user profile');
                }

                // Save to database
                await (supabaseService as any).upsertLineProfile(
                    user.id,
                    profileData.userId,
                    profileData.displayName,
                    profileData.pictureUrl || ''
                );

                setStatus('เชื่อมต่อบัญชี LINE สำเร็จ! กำลังพากลับ...');
                setTimeout(() => navigate('/settings'), 2000);

            } catch (err) {
                console.error('Error during LINE callback:', err);
                setError(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}`);
                setTimeout(() => navigate('/settings'), 3000);
            } finally {
                localStorage.removeItem('line_oauth_state');
            }
        };

        handleCallback();
    }, [location, navigate, user]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                {error ? (
                    <>
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">เชื่อมต่อไม่สำเร็จ</h2>
                        <p className="text-slate-600">{error}</p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 border-4 border-[#06C755] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">LINE Login</h2>
                        <p className="text-slate-600">{status}</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default LineCallback;
