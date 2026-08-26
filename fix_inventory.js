import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching all products...");
    const { data: products } = await supabase.from('products').select('id');
    console.log(`Found ${products.length} products.`);

    for (const p of products) {
        // get transactions
        const { data, error } = await supabase.rpc('get_product_transactions', { p_product_id: p.id, p_end_date: new Date().toISOString() });
        if (error) {
            console.error(error);
            continue;
        }
        let sum = 0;
        (data || []).forEach(tx => sum += (tx.quantity_in || 0) - (tx.quantity_out || 0));
        
        // get current inventory
        const { data: inv } = await supabase.from('inventory').select('quantity').eq('product_id', p.id).single();
        const currentQty = inv ? inv.quantity : 0;

        if (currentQty !== sum) {
            console.log(`Product ${p.id}: Inventory ${currentQty} != Transactions ${sum}. Fixing...`);
            await supabase.from('inventory').update({ quantity: sum }).eq('product_id', p.id);
        }
    }
    console.log("Done.");
}

run();
