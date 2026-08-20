const fs = require('fs');
let code = fs.readFileSync('components/admin/StockCardView.tsx', 'utf8');

const regex = /const StockAdjustmentModal.*?return \(\s*<Modal.*?<\/Modal>\s*\);\s*};/s;

const newCode = `const StockAdjustmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    currentStock: number;
    onSuccess: () => void;
}> = ({ isOpen, onClose, product, currentStock, onSuccess }) => {
    const [mode, setMode] = React.useState<'actual' | 'delta'>('actual');
    const [adjustmentType, setAdjustmentType] = React.useState<'increase' | 'decrease'>('increase');
    const [quantity, setQuantity] = React.useState('');
    const [actualStock, setActualStock] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setMode('actual');
            setAdjustmentType('increase');
            setQuantity('');
            setActualStock(currentStock.toString());
            setNotes('ปรับปรุงจากการนับสต็อกจริง');
            setError('');
            setIsSaving(false);
        }
    }, [isOpen, currentStock]);

    const actualStockVal = parseInt(actualStock, 10);
    const quantityChange = parseInt(quantity, 10) || 0;
    
    let finalQuantityChange = 0;
    let newStock = 0;

    if (mode === 'actual') {
        if (!isNaN(actualStockVal)) {
            finalQuantityChange = actualStockVal - currentStock;
            newStock = actualStockVal;
        } else {
            newStock = currentStock;
        }
    } else {
        newStock = adjustmentType === 'increase' ? currentStock + quantityChange : currentStock - quantityChange;
        finalQuantityChange = adjustmentType === 'increase' ? quantityChange : -quantityChange;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (finalQuantityChange === 0) {
            setError('ยอดคงคลังไม่มีการเปลี่ยนแปลง');
            return;
        }

        if (!notes.trim()) {
            setError('กรุณากรอกหมายเหตุ / เหตุผล');
            return;
        }

        if (newStock < 0) {
            setError('ยอดคงคลังหลังปรับต้องไม่ติดลบ');
            return;
        }
        
        const confirmMsg = \`ยืนยันการปรับปรุงสต๊อกของ "\${product.name}"\\nจาก \${currentStock.toLocaleString()} เป็น \${newStock.toLocaleString()}\\n(ส่วนต่าง \${finalQuantityChange > 0 ? '+' : ''}\${finalQuantityChange.toLocaleString()}) ใช่หรือไม่?\`;
        if (!window.confirm(confirmMsg)) {
            return;
        }
        
        setIsSaving(true);
        setError('');

        try {
            await supabaseService.adjustStockQuantity(product.id, finalQuantityChange, notes);
            alert('ปรับสต็อกสำเร็จ!');
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={\`ปรับสต็อก: \${product.name}\`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={() => setMode('actual')} className={\`pb-2 px-4 text-sm font-medium border-b-2 \${mode === 'actual' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
                        กรอกยอดนับจริง
                    </button>
                    <button type="button" onClick={() => setMode('delta')} className={\`pb-2 px-4 text-sm font-medium border-b-2 \${mode === 'delta' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
                        ระบุส่วนต่าง (เพิ่ม/ลด)
                    </button>
                </div>

                {mode === 'actual' && (
                    <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-lg">
                        <label htmlFor="actual-stock" className="block text-sm font-medium text-slate-700 dark:text-slate-200">จำนวนที่นับได้จริง (Physical Count)</label>
                        <input id="actual-stock" type="number" min="0" value={actualStock} onChange={e => setActualStock(e.target.value)} className="mt-2 w-full p-2 border border-sky-300 dark:border-sky-700 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" required />
                        {finalQuantityChange !== 0 && !isNaN(actualStockVal) && (
                            <p className={\`mt-2 text-sm font-medium \${finalQuantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'}\`}>
                                ระบบจะทำการปรับ {finalQuantityChange > 0 ? 'เพิ่ม' : 'ลด'} สต็อกอัตโนมัติ: {Math.abs(finalQuantityChange).toLocaleString()} {product.unit}
                            </p>
                        )}
                    </div>
                )}

                {mode === 'delta' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">ประเภทการปรับ</label>
                            <div className="mt-2 flex gap-4">
                                <label className="flex items-center"><input type="radio" value="increase" checked={adjustmentType === 'increase'} onChange={() => setAdjustmentType('increase')} className="h-4 w-4" /> <span className="ml-2">เพิ่มสต็อก</span></label>
                                <label className="flex items-center"><input type="radio" value="decrease" checked={adjustmentType === 'decrease'} onChange={() => setAdjustmentType('decrease')} className="h-4 w-4" /> <span className="ml-2">ลดสต็อก</span></label>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="adj-quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-200">จำนวนส่วนต่างที่ต้องการปรับ</label>
                            <input id="adj-quantity" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md" required={mode === 'delta'} />
                        </div>
                    </>
                )}
                 <div className="grid grid-cols-2 gap-4 text-center mt-2">
                    <InfoBox title="คงคลังปัจจุบัน"><p className="text-xl font-bold">{currentStock.toLocaleString()}</p></InfoBox>
                    <InfoBox title="คงคลังหลังปรับ"><p className="text-xl font-bold text-sky-600 dark:text-sky-400">{newStock.toLocaleString()}</p></InfoBox>
                </div>
                <div>
                    <label htmlFor="adj-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-200">หมายเหตุ / เหตุผล (สำคัญมาก)</label>
                    <textarea id="adj-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-md" required placeholder="เช่น จากการนับสต็อกจริง, ของชำรุด, ปรับยอดยกมา" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-600">
                    <button type="button" onClick={onClose} className="bg-slate-200 font-bold py-2 px-4 rounded-lg">ยกเลิก</button>
                    <button type="submit" disabled={isSaving} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400">
                        {isSaving ? 'กำลังบันทึก...' : 'ยืนยันการปรับสต็อก'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};`;

code = code.replace(regex, newCode);
fs.writeFileSync('components/admin/StockCardView.tsx', code);
console.log('Replaced successfully');
