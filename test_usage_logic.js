import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%2%CHG%');
    if (!prods || prods.length === 0) return console.log("Product not found");
    const pid = prods[0].id;
    console.log("Product:", prods[0].name, pid);

    const { data: reqItems, error } = await supabase.from('requisition_items')
        .select(`
            quantity,
            approved_quantity,
            requisitions!inner (
                created_at,
                status
            )
        `)
        .eq('product_id', pid)
        .in('requisitions.status', ['Picking', 'PartiallyApproved', 'Ready', 'Completed']);

    if (error) {
        console.error("Error fetching usage history", error);
        return;
    }

    let sum2569 = 0;
    reqItems.forEach(item => {
        const date = new Date(item.requisitions.created_at);
        const month = date.getMonth(); // 0-indexed, so Oct is 9
        const yearCE = date.getFullYear();
        const fiscalYearCE = month >= 9 ? yearCE + 1 : yearCE;
        const fiscalYearBE = fiscalYearCE + 543;
        
        const qty = (item.approved_quantity !== null && item.approved_quantity !== undefined) ? item.approved_quantity : (item.quantity || 0);
        
        if (fiscalYearBE === 2569) {
            sum2569 += qty;
            console.log(`Req: ${item.requisitions.created_at} | Status: ${item.requisitions.status} | Qty: ${qty}`);
        }
    });
    console.log("Total Usage FY2569:", sum2569);
}
run();
