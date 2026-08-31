import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG
    
    const { data: reqs } = await supabase.from('requisition_items')
        .select(`id, quantity, approved_quantity, requisitions!inner(requisition_number, created_at, status)`)
        .eq('product_id', pid)
        .in('requisitions.status', ['Picking', 'PartiallyApproved', 'Ready', 'Completed']);
        
    const fYs = {};
    reqs.forEach(item => {
        const date = new Date(item.requisitions.created_at);
        const month = date.getMonth();
        const yearCE = date.getFullYear();
        const fiscalYearCE = month >= 9 ? yearCE + 1 : yearCE;
        const fiscalYearBE = fiscalYearCE + 543;
        
        if (!fYs[fiscalYearBE]) fYs[fiscalYearBE] = 0;
        fYs[fiscalYearBE] += (item.approved_quantity !== null ? item.approved_quantity : item.quantity);
    });
    console.log("Usage per fiscal year (from requisition_items):", fYs);
}
run();
