import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG
    const { data: txs } = await supabase.from('product_transactions')
        .select('*')
        .eq('product_id', pid)
        .eq('transaction_type', 'เบิกจ่าย')
        .order('transaction_date', { ascending: true });
        
    let c = 0;
    txs.forEach(t => {
        const d = new Date(t.transaction_date);
        if (d.getFullYear() === 2025 && d.getMonth() === 9) { // Oct 2025
            console.log(t.transaction_date, t.quantity_out);
        }
    });
}
run();
