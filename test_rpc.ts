import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://olfabhkhyfibanhsxwpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: reqs } = await supabase.from('requisitions').select('*').order('created_at', { ascending: false }).limit(1);
    if (!reqs || reqs.length === 0) return console.log("No reqs");
    const reqId = reqs[0].id;
    
    const { data: items } = await supabase.from('requisition_items').select('*').eq('requisition_id', reqId);
    console.log("Items:", items);

    // Try a dummy update to see if it fails
    if (items && items.length > 0) {
        const item = items[0];
        const { data, error } = await supabase.from('requisition_items').update({
            status: 'Loaned',
            approved_quantity: item.quantity
        }).eq('id', item.id).select();
        
        console.log("Update result:", { data, error });
    }
}
test();
