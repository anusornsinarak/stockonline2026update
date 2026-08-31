import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    // get a requisition from the DB
    const { data: reqs } = await supabase.from('requisitions').select('id, created_at, status').limit(5);
    console.log("Reqs:", reqs);
    
    // get from product_transactions
    const { data: txs } = await supabase.from('product_transactions').select('*').eq('transaction_type', 'เบิกจ่าย').limit(5);
    console.log("Txs:", txs);
}
run();
