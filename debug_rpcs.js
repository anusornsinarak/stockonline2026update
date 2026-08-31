import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    // try to get product_transactions but paginated to see if we can just paginate it
    let allTxs = [];
    let page = 0;
    while(true) {
        const { data, error } = await supabase.from('product_transactions')
            .select('product_id, transaction_date, quantity_out')
            .eq('transaction_type', 'เบิกจ่าย')
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allTxs = allTxs.concat(data);
        page++;
        if (data.length < 1000) break;
    }
    console.log("Total txs fetched via pagination:", allTxs.length);
    
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    let sum = 0;
    allTxs.filter(t => t.product_id === pid).forEach(t => sum += t.quantity_out);
    console.log("Sum for 2% CHG in all txs:", sum);
}
run();
