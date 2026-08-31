import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    // 1. Get raw transactions
    const { data: rawTxs } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    
    let txs = (rawTxs || []).map(t => ({
        transactionDate: new Date(t.transaction_date), transactionType: t.transaction_type,
        referenceDocument: t.reference_document, departmentName: t.department_name,
        quantityIn: t.quantity_in, quantityOut: t.quantity_out, balance: t.balance
    }));
    
    // 2. Fetch Requisition Items to override quantityOut with approved_quantity
    const { data: reqItems } = await supabase.from('requisition_items')
        .select(`
            approved_quantity,
            requisitions!inner(requisition_number, status)
        `)
        .eq('product_id', pid);

    if (reqItems) {
        const reqMap = new Map();
        reqItems.forEach((item) => {
            // Include all statuses to match stock card logic?
            if (item.requisitions?.requisition_number && item.approved_quantity !== null) {
                reqMap.set(item.requisitions.requisition_number, item.approved_quantity);
            }
        });

        txs.forEach(tx => {
            if (tx.transactionType === 'เบิกจ่าย' && tx.referenceDocument && reqMap.has(tx.referenceDocument)) {
                tx.quantityOut = reqMap.get(tx.referenceDocument);
            }
        });
    }

    // Filter by date range (from StockCardView)
    const startDate = new Date('2025-10-01T00:00:00.000Z');
    const endDate = new Date('2026-08-31T23:59:59.999Z');
    
    let sumOut = 0;
    txs.forEach(t => {
        if (t.transactionDate >= startDate && t.transactionDate <= endDate && t.transactionType === 'เบิกจ่าย') {
            sumOut += t.quantityOut;
        }
    });
    console.log("Stock Card Sum Out WITH OVERRIDE:", sumOut);
}
run();
