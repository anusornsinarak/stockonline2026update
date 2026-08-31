import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');
async function run() {
    const start = Date.now();
    const { data: txs, error } = await supabase.from('product_transactions').select('product_id, transaction_date, quantity_out').eq('transaction_type', 'เบิกจ่าย');
    console.log(`Fetched ${txs?.length} txs in ${Date.now() - start}ms. error:`, error);
}
run();
