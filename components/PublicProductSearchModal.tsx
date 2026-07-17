import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { PublicProductInfo, Product } from '../types';
import CubeIcon from './icons/CubeIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import MagnifyingGlassIcon from './icons/MagnifyingGlassIcon';
import Modal from './Modal';

type SearchResult = Pick<Product, 'id' | 'name' | 'unit' | 'zone' | 'minStock' | 'maxStock'> & { quantity: number };

const PublicProductSearchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedProductInfo, setSelectedProductInfo] = useState<PublicProductInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await supabaseService.searchPublicProducts(searchTerm);
                setSearchResults(results);
            } catch (err) {
                setError('Failed to search for products.');
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleProductSelect = async (productId: string) => {
        setIsLoading(true);
        setError(null);
        setSearchResults([]);
        setSearchTerm('');
        try {
            const productInfo = await supabaseService.getPublicProductInfo(productId);
            if (productInfo) {
                setSelectedProductInfo(productInfo);
            } else {
                setError(`Could not find information for the selected product.`);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Error fetching product details.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchAgain = () => {
        setSelectedProductInfo(null);
        setError(null);
        setSearchTerm('');
        setSearchResults([]);
        setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center p-8 text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูล...</div>;
        }

        if (error) {
            return (
                <div className="text-center p-8">
                    <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                    <button onClick={handleSearchAgain} className="mt-4 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg">
                        ลองอีกครั้ง
                    </button>
                </div>
            );
        }

        if (selectedProductInfo) {
            const isLowStock = selectedProductInfo.minStock !== null && selectedProductInfo.quantity < selectedProductInfo.minStock;
            return (
                <div className="text-center p-6 animate-fade-in">
                    <p className="text-muted-foreground text-lg">คงเหลือ</p>
                    <p className={`text-6xl font-bold my-2 ${isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}`}>
                        {selectedProductInfo.quantity.toLocaleString()}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedProductInfo.name}</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-300">
                        หน่วย: {selectedProductInfo.unit} | Zone: {selectedProductInfo.zone || 'N/A'}
                    </p>
                     <p className="text-md text-slate-500 dark:text-slate-400 mt-2">
                        Min: {selectedProductInfo.minStock ?? '-'} | Max: {selectedProductInfo.maxStock ?? '-'}
                    </p>
                    {isLowStock && (
                        <div className="mt-4 p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                            <ExclamationTriangleIcon className="w-5 h-5" />
                            <span>สต็อกใกล้หมด</span>
                        </div>
                    )}
                    <button onClick={handleSearchAgain} className="mt-6 w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700">
                        ค้นหารายการอื่น
                    </button>
                </div>
            );
        }

        return (
            <div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="พิมพ์ชื่อเวชภัณฑ์เพื่อค้นหา..."
                        className="w-full pl-10 pr-4 py-3 border-b dark:border-slate-600 focus:outline-none focus:ring-0 focus:border-sky-500 bg-transparent text-lg"
                    />
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {isSearching && <p className="p-4 text-center text-slate-500 dark:text-slate-400">กำลังค้นหา...</p>}
                    {!isSearching && searchResults.length > 0 && (
                        <ul>
                            {searchResults.map(product => {
                                const isLowStock = product.minStock !== null && product.quantity < product.minStock;
                                return (
                                <li key={product.id}>
                                    <button onClick={() => handleProductSelect(product.id)} className="w-full text-left p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-slate-200">{product.name}</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    หน่วย: {product.unit} | Zone: {product.zone || 'N/A'} | Min: {product.minStock ?? '-'} | Max: {product.maxStock ?? '-'}
                                                </p>
                                                 {isLowStock && (
                                                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                                                        <ExclamationTriangleIcon className="w-4 h-4" />
                                                        <span>สต็อกใกล้หมด</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-slate-500 dark:text-slate-400">คงเหลือ</p>
                                                <p className={`font-bold text-lg ${isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}`}>
                                                    {product.quantity.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            )})}
                        </ul>
                    )}
                    {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
                        <p className="p-4 text-center text-slate-500 dark:text-slate-400">ไม่พบรายการที่ค้นหา</p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="ค้นหาเพื่อตรวจสอบยอดคงคลัง" size="lg">
            {renderContent()}
        </Modal>
    );
};

export default PublicProductSearchModal;