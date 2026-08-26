import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    // get product id for 'กล่องทิ้งหัวเข็ม ขนาด 3.2 ลิตร'
    const { data: prods } = await supabase.from('products').select('*').ilike('name', '%3.2%');
    console.log("Products:", prods?.map(p => ({id: p.id, name: p.name})));
    
    if (prods && prods.length > 0) {
        const pid = prods[0].id;
        const { data: inv } = await supabase.from('inventory').select('*').eq('product_id', pid);
        console.log("Current Inventory table:", inv);
        
        const { data: txs } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: new Date().toISOString() });
        console.log("Last 5 Transactions:");
        console.log(txs?.slice(0, 5));
    }
}
run();
