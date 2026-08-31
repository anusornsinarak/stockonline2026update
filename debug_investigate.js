import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    if (!prods || prods.length === 0) return console.log("Product not found");
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);

    // Get from product_transactions directly
    const { data: txs, error: e1 } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    
    let sumTx = 0;
    let sumTxFy2569 = 0;
    txs?.forEach(tx => {
        if(tx.transaction_type === 'เบิกจ่าย') {
           const d = new Date(tx.transaction_date);
           const m = d.getMonth();
           const y = d.getFullYear();
           const fy = (m >= 9 ? y + 1 : y) + 543;
           if(fy === 2569) {
               sumTxFy2569 += tx.quantity_out || 0;
           }
        }
    });
    console.log("Total from product_transactions view (FY2569):", sumTxFy2569);
    
    // Now simulate getProductTransactionHistory from UI
    // Which calls RPC get_product_transactions
    const { data: rpcTxs, error: e2 } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: '2026-08-31T23:59:59.999Z' });
    let sumRpc = 0;
    
    // UI then fetches requisition_items to override!
    const { data: reqItems } = await supabase.from('requisition_items')
            .select(`
                approved_quantity,
                requisitions!inner(requisition_number)
            `)
            .eq('product_id', pid);

    const reqMap = new Map();
    if(reqItems) {
        reqItems.forEach((item) => {
            if (item.requisitions?.requisition_number && item.approved_quantity !== null) {
                reqMap.set(item.requisitions.requisition_number, item.approved_quantity);
            }
        });
    }

    rpcTxs?.forEach(tx => {
        let qOut = tx.quantity_out || 0;
        if (tx.transaction_type === 'เบิกจ่าย' && tx.reference_document && reqMap.has(tx.reference_document)) {
            qOut = reqMap.get(tx.reference_document);
        }
        
        if(tx.transaction_type === 'เบิกจ่าย') {
           const d = new Date(tx.transaction_date);
           const m = d.getMonth();
           const y = d.getFullYear();
           const fy = (m >= 9 ? y + 1 : y) + 543;
           if(fy === 2569) {
               sumRpc += qOut;
           }
        }
    });
    
    console.log("Total from getProductTransactionHistory logic (FY2569):", sumRpc);
}
run();
