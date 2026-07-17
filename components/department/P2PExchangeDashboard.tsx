
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Department, Product, User, P2PExchangePosting } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../supabaseClient';
import Modal from '../Modal';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import ArrowUturnLeftIcon from '../icons/ArrowUturnLeftIcon';
import ArrowPathIcon from '../icons/ArrowPathIcon';

type DepartmentStock = { departmentId: string; departmentName: string; quantity: number };

// Modal for creating a new post
const P2PPostModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    department: Department;
    type: 'OFFER' | 'REQUEST';
    onSave: () => void;
    preselectedProductId: string | null;
}> = ({ isOpen, onClose, department, type, onSave, preselectedProductId }) => {
    const [departmentInventory, setDepartmentInventory] = useState<{product: Product, quantity: number}[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const title = type === 'OFFER' ? 'ลงประกาศของเหลือ' : 'ลงประกาศของที่ต้องการ';
    const availableItems = type === 'OFFER' ? departmentInventory.map(i => i.product) : allProducts;
    const maxQuantity = type === 'OFFER' ? departmentInventory.find(i => i.product.id === selectedProductId)?.quantity || 0 : undefined;

    useEffect(() => {
        if (isOpen) {
            setError('');
            setQuantity(1);
            setNotes('');
            setSelectedProductId(preselectedProductId || '');

            if (type === 'OFFER') {
                supabaseService.getDepartmentInventory(department.id)
                    .then(async (inv) => {
                        const productIds = inv.map(i => i.productId);
                        const products = await supabaseService.getProducts();
                        const invWithProducts = inv.map(i => ({
                            product: products.find(p => p.id === i.productId)!,
                            quantity: i.quantity
                        })).filter(i => i.product);
                        setDepartmentInventory(invWithProducts);
                    });
            } else {
                supabaseService.getProducts().then(setAllProducts);
            }
        }
    }, [isOpen, type, department.id, preselectedProductId]);

    const handleSubmit = async () => {
        if (!selectedProductId || quantity <= 0) {
            setError('กรุณาเลือกรายการและระบุจำนวนที่ถูกต้อง');
            return;
        }
        if (maxQuantity !== undefined && quantity > maxQuantity) {
            setError(`จำนวนที่เสนอให้ต้องไม่เกินที่มีในคลัง (${maxQuantity})`);
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await supabaseService.createP2PPosting({
                postingDepartmentId: department.id,
                productId: selectedProductId,
                quantity,
                notes,
                postType: type,
            });
            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <div>
                    <label>รายการ</label>
                    <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full mt-1 p-2 border rounded dark:bg-slate-700 dark:border-slate-600">
                        <option value="">-- เลือกรายการ --</option>
                        {availableItems.sort((a,b) => a.name.localeCompare(b.name, 'th')).map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} {type === 'OFFER' ? `(มี ${departmentInventory.find(i => i.product.id === p.id)?.quantity})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                 <div>
                    <label>จำนวน</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value, 10))} min="1" max={maxQuantity} className="w-full mt-1 p-2 border rounded dark:bg-slate-700 dark:border-slate-600"/>
                    {maxQuantity !== undefined && <p className="text-xs text-slate-500 dark:text-slate-400">สูงสุด: {maxQuantity}</p>}
                </div>
                 <div>
                    <label>หมายเหตุ (ถ้ามี)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full mt-1 p-2 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="เช่น ใกล้หมดอายุ, เหลือจากเคส"/>
                </div>
                {error && <p className="text-red-500">{error}</p>}
                <div className="flex justify-end gap-2 pt-4">
                    <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 py-2 px-4 rounded-lg">ยกเลิก</button>
                    <button onClick={handleSubmit} disabled={isSaving} className="bg-blue-500 text-white py-2 px-4 rounded-lg disabled:bg-slate-400">
                        {isSaving ? 'กำลังบันทึก...' : 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}


// Main Dashboard Component
const P2PExchangeDashboard: React.FC<{ user: User; department: Department }> = ({ user, department }) => {
    const [view, setView] = useState<'tabs' | 'search'>('tabs');
    const [activeTab, setActiveTab] = useState<'offers' | 'requests' | 'mine'>('offers');
    const [postings, setPostings] = useState<P2PExchangePosting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'OFFER' | 'REQUEST'>('OFFER');
    const [preselectedProductForModal, setPreselectedProductForModal] = useState<string | null>(null);
    const [showRefreshBanner, setShowRefreshBanner] = useState(false);

    // Search state
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [searchedProduct, setSearchedProduct] = useState<Product | null>(null);
    const [searchResults, setSearchResults] = useState<{ offers: P2PExchangePosting[], departmentStocks: DepartmentStock[] } | null>(null);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    
    const playNotificationSound = useCallback(() => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (!audioContext) return;
            if (audioContext.state === 'suspended') { audioContext.resume(); }
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
            gainNode.gain.setValueAtTime(0.07, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            oscillator.onended = () => { audioContext.close().catch(() => {}); };
        } catch (e) { console.error("Could not play notification sound:", e); }
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [postingsData, productsData] = await Promise.all([
                supabaseService.getP2PPostings(),
                supabaseService.getProducts()
            ]);
            setPostings(postingsData);
            setAllProducts(productsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const channel = supabase.channel('public:p2p_exchange_postings')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'p2p_exchange_postings' },
                (payload) => {
                    if (payload.new && payload.new.posting_department_id !== department.id) {
                        setShowRefreshBanner(true);
                        playNotificationSound();
                    }
                }
            )
            .subscribe();
    
        return () => {
            supabase.removeChannel(channel);
        };
    }, [department.id, playNotificationSound]);
    
    const handleRefresh = () => {
        setShowRefreshBanner(false);
        fetchData();
    };

    const handleOpenModal = (type: 'OFFER' | 'REQUEST') => {
        setModalType(type);
        setIsModalOpen(true);
    };
    
    const handleCreateRequestForProduct = (productId: string) => {
        setPreselectedProductForModal(productId);
        handleOpenModal('REQUEST');
    };

    const handleClaim = async (post: P2PExchangePosting) => {
        if (!window.confirm(`คุณต้องการรับ "${post.product?.name}" จำนวน ${post.quantity} ชิ้น จากหน่วยงาน "${post.department?.name}" หรือไม่? การดำเนินการนี้จะปรับสต็อกของทั้งสองหน่วยงาน`)) return;
        try {
            await supabaseService.fulfillP2PPosting(post.id, department.id);
            alert('รับของสำเร็จ!');
            fetchData();
            if (view === 'search' && searchedProduct) {
                handleSearch(searchedProduct.id);
            }
        } catch (err) {
            alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleCancel = async (post: P2PExchangePosting) => {
        if (!window.confirm(`คุณต้องการยกเลิกประกาศนี้ใช่หรือไม่?`)) return;
        try {
            await supabaseService.cancelP2PPosting(post.id);
            alert('ยกเลิกประกาศสำเร็จ');
            fetchData();
        } catch (err) {
            alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    
    const handleSearch = async (productId: string) => {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;
        setSearchedProduct(product);
        setIsSearchLoading(true);
        setView('search');
        try {
            const results = await supabaseService.searchP2P(productId, department.id);
            setSearchResults(results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearchLoading(false);
        }
    };
    
    const searchableProducts = useMemo(() => {
        if (!productSearchTerm.trim()) return [];
        return allProducts
            .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
            .sort((a,b) => a.name.localeCompare(b.name, 'th'))
            .slice(0, 7);
    }, [productSearchTerm, allProducts]);

    const renderPostings = (data: P2PExchangePosting[], context: 'tabs' | 'search') => {
        if (data.length === 0 && context === 'tabs') return <p className="text-center text-slate-500 py-8">ไม่มีประกาศ</p>;
        if (data.length === 0 && context === 'search') return <p className="text-slate-500 py-2">ไม่พบประกาศเสนอให้สำหรับรายการนี้</p>;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.map(post => (
                    <div key={post.id} className="border rounded-lg p-4 bg-white dark:bg-slate-800 flex flex-col">
                        <div className="flex-grow space-y-2">
                            <h3 className="font-bold text-lg">{post.product?.name}</h3>
                            <p>จำนวน: <span className="font-semibold">{post.quantity} {post.product?.unit}</span></p>
                            <p>จาก: <span className="font-semibold">{post.department?.name}</span></p>
                            <p className="text-xs text-slate-500">ประกาศเมื่อ: {new Date(post.createdAt).toLocaleDateString('th-TH')}</p>
                            {post.notes && <p className="text-sm bg-slate-100 dark:bg-slate-700 p-2 rounded">หมายเหตุ: {post.notes}</p>}
                        </div>
                        <div className="mt-4 pt-4 border-t dark:border-slate-700">
                            <button onClick={() => handleClaim(post)} className="w-full bg-green-500 text-white font-bold py-2 rounded-lg hover:bg-green-600">
                                ขอรับ
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const offers = postings.filter(p => p.status === 'ACTIVE' && p.postType === 'OFFER' && p.postingDepartmentId !== department.id);
    const requests = postings.filter(p => p.status === 'ACTIVE' && p.postType === 'REQUEST' && p.postingDepartmentId !== department.id);
    const myPostings = postings.filter(p => p.status === 'ACTIVE' && p.postingDepartmentId === department.id);

    return (
        <div className="max-w-7xl mx-auto bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl">
            {showRefreshBanner && (
                 <div className="mb-4 p-3 bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 rounded-lg flex justify-between items-center animate-fade-in">
                    <span>มีประกาศแลกเปลี่ยนใหม่!</span>
                    <button onClick={handleRefresh} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-1 px-3 rounded-lg">
                        <ArrowPathIcon className="w-4 h-4" />
                        รีเฟรช
                    </button>
                </div>
            )}
            {view === 'tabs' ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">ระบบแลกเปลี่ยนระหว่างหน่วยงาน</h2>
                        <div className="flex gap-2">
                            <button onClick={() => handleOpenModal('OFFER')} className="flex items-center gap-2 bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
                                <PlusIcon className="w-5 h-5"/> ลงประกาศของเหลือ
                            </button>
                            <button onClick={() => handleOpenModal('REQUEST')} className="flex items-center gap-2 bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600">
                                <PlusIcon className="w-5 h-5"/> ลงประกาศของที่ต้องการ
                            </button>
                        </div>
                    </div>

                    <div className="mb-4 p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg">
                        <label htmlFor="product-search" className="block text-md font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><MagnifyingGlassIcon className="w-5 h-5"/> ค้นหาเวชภัณฑ์</label>
                        <div className="relative">
                             <input
                                id="product-search"
                                type="text"
                                placeholder="พิมพ์ชื่อเวชภัณฑ์เพื่อดูว่าใครมีของ หรือมีใครเสนอให้บ้าง..."
                                value={productSearchTerm}
                                onChange={e => setProductSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
                                autoComplete="off"
                            />
                            {searchableProducts.length > 0 && (
                                <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                                    {searchableProducts.map(p => (
                                        <button key={p.id} onClick={() => { handleSearch(p.id); setProductSearchTerm(''); }} className="w-full text-left px-4 py-3 hover:bg-sky-50 dark:hover:bg-sky-900/50">
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-b border-slate-200 dark:border-slate-700 mb-4">
                        <nav className="-mb-px flex space-x-6">
                            <button onClick={() => setActiveTab('offers')} className={`${activeTab === 'offers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'} pb-2 border-b-2`}>ของที่มีให้</button>
                            <button onClick={() => setActiveTab('requests')} className={`${activeTab === 'requests' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500'} pb-2 border-b-2`}>ของที่ต้องการ</button>
                            <button onClick={() => setActiveTab('mine')} className={`${activeTab === 'mine' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'} pb-2 border-b-2`}>ประกาศของฉัน</button>
                        </nav>
                    </div>
                    
                    {error && <p className="text-red-500">{error}</p>}

                    {activeTab === 'offers' && renderPostings(offers, 'tabs')}
                    {activeTab === 'requests' && renderPostings(requests, 'tabs')}
                    {activeTab === 'mine' && (myPostings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myPostings.map(post => (
                                <div key={post.id} className="border rounded-lg p-4 bg-white dark:bg-slate-800 flex flex-col">
                                    <div className="flex-grow space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-lg pr-2">{post.product?.name}</h3>
                                            {post.postType === 'OFFER' ? (
                                                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded-full flex-shrink-0">ประกาศให้</span>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-800 rounded-full flex-shrink-0">ประกาศขอ</span>
                                            )}
                                        </div>
                                        <p>จำนวน: <span className="font-semibold">{post.quantity} {post.product?.unit}</span></p>
                                        <p className="text-xs text-slate-500">ประกาศเมื่อ: {new Date(post.createdAt).toLocaleDateString('th-TH')}</p>
                                        {post.notes && <p className="text-sm bg-slate-100 dark:bg-slate-700 p-2 rounded">หมายเหตุ: {post.notes}</p>}
                                    </div>
                                    <div className="mt-4 pt-4 border-t dark:border-slate-700">
                                        <button onClick={() => handleCancel(post)} className="w-full bg-red-500 text-white font-bold py-2 rounded-lg hover:bg-red-600">
                                            ยกเลิกประกาศ
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-center text-slate-500 py-8">ไม่มีประกาศ</p>)}
                </>
            ) : ( // Search View
                <div className="animate-fade-in">
                    <button onClick={() => setView('tabs')} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 font-medium mb-4">
                        <ArrowUturnLeftIcon className="w-5 h-5"/>
                        <span>กลับไปหน้ารวม</span>
                    </button>
                    <h2 className="text-2xl font-bold mb-4">ผลการค้นหาสำหรับ: <span className="text-sky-600 dark:text-sky-400">{searchedProduct?.name}</span></h2>
                    
                    {isSearchLoading ? <p>กำลังค้นหา...</p> : error ? <p className="text-red-500">{error}</p> : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">ประกาศที่มีผู้เสนอให้</h3>
                                {searchResults && renderPostings(searchResults.offers, 'search')}
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">หน่วยงานอื่นที่มีในคลัง</h3>
                                {searchResults && searchResults.departmentStocks.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {searchResults.departmentStocks.map(stock => (
                                            <div key={stock.departmentId} className="border rounded-lg p-4 bg-white dark:bg-slate-800 flex flex-col justify-between">
                                                <div>
                                                    <p className="font-semibold text-lg">{stock.departmentName}</p>
                                                    <p>มีในคลัง: <span className="font-bold text-blue-600">{stock.quantity}</span> ชิ้น</p>
                                                </div>
                                                 <button onClick={() => handleCreateRequestForProduct(searchedProduct!.id)} className="mt-4 w-full bg-orange-500 text-white font-bold py-2 rounded-lg hover:bg-orange-600">
                                                    สร้างคำขอ
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-slate-500 py-2">ไม่พบหน่วยงานอื่นที่มีรายการนี้ในคลัง</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <P2PPostModal 
                isOpen={isModalOpen} 
                onClose={() => { setIsModalOpen(false); setPreselectedProductForModal(null); }} 
                department={department} 
                type={modalType} 
                onSave={fetchData} 
                preselectedProductId={preselectedProductForModal}
            />
        </div>
    );
};

export default P2PExchangeDashboard;
