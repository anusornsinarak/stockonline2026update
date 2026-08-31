import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    const { data: txs } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    
    txs?.forEach(tx => {
        const d = new Date(tx.transaction_date);
        if (d.getFullYear() === 2026 && d.getMonth() === 7) {
            console.log(tx.transaction_date, tx.quantity_out, tx.department_name);
        }
    });
}
run();
