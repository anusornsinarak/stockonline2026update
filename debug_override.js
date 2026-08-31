import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    const { data: reqItems } = await supabase.from('requisition_items')
        .select(`
            quantity,
            approved_quantity,
            requisitions!inner(requisition_number, created_at)
        `)
        .eq('product_id', pid)
        .ilike('requisitions.requisition_number', '%690803%'); // from my output 6908030, 6908031
        
    console.log("Req items for 690803x:");
    reqItems.forEach(r => {
        console.log(r.requisitions.requisition_number, "qty:", r.quantity, "app_qty:", r.approved_quantity);
    });
}
run();
