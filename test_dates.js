import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    if (!prods || prods.length === 0) return console.log("Product not found");
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);

    const { data: reqItems } = await supabase.from('requisition_items')
        .select(`quantity, approved_quantity, requisitions!inner(created_at, status)`)
        .eq('product_id', pid);

    console.log(`Found ${reqItems?.length} req items for this product.`);
    if(reqItems) {
       reqItems.forEach(r => console.log(r.requisitions.created_at, r.quantity, r.approved_quantity, r.requisitions.status));
    }
}
run();
