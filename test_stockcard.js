import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: grns } = await supabase.from('goods_received_notes').select('*, goods_received_items(*)').eq('source_type', 'Other').order('created_at', { ascending: false }).limit(5);
    console.log("Recent 'Other' GRNs:");
    console.dir(grns, {depth: null});
    
    if (grns && grns.length > 0) {
        const pid = grns[0].goods_received_items[0]?.product_id;
        if (pid) {
            console.log("\nFetching transactions for product:", pid);
            const { data: txs } = await supabase.rpc('get_product_transactions', { p_product_id: pid, p_end_date: new Date().toISOString() });
            console.log("Recent txs:");
            console.log(txs?.slice(0, 5));
        }
    }
}
run();
