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
        .eq('product_id', pid);
        
    console.log("Req items length:", reqItems?.length);
    if (reqItems && reqItems.length > 0) {
        console.log("First item:", reqItems[0]);
    }
}
run();
