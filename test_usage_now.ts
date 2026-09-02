import { supabaseService } from './services/supabaseService.ts';

async function run() {
    const history = await supabaseService.getProductUsageHistory();
    const pid = '418753eb-59dd-400e-9a2f-7f7ca2f5b6b6'; // 2% CHG
    const item = history.find(h => h.productId === pid && h.fiscalYear === 2569);
    console.log("Usage for 2% CHG in FY2569:", item?.totalQuantity);
}
run();
