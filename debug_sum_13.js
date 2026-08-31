import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: txs, error } = await supabase.from('product_transactions')
            .select('product_id, transaction_date, quantity_out')
            .eq('transaction_type', 'เบิกจ่าย')
            .order('transaction_date', { ascending: false }); // or whatever the default order is
            
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    let sum = 0;
    txs.filter(t => t.product_id === pid).forEach(t => sum += t.quantity_out);
    console.log("Sum of the 13 txs:", sum);
}
run();
