import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');
async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);
    
    // Check product_transactions directly
    const { data: txs, error } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    console.log(`Found ${txs?.length} txs for this product in product_transactions view. error:`, error);
    if(txs && txs.length > 0) {
        console.log(txs.slice(0, 3));
    }
}
run();
