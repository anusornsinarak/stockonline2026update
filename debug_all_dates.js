import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    const { data: txs } = await supabase.from('product_transactions').select('*').eq('product_id', pid);
    
    let sums = {};
    txs?.forEach(tx => {
        if(tx.transaction_type === 'เบิกจ่าย') {
           const d = new Date(tx.transaction_date);
           const m = d.getMonth();
           const y = d.getFullYear();
           const fy = (m >= 9 ? y + 1 : y) + 543;
           
           if (!sums[fy]) sums[fy] = 0;
           sums[fy] += tx.quantity_out || 0;
           
           // If it's August 2026, print it
           if (y === 2026 && m === 7) {
               console.log("August 2026 transaction:", tx.transaction_date, tx.quantity_out, tx.reference_document);
           }
        }
    });
    console.log("Sums by FY:", sums);
}
run();
