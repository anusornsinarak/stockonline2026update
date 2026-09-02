import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG

    // 1. Fetch req map for ALL products (simulate getProductUsageHistory)
    const reqMap = new Map();
    const { data: reqs } = await supabase.from('requisition_items')
        .select(`product_id, approved_quantity, requisitions!inner(requisition_number)`)
        .eq('product_id', pid); // Let's just look at this product for a sec

    reqs.forEach(item => {
        if (item.requisitions?.requisition_number && item.approved_quantity !== null) {
            reqMap.set(item.requisitions.requisition_number, item.approved_quantity);
        }
    });

    const { data: txs } = await supabase.from('product_transactions')
        .select('product_id, transaction_date, quantity_out, transaction_type, reference_document')
        .eq('transaction_type', 'เบิกจ่าย')
        .eq('product_id', pid);

    let usage = 0;
    txs.forEach(tx => {
        const date = new Date(tx.transaction_date);
        const month = date.getMonth();
        const yearCE = date.getFullYear();
        const fiscalYearBE = (month >= 9 ? yearCE + 1 : yearCE) + 543;

        if (fiscalYearBE === 2569) {
            let qty = tx.quantity_out || 0;
            if (tx.reference_document && reqMap.has(tx.reference_document)) {
                qty = reqMap.get(tx.reference_document);
            }
            usage += qty;
        }
    });
    console.log("Usage for FY2569 (with correct product filter):", usage);
}
run();
