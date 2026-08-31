import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: view_def, error } = await supabase.rpc('get_view_definition', { view_name: 'product_transactions' }); // wait, it's an RPC, not a view.
}
run();
