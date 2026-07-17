
// ... existing imports ...
import { supabase as supabaseClient } from '../supabaseClient';

// FIX: Cast supabase to any to bypass strict type checking for the Database type
// which is causing widespread 'never' errors in this service.
const supabase = supabaseClient as any;
import * as XLSX from 'xlsx';
import { User, Product, Department, AppNotification, SurveyEntry, Company, ProductSupplier, Requisition, RequisitionStatus, requisitionStatusMap, RequisitionItem, PurchaseOrder, GoodsReceivedNote, SystemLog, InventoryItem, DocumentSettings, Personnel, BackOrderItem, LoanItem, ProductUsageHistory, ProductCategory, P2PExchangePosting, PublicProductInfo, DepartmentInventoryLot, DepartmentInventoryItem, ProductIssue, POStatus, ProductIssueStatus, PurchasePlanItem, ExpiringStockItem, DepartmentProductUsage, ProductTransaction, PublicChatMessage, LineUserProfile, LoanTransaction, LoanTransactionItem, SurveyConfig, SurveyQuestion, SurveyResponse } from '../types';
import type { Json } from '../database.types';
import { getThaiYearMonthPrefix, formatRunningNumber } from '../utils';

// Helper to get GAS URL
const getGasUrl = async () => {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'gas_webhook_url').maybeSingle();
    return (data as any)?.value as string;
};

export const supabaseService = {
    // ... existing methods ...

    async repairLegacyApprovedQuantities() {
        // Fetch all items where approved_quantity is null
        const { data: items, error } = await supabase
            .from('requisition_items')
            .select('id, quantity, status')
            .is('approved_quantity', null);

        if (error) throw error;
        if (!items || items.length === 0) return 0;

        let updateCount = 0;
        const updates = [];

        // Prepare updates based on status
        for (const item of items) {
            let newApprovedQty = 0;
            // Case 1: Status implies NO approval -> 0
            if (['Rejected', 'Backordered', 'Cancelled', 'Loaned'].includes(item.status as string)) {
                newApprovedQty = 0;
            } else {
                // Case 2: Status implies approval (legacy) -> Full Quantity
                newApprovedQty = item.quantity;
            }

            updates.push(
                supabase.from('requisition_items')
                    .update({ approved_quantity: newApprovedQty } as any)
                    .eq('id', item.id)
            );
            updateCount++;
        }

        // Execute updates in parallel batches to be faster
        const BATCH_SIZE = 50;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            await Promise.all(updates.slice(i, i + BATCH_SIZE));
        }

        return updateCount;
    },

    // ... rest of the existing methods ...
    // Auth & Users
    async login(username: string, password: string) {
        const cleanUsername = username.trim().toLowerCase();
        let loginEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@hospital.com`;

        try {
            // ค้นหาอีเมลจริงจาก username หรือ email ที่กรอกมา
            const { data: userRecords, error: queryError } = await supabase
                .from('users')
                .select('email')
                .or(`username.ilike.${cleanUsername},email.ilike.${cleanUsername}`)
                .limit(1);
            
            if (!queryError && userRecords && userRecords.length > 0) {
                loginEmail = userRecords[0].email || loginEmail;
            }
        } catch (e) {
            console.error('Error fetching user email for login:', e);
            // Fallback
        }
        
        let response = await supabase.auth.signInWithPassword({ email: loginEmail, password: password });
        
        // หาก login ด้วย @hospital.com หรืออีเมลที่หาได้ไม่สำเร็จ ให้ลองใช้ @internal-system.com
        if (response.error && response.error.message === 'Invalid login credentials' && !cleanUsername.includes('@')) {
             const fallbackEmail = `${cleanUsername}@internal-system.com`;
             const fallbackResponse = await supabase.auth.signInWithPassword({ email: fallbackEmail, password: password });
             if (!fallbackResponse.error) {
                 response = fallbackResponse;
             }
        }

        if (!response.error && response.data.user) {
            await this.logSystemEvent({
                level: 'INFO',
                event: 'USER_LOGIN',
                message: `User ${cleanUsername} logged in.`
            });
        }
        return response;
    },

    async registerUser(payload: { username: string; email?: string; password: string; departmentId: string }) {
        const { email, password, username, departmentId } = payload;
        const cleanUsername = username.trim();
        const finalEmail = email || `${cleanUsername}@hospital.com`;
        const { data, error } = await supabase.auth.signUp({
            email: finalEmail,
            password,
            options: { data: { username: cleanUsername, department_id: departmentId, role: 'Department' } }
        });
        if (error) throw error;
        await this.logSystemEvent({
            level: 'INFO',
            event: 'USER_REGISTERED',
            message: `User ${cleanUsername} registered for department ${departmentId}.`
        });
        return { isUnconfirmed: !data.session };
    },

    async getUserProfile(id: string): Promise<User | null> {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (error || !data) return null;
        return {
            id: data.id,
            username: data.username,
            role: (data.role as any) || 'Department',
            departmentId: data.department_id || undefined,
            email: data.email,
            permissions: (data.permissions as any) || {}
        };
    },

    async getUsers(): Promise<User[]> {
        const { data } = await supabase.from('users').select('*');
        return (data || []).map(u => ({
            id: u.id,
            username: u.username,
            role: (u.role as any) || 'Department',
            departmentId: u.department_id || undefined,
            email: u.email,
            permissions: (u.permissions as any) || {}
        }));
    },

    async addUser(u: { username: string; password?: string; email?: string; role: string; departmentId?: string; permissions?: any }) {
        const finalRole = (u.role && u.role.trim() !== '') ? u.role : 'Department';
        const finalUsername = u.username.trim();
        const finalDeptId = (u.departmentId && u.departmentId.trim() !== '') ? u.departmentId : null;
        // ใช้โดเมนที่ปลอดภัยและเป็นสากลมากขึ้นสำหรับการสร้าง User ภายใน
        const finalEmail = (u.email && u.email.trim() !== '') ? u.email : `${finalUsername.toLowerCase()}_${Math.floor(Math.random() * 1000)}@internal-system.com`;
        const finalPerms = u.permissions || {};
        const finalPassword = u.password || '123456';

        console.log('Adding user via signUp workaround:', finalEmail);

        // Create a temporary client to avoid logging out the current admin
        const { createClient } = await import('@supabase/supabase-js');
        const { supabaseUrl, supabaseKey } = await import('../supabaseClient');
        const tempSupabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        const { data, error } = await tempSupabase.auth.signUp({
            email: finalEmail,
            password: finalPassword,
            options: {
                data: {
                    username: finalUsername,
                    department_id: finalDeptId,
                    role: finalRole,
                    permissions: finalPerms
                }
            }
        });

        if (error) {
            console.error('Add user via signUp failed:', error);
            throw error;
        }

        console.log('User added successfully via signUp workaround');
        return data;
    },

    async updateUser(u: User) {
        const finalRole = (u.role && u.role.trim() !== '') ? u.role : 'Department';
        const finalDeptId = (u.departmentId && u.departmentId.trim() !== '') ? u.departmentId : null;

        const { error } = await supabase.from('users').update({
            username: u.username.trim(),
            email: u.email?.trim() || null,
            role: finalRole as any,
            department_id: finalDeptId,
            permissions: u.permissions as any
        }).eq('id', u.id);
        if (error) throw error;
    },

    async deleteUser(id: string) {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
    },

    // Departments
    async getDepartments(): Promise<Department[]> {
        const { data } = await supabase.from('departments').select('*').order('name');
        return (data || []).map(d => ({ id: d.id, name: d.name, type: d.type as any, telegramChatId: d.telegram_chat_id }));
    },

    async addDepartment(name: string, type: string) {
        const { data, error } = await supabase.from('departments').insert({ name, type }).select().single();
        if (error) throw error;
        return data;
    },

    async updateDepartment(id: string, name: string, type: string) {
        const { error } = await supabase.from('departments').update({ name, type }).eq('id', id);
        if (error) throw error;
    },

    async deleteDepartment(id: string) {
        const { error } = await supabase.from('departments').delete().eq('id', id);
        if (error) throw error;
    },

    // Products
    async getProducts(): Promise<Product[]> {
        const { data } = await supabase.from('products').select('*').order('name');
        return (data || []).map(p => ({
            id: p.id, name: p.name, unit: p.unit, category: p.category as any,
            pricePerUnit: p.price_per_unit, previousPricePerUnit: p.previous_price_per_unit,
            minStock: p.min_stock, maxStock: p.max_stock, lastYearUsage: p.last_year_usage,
            zone: p.zone, createdAt: p.created_at
        }));
    },

    async getProductsForDepartment(deptId: string): Promise<Product[]> {
        const { data, error } = await supabase.rpc('get_products_for_department', { dept_id: deptId });
        if (error) throw error;
        
        return (data as any[] || [])
            .map(p => ({
                id: p.id, name: p.name, unit: p.unit, category: p.category,
                pricePerUnit: p.price_per_unit, previousPricePerUnit: p.previous_price_per_unit,
                minStock: p.min_stock, maxStock: p.max_stock, lastYearUsage: p.last_year_usage,
                zone: p.zone
            }));
    },

    async updateProduct(p: Product): Promise<Product> {
        const updateData: any = {
            name: p.name, unit: p.unit, category: p.category as any,
            price_per_unit: p.pricePerUnit, previous_price_per_unit: p.previousPricePerUnit,
            min_stock: p.minStock, max_stock: p.maxStock, last_year_usage: p.lastYearUsage,
            zone: p.zone
        };
        const { data, error } = await supabase.from('products').update(updateData).eq('id', p.id).select().single();
        if (error || !data) throw error || new Error('Update failed');
        return {
            id: data.id, name: data.name, unit: data.unit, category: data.category as any,
            pricePerUnit: data.price_per_unit, previousPricePerUnit: data.previous_price_per_unit,
            minStock: data.min_stock, maxStock: data.max_stock, lastYearUsage: data.last_year_usage,
            zone: data.zone, createdAt: data.created_at
        };
    },

    async addProduct(p: Omit<Product, 'id'>): Promise<Product> {
        const insertData: any = {
            name: p.name, unit: p.unit, category: p.category as any,
            price_per_unit: p.pricePerUnit, previous_price_per_unit: p.previousPricePerUnit,
            min_stock: p.minStock, max_stock: p.maxStock, last_year_usage: p.lastYearUsage,
            zone: p.zone
        };
        const { data, error } = await supabase.from('products').insert(insertData).select().single();
        if (error || !data) throw error || new Error('Insert failed');
        return {
            id: data.id, name: data.name, unit: data.unit, category: data.category as any,
            pricePerUnit: data.price_per_unit, previousPricePerUnit: data.previous_price_per_unit,
            minStock: data.min_stock, maxStock: data.max_stock, lastYearUsage: data.last_year_usage,
            zone: data.zone, createdAt: data.created_at
        };
    },

    async deleteProduct(id: string) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    // Requisitions
    async getRequisitionsForAdmin(): Promise<Requisition[]> {
        const { data } = await supabase.from('requisitions').select('*, requisition_items(*, products(name, unit, price_per_unit, zone))').order('created_at', { ascending: false });
        return (data || []).map(r => ({
            id: r.id, requisitionNumber: r.requisition_number, departmentId: r.department_id, name: r.name,
            status: r.status as any, type: r.type as any, urgentReason: r.urgent_reason, createdAt: new Date(r.created_at),
            submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
            approvedAt: (r as any).submitted_at ? new Date((r as any).submitted_at) : null,
            requesterName: r.requester_name,
            requesterPosition: r.requester_position, approverName: r.approver_name, approverPosition: r.approver_position,
            receiverName: r.receiver_name,
            rejectionReason: r.rejection_reason,
            items: (r as any).requisition_items.map((i: any) => ({
                id: i.id, requisitionId: i.requisition_id, productId: i.product_id, quantity: i.quantity,
                pricePerUnit: i.price_per_unit, approvedQuantity: i.approved_quantity, status: i.status as any,
                departmentStockOnSubmit: i.department_stock_on_submit, returnedQuantity: i.returned_quantity,
                rejectReason: i.reject_reason,
                product: i.products ? { id: i.product_id, name: i.products.name, unit: i.products.unit, pricePerUnit: i.products.price_per_unit, zone: i.products.zone } : undefined
            }))
        } as Requisition));
    },

    async getRequisitionsForDepartment(deptId: string): Promise<Requisition[]> {
        const { data } = await supabase.from('requisitions').select('*, requisition_items(*, products(name, unit, price_per_unit))').eq('department_id', deptId).order('created_at', { ascending: false });
        return (data || []).map(r => ({
            id: r.id, requisitionNumber: r.requisition_number, departmentId: r.department_id, name: r.name,
            status: r.status as any, type: r.type as any, urgentReason: r.urgent_reason, createdAt: new Date(r.created_at),
            submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
            approvedAt: (r as any).submitted_at ? new Date((r as any).submitted_at) : null,
            requesterName: r.requester_name,
            requesterPosition: r.requester_position, approverName: r.approver_name, approverPosition: r.approver_position, receiverName: r.receiver_name,
            rejectionReason: r.rejection_reason,
            items: (r as any).requisition_items.map((i: any) => ({
                id: i.id, requisitionId: i.requisition_id, productId: i.product_id, quantity: i.quantity,
                pricePerUnit: i.price_per_unit, approvedQuantity: i.approved_quantity, status: i.status as any,
                departmentStockOnSubmit: i.department_stock_on_submit, returnedQuantity: i.returned_quantity,
                rejectReason: i.reject_reason,
                product: i.products ? { id: i.product_id, name: i.products.name, unit: i.products.unit, pricePerUnit: i.products.price_per_unit } : undefined
            }))
        } as Requisition));
    },

    async deleteRequisition(id: string) {
        await supabase.from('requisitions').delete().eq('id', id);
    },

    async getPendingRequisitionsForWarning(deptId: string): Promise<Requisition[]> {
        const { data } = await supabase
            .from('requisitions')
            .select('*, requisition_items(*, products(name, unit, price_per_unit))')
            .eq('department_id', deptId)
            .in('status', ['Ready', 'PartiallyApproved', 'Picking']);
        
        return (data || []).map(r => ({
            id: r.id, requisitionNumber: r.requisition_number, departmentId: r.department_id, name: r.name,
            status: r.status as any, type: r.type as any, urgentReason: r.urgent_reason, createdAt: new Date(r.created_at),
            submittedAt: r.submitted_at ? new Date(r.submitted_at) : null, requesterName: r.requester_name,
            requesterPosition: r.requester_position, approverName: r.approver_name, approverPosition: r.approver_position,
            receiverName: r.receiver_name,
            items: (r as any).requisition_items.map((i: any) => ({
                id: i.id, requisitionId: i.requisition_id, productId: i.product_id, quantity: i.quantity,
                pricePerUnit: i.price_per_unit, approvedQuantity: i.approved_quantity, status: i.status as any,
                departmentStockOnSubmit: i.department_stock_on_submit, returnedQuantity: i.returned_quantity,
                rejectReason: i.reject_reason,
                product: i.products ? { id: i.product_id, name: i.products.name, unit: i.products.unit, pricePerUnit: i.products.price_per_unit } : undefined
            }))
        } as Requisition));
    },

    async getRequisitionById(id: string): Promise<Requisition | null> {
        const { data } = await supabase
            .from('requisitions')
            .select('*, requisition_items(*, products(name, unit, price_per_unit))')
            .eq('id', id)
            .single();
        if (!data) return null;
        return {
            id: data.id, requisitionNumber: data.requisition_number, departmentId: data.department_id, name: data.name,
            status: data.status as any, type: data.type as any, urgentReason: data.urgent_reason, createdAt: new Date(data.created_at),
            submittedAt: data.submitted_at ? new Date(data.submitted_at) : null, requesterName: data.requester_name,
            requesterPosition: data.requester_position, approverName: data.approver_name, approverPosition: data.approver_position,
            receiverName: data.receiver_name,
            items: (data as any).requisition_items.map((i: any) => ({
                id: i.id, requisitionId: i.requisition_id, productId: i.product_id, quantity: i.quantity,
                pricePerUnit: i.price_per_unit, approvedQuantity: i.approved_quantity, status: i.status as any,
                departmentStockOnSubmit: i.department_stock_on_submit, returnedQuantity: i.returned_quantity,
                rejectReason: i.reject_reason,
                product: i.products ? { id: i.product_id, name: i.products.name, unit: i.products.unit, pricePerUnit: i.products.price_per_unit } : undefined
            }))
        } as Requisition;
    },

    async getNextRequisitionNumber(date: Date): Promise<string> {
        const prefix = getThaiYearMonthPrefix(date);
        
        // Search for requisitions with the same prefix (YYMM)
        const { data, error } = await supabase
            .from('requisitions')
            .select('requisition_number')
            .not('requisition_number', 'is', null)
            .ilike('requisition_number', `${prefix}%`);
            
        if (error) throw error;
        
        // Find the maximum running number
        let maxNum = 0;
        (data || []).forEach(r => {
            const numPart = r.requisition_number?.slice(4);
            if (numPart && !isNaN(parseInt(numPart))) {
                maxNum = Math.max(maxNum, parseInt(numPart));
            }
        });
        
        return `${prefix}${formatRunningNumber(maxNum + 1)}`;
    },

    async createAndCompleteRequisition(deptId: string, name: string, items: any[]) {
        const reqDate = new Date();
        const nextNum = await this.getNextRequisitionNumber(reqDate);
        
        const { data, error } = await supabase.rpc('create_and_complete_requisition', {
            p_department_id: deptId,
            p_name: name,
            p_items: items as any
        });
        if (error) throw error;
        
        await supabase.from('requisitions').update({ requisition_number: nextNum }).eq('id', data);
        
        return data;
    },

    async saveRequisition(req: Partial<Requisition>, items: any[], deptName: string, skipAdminNotification: boolean = false) {
        let reqId = req.id;
        const isNew = !reqId || reqId.startsWith('draft-');
        const isSubmitting = req.status === 'Submitted';
        
        let requisitionNumber = (req as any).requisitionNumber;
        
        // Generate number only when first submitted if it doesn't have one
        if (isSubmitting && !requisitionNumber) {
            requisitionNumber = await this.getNextRequisitionNumber(new Date());
        }

        const requisitionData = {
            department_id: req.departmentId, 
            name: req.name, 
            status: req.status, 
            type: req.type,
            urgent_reason: req.urgentReason, 
            submitted_at: req.submittedAt ? req.submittedAt.toISOString() : (isSubmitting ? new Date().toISOString() : null),
            requester_name: req.requesterName, 
            requester_position: req.requesterPosition,
            requisition_number: requisitionNumber
        };

        if (!isNew) {
            // Check current status to prevent race conditions (e.g. department edits after admin approved)
            const { data: currentReq } = await supabase.from('requisitions').select('status').eq('id', reqId!).single();
            if (currentReq && !['Draft', 'Submitted'].includes(currentReq.status)) {
                throw new Error('ไม่สามารถแก้ไขใบเบิกนี้ได้เนื่องจากสถานะถูกเปลี่ยนแปลงไปแล้ว (อาจกำลังดำเนินการหรืออนุมัติแล้ว)');
            }
            
            await supabase.from('requisitions').update(requisitionData as any).eq('id', reqId!);
        } else {
            const { data, error } = await supabase.from('requisitions').insert(requisitionData as any).select().single();
            if (error) throw error;
            reqId = data.id;
        }

        // Fetch existing items to determine what to delete and what to update
        const { data: existingItems } = await supabase.from('requisition_items').select('id, product_id').eq('requisition_id', reqId!);
        
        const newProductIds = new Set(items.map(i => i.productId));
        const itemsToDelete = existingItems?.filter(i => !newProductIds.has(i.product_id)).map(i => i.id) || [];
        
        if (itemsToDelete.length > 0) {
            const { error: deleteError } = await supabase.from('requisition_items').delete().in('id', itemsToDelete);
            if (deleteError) throw deleteError;
        }

        const itemsToUpsert = items.map(i => {
            return {
                requisition_id: reqId, 
                product_id: i.productId, 
                quantity: i.quantity,
                price_per_unit: i.price_per_unit, 
                status: i.status || 'Pending',
                approved_quantity: i.approved_quantity, 
                department_stock_on_submit: i.department_stock_on_submit
            };
        });

        const { error: itemsError } = await supabase.from('requisition_items').upsert(itemsToUpsert, { onConflict: 'requisition_id,product_id' });
        if (itemsError) {
            console.error('Error upserting requisition items:', itemsError);
            throw new Error('เกิดข้อผิดพลาดในการบันทึกรายการสินค้า กรุณาลองใหม่อีกครั้ง');
        }
        
        // Notification logic moved here to support central management
        if (isSubmitting && !skipAdminNotification) {
            try {
                // Fetch product prices to calculate total value
                let totalValue = 0;
                let formattedTotal = "0.00";
                
                try {
                    const productIds = items.map(i => i.productId);
                    const { data: productsData } = await supabase
                        .from('products')
                        .select('id, price_per_unit')
                        .in('id', productIds);
                    
                    if (productsData) {
                        const priceMap = new Map(productsData.map(p => [p.id, p.price_per_unit || 0]));
                        items.forEach(i => {
                            const price = i.pricePerUnit || i.price_per_unit || priceMap.get(i.productId) || 0;
                            totalValue += (i.quantity || 0) * price;
                        });
                        formattedTotal = totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                } catch (calcError) {
                    console.error("Error calculating total for notification:", calcError);
                    formattedTotal = "ไม่สามารถคำนวณได้";
                }

                const requesterInfo = req.requesterName ? `\nผู้เบิก: ${req.requesterName}` : '';
                const reqNumInfo = requisitionNumber ? `\nเลขที่ใบเบิก: ${requisitionNumber}` : '';
                const message = `มีใบเบิกใหม่จากหน่วยงาน: ${deptName}${reqNumInfo}${requesterInfo}\nจำนวน: ${items.length} รายการ\nมูลค่ารวม: ฿${formattedTotal}`;
                
                // Use a non-blocking call for notifications to ensure requisition save completes
                this.notifyAdmins(message).catch(e => console.error("Async notification error:", e));
            } catch (notifyError) {
                console.error("Error in notification preparation:", notifyError);
            }
        }

        return reqId;
    },

    async updateRequisitionStatus(id: string, status: RequisitionStatus) {
        await supabase.rpc('update_requisition_status', { p_requisition_id: id, p_new_status: status });
    },

    async forceUpdateRequisitionStatus(id: string, status: RequisitionStatus, reason?: string | null) {
        const updateData: any = { status: status as any };
        if (reason !== undefined) {
            updateData.rejection_reason = reason;
        }
        const { error } = await supabase
            .from('requisitions')
            .update(updateData)
            .eq('id', id);
        if (error) throw error;
    },

    async notifyDepartmentUsers(departmentId: string, message: string) {
        // 1. In-App Notification (Supabase)
        const { data: users } = await supabase.from('users').select('id').eq('department_id', departmentId);
        if (users && users.length > 0) {
            await supabase.from('notifications').insert(
                users.map(u => ({ recipient_id: u.id, message, is_read: false }))
            );
        }

        // 2. LINE Push Notification (via GAS)
        const lineWebhookUrl = await getGasUrl();
        if (lineWebhookUrl) {
            try {
                // Find all users in this department who have a LINE profile
                const { data: users } = await supabase.from('users').select('id').eq('department_id', departmentId);
                
                let profiles: any[] = [];
                if (users && users.length > 0) {
                    const userIds = users.map(u => u.id);
                    const { data: linkedProfiles } = await supabase.from('line_user_profiles').select('line_user_id, settings').in('user_id', userIds);
                    if (linkedProfiles) profiles = [...linkedProfiles];
                }

                // ALSO: Get LINE profiles linked directly to department via settings (from QR code scan)
                const { data: directProfiles } = await supabase
                    .from('line_user_profiles')
                    .select('line_user_id, settings')
                    .contains('settings', { department_id: departmentId });
                
                if (directProfiles) {
                    // Merge and remove duplicates by line_user_id
                    const existingIds = new Set(profiles.map(p => p.line_user_id));
                    directProfiles.forEach(p => {
                        if (!existingIds.has(p.line_user_id)) {
                            profiles.push(p);
                        }
                    });
                }
                
                if (profiles.length > 0) {
                    for (const profile of profiles) {
                        // Check if they have notifications enabled
                        if ((profile.settings as any)?.notify_status_change !== false) {
                            await fetch(lineWebhookUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: {
                                    'Content-Type': 'text/plain;charset=utf-8',
                                },
                                body: JSON.stringify({
                                    action: 'notify',
                                    targetUserId: profile.line_user_id,
                                    message: message
                                })
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to trigger LINE notification', err);
            }
        }
    },

    async confirmRequisitionReceipt(id: string, receiverName: string, isAdminOverride: boolean = false) {
        // Fetch requisition and department info for notification
        const { data: req } = await supabase
            .from('requisitions')
            .select('requisition_number, department_id, departments(name)')
            .eq('id', id)
            .single();

        await supabase.from('requisitions').update({ status: 'Completed', receiver_name: receiverName } as any).eq('id', id);

        if (req) {
            const deptName = (req as any).departments?.name || 'ไม่ทราบหน่วยงาน';
            const reqNum = req.requisition_number || id.substring(0, 8);
            const message = `หน่วยงาน ${deptName} ได้รับของแล้ว\nเลขที่ใบเบิก: ${reqNum}\nผู้รับ: ${receiverName}`;
            await this.notifyAdmins(message, 'requisition_received', '📦');
        }
    },

    async saveSimpleApproval(reqId: string, items: RequisitionItem[], status: RequisitionStatus) {
        // Fetch original items to preserve the requested quantity
        const { data: originalItems } = await supabase
            .from('requisition_items')
            .select('id, quantity, product_id')
            .eq('requisition_id', reqId);
        
        const originalQtyMap = new Map(originalItems?.map(i => [i.product_id, i.quantity]) || []);

        // Fetch original requisition to check its submitted_at date and requisition_number
        const { data: originalReq } = await supabase
            .from('requisitions')
            .select('submitted_at, requisition_number')
            .eq('id', reqId)
            .single();

        await supabase.rpc('process_requisition_approval', { p_requisition_id: reqId, p_items: items as any, p_edit_reason: 'Simple Approval' });
        
        // Update requisition status and submitted_at (only if not already set)
        const updateData: any = { status: status };
        if (!originalReq?.submitted_at) {
            updateData.submitted_at = new Date().toISOString();
        }
        // Restore original requisition_number if the RPC changed it
        if (originalReq?.requisition_number) {
            updateData.requisition_number = originalReq.requisition_number;
        }
        await supabase.from('requisitions').update(updateData).eq('id', reqId);

        // FIX: The RPC might overwrite the original requested quantity with the approved quantity,
        // or it might delete and recreate items (changing their IDs).
        // We must ensure the original requested quantity is preserved using the data we fetched BEFORE the RPC.
        // We update by requisition_id and product_id to be safe.
        for (const item of items) {
            const originalQty = originalQtyMap.has(item.productId) ? originalQtyMap.get(item.productId) : item.quantity;
            await supabase.from('requisition_items').update({ 
                quantity: originalQty,
                status: item.status 
            } as any)
            .eq('requisition_id', reqId)
            .eq('product_id', item.productId);
        }

        await this.handleRejectReasonsAndLocks(reqId, items);
        await this.logSystemEvent({
            level: 'INFO',
            event: 'REQUISITION_APPROVED',
            message: `Requisition ${reqId} approved (Simple Approval).`
        });
    },

    async updateProcessedRequisitionItems(reqId: string, items: RequisitionItem[], editReason: string | null) {
        // Fetch original items to preserve the requested quantity
        const { data: originalItems } = await supabase
            .from('requisition_items')
            .select('id, quantity, product_id')
            .eq('requisition_id', reqId);
        
        const originalQtyMap = new Map(originalItems?.map(i => [i.product_id, i.quantity]) || []);

        // Fetch original requisition to check its submitted_at date and requisition_number
        const { data: originalReq } = await supabase
            .from('requisitions')
            .select('submitted_at, requisition_number')
            .eq('id', reqId)
            .single();

        await supabase.rpc('process_requisition_approval', { p_requisition_id: reqId, p_items: items as any, p_edit_reason: editReason });
        
        const updateData: any = {};
        // Set submitted_at to current date only if not already set
        if (!originalReq?.submitted_at) {
            updateData.submitted_at = new Date().toISOString();
        }
        // Restore original requisition_number if the RPC changed it
        if (originalReq?.requisition_number) {
            updateData.requisition_number = originalReq.requisition_number;
        }
        
        if (Object.keys(updateData).length > 0) {
            await supabase.from('requisitions').update(updateData).eq('id', reqId);
        }

        // FIX: The RPC might overwrite the original requested quantity with the approved quantity,
        // or it might delete and recreate items (changing their IDs).
        // We must ensure the original requested quantity is preserved using the data we fetched BEFORE the RPC.
        // We update by requisition_id and product_id to be safe.
        for (const item of items) {
            const originalQty = originalQtyMap.has(item.productId) ? originalQtyMap.get(item.productId) : item.quantity;
            await supabase.from('requisition_items').update({ 
                quantity: originalQty,
                status: item.status 
            } as any)
            .eq('requisition_id', reqId)
            .eq('product_id', item.productId);
        }

        await this.handleRejectReasonsAndLocks(reqId, items);
        await this.logSystemEvent({
            level: 'INFO',
            event: 'REQUISITION_PROCESSED',
            message: `Requisition ${reqId} processed with reason: ${editReason || 'None'}.`
        });
    },

    async handleRejectReasonsAndLocks(reqId: string, items: RequisitionItem[]) {
        const rejectedItems = items.filter(i => i.status === 'Rejected');
        if (rejectedItems.length === 0) return;

        const { data: reqData } = await supabase.from('requisitions').select('department_id').eq('id', reqId).single();
        if (!reqData) return;

        for (const item of rejectedItems) {
            if (item.rejectReason) {
                await supabase.from('requisition_items').update({ reject_reason: item.rejectReason } as any).eq('id', item.id!);
            }
            if (item.lockProduct) {
                const { data: existing } = await supabase.from('product_assignments')
                    .select('id')
                    .eq('department_id', reqData.department_id)
                    .eq('product_id', item.productId)
                    .maybeSingle();
                
                if (existing) {
                    await supabase.from('product_assignments').update({ is_locked: true, lock_reason: item.rejectReason } as any).eq('id', existing.id);
                } else {
                    await supabase.from('product_assignments').insert({
                        department_id: reqData.department_id,
                        product_id: item.productId,
                        is_locked: true,
                        lock_reason: item.rejectReason
                    } as any);
                }
            }
        }
    },

    async updateRequisitionNumber(id: string, newNumber: string) {
        const { error } = await supabase.from('requisitions').update({ requisition_number: newNumber } as any).eq('id', id);
        if (error) throw error;
    },

    async fixAllRequisitionNumbers() {
        const { data, error } = await supabase
            .from('requisitions')
            .select('id, created_at, requisition_number')
            .not('status', 'eq', 'Draft')
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        if (!data) return;

        const monthGroups: Record<string, typeof data> = {};
        data.forEach(req => {
            const prefix = getThaiYearMonthPrefix(new Date(req.created_at));
            if (!monthGroups[prefix]) monthGroups[prefix] = [];
            monthGroups[prefix].push(req);
        });

        const updates = [];
        for (const [prefix, group] of Object.entries(monthGroups)) {
            for (let i = 0; i < group.length; i++) {
                const newNum = `${prefix}${formatRunningNumber(i + 1)}`;
                if (group[i].requisition_number !== newNum) {
                    updates.push(supabase.from('requisitions').update({ requisition_number: newNum } as any).eq('id', group[i].id));
                }
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
        }
        return updates.length;
    },

    // Inventory & Stock
    async getInventory(): Promise<InventoryItem[]> {
        const { data } = await supabase.from('inventory').select('*');
        return (data || []).map(i => ({
            productId: i.product_id,
            quantity: i.quantity,
            updatedAt: new Date(i.updated_at)
        }));
    },

    async adjustStockQuantity(productId: string, delta: number, notes: string) {
        await supabase.rpc('adjust_stock_quantity', { p_product_id: productId, p_adjustment_quantity: delta, p_notes: notes });
        await this.logSystemEvent({
            level: 'INFO',
            event: 'STOCK_ADJUSTED',
            message: `Stock for product ${productId} adjusted by ${delta}. Notes: ${notes}`
        });
    },

    async getProductTransactionHistory(productId: string, endDate: string): Promise<ProductTransaction[]> {
        const { data, error } = await supabase.rpc('get_product_transactions', { p_product_id: productId, p_end_date: endDate });
        if (error) throw error;
        return (data as any[] || []).map(t => ({
            transactionDate: new Date(t.transaction_date), transactionType: t.transaction_type,
            referenceDocument: t.reference_document, departmentName: t.department_name,
            quantityIn: t.quantity_in, quantityOut: t.quantity_out, balance: t.balance
        }));
    },

    // Surveys
    async getSurveyForDepartment(deptId: string, fiscalYear: number): Promise<SurveyEntry | null> {
        const { data } = await supabase.from('survey_submissions').select('*').eq('department_id', deptId).maybeSingle();
        if (!data || !data.quantities) return null;
        let q = data.quantities as any;
        const keys = Object.keys(q);
        if (keys.length > 0 && keys[0].length > 4) {
             // Old format, assume year 2569 as requested by user
             q = { 2569: q };
        }
        if (!q[fiscalYear]) return null;
        return {
            id: data.id,
            departmentId: data.department_id,
            submittedAt: data.submitted_at,
            quantities: q[fiscalYear]
        };
    },

    async submitSurvey(deptId: string, fiscalYear: number, newQuantities: any) {
        const { data: existing } = await supabase.from('survey_submissions').select('id, quantities').eq('department_id', deptId).maybeSingle();
        let quantities = existing?.quantities || {};
        const keys = Object.keys(quantities);
        if (keys.length > 0 && keys[0].length > 4) {
             quantities = { 2569: quantities }; // Old format belongs to 2569
        }
        quantities[fiscalYear] = newQuantities;
        
        if (existing) {
            const { error } = await supabase.from('survey_submissions').update({ quantities, submitted_at: new Date().toISOString() }).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error = null } = await supabase.from('survey_submissions').insert({ department_id: deptId, quantities, submitted_at: new Date().toISOString() });
            if (error) throw error;
        }
        await this.logSystemEvent({
            level: 'INFO',
            event: 'SURVEY_SUBMITTED',
            message: `Survey submitted for department ${deptId}.`
        });
        
        // Notify Admins
        try {
            const { data: dept } = await supabase.from('departments').select('name').eq('id', deptId).maybeSingle();
            const deptName = dept?.name || 'ไม่ทราบหน่วยงาน';
            await this.notifyAdmins(`หน่วยงาน ${deptName} ได้${existing ? 'อัปเดต' : 'ส่ง'}แบบสำรวจประจำปีงบประมาณ ${fiscalYear} แล้ว`, 'new_survey', '📋');
        } catch (e) {
            console.error("Failed to notify admins about survey submission", e);
        }
    },

    async getSurveySubmissions(fiscalYear: number): Promise<SurveyEntry[]> {
        const { data } = await supabase.from('survey_submissions').select('*');
        return (data || []).map(s => {
            let q = s.quantities as any || {};
            const keys = Object.keys(q);
            if (keys.length > 0 && keys[0].length > 4) {
                 q = { 2569: q }; // Old format belongs to 2569
            }
            return {
                id: s.id,
                departmentId: s.department_id,
                submittedAt: s.submitted_at,
                quantities: q[fiscalYear] || {}
            };
        });
    },

    // FY 2027 Survey Helpers
    async getFySurveySettings() {
        const { data } = await supabase.from('system_settings').select('*').in('key', ['fy_survey_open', 'fy_survey_year', 'fy_previous_year', 'fy_survey_force']);
        const settings: any = { fy_survey_open: false, fy_survey_force: false, fy_survey_year: 2570, fy_previous_year: 2569 };
        (data || []).forEach((s: any) => {
            settings[s.key] = s.value;
        });
        return settings;
    },

    async saveFySurveySettings(settings: { fy_survey_open: boolean; fy_survey_force: boolean; fy_survey_year: number; fy_previous_year: number }) {
        const updates = [
            supabase.from('system_settings').upsert({ key: 'fy_survey_open', value: settings.fy_survey_open }),
            supabase.from('system_settings').upsert({ key: 'fy_survey_force', value: settings.fy_survey_force }),
            supabase.from('system_settings').upsert({ key: 'fy_survey_year', value: settings.fy_survey_year }),
            supabase.from('system_settings').upsert({ key: 'fy_previous_year', value: settings.fy_previous_year })
        ];
        await Promise.all(updates);
    },

    async getDepartmentUsageForFiscalYear(deptId: string, fiscalYear: number): Promise<Record<string, number>> {
        // Simple logic to map Thai Fiscal Year to Date range
        // FY 2569 starts 2025-10-01, ends 2026-09-30
        const startYear = fiscalYear - 544; // 2569 - 544 = 2025
        const endYear = fiscalYear - 543;   // 2569 - 543 = 2026
        const startDate = `${startYear}-10-01T00:00:00Z`;
        const endDate = `${endYear}-09-30T23:59:59Z`;

        const { data, error } = await supabase
            .from('requisition_items')
            .select('product_id, approved_quantity, quantity, requisitions!inner(department_id, status, created_at)')
            .eq('requisitions.department_id', deptId)
            .in('requisitions.status', ['Completed', 'Ready', 'PartiallyApproved'])
            .gte('requisitions.created_at', startDate)
            .lte('requisitions.created_at', endDate);

        if (error) throw error;

        const usageMap: Record<string, number> = {};
        (data as any[] || []).forEach(item => {
            const qty = (item.approved_quantity !== null && item.approved_quantity !== undefined) ? item.approved_quantity : item.quantity;
            usageMap[item.product_id] = (usageMap[item.product_id] || 0) + qty;
        });

        return usageMap;
    },

    async getLockedProductsWithReasons(deptId: string): Promise<Record<string, string>> {
        const { data } = await supabase
            .from('product_assignments')
            .select('product_id, lock_reason')
            .eq('department_id', deptId)
            .eq('is_locked', true);
        
        const lockedMap: Record<string, string> = {};
        (data || []).forEach(item => {
            lockedMap[item.product_id] = item.lock_reason || 'ไม่ได้ระบุเหตุผล';
        });
        return lockedMap;
    },

    async checkDepartmentMinMaxStatus(deptId: string): Promise<{ hasMissingMinMax: boolean; missingCount: number }> {
        const { data } = await supabase
            .from('department_inventory')
            .select('product_id, min_stock, max_stock')
            .eq('department_id', deptId);
        
        if (!data || data.length === 0) return { hasMissingMinMax: false, missingCount: 0 };
        
        const missing = data.filter(i => i.min_stock === null || i.max_stock === null);
        return {
            hasMissingMinMax: missing.length > 0,
            missingCount: missing.length
        };
    },

    // Budget
    async getBudgetForFiscalYear(year: number): Promise<number | null> {
        const { data } = await supabase.from('system_settings').select('value').eq('key', `budget_${year}`).maybeSingle();
        return data ? (data.value as number) : null;
    },

    async setBudgetForFiscalYear(year: number, budget: number) {
        const { error } = await supabase.from('system_settings').upsert({ key: `budget_${year}`, value: budget });
        if (error) throw error;
    },

    // Logs & Settings
    async getSystemSettings() {
        const { data } = await supabase.from('system_settings').select('*');
        const settings: any = {};
        (data || []).forEach(s => settings[s.key] = s.value);
        return settings;
    },
    
    async saveSystemSettings(settings: any) {
        for (const [key, value] of Object.entries(settings)) {
            const { error } = await supabase
                .from('system_settings')
                .upsert({ key, value } as any, { onConflict: 'key' });
            if (error) throw error;
        }
    },

    async updateSystemSetting(key: string, value: any) {
        await supabase.from('system_settings').upsert({ key, value });
    },

    async logSystemEvent(payload: { level: 'INFO' | 'WARN' | 'ERROR', event: string, message: string }) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('system_logs').insert({
                level: payload.level,
                event: payload.event,
                message: payload.message,
                user_id: user?.id || null
            });
            if (error) {
                // If direct insert fails (e.g. RLS), fallback to RPC
                console.warn("Direct log failed, falling back to RPC", error);
                await supabase.rpc('log_event', { p_level: payload.level, p_event: payload.event, p_message: payload.message });
            }
        } catch (e) {
            console.error("Logging failed", e);
        }
    },

    async getSystemLogs(): Promise<SystemLog[]> {
        const { data, error } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) {
            console.error("Error fetching logs:", error);
            return [];
        }
        
        // Fetch usernames separately if needed, or just use user_id
        const userIds = [...new Set((data || []).map(l => l.user_id).filter(Boolean))];
        let userMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase.from('users').select('id, username').in('id', userIds);
            (users || []).forEach(u => { userMap[u.id] = u.username; });
        }

        return (data || []).map(l => ({ 
            id: l.id, 
            level: l.level as any, 
            event: l.event, 
            message: l.message, 
            userId: l.user_id, 
            username: userMap[l.user_id] || 'System', 
            createdAt: new Date(l.created_at) 
        }));
    },

    async getProductTransactions(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('product_transactions')
            .select('*')
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate);
        if (error) throw error;
        return data;
    },

    async getAdminDashboardData(fiscalYear: number) {
        const [prods, depts, reqs, surveys, logs, users] = await Promise.all([
            this.getProducts(),
            this.getDepartments(),
            this.getRequisitionsForAdmin(),
            this.getSurveySubmissions(fiscalYear),
            this.getSystemLogs(),
            this.getUsers()
        ]);
        return { products: prods, departments: depts, requisitions: reqs, surveySubmissions: surveys, systemLogs: logs, users };
    },

    async getPurchasePlan(year: number): Promise<PurchasePlanItem[]> {
        const { data } = await supabase.from('purchase_plan_items').select('*').eq('fiscal_year', year);
        return (data || []).map(p => ({
            productId: p.product_id,
            fiscalYear: p.fiscal_year,
            plannedQuantity: p.planned_quantity
        }));
    },

    async savePurchasePlan(year: number, items: PurchasePlanItem[]) {
        const { data: existingItems } = await supabase.from('purchase_plan_items').select('id, product_id').eq('fiscal_year', year);
        const newProductIds = new Set(items.map(i => i.productId));
        const itemsToDelete = existingItems?.filter(i => !newProductIds.has(i.product_id)).map(i => i.id) || [];
        
        if (itemsToDelete.length > 0) {
            await supabase.from('purchase_plan_items').delete().in('id', itemsToDelete);
        }

        const itemsToUpsert = items.map(i => {
            return {
                product_id: i.productId, 
                fiscal_year: i.fiscalYear, 
                planned_quantity: i.plannedQuantity
            };
        });

        const { error } = await supabase.from('purchase_plan_items').upsert(itemsToUpsert, { onConflict: 'product_id,fiscal_year' });
        if (error) throw error;
    },

    async getPurchasePlanManualStock(year: number): Promise<Record<string, number>> {
        const { data } = await supabase.from('system_settings').select('value').eq('key', `purchase_plan_stock_${year}`).maybeSingle();
        return (data?.value as Record<string, number>) || {};
    },

    async savePurchasePlanManualStock(year: number, stockData: Record<string, number>) {
        const { error } = await supabase.from('system_settings').upsert({ key: `purchase_plan_stock_${year}`, value: stockData });
        if (error) throw error;
    },

    async getExpiringStock(): Promise<ExpiringStockItem[]> {
        const { data, error } = await supabase.rpc('get_expiring_stock');
        if (error) throw error;
        return (data as any[] || []).map(i => ({
            id: i.id, productId: i.product_id, product: { name: i.product_name } as any,
            quantityRemaining: i.quantity_remaining,
            expiryDate: i.expiry_date ? new Date(i.expiry_date) : null,
            company: { name: i.company_name } as any
        }));
    },

    async getLoansForAdmin(): Promise<LoanItem[]> {
        const { data } = await supabase.from('loan_items').select('*, products(name), departments(name)');
        return (data || []).map(l => ({
            id: l.id, createdAt: new Date(l.created_at), originalRequisitionId: l.original_requisition_id || '',
            productId: l.product_id, departmentId: l.department_id, quantity: l.quantity, status: l.status as any,
            fulfilledAt: l.fulfilled_at ? new Date(l.fulfilled_at) : null, isDerived: false,
            productName: (l as any).products?.name, departmentName: (l as any).departments?.name
        }));
    },

    async getProductUsageHistory(): Promise<ProductUsageHistory[]> {
        const { data } = await supabase.from('product_usage_by_fiscal_year').select('*');
        return (data || []).map(u => ({
            productId: u.product_id || '',
            fiscalYear: u.fiscal_year || 0,
            totalQuantity: u.total_quantity_used || 0
        }));
    },

    async getGoodsReceivedNotesWithDetails(): Promise<GoodsReceivedNote[]> {
        const { data } = await supabase.from('goods_received_notes').select('*, goods_received_items(*)').order('received_date', { ascending: false });
        return (data as any[] || []).map(g => ({
            id: g.id, grnNumber: g.grn_number, sourceType: g.source_type as any,
            purchaseOrderId: g.purchase_order_id || undefined, receivedDate: new Date(g.received_date),
            status: g.status as any, notes: g.notes,
            items: (g as any).goods_received_items.map((i: any) => ({
                id: i.id, productId: i.product_id, quantityReceived: i.quantity_received,
                expiryDate: i.expiry_date ? new Date(i.expiry_date) : null, lotNumber: i.lot_number
            }))
        }));
    },

    async getPurchaseOrdersForAdmin(): Promise<PurchaseOrder[]> {
        const { data } = await supabase.from('purchase_orders').select('*, purchase_order_items(*), po_committees(*)').order('created_at', { ascending: false });
        return (data || []).map(p => ({
            id: p.id,
            poNumber: p.po_number,
            companyId: p.company_id,
            status: p.status as any,
            totalValue: p.total_value,
            createdAt: new Date(p.created_at),
            orderedAt: p.ordered_at ? new Date(p.ordered_at) : null,
            items: (p as any).purchase_order_items.map((i: any) => ({
                id: i.id, productId: i.product_id, quantity: i.quantity, price_per_unit: i.price_per_unit
            })),
            committees: (p as any).po_committees.map((c: any) => ({
                id: c.id, name: c.name, position: c.position, role: c.role as any, ordering: c.ordering
            }))
        } as PurchaseOrder));
    },

    async getCompanies(): Promise<Company[]> {
        const { data, error } = await supabase.from('companies').select('*').order('name');
        if (error) throw error;
        return (data || []).map(c => ({ id: c.id, name: c.name }));
    },

    async addCompany(name: string): Promise<Company> {
        const { data, error } = await supabase.from('companies').insert({ name }).select().single();
        if (error) throw error;
        return { id: data.id, name: data.name };
    },

    async updateCompany(id: string, name: string): Promise<Company> {
        const { data, error } = await supabase.from('companies').update({ name }).eq('id', id).select().single();
        if (error) throw error;
        return { id: data.id, name: data.name };
    },

    async deleteCompany(id: string) {
        await supabase.from('companies').delete().eq('id', id);
    },

    async getPersonnel(): Promise<Personnel[]> {
        const { data } = await supabase.from('personnel').select('*').order('name');
        return (data || []).map(p => ({ id: p.id, name: p.name, position: p.position, signatureImage: p.signature_image }));
    },

    async addPersonnel(p: { name: string, position: string }): Promise<Personnel> {
        const { data, error } = await supabase.from('personnel').insert(p).select().single();
        if (error) throw error;
        return { id: data.id, name: data.name, position: data.position, signatureImage: data.signature_image };
    },

    async updatePersonnel(id: string, p: { name: string, position: string }): Promise<Personnel> {
        const { data, error } = await supabase.from('personnel').update(p).eq('id', id).select().single();
        if (error) throw error;
        return { id: data.id, name: data.name, position: data.position, signatureImage: data.signature_image };
    },

    async updatePersonnelSignature(id: string, signatureImage: string | null): Promise<void> {
        const { error } = await supabase.from('personnel').update({ signature_image: signatureImage }).eq('id', id);
        if (error) throw error;
    },

    async deletePersonnel(id: string) {
        await supabase.from('personnel').delete().eq('id', id);
    },

    async getAssignedProductIdsForDepartment(deptId: string): Promise<{productId: string, isLocked: boolean, lockReason: string | null}[]> {
        const { data } = await supabase.from('product_assignments').select('product_id, is_locked, lock_reason').eq('department_id', deptId);
        return (data || []).map(d => ({
            productId: d.product_id,
            isLocked: d.is_locked || false,
            lockReason: d.lock_reason
        }));
    },

    async setProductAssignmentsForDepartment(deptId: string, assignments: {productId: string, isLocked?: boolean, lockReason?: string | null}[]) {
        const { data: existingAssignments } = await supabase.from('product_assignments').select('id, product_id').eq('department_id', deptId);
        const newProductIds = new Set(assignments.map(a => a.productId));
        const assignmentsToDelete = existingAssignments?.filter(a => !newProductIds.has(a.product_id)).map(a => a.id) || [];
        
        if (assignmentsToDelete.length > 0) {
            await supabase.from('product_assignments').delete().in('id', assignmentsToDelete);
        }

        if (assignments.length > 0) {
            const assignmentsToUpsert = assignments.map(a => {
                return {
                    department_id: deptId, 
                    product_id: a.productId,
                    is_locked: a.isLocked || false,
                    lock_reason: a.lockReason || null
                };
            });
            await supabase.from('product_assignments').upsert(assignmentsToUpsert, { onConflict: 'department_id,product_id' });
        }
    },

    async getProductSuppliers(): Promise<ProductSupplier[]> {
        const { data, error } = await supabase.from('product_suppliers').select('*');
        if (error) throw error;
        return (data || []).map(ps => ({
            id: ps.id,
            productId: ps.product_id,
            companyId: ps.company_id
        }));
    },

    async setSuppliersForProduct(productId: string, companyIds: string[]) {
        const { data: existingSuppliers, error: fetchError } = await supabase.from('product_suppliers').select('id, company_id').eq('product_id', productId);
        if (fetchError) throw fetchError;

        const newCompanyIds = new Set(companyIds);
        const existingCompanyIds = new Set(existingSuppliers?.map(s => s.company_id) || []);

        // Delete suppliers that are no longer in the list
        const suppliersToDelete = existingSuppliers?.filter(s => !newCompanyIds.has(s.company_id)).map(s => s.id) || [];
        if (suppliersToDelete.length > 0) {
            const { error: deleteError } = await supabase.from('product_suppliers').delete().in('id', suppliersToDelete);
            if (deleteError) throw deleteError;
        }

        // Insert only the ones that are actually new
        const companyIdsToInsert = companyIds.filter(id => !existingCompanyIds.has(id));
        if (companyIdsToInsert.length > 0) {
            const suppliersToInsert = companyIdsToInsert.map(id => ({
                product_id: productId,
                company_id: id
            }));
            const { error: insertError } = await supabase.from('product_suppliers').insert(suppliersToInsert);
            if (insertError) throw insertError;
        }
    },

    async notifyAdmins(message: string, toggleKey: string = 'new_requisition', icon: string = '📦') {
        try {
            const { data: admins } = await supabase.from('users').select('id').in('role', ['Admin', 'Warehouse']);
            if (admins && admins.length > 0) {
                await supabase.from('notifications').insert(admins.map(a => ({ recipient_id: a.id, message, is_read: false })));
            }
        } catch (dbNotifyError) {
            console.error("Failed to save in-app notification:", dbNotifyError);
        }

        try {
            const settings = await this.getSystemSettings();
            
            // 1. Telegram Notification
            if (settings.admin_channel_telegram !== false) {
                const botToken = settings.telegram_bot_token;
                const chatId = settings.telegram_admin_chat_id;
                
                if (botToken && chatId) {
                    await this.sendTelegramNotification(chatId, message.startsWith(icon) ? message : `${icon} ${message}`, botToken);
                }
            }

            // 2. LINE Notification
            // Check if LINE is enabled OR if we have the necessary credentials
            if (settings.admin_channel_line === true || (settings.gas_webhook_url && settings.admin_line_user_id)) {
                 const lineWebhookUrl = settings.gas_webhook_url;
                 const adminLineUserId = settings.admin_line_user_id;
                 
                 if (lineWebhookUrl && adminLineUserId) {
                     const finalMessage = message.startsWith(icon) ? message : `${icon} ${message}`;
                     
                     await fetch(lineWebhookUrl, {
                         method: 'POST',
                         mode: 'no-cors',
                         headers: {
                             'Content-Type': 'text/plain;charset=utf-8',
                         },
                         body: JSON.stringify({
                             action: 'notify',
                             targetUserId: adminLineUserId,
                             message: finalMessage
                         })
                     });
                 }
            }
        } catch (settingsError) {
            console.error("Failed to notify admins via external channels:", settingsError);
        }
    },

    async createNotification(userId: string, message: string) {
        await supabase.from('notifications').insert({ recipient_id: userId, message, is_read: false });
    },

    async markNotificationAsRead(id: number) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },

    async markAllNotificationsAsRead(userId: string) {
        await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId);
    },

    async getNotifications(userId: string): Promise<AppNotification[]> {
        const { data } = await supabase.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(50);
        return (data || []).map(n => ({ id: n.id, message: n.message, isRead: n.is_read, createdAt: new Date(n.created_at) }));
    },

    async sendAdminNotification(payload: { message: string, recipientIds: string[], sendToLine?: boolean }) {
        await supabase.from('notifications').insert(payload.recipientIds.map(id => ({ recipient_id: id, message: payload.message, is_read: false })));
        
        if (payload.sendToLine) {
            const lineWebhookUrl = await getGasUrl();
            if (lineWebhookUrl) {
                try {
                    let allLineUserIds = new Set<string>();

                    // 1. Get LINE profiles for the selected users
                    const { data: linkedProfiles } = await supabase.from('line_user_profiles').select('line_user_id').in('user_id', payload.recipientIds);
                    if (linkedProfiles) {
                        linkedProfiles.forEach(p => {
                            if (p.line_user_id) allLineUserIds.add(p.line_user_id);
                        });
                    }

                    // 2. Get departments of the selected users
                    const { data: users } = await supabase.from('users').select('department_id').in('id', payload.recipientIds);
                    if (users) {
                        const departmentIds = Array.from(new Set(users.map(u => u.department_id).filter(Boolean)));
                        
                        // 3. Get LINE profiles linked directly to those departments
                        for (const deptId of departmentIds) {
                            const { data: directProfiles } = await supabase
                                .from('line_user_profiles')
                                .select('line_user_id')
                                .contains('settings', { department_id: deptId });
                            
                            if (directProfiles) {
                                directProfiles.forEach(p => {
                                    if (p.line_user_id) allLineUserIds.add(p.line_user_id);
                                });
                            }
                        }
                    }

                    // Send to all unique LINE user IDs
                    if (allLineUserIds.size > 0) {
                        for (const lineUserId of Array.from(allLineUserIds)) {
                            await fetch(lineWebhookUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                body: JSON.stringify({
                                    action: 'notify',
                                    targetUserId: lineUserId,
                                    message: `🔔 แจ้งเตือนจากผู้ดูแลระบบ\n\n${payload.message}`
                                })
                            }).catch(e => console.error("Error sending LINE push to user", e));
                        }
                    }
                } catch (e) {
                    console.error("Failed to send LINE notification in sendAdminNotification", e);
                }
            }
        }
    },

    async getPublicChatMessages(): Promise<PublicChatMessage[]> {
        const { data } = await supabase.from('public_chat_messages').select('*').order('created_at', { ascending: true }).limit(100);
        return (data || []).map(m => ({ id: m.id, createdAt: new Date(m.created_at), username: m.username, message: m.message, userId: m.user_id }));
    },

    async sendPublicChatMessage(user: User | null, username: string, message: string) {
        const { error } = await supabase.from('public_chat_messages').insert({ user_id: user?.id || null, username: username, message: message });
        if (error) throw error;
        
        const notificationMessage = `แชทใหม่จาก ${username}: ${message.length > 60 ? message.substring(0, 60) + '...' : message}`;
        await this.notifyAdmins(notificationMessage, 'public_chat_message', '💬');
    },

    async deletePublicChatMessage(id: number) {
        await supabase.from('public_chat_messages').delete().eq('id', id);
    },

    async getOrderedPurchaseOrders(): Promise<PurchaseOrder[]> {
        const { data } = await supabase.from('purchase_orders').select('*').in('status', ['Ordered', 'PartiallyReceived']);
        return (data || []).map(p => ({ id: p.id, poNumber: p.po_number, companyId: p.company_id, status: p.status as any, totalValue: p.total_value, createdAt: new Date(p.created_at), orderedAt: p.ordered_at ? new Date(p.ordered_at) : null } as any));
    },

    async getPurchaseOrderForReceiving(poId: string): Promise<any> {
        const { data } = await supabase.from('purchase_orders').select('*, purchase_order_items(*)').eq('id', poId).single();
        if (!data) return null;
        return { ...data, items: (data as any).purchase_order_items.map((i: any) => ({ productId: i.product_id, quantity: i.quantity, price_per_unit: i.price_per_unit })) };
    },

    async getReceivedItemsForPO(poId: string): Promise<Record<string, number>> {
        const { data } = await supabase.from('goods_received_notes').select('id').eq('purchase_order_id', poId).eq('status', 'Completed');
        if (!data || data.length === 0) return {};
        const grnIds = data.map(g => g.id);
        const { data: items } = await supabase.from('goods_received_items').select('product_id, quantity_received').in('grn_id', grnIds);
        const totals: Record<string, number> = {};
        (items || []).forEach(i => totals[i.product_id] = (totals[i.product_id] || 0) + i.quantity_received);
        return totals;
    },

    async createGoodsReceivedNote(payload: any) {
        return await supabase.rpc('create_grn_with_items', { p_source_type: payload.sourceType, p_po_id: payload.purchaseOrderId || null, p_notes: payload.notes || null, p_items: payload.items as any });
    },

    async approveGoodsReceivedNote(grnId: string) {
        await supabase.rpc('approve_grn_and_update_stock', { p_grn_id: grnId });
    },

    async updateCompletedGoodsReceivedNote(grn: GoodsReceivedNote, items: any[]) {
        for (const item of items) {
            await supabase.rpc('update_completed_grn_item', { p_item_id: item.id, p_new_quantity: item.quantityReceived, p_new_expiry_date: item.expiryDate ? item.expiryDate.toISOString() : null, p_new_lot_number: item.lot_number });
        }
    },

    async updatePendingGrn(grnId: string, items: any[]) {
        await supabase.rpc('update_pending_grn_items', { p_grn_id: grnId, p_items: items as any });
    },

    async cancelCompletedGrn(grnId: string) {
        await supabase.rpc('cancel_grn_and_adjust_stock', { p_grn_id: grnId });
    },

    async deletePendingGrn(grnId: string) {
        await supabase.from('goods_received_notes').delete().eq('id', grnId);
    },

    async createPurchaseOrders(basket: any) {
        for (const [companyId, data] of Object.entries(basket)) {
            const typedData = data as any;
            const { data: po, error } = await supabase.from('purchase_orders').insert({
                company_id: companyId, status: 'Draft',
                total_value: typedData.items.reduce((sum: number, i: any) => sum + (i.quantity * (i.product.pricePerUnit || 0)), 0)
            }).select().single();
            if (error) throw error;
            await supabase.from('purchase_order_items').insert(typedData.items.map((i: any) => ({
                purchase_order_id: po.id, product_id: i.product.id, quantity: i.quantity, price_per_unit: i.product.pricePerUnit || 0
            })));
        }
    },

    async updatePurchaseOrderDetails(poId: string, poData: any, items: any[], committees: any[]) {
        await supabase.from('purchase_orders').update(poData).eq('id', poId);
        
        // Handle items
        const { data: existingItems } = await supabase.from('purchase_order_items').select('id, product_id').eq('purchase_order_id', poId);
        const newProductIds = new Set(items.map(i => i.product_id));
        const itemsToDelete = existingItems?.filter(i => !newProductIds.has(i.product_id)).map(i => i.id) || [];
        if (itemsToDelete.length > 0) {
            await supabase.from('purchase_order_items').delete().in('id', itemsToDelete);
        }
        const itemsToUpsert = items.map(i => {
            const existingItem = existingItems?.find(e => e.product_id === i.product_id);
            return { ...(existingItem?.id ? { id: existingItem.id } : {}), ...i, purchase_order_id: poId };
        });
        await supabase.from('purchase_order_items').upsert(itemsToUpsert);

        // Handle committees
        const { data: existingCommittees } = await supabase.from('po_committees').select('id, personnel_id').eq('purchase_order_id', poId);
        const newPersonnelIds = new Set(committees.map(c => c.personnel_id));
        const committeesToDelete = existingCommittees?.filter(c => !newPersonnelIds.has(c.personnel_id)).map(c => c.id) || [];
        if (committeesToDelete.length > 0) {
            await supabase.from('po_committees').delete().in('id', committeesToDelete);
        }
        const committeesToUpsert = committees.map(c => {
            const existingCommittee = existingCommittees?.find(e => e.personnel_id === c.personnel_id);
            return { ...(existingCommittee?.id ? { id: existingCommittee.id } : {}), ...c, purchase_order_id: poId };
        });
        await supabase.from('po_committees').upsert(committeesToUpsert);
    },

    async getPublicProductInfo(productId: string): Promise<PublicProductInfo | null> {
        const { data, error } = await supabase.rpc('get_product_stock', { p_product_id: productId });
        if (error) throw error;
        const { data: p } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
        if (!p) return null;
        return { id: p.id, name: p.name, unit: p.unit, quantity: data || 0, minStock: p.min_stock, maxStock: p.max_stock, zone: p.zone };
    },

    async searchPublicProducts(term: string): Promise<any[]> {
        const { data } = await supabase.from('products').select('*, inventory(quantity)').ilike('name', `%${term}%`).limit(20);
        return (data || []).map(p => ({ id: p.id, name: p.name, unit: p.unit, zone: p.zone, minStock: p.min_stock, maxStock: p.max_stock, quantity: (p as any).inventory?.[0]?.quantity || 0 }));
    },

    async fulfillBackorderItem(id: number) { await supabase.rpc('fulfill_backorder_item', { p_backorder_item_id: id }); },
    
    async fulfillBackorderItemsBatch(ids: number[]) {
        for (const id of ids) await this.fulfillBackorderItem(id);
    },

    async cancelBackorderItem(id: number) {
        // Since backorders are derived from requisition_items with status 'Backordered',
        // cancelling means setting the status to 'Rejected' (or another appropriate status).
        const { error } = await supabase.from('requisition_items').update({ status: 'Rejected' }).eq('id', id);
        if (error) throw error;
    },

    async fulfillLoanItem(item: LoanItem) {
        if (item.isDerived) {
            const { error } = await supabase.from('requisition_items').update({ status: 'LoanFulfilled' }).eq('id', item.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('loan_items').update({ status: 'Fulfilled', fulfilled_at: new Date().toISOString() }).eq('id', item.id);
            if (error) throw error;
        }
    },

    async deleteLoanItem(item: LoanItem) {
        if (item.isDerived) {
            const { error } = await supabase.from('requisition_items').update({ status: 'Rejected' }).eq('id', item.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('loan_items').delete().eq('id', item.id);
            if (error) throw error;
        }
    },

    async fulfillLoanItemsBatch(items: LoanItem[]) {
        for (const i of items) await this.fulfillLoanItem(i);
    },

    async getLoansForDepartment(deptId: string): Promise<LoanItem[]> {
        const { data } = await supabase.from('loan_items').select('*, products(name)').eq('department_id', deptId).eq('status', 'Pending');
        return (data || []).map(l => ({ id: l.id, createdAt: new Date(l.created_at), productId: l.product_id, departmentId: l.department_id, quantity: l.quantity, status: 'Pending', fulfilledAt: null, isDerived: false, productName: (l as any).products?.name }));
    },

    async createDirectLoans(deptId: string, deptName: string, items: any[], notes: string) {
        await supabase.from('loan_items').insert(items.map(i => ({ department_id: deptId, product_id: i.productId, quantity: i.quantity, status: 'Pending' })));
    },

    async markLoansAsFulfilled(directLoanIds: number[], derivedLoanIds: number[]) {
        if (directLoanIds.length > 0) await supabase.from('loan_items').update({ status: 'Fulfilled', fulfilled_at: new Date().toISOString() } as any).in('id', directLoanIds);
        if (derivedLoanIds.length > 0) await supabase.from('requisition_items').update({ status: 'LoanFulfilled' } as any).in('id', derivedLoanIds);
    },

    async createReturnSlip(req: Requisition, items: any[], reason: string) {
        await supabase.rpc('create_return_slip', { p_original_requisition_id: req.id, p_original_department_id: req.departmentId, p_notes: reason, p_items: items as any });
    },

    async autoProcessStaleRequisitions() { /* Implementation via DB Function */ },
    async autoFulfillLoansWithStock() { /* Implementation via DB Function */ },

    async updateDepartmentInventoryBatch(deptId: string, updates: any[]) {
        for (const u of updates) {
            await supabase.from('department_inventory').upsert({ department_id: deptId, product_id: u.productId, quantity: u.quantity, min_stock: u.min_stock, max_stock: u.max_stock, updated_at: new Date().toISOString() });
        }
    },

    async updateDepartmentInventoryLotsBatch(deptId: string, lots: any[]) {
        const { data: existingLots } = await supabase.from('department_inventory_lots').select('id, product_id, lot_number').eq('department_id', deptId);
        
        const newLotsSet = new Set(lots.map(l => `${l.productId}-${l.lot_number || ''}`));
        const lotsToDelete = existingLots?.filter(l => !newLotsSet.has(`${l.product_id}-${l.lot_number || ''}`)).map(l => l.id) || [];
        
        if (lotsToDelete.length > 0) {
            await supabase.from('department_inventory_lots').delete().in('id', lotsToDelete);
        }

        if (lots.length > 0) {
            const lotsToUpsert = lots.map(l => {
                const existingLot = existingLots?.find(e => e.product_id === l.productId && (e.lot_number || '') === (l.lot_number || ''));
                return {
                    ...(existingLot?.id ? { id: existingLot.id } : {}),
                    department_id: deptId, 
                    product_id: l.productId, 
                    quantity: l.quantity, 
                    lot_number: l.lot_number, 
                    expiry_date: l.expiry_date
                };
            });
            await supabase.from('department_inventory_lots').upsert(lotsToUpsert);
        }
    },

    async getDepartmentInventory(deptId: string): Promise<DepartmentInventoryItem[]> {
        const { data } = await supabase.from('department_inventory').select('*').eq('department_id', deptId);
        return (data || []).map(i => ({ departmentId: i.department_id, productId: i.product_id, quantity: i.quantity, minStock: i.min_stock, maxStock: i.max_stock }));
    },

    async createLoanTransaction(transaction: Omit<LoanTransaction, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Date }, items: Omit<LoanTransactionItem, 'id' | 'loanTransactionId' | 'returnedQuantity'>[]) {
        const { data: txn, error: txnError } = await supabase.from('loan_transactions').insert({
            transaction_number: transaction.transactionNumber,
            department_id: transaction.departmentId,
            borrower_name: transaction.borrowerName,
            lender_name: transaction.lenderName,
            reason: transaction.reason,
            status: transaction.status,
            created_at: transaction.createdAt ? new Date(transaction.createdAt).toISOString() : new Date().toISOString()
        }).select().single();

        if (txnError) throw txnError;

        const { error: itemsError } = await supabase.from('loan_transaction_items').insert(items.map(i => ({
            loan_transaction_id: txn.id,
            product_id: i.productId,
            quantity: i.quantity
        })));

        if (itemsError) throw itemsError;
        return txn;
    },

    async getLoanTransactions(): Promise<LoanTransaction[]> {
        // 1. Fetch real loan transactions
        const { data: dbTxns, error } = await supabase.from('loan_transactions').select(`
            *,
            department:departments(name),
            items:loan_transaction_items(
                *,
                product:products(*)
            )
        `).order('created_at', { ascending: false });

        if (error) throw error;

        const mappedDbTxns = dbTxns.map((t: any) => ({
            id: t.id,
            transactionNumber: t.transaction_number,
            departmentId: t.department_id,
            departmentName: t.department?.name,
            borrowerName: t.borrower_name,
            lenderName: t.lender_name,
            reason: t.reason,
            status: t.status,
            createdAt: new Date(t.created_at),
            updatedAt: new Date(t.updated_at),
            isDerived: false,
            items: t.items.map((i: any) => ({
                id: i.id,
                loanTransactionId: i.loan_transaction_id,
                productId: i.product_id,
                quantity: i.quantity,
                returnedQuantity: i.returned_quantity,
                isDerived: false,
                product: {
                    id: i.product.id,
                    name: i.product.name,
                    unit: i.product.unit,
                    pricePerUnit: i.product.price_per_unit,
                    minStock: i.product.min_stock,
                    maxStock: i.product.max_stock,
                    image: i.product.image,
                    zone: i.product.zone
                }
            }))
        }));

        // 2. Fetch Requisitions with Loaned items
        const { data: reqs, error: reqError } = await supabase
            .from('requisitions')
            .select(`
                *,
                department:departments(name),
                items:requisition_items(
                    *,
                    product:products(*)
                )
            `)
            .not('status', 'eq', 'Draft'); // Only submitted/processed requisitions
        
        if (reqError) throw reqError;

        const derivedTxns: LoanTransaction[] = [];

        (reqs || []).forEach((req: any) => {
            const loanedItems = (req.items || []).filter((i: any) => i.status === 'Loaned' || i.status === 'LoanFulfilled');
            
            if (loanedItems.length > 0) {
                // Determine status based on returned quantity
                const allReturned = loanedItems.every((i: any) => (i.returned_quantity || 0) >= (i.approved_quantity || i.quantity));
                
                derivedTxns.push({
                    id: `req-${req.id}`,
                    transactionNumber: `${req.requisition_number} (Loan)`,
                    departmentId: req.department_id,
                    departmentName: req.department?.name,
                    borrowerName: req.requester_name || 'Unknown',
                    lenderName: req.approver_name || 'System',
                    reason: `From Requisition #${req.requisition_number}`,
                    status: allReturned ? 'Completed' : 'Active',
                    createdAt: new Date(req.created_at),
                    updatedAt: new Date(req.updated_at || req.created_at),
                    isDerived: true,
                    items: loanedItems.map((i: any) => ({
                        id: i.id, // Use requisition_item_id
                        loanTransactionId: `req-${req.id}`,
                        productId: i.product_id,
                        quantity: i.approved_quantity || i.quantity, // Use approved quantity as loaned amount
                        returnedQuantity: i.returned_quantity || 0,
                        isDerived: true,
                        originalRequisitionItemId: i.id,
                        product: {
                            id: i.product.id,
                            name: i.product.name,
                            unit: i.product.unit,
                            pricePerUnit: i.product.price_per_unit,
                            minStock: i.product.min_stock,
                            maxStock: i.product.max_stock,
                            image: i.product.image,
                            zone: i.product.zone
                        }
                    }))
                });
            }
        });

        // 3. Merge and Sort
        return [...mappedDbTxns, ...derivedTxns].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async updateRequisitionItemReturn(itemId: number, returnedQty: number) {
        const { data: item, error: fetchError } = await supabase.from('requisition_items').select('approved_quantity, quantity').eq('id', itemId).single();
        if (fetchError) throw fetchError;
        if (!item) throw new Error('Item not found');
        
        const targetQty = item.approved_quantity || item.quantity;
        // Keep status as 'Loaned' because 'LoanFulfilled' might not be in the DB enum yet
        // The UI/Service logic uses returned_quantity to determine if a loan is completed
        const status = 'Loaned';
        
        const { error } = await supabase.from('requisition_items').update({ 
            returned_quantity: returnedQty,
            status: status
        }).eq('id', itemId);
        
        if (error) throw error;
    },

    async updateLoanTransactionItem(itemId: number, returnedQty: number) {
        const { data: item, error: fetchError } = await supabase
            .from('loan_transaction_items')
            .update({ returned_quantity: returnedQty })
            .eq('id', itemId)
            .select('loan_transaction_id')
            .single();
            
        if (fetchError) throw fetchError;

        // Check if all items in this transaction are now fully returned
        const { data: allItems } = await supabase
            .from('loan_transaction_items')
            .select('quantity, returned_quantity')
            .eq('loan_transaction_id', item.loan_transaction_id);

        if (allItems) {
            const isFullyReturned = allItems.every((i: any) => i.returned_quantity >= i.quantity);
            if (isFullyReturned) {
                await supabase
                    .from('loan_transactions')
                    .update({ status: 'Completed' })
                    .eq('id', item.loan_transaction_id);
            } else {
                // If it was Completed but now someone reduced returned qty (unlikely via UI but for safety)
                await supabase
                    .from('loan_transactions')
                    .update({ status: 'Active' })
                    .eq('id', item.loan_transaction_id);
            }
        }
    },

    async updateLoanTransactionStatus(txnId: string, status: string) {
        const { error } = await supabase.from('loan_transactions').update({ status }).eq('id', txnId);
        if (error) throw error;
    },

    async updateLoanTransactionItemQuantity(itemId: number, quantity: number) {
        const { data: item, error: updateError } = await supabase
            .from('loan_transaction_items')
            .update({ quantity })
            .eq('id', itemId)
            .select('loan_transaction_id')
            .single();
        
        if (updateError) throw updateError;

        // Re-check status
        const { data: allItems } = await supabase
            .from('loan_transaction_items')
            .select('quantity, returned_quantity')
            .eq('loan_transaction_id', item.loan_transaction_id);

        if (allItems) {
            const isFullyReturned = allItems.every((i: any) => i.returned_quantity >= i.quantity);
            await supabase
                .from('loan_transactions')
                .update({ status: isFullyReturned ? 'Completed' : 'Active' })
                .eq('id', item.loan_transaction_id);
        }
    },

    async deleteLoanTransactionItem(itemId: number) {
        // Get txnId first
        const { data: item, error: fetchError } = await supabase
            .from('loan_transaction_items')
            .select('loan_transaction_id')
            .eq('id', itemId)
            .single();
        
        if (fetchError) {
            console.error('Error fetching item to delete:', fetchError);
            throw new Error('ไม่พบรายการที่ต้องการลบ');
        }
        if (!item) throw new Error('ไม่พบรายการที่ต้องการลบ');

        const { error, data: deletedData } = await supabase.from('loan_transaction_items').delete().eq('id', itemId).select();
        if (error) throw error;
        if (!deletedData || deletedData.length === 0) {
            throw new Error('ไม่สามารถลบรายการได้ (อาจติดสิทธิ์ RLS หรือไม่มีรายการนี้)');
        }

        // Check if txn has any items left
        const { data: remainingItems } = await supabase
            .from('loan_transaction_items')
            .select('id, quantity, returned_quantity')
            .eq('loan_transaction_id', item.loan_transaction_id);
        
        if (!remainingItems || remainingItems.length === 0) {
            // If no items left, maybe delete the transaction too? 
            // Or just leave it empty. Let's delete it to keep it clean.
            const { error: delTxnErr } = await supabase.from('loan_transactions').delete().eq('id', item.loan_transaction_id);
            if (delTxnErr) console.error('Failed to delete empty transaction:', delTxnErr);
        } else {
            // Re-check status
            const isFullyReturned = remainingItems.every((i: any) => i.returned_quantity >= i.quantity);
            await supabase
                .from('loan_transactions')
                .update({ status: isFullyReturned ? 'Completed' : 'Active' })
                .eq('id', item.loan_transaction_id);
        }
    },

    async deleteLoanTransaction(txnId: string) {
        if (txnId.startsWith('req-')) {
            const realReqId = txnId.replace('req-', '');
            // Update requisition items status back to 'Approved'
            const { error } = await supabase
                .from('requisition_items')
                .update({ status: 'Approved' })
                .eq('requisition_id', realReqId)
                .in('status', ['Loaned', 'LoanFulfilled']);
            if (error) throw error;
            return;
        }

        // Delete items first if no cascade
        const { error: delItemsErr } = await supabase.from('loan_transaction_items').delete().eq('loan_transaction_id', txnId);
        if (delItemsErr) throw delItemsErr;
        const { error, data: deletedTxn } = await supabase.from('loan_transactions').delete().eq('id', txnId).select();
        if (error) throw error;
        if (!deletedTxn || deletedTxn.length === 0) {
            throw new Error('ไม่สามารถลบรายการยืมได้ (อาจติดสิทธิ์ RLS หรือไม่มีรายการนี้)');
        }
    },

    async getDepartmentInventoryLots(deptId: string): Promise<DepartmentInventoryLot[]> {
        const { data } = await supabase.from('department_inventory_lots').select('*').eq('department_id', deptId);
        return (data || []).map(l => ({ id: l.id, departmentId: l.department_id, productId: l.product_id, quantity: l.quantity, lotNumber: l.lot_number, expiryDate: l.expiry_date }));
    },

    async getDepartmentProductUsage(deptId: string): Promise<DepartmentProductUsage[]> {
        const { data } = await supabase.from('department_product_usage').select('*').eq('department_id', deptId);
        return (data || []).map(u => ({ departmentId: u.department_id || '', productId: u.product_id || '', totalApprovedQuantity: u.total_approved_quantity || 0 }));
    },

    async updateRequisitionItemPrices(items: { id: number, pricePerUnit: number }[]) {
        for (const item of items) { await supabase.from('requisition_items').update({ price_per_unit: item.pricePerUnit }).eq('id', item.id); }
    },

    async getLineProfile(userId: string): Promise<LineUserProfile | null> {
        const { data } = await supabase.from('line_user_profiles').select('*').eq('user_id', userId).maybeSingle();
        if (!data) return null;
        return { userId: data.user_id, lineUserId: data.line_user_id, displayName: data.display_name, pictureUrl: data.picture_url, settings: data.settings as any };
    },

    async upsertLineProfile(userId: string, lineUserId: string, displayName: string, pictureUrl: string) {
        // Fetch user's department_id to include in settings for easier notification filtering
        const { data: userData } = await supabase.from('users').select('department_id').eq('id', userId).maybeSingle();
        const departmentId = userData?.department_id;

        const { error } = await supabase.from('line_user_profiles').upsert({
            user_id: userId,
            line_user_id: lineUserId,
            display_name: displayName,
            picture_url: pictureUrl,
            settings: { 
                notify_status_change: true, 
                notify_new_requisition: true,
                department_id: departmentId 
            }
        }, { onConflict: 'user_id' });
        if (error) throw error;
    },

    async initiateLineLogin() {
        const clientId = '2008863486';
        // Use window.location.origin so it works on both dev and pre URLs
        const redirectUri = `${window.location.origin}/line-callback`;
        const state = Math.random().toString(36).substring(7);
        
        // Store state in localStorage to verify later
        localStorage.setItem('line_oauth_state', state);

        const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=profile%20openid`;
        
        window.location.href = lineLoginUrl;
    },
    
    async unlinkLineProfile(userId: string) { await supabase.from('line_user_profiles').delete().eq('user_id', userId); },
    async updateLineSettings(userId: string, settings: any) { await supabase.from('line_user_profiles').update({ settings }).eq('user_id', userId); },
    async updateUserNotificationSettings(userId: string, settings: any) { await supabase.from('users').update({ permissions: settings }).eq('id', userId); },
    
    async sendTestLineNotification(userId: string) {
        const gasUrl = await getGasUrl();
        if (!gasUrl) return;
        
        const { data: profile } = await supabase.from('line_user_profiles').select('line_user_id').eq('user_id', userId).single();
        if (!profile) return;

        await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'notify',
                targetUserId: profile.line_user_id,
                message: "🔔 ทดสอบการแจ้งเตือนจากระบบเบิกเวชภัณฑ์\n(Test Notification)"
            })
        });
    },
    
    async saveGasWebhookUrl(url: string) {
        await this.updateSystemSetting('gas_webhook_url', url);
    },

    async sendTelegramNotification(chatId: string, message: string, token?: string) {
        const settings = token ? { telegram_bot_token: token } : await this.getSystemSettings();
        const botToken = token || settings.telegram_bot_token;
        if (!botToken || !chatId) return;

        try {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('text', message);
            formData.append('parse_mode', 'HTML');

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });
        } catch (e) {
            console.error("Telegram notification failed", e);
        }
    },

    async getP2PPostings(): Promise<P2PExchangePosting[]> {
        const { data } = await supabase.from('p2p_exchange_postings').select('*, products(name, unit), departments(name)');
        return (data as any[] || []).map(p => ({
            id: p.id,
            postingDepartmentId: p.posting_department_id,
            productId: p.product_id,
            quantity: p.quantity,
            postType: p.post_type as any,
            status: p.status as any,
            notes: p.notes,
            fulfilledByDepartmentId: p.fulfilled_by_department_id,
            fulfilledAt: p.fulfilled_at ? new Date(p.fulfilled_at) : null,
            createdAt: new Date(p.created_at),
            product: (p as any).products ? { id: p.product_id, name: p.products.name, unit: p.products.unit } as any : undefined,
            department: (p as any).departments ? { id: p.posting_department_id, name: p.departments.name } as any : undefined
        }));
    },

    async createP2PPosting(p: any) { await supabase.rpc('create_p2p_posting', { p_posting_department_id: p.posting_department_id, p_product_id: p.product_id, p_quantity: p.quantity, p_post_type: p.post_type, p_notes: p.notes }); },
    async fulfillP2PPosting(postId: string, deptId: string) { await supabase.rpc('fulfill_p2p_posting', { p_post_id: postId, p_fulfilling_department_id: deptId }); },
    async cancelP2PPosting(postId: string) { await supabase.rpc('cancel_p2p_posting', { p_post_id: postId }); },

    async searchP2P(productId: string, deptId: string) {
        const [offers, stocks] = await Promise.all([
            supabase.from('p2p_exchange_postings').select('*, departments(name)').eq('product_id', productId).eq('status', 'ACTIVE').eq('post_type', 'OFFER').neq('posting_department_id', deptId),
            supabase.from('department_inventory').select('*, departments(name)').eq('product_id', productId).gt('quantity', 0).neq('department_id', deptId)
        ]);
        return { offers: (offers.data || []).map(p => ({ ...p, department: { name: (p as any).departments?.name } } as any)), departmentStocks: (stocks.data || []).map(s => ({ departmentId: s.department_id, departmentName: (s as any).departments?.name, quantity: s.quantity })) };
    },

    async getAnnouncementSettings() {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'announcement_settings').maybeSingle();
        return data ? (data.value as any) : { content: '', enabled: false };
    },

    async saveAnnouncementSettings(settings: any) {
        await this.updateSystemSetting('announcement_settings', settings);
    },

    async getAnnouncementLibrary(): Promise<any[]> {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'announcement_library').maybeSingle();
        return data ? (data.value as any[]) : [];
    },

    async saveAnnouncementLibrary(library: any[]) {
        await this.updateSystemSetting('announcement_library', library);
    },

    async getDocumentSettings(): Promise<DocumentSettings> {
        const settings = await this.getSystemSettings();
        return {
            hospitalName: settings.hospital_name,
            hospitalLogoUrl: settings.hospital_logo_url,
            documentApproverName: settings.document_approver_name,
            documentApproverPosition: settings.document_approver_position,
            documentIssuerName: settings.document_issuer_name,
            documentIssuerPosition: settings.document_issuer_position,
            documentDisbursementApproverName: settings.document_disbursement_approver_name,
            documentDisbursementApproverPosition: settings.document_disbursement_approver_position,
            documentReceiverName: settings.document_receiver_name,
            documentReceiverPosition: settings.document_receiver_position
        };
    },

    async updateDocumentSettings(settings: DocumentSettings) {
        await Promise.all([
            this.updateSystemSetting('hospital_name', settings.hospitalName),
            this.updateSystemSetting('hospital_logo_url', settings.hospitalLogoUrl),
            this.updateSystemSetting('document_approver_name', settings.documentApproverName),
            this.updateSystemSetting('document_approver_position', settings.documentApproverPosition),
            this.updateSystemSetting('document_issuer_name', settings.documentIssuerName),
            this.updateSystemSetting('document_issuer_position', settings.documentIssuerPosition),
            this.updateSystemSetting('document_disbursement_approver_name', settings.documentDisbursementApproverName),
            this.updateSystemSetting('document_disbursement_approver_position', settings.documentDisbursementApproverPosition),
            this.updateSystemSetting('document_receiver_name', settings.documentReceiverName),
            this.updateSystemSetting('document_receiver_position', settings.documentReceiverPosition)
        ]);
    },

    async uploadLogo(file: File): Promise<string> {
        const fileName = `hospital_logo_${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('public').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(fileName);
        return publicUrl;
    },

    async restoreFromBackup(file: File) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonData: Record<string, any[]> = {};
                    workbook.SheetNames.forEach(name => { jsonData[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name]); });
                    const { error } = await supabase.rpc('restore_database_from_json', { json_data: jsonData as any });
                    if (error) reject(error); else resolve(true);
                } catch (err) { reject(err); }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    async updateProductMinMaxBatch(updates: { productId: string, minStock: number | null, maxStock: number | null }[]) {
        for (const u of updates) {
            await supabase.from('products').update({ min_stock: u.minStock, max_stock: u.maxStock }).eq('id', u.productId);
        }
    },

    async createProductIssue(payload: any) {
        const { error } = await supabase.from('product_issues').insert({
            requisition_item_id: payload.requisition_item_id,
            department_id: payload.department_id,
            product_id: payload.product_id,
            lot_number: payload.lot_number,
            issue_type: payload.issue_type,
            quantity: payload.quantity,
            description: payload.description,
            reporter_name: payload.reporter_name,
            reporter_position: payload.reporter_position,
            status: 'SUBMITTED'
        });
        if (error) throw error;
    },

    async getProductIssuesForDepartment(deptId: string): Promise<ProductIssue[]> {
        const { data } = await supabase
            .from('product_issues')
            .select('*, products(name)')
            .eq('department_id', deptId)
            .order('created_at', { ascending: false });
        
        return (data || []).map(i => ({
            id: i.id,
            requisition_item_id: i.requisition_item_id,
            department_id: i.department_id,
            product_id: i.product_id,
            productName: (i as any).products?.name,
            lotNumber: i.lot_number,
            issueType: i.issue_type as any,
            quantity: i.quantity,
            description: i.description,
            reporterName: i.reporter_name,
            reporterPosition: i.reporter_position,
            status: i.status as any,
            warehouseNotes: i.warehouse_notes,
            createdAt: new Date(i.created_at)
        }));
    },

    async updateProductIssueStatus(issueId: string, status: ProductIssueStatus, notes: string) {
        const { error } = await supabase
            .from('product_issues')
            .update({ status: status as any, warehouse_notes: notes })
            .eq('id', issueId);
        if (error) throw error;
        await this.logSystemEvent({
            level: 'INFO',
            event: 'PRODUCT_ISSUE_UPDATED',
            message: `Product issue ${issueId} status updated to ${status}.`
        });
    },

    // Satisfaction Survey Methods
    async getActiveSurveyConfig(): Promise<SurveyConfig | null> {
        const { data, error } = await supabase
            .from('survey_configs')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;
        
        return {
            id: data.id,
            roundName: data.round_name,
            isActive: data.is_active,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at)
        };
    },

    async getAllSurveyConfigs(): Promise<SurveyConfig[]> {
        const { data, error } = await supabase
            .from('survey_configs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []).map(d => ({
            id: d.id,
            roundName: d.round_name,
            isActive: d.is_active,
            createdAt: new Date(d.created_at),
            updatedAt: new Date(d.updated_at)
        }));
    },

    async getSurveyQuestions(configId: string): Promise<SurveyQuestion[]> {
        const { data, error } = await supabase
            .from('survey_questions')
            .select('*')
            .eq('config_id', configId)
            .order('order_index', { ascending: true });
        
        if (error) throw error;
        return (data || []).map(q => ({
            id: q.id,
            configId: q.config_id,
            questionText: q.question_text,
            questionType: q.question_type as any,
            orderIndex: q.order_index,
            createdAt: new Date(q.created_at)
        }));
    },

    async checkDepartmentSurveyStatus(configId: string, deptId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('survey_responses')
            .select('id')
            .eq('config_id', configId)
            .eq('department_id', deptId)
            .maybeSingle();
        
        if (error) throw error;
        return !!data;
    },

    async submitSurveyResponse(payload: { configId: string, departmentId: string, userId?: string, answers: any }) {
        const { error } = await supabase.from('survey_responses').insert({
            config_id: payload.configId,
            department_id: payload.departmentId,
            user_id: payload.userId,
            answers: payload.answers
        });
        if (error) throw error;
    },

    async startNewSurveyRound(roundName: string) {
        // Deactivate all others
        await supabase.from('survey_configs').update({ is_active: false });
        
        const { data, error } = await supabase.from('survey_configs').insert({
            round_name: roundName,
            is_active: true
        }).select().single();
        
        if (error) throw error;
        return data;
    },

    async toggleSurveyStatus(configId: string, isActive: boolean) {
        if (isActive) {
            // Deactivate others
            await supabase.from('survey_configs').update({ is_active: false }).neq('id', configId);
        }
        const { error } = await supabase.from('survey_configs').update({ is_active: isActive }).eq('id', configId);
        if (error) throw error;
    },

    async saveSurveyQuestions(configId: string, questions: Partial<SurveyQuestion>[]) {
        const { data: existingQuestions } = await supabase.from('survey_questions').select('id, question_text').eq('config_id', configId);
        const newQuestionTexts = new Set(questions.map(q => q.questionText));
        const questionsToDelete = existingQuestions?.filter(q => !newQuestionTexts.has(q.question_text)).map(q => q.id) || [];
        
        if (questionsToDelete.length > 0) {
            await supabase.from('survey_questions').delete().in('id', questionsToDelete);
        }

        if (questions.length === 0) return;

        const toUpsert = questions.map((q, idx) => {
            const existingQuestion = existingQuestions?.find(e => e.question_text === q.questionText);
            return {
                ...(existingQuestion?.id ? { id: existingQuestion.id } : {}),
                config_id: configId,
                question_text: q.questionText,
                question_type: q.questionType || 'rating',
                order_index: idx
            };
        });
        
        const { error } = await supabase.from('survey_questions').upsert(toUpsert);
        if (error) throw error;
    },

    async getSurveySummary(configId: string) {
        const { data: responses, error } = await supabase
            .from('survey_responses')
            .select('answers')
            .eq('config_id', configId);
        
        if (error) throw error;
        return responses || [];
    },

    async deleteSurveyRound(configId: string) {
        const { error } = await supabase.from('survey_configs').delete().eq('id', configId);
        if (error) throw error;
    }
};
