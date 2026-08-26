import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const grnPayload = {
        sourceType: 'Other',
        notes: `[ปรับปรุงยอดจากระบบ] Test`,
        items: [{ 
            productId: 'f7267eb4-8742-4933-a3d8-e7bd95cfd986', // Need a valid product id
            quantityReceived: 10, 
            expiryDate: null, 
            lotNumber: null 
        }]
    };
    
    // Get a product
    const { data: prods } = await supabase.from('products').select('id').limit(1);
    if (!prods || prods.length === 0) return console.log('no product');
    grnPayload.items[0].productId = prods[0].id;
    
    console.log("Calling RPC...");
    const { data: newGrn, error } = await supabase.rpc('create_grn_with_items', { 
        p_source_type: 'Other', 
        p_po_id: null, 
        p_notes: grnPayload.notes, 
        p_items: grnPayload.items 
    });
    
    console.log("Result:");
    console.log(data, error);
}
run();
