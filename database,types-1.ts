
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      backorder_items: {
        Row: {
          id: number
          created_at: string
          original_requisition_id: string
          product_id: string
          department_id: string
          quantity: number
        }
        Insert: {
          id?: number
          created_at?: string
          original_requisition_id: string
          product_id: string
          department_id: string
          quantity: number
        }
        Update: {
          id?: number
          created_at?: string
          original_requisition_id?: string
          product_id?: string
          department_id?: string
          quantity?: number
        }
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
      }
      department_inventory: {
        Row: {
          department_id: string
          product_id: string
          quantity: number
          updated_at: string
          min_stock: number | null
          max_stock: number | null
        }
        Insert: {
          department_id: string
          product_id: string
          quantity?: number
          updated_at?: string
          min_stock?: number | null
          max_stock?: number | null
        }
        Update: {
          department_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          min_stock?: number | null
          max_stock?: number | null
        }
      }
      department_inventory_lots: {
        Row: {
          id: number
          department_id: string
          product_id: string
          quantity: number
          lot_number: string | null
          expiry_date: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          department_id: string
          product_id: string
          quantity: number
          lot_number?: string | null
          expiry_date?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          department_id?: string
          product_id?: string
          quantity?: number
          lot_number?: string | null
          expiry_date?: string | null
          updated_at?: string
        }
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          telegram_chat_id: string | null
          type: "Internal" | "External" | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          telegram_chat_id?: string | null
          type?: "Internal" | "External" | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          telegram_chat_id?: string | null
          type?: "Internal" | "External" | null
        }
      }
      goods_received_items: {
        Row: {
          expiry_date: string | null
          grn_id: string
          id: number
          lot_number: string | null
          product_id: string
          quantity_received: number
          quantity_remaining: number | null
        }
        Insert: {
          expiry_date?: string | null
          grn_id: string
          id?: number
          lot_number?: string | null
          product_id: string
          quantity_received: number
          quantity_remaining?: number | null
        }
        Update: {
          expiry_date?: string | null
          grn_id?: string
          id?: number
          lot_number?: string | null
          product_id?: string
          quantity_received?: number
          quantity_remaining?: number | null
        }
      }
      goods_received_notes: {
        Row: {
          grn_number: string | null
          id: string
          notes: string | null
          purchase_order_id: string | null
          received_by: string | null
          received_date: string
          source_type: "PO" | "Other" | "Return"
          status: "Pending Approval" | "Completed" | "Cancelled"
        }
        Insert: {
          grn_number?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          received_by?: string | null
          received_date?: string
          source_type: "PO" | "Other" | "Return"
          status?: "Pending Approval" | "Completed" | "Cancelled"
        }
        Update: {
          grn_number?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          received_by?: string | null
          received_date?: string
          source_type?: "PO" | "Other" | "Return"
          status?: "Pending Approval" | "Completed" | "Cancelled"
        }
      }
      inventory: {
        Row: {
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          quantity?: number
          updated_at?: string
        }
      }
      line_user_profiles: {
        Row: {
          user_id: string
          line_user_id: string
          display_name: string
          picture_url: string | null
          settings: Json
          created_at: string
        }
        Insert: {
          user_id: string
          line_user_id: string
          display_name: string
          picture_url?: string | null
          settings?: Json
          created_at?: string
        }
        Update: {
          user_id?: string
          line_user_id?: string
          display_name?: string
          picture_url?: string | null
          settings?: Json
          created_at?: string
        }
      }
      loan_items: {
        Row: {
          id: number
          created_at: string
          original_requisition_id: string | null
          product_id: string
          department_id: string
          quantity: number
          status: "Pending" | "Fulfilled"
          fulfilled_at: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          original_requisition_id?: string | null
          product_id: string
          department_id: string
          quantity: number
          status?: "Pending" | "Fulfilled"
          fulfilled_at?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          original_requisition_id?: string | null
          product_id?: string
          department_id?: string
          quantity?: number
          status?: "Pending" | "Fulfilled"
          fulfilled_at?: string | null
        }
      }
      notifications: {
        Row: {
          created_at: string
          id: number
          is_read: boolean
          message: string
          recipient_id: string
          sender_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          is_read?: boolean
          message: string
          recipient_id: string
          sender_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          is_read?: boolean
          message?: string
          recipient_id?: string
          sender_id?: string | null
        }
      }
      p2p_exchange_postings: {
        Row: {
          id: string
          created_at: string
          posting_department_id: string
          product_id: string
          quantity: number
          post_type: "OFFER" | "REQUEST"
          status: "ACTIVE" | "FULFILLED" | "CANCELLED"
          notes: string | null
          fulfilled_by_department_id: string | null
          fulfilled_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          posting_department_id: string
          product_id: string
          quantity: number
          post_type: "OFFER" | "REQUEST"
          status?: "ACTIVE" | "FULFILLED" | "CANCELLED"
          notes?: string | null
          fulfilled_by_department_id?: string | null
          fulfilled_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          posting_department_id?: string
          product_id?: string
          quantity?: number
          post_type?: "OFFER" | "REQUEST"
          status?: "ACTIVE" | "FULFILLED" | "CANCELLED"
          notes?: string | null
          fulfilled_by_department_id?: string | null
          fulfilled_at?: string | null
        }
      }
      personnel: {
        Row: {
          created_at: string
          id: string
          name: string
          position: string
          signature_image: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position: string
          signature_image?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: string
          signature_image?: string | null
        }
      }
      po_committees: {
        Row: {
          id: number
          name: string
          ordering: number
          position: string
          purchase_order_id: string
          role: "ประธานกรรมการ" | "กรรมการ"
        }
        Insert: {
          id?: number
          name: string
          ordering?: number
          position: string
          purchase_order_id: string
          role: "ประธานกรรมการ" | "กรรมการ"
        }
        Update: {
          id?: number
          name?: string
          ordering?: number
          position?: string
          purchase_order_id?: string
          role?: "ประธานกรรมการ" | "กรรมการ"
        }
      }
      product_assignments: {
        Row: {
          department_id: string
          id: number
          product_id: string
        }
        Insert: {
          department_id: string
          id?: number
          product_id: string
        }
        Update: {
          department_id?: string
          id?: number
          product_id?: string
        }
      }
      product_issues: {
        Row: {
          created_at: string
          department_id: string
          description: string
          id: string
          issue_type: "FOR_RESOLUTION" | "REQUEST_REPLACEMENT"
          lot_number: string
          product_id: string
          quantity: number
          reporter_name: string
          reporter_position: string
          requisition_item_id: number
          resolved_at: string | null
          status:
            | "SUBMITTED"
            | "REPLACEMENT_READY"
            | "REPLACEMENT_UNAVAILABLE"
            | "ACKNOWLEDGED"
          warehouse_notes: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          description: string
          id?: string
          issue_type: "FOR_RESOLUTION" | "REQUEST_REPLACEMENT"
          lot_number: string
          product_id: string
          quantity: number
          reporter_name: string
          reporter_position: string
          requisition_item_id: number
          resolved_at?: string | null
          status?:
            | "SUBMITTED"
            | "REPLACEMENT_READY"
            | "REPLACEMENT_UNAVAILABLE"
            | "ACKNOWLEDGED"
          warehouse_notes?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string
          id?: string
          issue_type?: "FOR_RESOLUTION" | "REQUEST_REPLACEMENT"
          lot_number?: string
          product_id?: string
          quantity?: number
          reporter_name?: string
          reporter_position?: string
          requisition_item_id?: number
          resolved_at?: string | null
          status?:
            | "SUBMITTED"
            | "REPLACEMENT_READY"
            | "REPLACEMENT_UNAVAILABLE"
            | "ACKNOWLEDGED"
          warehouse_notes?: string | null
        }
      }
      product_suppliers: {
        Row: {
          company_id: string
          id: number
          product_id: string
        }
        Insert: {
          company_id: string
          id?: number
          product_id: string
        }
        Update: {
          company_id?: string
          id?: number
          product_id?: string
        }
      }
      products: {
        Row: {
          category: "วัสดุการแพทย์ทั่วไป" | "วัสดุเภสัชกรรม" | "ของสนับสนุน" | "ของแถม"
          created_at: string
          id: string
          last_year_usage: number | null
          max_stock: number | null
          min_stock: number | null
          name: string
          price_per_unit: number | null
          previous_price_per_unit: number | null
          unit: string
          zone: string | null
        }
        Insert: {
          category: "วัสดุการแพทย์ทั่วไป" | "วัสดุเภสัชกรรม" | "ของสนับสนุน" | "ของแถม"
          created_at?: string
          id?: string
          last_year_usage?: number | null
          max_stock?: number | null
          min_stock?: number | null
          name: string
          price_per_unit?: number | null
          previous_price_per_unit?: number | null
          unit: string
          zone?: string | null
        }
        Update: {
          category?: "วัสดุการแพทย์ทั่วไป" | "วัสดุเภสัชกรรม" | "ของสนับสนุน" | "ของแถม"
          created_at?: string
          id?: string
          last_year_usage?: number | null
          max_stock?: number | null
          min_stock?: number | null
          name?: string
          price_per_unit?: number | null
          previous_price_per_unit?: number | null
          unit?: string
          zone?: string | null
        }
      }
      public_chat_messages: {
        Row: {
          created_at: string
          id: number
          message: string
          username: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          message: string
          username: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          message?: string
          username?: string
          user_id?: string | null
        }
      }
      purchase_order_items: {
        Row: {
          id: number
          price_per_unit: number
          product_id: string
          purchase_order_id: string | null
          quantity: number
        }
        Insert: {
          id?: number
          price_per_unit: number
          product_id: string
          purchase_order_id: string | null
          quantity: number
        }
        Update: {
          id?: number
          price_per_unit?: number
          product_id?: string
          purchase_order_id?: string | null
          quantity?: number
        }
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          ordered_at: string | null
          po_number: string | null
          status: "Draft" | "Ordered" | "PartiallyReceived" | "Completed" | "Cancelled"
          total_value: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ordered_at?: string | null
          po_number?: string | null
          status?: "Draft" | "Ordered" | "PartiallyReceived" | "Completed" | "Cancelled"
          total_value: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ordered_at?: string | null
          po_number?: string | null
          status?: "Draft" | "Ordered" | "PartiallyReceived" | "Completed" | "Cancelled"
          total_value?: number
        }
      }
      purchase_plan_items: {
        Row: {
          created_at: string
          fiscal_year: number
          id: number
          planned_quantity: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_year: number
          id?: number
          planned_quantity?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_year?: number
          id?: number
          planned_quantity?: number
          product_id?: string
          updated_at?: string
        }
      }
      requisition_items: {
        Row: {
          approved_quantity: number | null
          department_stock_on_submit: number | null
          id: number
          price_per_unit: number | null
          product_id: string
          quantity: number
          requisition_id: string
          returned_quantity: number | null
          status:
            | "Pending"
            | "Approved"
            | "Backordered"
            | "Loaned"
            | "Fulfilled"
            | "Rejected"
            | "LoanFulfilled"
            | null
        }
        Insert: {
          approved_quantity?: number | null
          department_stock_on_submit?: number | null
          id?: number
          price_per_unit?: number | null
          product_id: string
          quantity: number
          requisition_id: string
          returned_quantity?: number | null
          status?:
            | "Pending"
            | "Approved"
            | "Backordered"
            | "Loaned"
            | "Fulfilled"
            | "Rejected"
            | "LoanFulfilled"
            | null
        }
        Update: {
          approved_quantity?: number | null
          department_stock_on_submit?: number | null
          id?: number
          price_per_unit?: number | null
          product_id?: string
          quantity?: number
          requisition_id?: string
          returned_quantity?: number | null
          status?:
            | "Pending"
            | "Approved"
            | "Backordered"
            | "Loaned"
            | "Fulfilled"
            | "Rejected"
            | "LoanFulfilled"
            | null
        }
      }
      requisitions: {
        Row: {
          approver_name: string | null
          approver_position: string | null
          created_at: string
          department_id: string
          id: string
          name: string
          receiver_name: string | null
          requester_name: string | null
          requester_position: string | null
          requisition_number: string | null
          status: "Draft" | "Submitted" | "PartiallyApproved" | "Rejected" | "Ready" | "Completed" | "Picking"
          submitted_at: string | null
          type: "Normal" | "OffCycle" | "Urgent"
          urgent_reason: string | null
        }
        Insert: {
          approver_name?: string | null
          approver_position?: string | null
          created_at?: string
          department_id: string
          id?: string
          name: string
          receiver_name?: string | null
          requester_name?: string | null
          requester_position?: string | null
          requisition_number?: string | null
          status?: "Draft" | "Submitted" | "PartiallyApproved" | "Rejected" | "Ready" | "Completed" | "Picking"
          submitted_at?: string | null
          type?: "Normal" | "OffCycle" | "Urgent"
          urgent_reason?: string | null
        }
        Update: {
          approver_name?: string | null
          approver_position?: string | null
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          receiver_name?: string | null
          requester_name?: string | null
          requester_position?: string | null
          requisition_number?: string | null
          status?: "Draft" | "Submitted" | "PartiallyApproved" | "Rejected" | "Ready" | "Completed" | "Picking"
          submitted_at?: string | null
          type?: "Normal" | "OffCycle" | "Urgent"
          urgent_reason?: string | null
        }
      }
      survey_submissions: {
        Row: {
          department_id: string
          id: number
          quantities: Json | null
          submitted_at: string
        }
        Insert: {
          department_id: string
          id?: number
          quantities?: Json | null
          submitted_at?: string
        }
        Update: {
          department_id?: string
          id?: number
          quantities?: Json | null
          submitted_at?: string
        }
      }
      system_logs: {
        Row: {
          created_at: string
          event: string
          id: number
          level: "INFO" | "WARN" | "ERROR"
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          level?: "INFO" | "WARN" | "ERROR"
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          level?: "INFO" | "WARN" | "ERROR"
          message?: string
          user_id?: string | null
        }
      }
      system_settings: {
        Row: {
          key: string
          value: Json | null
        }
        Insert: {
          key: string
          value?: Json | null
        }
        Update: {
          key?: string
          value?: Json | null
        }
      }
      users: {
        Row: {
          department_id: string | null
          email: string | null
          id: string
          permissions: Json | null
          role: "Admin" | "Department" | "Warehouse"
          username: string
        }
        Insert: {
          department_id?: string | null
          email?: string | null
          id: string
          permissions?: Json | null
          role?: "Admin" | "Department" | "Warehouse"
          username: string
        }
        Update: {
          department_id?: string | null
          email?: string | null
          id?: string
          permissions?: Json | null
          role?: "Admin" | "Department" | "Warehouse"
          username?: string
        }
      }
    }
    Views: {
      department_product_usage: {
        Row: {
          department_id: string | null
          product_id: string | null
          total_approved_quantity: number | null
        }
      }
      global_product_usage: {
        Row: {
          product_id: string | null
          total_approved_globally: number | null
        }
      }
      product_transactions: {
        Row: {
          created_at: string | null
          department_name: string | null
          product_id: string | null
          quantity_in: number | null
          quantity_out: number | null
          reference_document: string | null
          transaction_date: string | null
          transaction_type: string | null
        }
      }
      product_usage_by_fiscal_year: {
        Row: {
          fiscal_year: number | null
          product_id: string | null
          total_quantity_used: number | null
        }
      }
    }
    Functions: {
      add_stock: {
        Args: {
          product_uuid: string
          amount: number
        }
        Returns: undefined
      }
      adjust_stock_quantity: {
        Args: {
          p_product_id: string
          p_adjustment_quantity: number
          p_notes: string
        }
        Returns: undefined
      }
      approve_grn_and_update_stock: {
        Args: {
          p_grn_id: string
        }
        Returns: undefined
      }
      cancel_grn_and_adjust_stock: {
        Args: {
          p_grn_id: string
        }
        Returns: undefined
      }
      cancel_p2p_posting: {
        Args: {
          p_post_id: string
        }
        Returns: undefined
      }
      cancel_requisition_and_restock: {
        Args: {
          p_requisition_id: string
        }
        Returns: undefined
      }
      create_and_complete_requisition: {
        Args: {
          p_department_id: string
          p_name: string
          p_items: Json
        }
        Returns: string
      }
      create_grn_with_items: {
        Args: {
          p_source_type: string
          p_po_id: string | null
          p_notes: string | null
          p_items: Json
        }
        Returns: Json
      }
      create_p2p_posting: {
        Args: {
          p_posting_department_id: string
          p_product_id: string
          p_quantity: number
          p_post_type: "OFFER" | "REQUEST"
          p_notes: string | null
        }
        Returns: undefined
      }
      create_requisition_by_admin: {
        Args: {
          p_department_id: string
          p_name: string
          p_items: Json
        }
        Returns: undefined
      }
      create_return_slip: {
        Args: {
          p_original_requisition_id: string
          p_original_department_id: string
          p_notes: string
          p_items: Json
        }
        Returns: undefined
      }
      deduct_stock: {
        Args: {
          product_uuid: string
          amount: number
        }
        Returns: undefined
      }
      delete_requisition_and_restock: {
        Args: {
          p_requisition_id: string
        }
        Returns: undefined
      }
      delete_user_by_id: {
        Args: {
          user_id_to_delete: string
        }
        Returns: undefined
      }
      fulfill_backorder_item: {
        Args: {
          p_backorder_item_id: number
        }
        Returns: undefined
      }
      fulfill_loans_by_admin: {
        Args: {
          p_department_id: string
          p_name: string
          p_items: Json
        }
        Returns: undefined
      }
      fulfill_p2p_posting: {
        Args: {
          p_post_id: string
          p_fulfilling_department_id: string
        }
        Returns: undefined
      }
      generate_requisition_number: {
        Args: {
          req_id: string
        }
        Returns: string
      }
      get_expiring_stock: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_pending_stock: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_products_for_department: {
        Args: {
          dept_id: string
        }
        Returns: Json
      }
      get_product_stock: {
        Args: {
          p_product_id: string
        }
        Returns: number
      }
      get_product_transactions: {
        Args: {
          p_product_id: string
          p_end_date: string
        }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_warehouse_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_event: {
        Args: {
          p_level: "INFO" | "WARN" | "ERROR"
          p_event: string
          p_message: string
        }
        Returns: undefined
      }
      process_intra_month_return: {
        Args: {
          p_requisition_id: string
          p_items: Json
          p_return_reason: string
        }
        Returns: undefined
      }
      process_requisition_approval: {
        Args: {
          p_requisition_id: string
          p_items: Json
          p_edit_reason: string | null
        }
        Returns: undefined
      }
      restore_database_from_json: {
        Args: {
          json_data: Json
        }
        Returns: undefined
      }
      update_completed_grn_item: {
        Args: {
          p_item_id: number
          p_new_quantity: number
          p_new_expiry_date: string | null
          p_new_lot_number: string | null
        }
        Returns: undefined
      }
      update_pending_grn_items: {
        Args: {
          p_grn_id: string
          p_items: Json
        }
        Returns: undefined
      }
      update_po_status_after_receiving: {
        Args: {
          po_id: string
        }
        Returns: undefined
      }
      update_requisition_status: {
        Args: {
          p_requisition_id: string
          p_new_status: string
        }
        Returns: undefined
      }
    }
  }
}

export type Views<ViewName extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][ViewName]["Row"]
export type Tables<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Row"]
export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Insert"]
export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Update"]
