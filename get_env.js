import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching get_product_transactions definition...");
    const { data, error } = await supabase.rpc('get_product_transactions', { p_product_id: '00000000-0000-0000-0000-000000000000', p_end_date: new Date().toISOString() });
    
    // We can query pg_proc!
    const { data: procs, error: procError } = await supabase.from('pg_proc').select('proname, prosrc').eq('proname', 'get_product_transactions');
    console.log("pg_proc:", procError ? procError : procs);
}
run();
