import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');
async function run() {
    const { data: cols, error } = await supabase.rpc('get_product_transactions', { p_product_id: '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6', p_end_date: '2026-08-31T23:59:59.999Z' });
    console.log(`RPC txs length:`, cols?.length);
}
run();
