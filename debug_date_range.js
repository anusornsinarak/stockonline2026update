import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    const { data: txs } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    
    const start = new Date('2025-10-01T00:00:00.000Z');
    const end = new Date('2026-08-31T23:59:59.999Z');
    
    let sum = 0;
    txs?.forEach(tx => {
        if(tx.transaction_type === 'เบิกจ่าย') {
           const d = new Date(tx.transaction_date);
           if (d >= start && d <= end) {
               sum += tx.quantity_out || 0;
           }
        }
    });
    console.log("Sum in date range:", sum);
}
run();
