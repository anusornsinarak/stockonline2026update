import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    if (!prods || prods.length === 0) return console.log("Product not found");
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);

    const { data: reqItems, error } = await supabase.from('requisition_items')
        .select(`
            quantity,
            approved_quantity,
            requisitions!inner (
                created_at,
                status
            )
        `)
        .eq('product_id', pid)
        .in('requisitions.status', ['Picking', 'PartiallyApproved', 'Ready', 'Completed']);

    if (error) {
        console.error("Error fetching usage history", error);
        return;
    }

    let sum2569 = 0;
    reqItems.forEach(item => {
        const date = new Date(item.requisitions.created_at);
        const month = date.getMonth(); // 0-indexed, so Oct is 9
        const yearCE = date.getFullYear();
        const fiscalYearCE = month >= 9 ? yearCE + 1 : yearCE;
        const fiscalYearBE = fiscalYearCE + 543;
        
        const qty = (item.approved_quantity !== null && item.approved_quantity !== undefined) ? item.approved_quantity : (item.quantity || 0);
        
        if (fiscalYearBE === 2569) {
            sum2569 += qty;
            console.log(`Req: ${item.requisitions.created_at} | Status: ${item.requisitions.status} | Qty: ${qty}`);
        }
    });
    console.log("Total Usage FY2569:", sum2569);
    
    // Also fetch transactions for this period
    const { data: txs } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: '2026-08-31T23:59:59.999Z' });
    let txSum = 0;
    txs.forEach(tx => {
        if(tx.transaction_type === 'เบิกจ่าย') {
           const d = new Date(tx.transaction_date);
           const m = d.getMonth();
           const y = d.getFullYear();
           const fy = (m >= 9 ? y + 1 : y) + 543;
           if(fy === 2569) {
               txSum += tx.quantity_out || 0;
               console.log(`Tx: ${tx.transaction_date} | QtyOut: ${tx.quantity_out}`);
           }
        }
    });
    console.log("Total Tx Out FY2569:", txSum);
}
run();
