const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: prods } = await supabase.from('products').select('*').ilike('name', '%ข้อต่อตรง%').limit(1);
    if (!prods || prods.length === 0) return console.log('no product');
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);
    
    const { data: grns } = await supabase.from('goods_received_notes')
            .select('id, grn_number, received_date, source_type, notes, status, goods_received_items!inner(product_id, quantity_received)')
            .eq('goods_received_items.product_id', pid);
    console.log("All GRNs for product:");
    console.dir(grns, {depth: null});
}
run();
