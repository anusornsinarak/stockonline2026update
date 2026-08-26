import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

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
