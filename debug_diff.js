import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG
    
    // 1. Get from requisition_items (Usage logic)
    let reqSum = 0;
    const { data: reqs } = await supabase.from('requisition_items')
        .select(`id, quantity, approved_quantity, requisitions!inner(requisition_number, created_at, status)`)
        .eq('product_id', pid)
        .in('requisitions.status', ['Picking', 'PartiallyApproved', 'Ready', 'Completed']);
        
    const reqList = [];
    reqs.forEach(item => {
        const date = new Date(item.requisitions.created_at);
        const month = date.getMonth();
        const yearCE = date.getFullYear();
        const fiscalYearCE = month >= 9 ? yearCE + 1 : yearCE;
        const fiscalYearBE = fiscalYearCE + 543;
        
        if (fiscalYearBE === 2569) {
            const qty = item.approved_quantity !== null ? item.approved_quantity : item.quantity;
            reqSum += qty;
            reqList.push({ id: item.requisitions.requisition_number, qty, date: item.requisitions.created_at });
        }
    });
    console.log("Usage Sum:", reqSum);
    
    // 2. Get from product_transactions + req items (Stock Card logic)
    const { data: txs } = await supabase.from('product_transactions')
        .select('*')
        .eq('product_id', pid)
        .eq('transaction_type', 'เบิกจ่าย');
        
    const reqMap = new Map();
    reqs.forEach(item => {
        if (item.requisitions.requisition_number && item.approved_quantity !== null) {
            reqMap.set(item.requisitions.requisition_number, item.approved_quantity);
        }
    });
    
    let stockSum = 0;
    const startDate = new Date('2025-10-01T00:00:00.000Z');
    const endDate = new Date('2026-08-31T23:59:59.999Z');
    const txList = [];
    
    txs.forEach(tx => {
        let qOut = tx.quantity_out || 0;
        if (tx.reference_document && reqMap.has(tx.reference_document)) {
            qOut = reqMap.get(tx.reference_document);
        }
        
        const d = new Date(tx.transaction_date);
        if (d >= startDate && d <= endDate) {
            stockSum += qOut;
            txList.push({ id: tx.reference_document, qty: qOut, date: tx.transaction_date });
        }
    });
    
    console.log("Stock Sum:", stockSum);
    
    // Compare lists
    const reqIds = reqList.map(r => r.id);
    const txIds = txList.map(t => t.id);
    
    const onlyInReq = reqList.filter(r => !txIds.includes(r.id));
    const onlyInTx = txList.filter(t => !reqIds.includes(t.id));
    
    console.log("Only in Req (Usage):", onlyInReq);
    console.log("Only in Tx (Stock):", onlyInTx);
}
run();
