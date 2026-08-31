import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6';
    let allTxs = [];
    let page = 0;
    while(true) {
        const { data } = await supabase.from('product_transactions')
            .select('transaction_type, transaction_date, quantity_in, quantity_out')
            .eq('product_id', pid)
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        allTxs = allTxs.concat(data);
        page++;
    }
    
    let sumIn = 0;
    let sumOut = 0;
    
    const startStockCard = new Date('2025-10-01T00:00:00.000+07:00');
    const endStockCard = new Date('2026-08-31T23:59:59.999+07:00');
    
    allTxs.forEach(tx => {
        const d = new Date(tx.transaction_date);
        if (d >= startStockCard && d <= endStockCard) {
            if (tx.transaction_type === 'รับเข้า') sumIn += tx.quantity_in;
            if (tx.transaction_type === 'เบิกจ่าย') sumOut += tx.quantity_out;
        }
    });
    console.log("In:", sumIn, "Out:", sumOut);
}
run();
