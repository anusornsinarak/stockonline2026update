
// @ts-nocheck
import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: any; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center border border-slate-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">พบข้อผิดพลาดในการโหลดระบบ</h1>
            <p className="text-sm text-slate-600 mb-6">
              อาจเกิดจากเบราว์เซอร์ยังคงบันทึกข้อมูลรุ่นเดิมไว้ (Cache) ท่านสามารถกดปุ่มด้านล่างเพื่อล้างข้อมูลและโหลดใหม่ได้ทันที
            </p>
            <button
              onClick={() => {
                if ('caches' in window) {
                  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
                    window.location.reload();
                  });
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition shadow-md"
            >
              🔄 ล้างแคชและโหลดระบบใหม่
            </button>
            {this.state.error && (
              <pre className="mt-4 p-3 bg-slate-50 text-slate-500 rounded-lg text-xs text-left overflow-x-auto max-h-32 border">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Manage Service Worker for PWA
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  } else {
    // In dev environment, unregister old service workers and purge caches to avoid stale React chunk conflicts
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then(keys => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
