import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('requisition_items')
            .select(`
                product_id,
                approved_quantity,
                requisitions!inner (
                    created_at,
                    status
                )
            `)
            .in('requisitions.status', ['PartiallyApproved', 'Ready', 'Completed']);
            
    if (error) console.error(error);
    else console.log(data.slice(0,2));
}
run();
