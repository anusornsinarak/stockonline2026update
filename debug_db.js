import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    if (!prods || prods.length === 0) return console.log("Product not found");
    const pid = prods[0].id;
    
    const { data: txs, error } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: '2026-08-31T23:59:59.999Z' });
    if (error) console.error(error);
    else console.log("RPC txs (first 3):", txs.slice(0,3));

    const { data: reqItems } = await supabase.from('requisition_items')
        .select(`approved_quantity, requisitions!inner(id, requisition_number)`)
        .eq('product_id', pid);
    
    console.log("ReqItems (first 3):", reqItems.slice(0,3));
}
run();
