import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG
    let page = 0;
    let items = [];
    while(true) {
        const { data } = await supabase.from('requisition_items')
            .select(`quantity, approved_quantity, requisitions!inner(requisition_number, created_at, status)`)
            .eq('product_id', pid)
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        items = items.concat(data);
        page++;
    }
    
    let sumCompleted = 0;
    let sumOther = 0;
    items.forEach(item => {
        const date = new Date(item.requisitions.created_at);
        const month = date.getMonth();
        const yearCE = date.getFullYear();
        const fiscalYearBE = (month >= 9 ? yearCE + 1 : yearCE) + 543;
        
        if (fiscalYearBE === 2569) {
            const status = item.requisitions.status;
            const qty = item.approved_quantity !== null ? item.approved_quantity : item.quantity;
            if (status === 'Completed') {
                sumCompleted += qty;
            } else if (['Picking', 'PartiallyApproved', 'Ready'].includes(status)) {
                sumOther += qty;
                console.log(`Other status: ${status}, qty: ${qty}, Req: ${item.requisitions.requisition_number}`);
            }
        }
    });
    console.log("Sum Completed:", sumCompleted, "Sum Other:", sumOther);
}
run();
