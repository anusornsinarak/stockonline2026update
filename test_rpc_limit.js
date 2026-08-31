import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6';
    const { data: txs } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    console.log("Raw table count:", txs?.length);
    
    // We can't auth easily, but wait, maybe the app in the browser DOES auth!
    // And in the browser, supabase.rpc() is called.
    // DOES supabase.rpc support pagination? Yes, by chaining .range(0, 999)!
}
run();
