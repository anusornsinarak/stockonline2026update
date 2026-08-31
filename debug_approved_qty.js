import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    const { data: reqItems } = await supabase.from('requisition_items')
            .select(`
                approved_quantity,
                quantity,
                requisitions!inner(requisition_number, created_at, status)
            `)
            .eq('product_id', pid)
            .in('requisitions.status', ['Picking', 'PartiallyApproved', 'Ready', 'Completed']);

    let sumApproved = 0;
    let sumRequested = 0;
    if (reqItems) {
        reqItems.forEach(item => {
            const date = new Date(item.requisitions.created_at);
            const m = date.getMonth();
            const y = date.getFullYear();
            const fy = (m >= 9 ? y + 1 : y) + 543;
            
            if (fy === 2569) {
                const qty = item.approved_quantity !== null ? item.approved_quantity : item.quantity;
                sumApproved += qty || 0;
                sumRequested += item.quantity || 0;
            }
        });
    }
    
    console.log("Sum of approved/requested in FY2569:", sumApproved, "Requested:", sumRequested);
}
run();
