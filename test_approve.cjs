const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: grns } = await supabase.from('goods_received_notes').select('id, status').eq('source_type', 'Other').order('created_at', { ascending: false }).limit(1);
    if (!grns || grns.length === 0) return console.log('no grn');
    console.log(grns[0]);
    const { data, error } = await supabase.rpc('approve_grn_and_update_stock', { p_grn_id: grns[0].id });
    console.log(data, error);
}
run();
