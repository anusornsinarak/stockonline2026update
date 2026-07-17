import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Product, RequisitionItem } from '../types';
import { geminiService, ExtractedItem } from '../services/geminiService';
import UploadIcon from './icons/UploadIcon';
import CheckIcon from './icons/CheckIcon';
import ExclamationCircleIcon from './icons/ExclamationCircleIcon';

interface ScanDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    allProducts: Product[];
    onSave: (scannedItems: RequisitionItem[]) => void;
}

interface MatchedItem extends ExtractedItem {
    match: Product | null;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            if (base64String) {
                resolve(base64String);
            } else {
                reject(new Error("Failed to read file as Base64."));
            }
        };
        reader.onerror = error => reject(error);
    });
};

const ScanDocumentModal: React.FC<ScanDocumentModalProps> = ({ isOpen, onClose, allProducts, onSave }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);

    const productByNameMap = useMemo(() => new Map(allProducts.map(p => [p.name, p])), [allProducts]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMatchedItems([]);
            setError('');
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            await processImage(file);
        }
    };

    const processImage = async (file: File) => {
        setIsLoading(true);
        setError('');
        try {
            const base64 = await fileToBase64(file);
            const mimeType = file.type;
            const extractedItems = await geminiService.extractRequisitionItemsFromImage(base64, mimeType, allProducts);
            
            if (extractedItems.length === 0) {
                setError("AI could not find any recognizable items in the document.");
                setMatchedItems([]);
                setIsLoading(false);
                return;
            }

            const matched = extractedItems.map(item => {
                const matchedProduct = productByNameMap.get(item.itemName) || null;
                return { ...item, match: matchedProduct };
            });
            
            setMatchedItems(matched);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        const itemsToSave: RequisitionItem[] = matchedItems
            .filter(item => item.match)
            .map(item => ({
                requisitionId: '', // Will be set later
                productId: item.match!.id,
                quantity: item.quantity,
                pricePerUnit: item.match!.pricePerUnit || 0,
                product: item.match!,
                status: 'Pending',
                approvedQuantity: null,
                departmentStockOnSubmit: null,
                returnedQuantity: null,
            }));
        onSave(itemsToSave);
        handleClose();
    };
    
    const handleClose = () => {
        setImageFile(null);
        setImagePreview('');
        setMatchedItems([]);
        setError('');
        setIsLoading(false);
        onClose();
    };

    const hasUnmatchedItems = useMemo(() => matchedItems.some(item => !item.match), [matchedItems]);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="สแกนเอกสารเพื่อสร้างใบเบิก" size="3xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Uploader */}
                    <div className="space-y-2">
                        <label htmlFor="image-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-200">อัปโหลดรูปภาพ</label>
                        <div className="flex items-center justify-center w-full">
                            <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="h-full w-full object-contain rounded-lg" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadIcon className="w-8 h-8 mb-3 text-slate-500 dark:text-slate-400" />
                                        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">คลิกเพื่ออัปโหลด</span> หรือลากมาวาง</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG</p>
                                    </div>
                                )}
                                <input id="image-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} />
                            </label>
                        </div>
                    </div>
                    {/* Right: Results */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">รายการที่สแกนได้</label>
                        <div className="w-full h-48 border border-slate-200 dark:border-slate-700 rounded-lg overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-slate-500 dark:text-slate-400">กำลังวิเคราะห์ด้วย AI...</p>
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full text-red-600 dark:text-red-400 p-4">{error}</div>
                            ) : matchedItems.length === 0 ? (
                                 <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 p-4">อัปโหลดรูปภาพเพื่อดูรายการที่สแกนได้</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody>
                                        {matchedItems.map((item, index) => (
                                            <tr key={index} className="border-b dark:border-slate-700 last:border-b-0">
                                                <td className="p-2">
                                                    {item.match ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ExclamationCircleIcon className="w-5 h-5 text-amber-500" title="ไม่พบรายการนี้ในระบบ"/>}
                                                </td>
                                                <td className="p-2">
                                                    <div className="text-slate-800 dark:text-slate-200">{item.itemName}</div>
                                                    {item.match && <div className="text-xs text-slate-500 dark:text-slate-400">หน่วย: {item.match.unit}</div>}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-300 font-medium">{item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {hasUnmatchedItems && matchedItems.length > 0 && (
                     <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm rounded-md">
                        <ExclamationCircleIcon className="inline w-5 h-5 mr-1" />
                        บางรายการไม่สามารถจับคู่ได้และจะถูกละเว้น กรุณาตรวจสอบการสะกดหรือเพิ่มเป็นสินค้าใหม่ภายหลัง
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button onClick={handleClose} className="bg-slate-200 font-bold py-2 px-4 rounded-lg">ยกเลิก</button>
                    <button onClick={handleSave} disabled={isLoading || matchedItems.filter(i => i.match).length === 0} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400">
                        สร้างใบเบิก
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ScanDocumentModal;