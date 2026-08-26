import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && k.trim()) env[k.trim()] = v.join('=').trim().replace(/["']/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: prods } = await supabase.from('products').select('id').limit(1);
    if (!prods || prods.length === 0) return console.log('no product');
    
    console.log("Calling RPC...");
    const { data, error } = await supabase.rpc('create_grn_with_items', { 
        p_source_type: 'Other', 
        p_po_id: null, 
        p_notes: 'Test', 
        p_items: [{ productId: prods[0].id, quantityReceived: 10, expiryDate: null, lotNumber: null }] 
    });
    console.log(data, error);
}
run();
