import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: grns, error } = await supabase.from('goods_received_notes')
            .select('id, grn_number, received_date, source_type, notes, status')
            .order('created_at', { ascending: false })
            .limit(5);
    console.log("Error:", error);
    console.log("Recent GRNs:", grns);
}
run();
