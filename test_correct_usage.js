import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG

    const reqMap = new Map();
    let reqPage = 0;
    while(true) {
        const { data } = await supabase.from('requisition_items')
            .select('product_id, approved_quantity, requisitions!inner(requisition_number)')
            .range(reqPage * 1000, (reqPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(item => {
            if (item.requisitions?.requisition_number && item.approved_quantity !== null) {
                reqMap.set(`${item.requisitions.requisition_number}_${item.product_id}`, item.approved_quantity);
            }
        });
        reqPage++;
    }
    
    let txPage = 0;
    let sum = 0;
    while(true) {
        const { data: txs } = await supabase.from('product_transactions')
            .select('product_id, transaction_date, quantity_out, transaction_type, reference_document')
            .eq('transaction_type', 'เบิกจ่าย')
            .range(txPage * 1000, (txPage + 1) * 1000 - 1);
        
        if (!txs || txs.length === 0) break;
        
        txs.forEach(tx => {
            const date = new Date(tx.transaction_date);
            const month = date.getMonth();
            const yearCE = date.getFullYear();
            const fiscalYearBE = (month >= 9 ? yearCE + 1 : yearCE) + 543;
            
            if (fiscalYearBE === 2569 && tx.product_id === pid) {
                let qty = tx.quantity_out || 0;
                const reqKey = `${tx.reference_document}_${tx.product_id}`;
                if (tx.reference_document && reqMap.has(reqKey)) {
                    qty = reqMap.get(reqKey);
                }
                sum += qty;
            }
        });
        txPage++;
    }
    
    console.log("Usage for FY2569 for 2% CHG:", sum);
}
run();
