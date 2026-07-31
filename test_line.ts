import { supabaseService } from './services/supabaseService';
async function test() {
    const profiles = await (supabaseService as any).supabase.from('line_user_profiles').select('*');
    console.log("Profiles count:", profiles.data?.length);
}
test();
