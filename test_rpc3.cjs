const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: grns } = await supabase.from('goods_received_notes')
            .select('id, grn_number, received_date, source_type, notes, goods_received_items!inner(product_id, quantity_received)')
            .eq('status', 'Completed')
            .limit(1);
    console.log(grns);
}
// run();
