const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: grns } = await supabase.from('goods_received_notes')
            .select('id, grn_number, received_date, source_type, notes, status, goods_received_items!inner(product_id, quantity_received)')
            .eq('status', 'Completed')
            .eq('source_type', 'Other')
            .limit(5);
    console.log(JSON.stringify(grns, null, 2));
}
// run();
