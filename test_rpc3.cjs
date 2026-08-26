const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: prods } = await supabase.from('products').select('id').limit(1);
    if (!prods || prods.length === 0) return console.log('no product');
    
    const items = [{ 
        product_id: prods[0].id, 
        quantity_received: 10, 
        expiry_date: null, 
        lot_number: null 
    }];
    
    console.log("Calling RPC...");
    const { data: newGrn, error } = await supabase.rpc('create_grn_with_items', { 
        p_source_type: 'Other', 
        p_po_id: null, 
        p_notes: 'Test', 
        p_items: items 
    });
    
    console.log("Result:");
    console.log(newGrn, error);
}
run();
