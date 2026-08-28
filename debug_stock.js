import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: grns } = await supabase.from('goods_received_notes')
            .select('id, grn_number, received_date, source_type, notes, status, goods_received_items!inner(product_id, quantity_received)')
            .order('created_at', { ascending: false })
            .limit(5);
    console.log("Recent GRNs:");
    console.dir(grns, {depth: null});
}
run();
