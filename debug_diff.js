import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    // Find the product
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    if (!prods || prods.length === 0) return console.log("Product not found");
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);

    // Get from getProductUsageHistory logic
    const { data: reqItems } = await supabase.from('requisition_items')
        .select(`approved_quantity, requisitions!inner(created_at, status, requisition_number)`)
        .eq('product_id', pid)
        .in('requisitions.status', ['PartiallyApproved', 'Ready', 'Completed']);
    
    let sumUsage = 0;
    reqItems.forEach(item => {
        const d = new Date(item.requisitions.created_at);
        const m = d.getMonth();
        const y = d.getFullYear();
        const fy = (m >= 9 ? y + 1 : y) + 543;
        if (fy === 2569) {
            sumUsage += item.approved_quantity || 0;
            console.log("Req:", item.requisitions.requisition_number, "Date:", item.requisitions.created_at, "Qty:", item.approved_quantity);
        }
    });
    console.log("Total Usage (FY2569):", sumUsage);

    // Get from getProductTransactionHistory logic
    const { data: txs } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: '2026-08-31T23:59:59.999Z' });
    let sumTx = 0;
    txs.forEach(tx => {
        const d = new Date(tx.transaction_date);
        const m = d.getMonth();
        const y = d.getFullYear();
        const fy = (m >= 9 ? y + 1 : y) + 543;
        if (fy === 2569 && tx.transaction_type === 'เบิกจ่าย') {
            sumTx += tx.quantity_out || 0;
            console.log("Tx:", tx.reference_document, "Date:", tx.transaction_date, "QtyOut:", tx.quantity_out);
        }
    });
    console.log("Total Tx Out (FY2569):", sumTx);
}
run();
