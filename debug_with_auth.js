import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://olfabhkhyfibanhsxwpg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg');

async function run() {
    // Attempt to authenticate
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'admin@hospital.com',
        password: 'password123'
    });
    
    console.log("Auth:", !!authData.session);

    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    const pid = prods[0].id;
    
    const { data: cols } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: '2026-08-31T23:59:59.999Z' });
    console.log("RPC Cols length:", cols?.length);
    
    let sumOut = 0;
    cols?.forEach(tx => {
        if(tx.transaction_type === 'เบิกจ่าย') {
            const d = new Date(tx.transaction_date);
            if (d >= new Date('2025-10-01T00:00:00.000Z') && d <= new Date('2026-08-31T23:59:59.999Z')) {
                sumOut += tx.quantity_out || 0;
            }
        }
    });
    console.log("RPC Sum Out:", sumOut);
}
run();
