export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_points: {
        Row: {
          awarded_by: string
          created_at: string
          id: string
          points: number
          reason: string | null
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          awarded_by: string
          created_at?: string
          id?: string
          points?: number
          reason?: string | null
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          awarded_by?: string
          created_at?: string
          id?: string
          points?: number
          reason?: string | null
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_votes: {
        Row: {
          approval_id: string
          id: string
          is_test: boolean | null
          vote_type: string
          voted_at: string
          voter_id: string
        }
        Insert: {
          approval_id: string
          id?: string
          is_test?: boolean | null
          vote_type: string
          voted_at?: string
          voter_id: string
        }
        Update: {
          approval_id?: string
          id?: string
          is_test?: boolean | null
          vote_type?: string
          voted_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_votes_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          created_at: string
          expires_at: string | null
          id: string
          initiated_by: string | null
          is_test: boolean | null
          reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          target_task_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          created_at?: string
          expires_at?: string | null
          id?: string
          initiated_by?: string | null
          is_test?: boolean | null
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          target_task_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_type?: Database["public"]["Enums"]["approval_type"]
          created_at?: string
          expires_at?: string | null
          id?: string
          initiated_by?: string | null
          is_test?: boolean | null
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          target_task_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_target_task_id_fkey"
            columns: ["target_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_assignments: {
        Row: {
          assigned_at: string
          challenge_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          challenge_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          challenge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_assignments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "skill_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_study_items: {
        Row: {
          category: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          is_completed: boolean
          is_pinned: boolean
          item_type: string
          notes: string | null
          session_id: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          is_completed?: boolean
          is_pinned?: boolean
          item_type?: string
          notes?: string | null
          session_id: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          is_completed?: boolean
          is_pinned?: boolean
          item_type?: string
          notes?: string | null
          session_id?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_study_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          message: string | null
          provider_message_id: string | null
          recipient_email: string
          recipient_id: string | null
          sender_id: string
          status: string
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          provider_message_id?: string | null
          recipient_email: string
          recipient_id?: string | null
          sender_id: string
          status?: string
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          recipient_id?: string | null
          sender_id?: string
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      global_todo_completions: {
        Row: {
          completed_at: string
          id: string
          todo_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          todo_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          todo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_todo_completions_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "global_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      global_todos: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_global: boolean
          mode: string
          parent_id: string | null
          session_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_global?: boolean
          mode?: string
          parent_id?: string | null
          session_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_global?: boolean
          mode?: string
          parent_id?: string | null
          session_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_todos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "global_todos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_todos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheet_cache: {
        Row: {
          cell_value: string | null
          column_name: string
          config_id: string
          fetched_at: string
          id: string
          row_index: number | null
          user_id: string | null
        }
        Insert: {
          cell_value?: string | null
          column_name: string
          config_id: string
          fetched_at?: string
          id?: string
          row_index?: number | null
          user_id?: string | null
        }
        Update: {
          cell_value?: string | null
          column_name?: string
          config_id?: string
          fetched_at?: string
          id?: string
          row_index?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_sheet_cache_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheet_configs: {
        Row: {
          configured_by: string
          created_at: string
          enabled: boolean
          fixed_row_number: number | null
          id: string
          last_synced_at: string | null
          refresh_interval: number
          row_logic_type: string
          sheet_id: string
          sheet_name: string
          sheet_url: string
          tracked_columns: string[]
          updated_at: string
          username_column: string | null
        }
        Insert: {
          configured_by: string
          created_at?: string
          enabled?: boolean
          fixed_row_number?: number | null
          id?: string
          last_synced_at?: string | null
          refresh_interval?: number
          row_logic_type?: string
          sheet_id: string
          sheet_name?: string
          sheet_url: string
          tracked_columns?: string[]
          updated_at?: string
          username_column?: string | null
        }
        Update: {
          configured_by?: string
          created_at?: string
          enabled?: boolean
          fixed_row_number?: number | null
          id?: string
          last_synced_at?: string | null
          refresh_interval?: number
          row_logic_type?: string
          sheet_id?: string
          sheet_name?: string
          sheet_url?: string
          tracked_columns?: string[]
          updated_at?: string
          username_column?: string | null
        }
        Relationships: []
      }
      grouping_note_replies: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_test: boolean | null
          note_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_test?: boolean | null
          note_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_test?: boolean | null
          note_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouping_note_replies_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "grouping_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      grouping_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_test: boolean | null
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          is_test?: boolean | null
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_test?: boolean | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouping_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      grouping_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_id: string
          sender_id: string
          session_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id: string
          sender_id?: string
          session_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id?: string
          sender_id?: string
          session_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouping_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      grouping_sessions: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          is_test: boolean | null
          name: string
          session_number: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          is_test?: boolean | null
          name: string
          session_number: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          is_test?: boolean | null
          name?: string
          session_number?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      grouping_targets: {
        Row: {
          achieved_points: number
          balance_points: number
          created_at: string
          created_by: string
          editable: boolean
          id: string
          is_test: boolean | null
          notes: string | null
          session_id: string
          target_points: number
          target_scope: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          achieved_points?: number
          balance_points?: number
          created_at?: string
          created_by: string
          editable?: boolean
          id?: string
          is_test?: boolean | null
          notes?: string | null
          session_id: string
          target_points?: number
          target_scope: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          achieved_points?: number
          balance_points?: number
          created_at?: string
          created_by?: string
          editable?: boolean
          id?: string
          is_test?: boolean | null
          notes?: string | null
          session_id?: string
          target_points?: number
          target_scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grouping_targets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          guest_user_id: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          guest_user_id: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          guest_user_id?: string
          id?: string
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completion_date: string
          created_at: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completion_date?: string
          created_at?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completion_date?: string
          created_at?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_revoke_requests: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_revoke_requests_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_global: boolean
          session_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_global?: boolean
          session_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_global?: boolean
          session_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_access_log: {
        Row: {
          action: string
          created_at: string
          id: string
          material_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          material_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          material_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_access_log_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_access_log_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_materials: {
        Row: {
          created_at: string
          description: string | null
          discount_pct_30d: number
          discount_pct_7d: number
          domain: string | null
          featured_until: string | null
          id: string
          keywords: string[]
          material_type: Database["public"]["Enums"]["marketplace_material_type"]
          max_days: number
          min_days: number
          price_per_day: number
          purchase_count: number
          rating_count: number
          rating_sum: number
          search_vec: unknown
          source_url: string
          status: Database["public"]["Enums"]["marketplace_material_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploader_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct_30d?: number
          discount_pct_7d?: number
          domain?: string | null
          featured_until?: string | null
          id?: string
          keywords?: string[]
          material_type: Database["public"]["Enums"]["marketplace_material_type"]
          max_days?: number
          min_days?: number
          price_per_day?: number
          purchase_count?: number
          rating_count?: number
          rating_sum?: number
          search_vec?: unknown
          source_url: string
          status?: Database["public"]["Enums"]["marketplace_material_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploader_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct_30d?: number
          discount_pct_7d?: number
          domain?: string | null
          featured_until?: string | null
          id?: string
          keywords?: string[]
          material_type?: Database["public"]["Enums"]["marketplace_material_type"]
          max_days?: number
          min_days?: number
          price_per_day?: number
          purchase_count?: number
          rating_count?: number
          rating_sum?: number
          search_vec?: unknown
          source_url?: string
          status?: Database["public"]["Enums"]["marketplace_material_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploader_id?: string
          view_count?: number
        }
        Relationships: []
      }
      marketplace_purchases: {
        Row: {
          buyer_id: string
          created_at: string
          days_purchased: number
          expires_at: string
          gp_paid: number
          id: string
          material_id: string
          status: Database["public"]["Enums"]["marketplace_purchase_status"]
          uploader_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          days_purchased: number
          expires_at: string
          gp_paid: number
          id?: string
          material_id: string
          status?: Database["public"]["Enums"]["marketplace_purchase_status"]
          uploader_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          days_purchased?: number
          expires_at?: string
          gp_paid?: number
          id?: string
          material_id?: string
          status?: Database["public"]["Enums"]["marketplace_purchase_status"]
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_purchases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_purchases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          material_id: string
          rating: number
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          material_id: string
          rating: number
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          material_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_treasury: {
        Row: {
          balance: number
          id: number
          total_collected: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: number
          total_collected?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: number
          total_collected?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_wishlist: {
        Row: {
          created_at: string
          id: string
          material_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_wishlist_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_wishlist_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "marketplace_materials_public"
            referencedColumns: ["id"]
          },
        ]
      }
      member_skills: {
        Row: {
          assigned_by: string
          created_at: string
          custom_domain: string | null
          domain: Database["public"]["Enums"]["skill_domain"]
          id: string
          skill_name: string
          skill_type: Database["public"]["Enums"]["skill_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          custom_domain?: string | null
          domain?: Database["public"]["Enums"]["skill_domain"]
          id?: string
          skill_name: string
          skill_type: Database["public"]["Enums"]["skill_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          custom_domain?: string | null
          domain?: Database["public"]["Enums"]["skill_domain"]
          id?: string
          skill_name?: string
          skill_type?: Database["public"]["Enums"]["skill_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      points_history: {
        Row: {
          created_at: string
          id: string
          operation_type: string
          performed_by: string
          points_after: number
          points_before: number
          points_change: number
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation_type: string
          performed_by: string
          points_after: number
          points_before: number
          points_change: number
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          operation_type?: string
          performed_by?: string
          points_after?: number
          points_before?: number
          points_change?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by_tl: string | null
          current_status: Database["public"]["Enums"]["task_status"] | null
          department: string
          email: string
          expires_at: string | null
          full_name: string
          id: string
          is_direct_access: boolean | null
          is_test: boolean | null
          phone_number: string | null
          register_number: string | null
          simulated_role: Database["public"]["Enums"]["krypton_role"] | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["test_user_type"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by_tl?: string | null
          current_status?: Database["public"]["Enums"]["task_status"] | null
          department: string
          email: string
          expires_at?: string | null
          full_name: string
          id?: string
          is_direct_access?: boolean | null
          is_test?: boolean | null
          phone_number?: string | null
          register_number?: string | null
          simulated_role?: Database["public"]["Enums"]["krypton_role"] | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["test_user_type"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by_tl?: string | null
          current_status?: Database["public"]["Enums"]["task_status"] | null
          department?: string
          email?: string
          expires_at?: string | null
          full_name?: string
          id?: string
          is_direct_access?: boolean | null
          is_test?: boolean | null
          phone_number?: string | null
          register_number?: string | null
          simulated_role?: Database["public"]["Enums"]["krypton_role"] | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["test_user_type"]
        }
        Relationships: []
      }
      project_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          project_id: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          description: string | null
          doc_type: string
          id: string
          project_id: string
          title: string
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          doc_type?: string
          id?: string
          project_id: string
          title: string
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          doc_type?: string
          id?: string
          project_id?: string
          title?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: string
          role_label: string | null
          share_percentage: number
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: string
          role_label?: string | null
          share_percentage?: number
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: string
          role_label?: string | null
          share_percentage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          project_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          project_id: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          project_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          milestone_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          status: Database["public"]["Enums"]["project_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          status?: Database["public"]["Enums"]["project_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          status?: Database["public"]["Enums"]["project_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          is_test: boolean | null
          name: string
          owner_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_test?: boolean | null
          name: string
          owner_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_test?: boolean | null
          name?: string
          owner_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ps_daily_entries: {
        Row: {
          attempt_count: number
          completed_at: string | null
          completed_by: string | null
          created_at: string
          entered_by: string
          entry_date: string
          entry_time: string | null
          id: string
          is_test: boolean | null
          reward_points: number
          s_no: number
          session_id: string
          skill_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          entered_by: string
          entry_date: string
          entry_time?: string | null
          id?: string
          is_test?: boolean | null
          reward_points?: number
          s_no: number
          session_id: string
          skill_name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          entered_by?: string
          entry_date?: string
          entry_time?: string | null
          id?: string
          is_test?: boolean | null
          reward_points?: number
          s_no?: number
          session_id?: string
          skill_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_daily_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
          password_hash: string
          requested_role: Database["public"]["Enums"]["krypton_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department: string
          email: string
          full_name: string
          id?: string
          password_hash: string
          requested_role: Database["public"]["Enums"]["krypton_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          email?: string
          full_name?: string
          id?: string
          password_hash?: string
          requested_role?: Database["public"]["Enums"]["krypton_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      report_downloads: {
        Row: {
          downloaded_at: string
          downloaded_by: string
          id: string
          report_date: string
        }
        Insert: {
          downloaded_at?: string
          downloaded_by: string
          id?: string
          report_date: string
        }
        Update: {
          downloaded_at?: string
          downloaded_by?: string
          id?: string
          report_date?: string
        }
        Relationships: []
      }
      skill_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          session_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          session_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_activity_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_challenge_completions: {
        Row: {
          approved_by: string | null
          challenge_id: string
          completed_at: string
          id: string
          proof_text: string | null
          status: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          challenge_id: string
          completed_at?: string
          id?: string
          proof_text?: string | null
          status?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          challenge_id?: string
          completed_at?: string
          id?: string
          proof_text?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "skill_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_challenges: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          difficulty: string
          expires_at: string | null
          id: string
          image_url: string | null
          session_id: string
          title: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          difficulty?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          session_id: string
          title: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          session_id?: string
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_challenges_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_dev_links: {
        Row: {
          created_at: string
          id: string
          link_type: string
          skill_track_id: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: string
          skill_track_id: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          skill_track_id?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_dev_links_skill_track_id_fkey"
            columns: ["skill_track_id"]
            isOneToOne: false
            referencedRelation: "skill_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_endorsements: {
        Row: {
          comment: string | null
          created_at: string
          endorsed_by: string
          endorsed_user_id: string
          id: string
          member_skill_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          endorsed_by: string
          endorsed_user_id: string
          id?: string
          member_skill_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          endorsed_by?: string
          endorsed_user_id?: string
          id?: string
          member_skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_member_skill_id_fkey"
            columns: ["member_skill_id"]
            isOneToOne: false
            referencedRelation: "member_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_flowchart_blocks: {
        Row: {
          block_shape: string
          created_at: string
          description: string | null
          id: string
          resource_url: string | null
          skill_track_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          block_shape?: string
          created_at?: string
          description?: string | null
          id?: string
          resource_url?: string | null
          skill_track_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          block_shape?: string
          created_at?: string
          description?: string | null
          id?: string
          resource_url?: string | null
          skill_track_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_flowchart_blocks_skill_track_id_fkey"
            columns: ["skill_track_id"]
            isOneToOne: false
            referencedRelation: "skill_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_levels: {
        Row: {
          created_at: string
          id: string
          level: number
          session_id: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          session_id: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          session_id?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_levels_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_reflections: {
        Row: {
          challenges: string | null
          content: string
          created_at: string
          id: string
          next_steps: string | null
          skill_track_id: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          challenges?: string | null
          content: string
          created_at?: string
          id?: string
          next_steps?: string | null
          skill_track_id: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          challenges?: string | null
          content?: string
          created_at?: string
          id?: string
          next_steps?: string | null
          skill_track_id?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_reflections_skill_track_id_fkey"
            columns: ["skill_track_id"]
            isOneToOne: false
            referencedRelation: "skill_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_active_date: string | null
          longest_streak: number
          session_id: string
          total_active_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          session_id: string
          total_active_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          session_id?: string
          total_active_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_streaks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_suggestions: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      skill_tracks: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          is_sequential: boolean
          session_id: string
          skill_name: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          is_sequential?: boolean
          session_id: string
          skill_name: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          is_sequential?: boolean
          session_id?: string
          skill_name?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_xp_log: {
        Row: {
          activity_type: string
          completion_id: string | null
          created_at: string
          description: string | null
          id: string
          session_id: string
          user_id: string
          xp_amount: number
        }
        Insert: {
          activity_type: string
          completion_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          session_id: string
          user_id: string
          xp_amount: number
        }
        Update: {
          activity_type?: string
          completion_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          session_id?: string
          user_id?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_xp_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "grouping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_alerts: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          has_response: boolean | null
          id: string
          is_read: boolean
          is_test: boolean | null
          message: string
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          has_response?: boolean | null
          id?: string
          is_read?: boolean
          is_test?: boolean | null
          message: string
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          has_response?: boolean | null
          id?: string
          is_read?: boolean
          is_test?: boolean | null
          message?: string
          task_id?: string
        }
        Relationships: []
      }
      task_documents: {
        Row: {
          description: string | null
          github_url: string
          id: string
          is_test: boolean | null
          task_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          description?: string | null
          github_url: string
          id?: string
          is_test?: boolean | null
          task_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          description?: string | null
          github_url?: string
          id?: string
          is_test?: boolean | null
          task_id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_documents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          accepted_at: string | null
          assigned_by: string
          assigned_to: string | null
          assigner_name: string | null
          assigner_role: string | null
          completed_at: string | null
          created_at: string
          deadline: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_test: boolean | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_by: string
          assigned_to?: string | null
          assigner_name?: string | null
          assigner_role?: string | null
          completed_at?: string | null
          created_at?: string
          deadline: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_test?: boolean | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_by?: string
          assigned_to?: string | null
          assigner_name?: string | null
          assigner_role?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_test?: boolean | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_login_activity: {
        Row: {
          created_at: string
          id: string
          login_date: string
          login_time: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_date?: string
          login_time: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_date?: string
          login_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_login_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_points: {
        Row: {
          created_at: string
          id: string
          last_updated_at: string
          last_updated_by: string
          notes: string | null
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated_at?: string
          last_updated_by: string
          notes?: string | null
          points?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_updated_at?: string
          last_updated_by?: string
          notes?: string | null
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["krypton_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["krypton_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["krypton_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          is_test: boolean | null
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          is_test?: boolean | null
          task_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          is_test?: boolean | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      marketplace_materials_public: {
        Row: {
          created_at: string | null
          description: string | null
          discount_pct_30d: number | null
          discount_pct_7d: number | null
          domain: string | null
          featured_until: string | null
          id: string | null
          keywords: string[] | null
          material_type:
            | Database["public"]["Enums"]["marketplace_material_type"]
            | null
          max_days: number | null
          min_days: number | null
          price_per_day: number | null
          purchase_count: number | null
          rating_count: number | null
          rating_sum: number | null
          status:
            | Database["public"]["Enums"]["marketplace_material_status"]
            | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          uploader_id: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_pct_30d?: number | null
          discount_pct_7d?: number | null
          domain?: string | null
          featured_until?: string | null
          id?: string | null
          keywords?: string[] | null
          material_type?:
            | Database["public"]["Enums"]["marketplace_material_type"]
            | null
          max_days?: number | null
          min_days?: number | null
          price_per_day?: number | null
          purchase_count?: number | null
          rating_count?: number | null
          rating_sum?: number | null
          status?:
            | Database["public"]["Enums"]["marketplace_material_status"]
            | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          uploader_id?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_pct_30d?: number | null
          discount_pct_7d?: number | null
          domain?: string | null
          featured_until?: string | null
          id?: string | null
          keywords?: string[] | null
          material_type?:
            | Database["public"]["Enums"]["marketplace_material_type"]
            | null
          max_days?: number | null
          min_days?: number | null
          price_per_day?: number | null
          purchase_count?: number | null
          rating_count?: number | null
          rating_sum?: number | null
          status?:
            | Database["public"]["Enums"]["marketplace_material_status"]
            | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          uploader_id?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_study_items: { Args: never; Returns: undefined }
      cleanup_old_login_activity: { Args: never; Returns: undefined }
      get_simulated_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["krypton_role"]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["krypton_role"]
      }
      has_active_rental: {
        Args: { _material_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["krypton_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_captain_or_vice: { Args: { _user_id: string }; Returns: boolean }
      is_guest_expired: { Args: { _user_id: string }; Returns: boolean }
      is_guest_user: { Args: { _user_id: string }; Returns: boolean }
      is_lead_for_user: {
        Args: { _lead_user_id: string; _target_user_id: string }
        Returns: boolean
      }
      is_leadership: { Args: { _user_id: string }; Returns: boolean }
      is_primary_test_user: { Args: { _user_id: string }; Returns: boolean }
      is_project_lead: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member_only: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      approval_type:
        | "registration"
        | "deletion_request"
        | "deletion_vote"
        | "task_reason"
        | "report_download"
        | "task_deletion_reason"
      krypton_role:
        | "team_captain"
        | "vice_captain"
        | "strategist"
        | "team_manager"
        | "team_member"
      marketplace_material_status: "active" | "paused" | "removed"
      marketplace_material_type:
        | "pdf"
        | "drive"
        | "youtube"
        | "github"
        | "url"
        | "image"
      marketplace_purchase_status: "active" | "expired" | "refunded"
      milestone_status: "not_started" | "in_progress" | "completed" | "overdue"
      priority_level: "low" | "medium" | "high" | "critical"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "archived"
      project_task_status: "todo" | "in_progress" | "review" | "done"
      registration_status: "pending" | "approved" | "rejected"
      skill_domain:
        | "ai_data"
        | "software_dev"
        | "research"
        | "ui_ux"
        | "general"
      skill_type: "primary" | "secondary" | "specialization"
      task_status: "idle" | "working" | "completed" | "pending"
      test_user_type: "real" | "primary_test" | "secondary_test"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected"],
      approval_type: [
        "registration",
        "deletion_request",
        "deletion_vote",
        "task_reason",
        "report_download",
        "task_deletion_reason",
      ],
      krypton_role: [
        "team_captain",
        "vice_captain",
        "strategist",
        "team_manager",
        "team_member",
      ],
      marketplace_material_status: ["active", "paused", "removed"],
      marketplace_material_type: [
        "pdf",
        "drive",
        "youtube",
        "github",
        "url",
        "image",
      ],
      marketplace_purchase_status: ["active", "expired", "refunded"],
      milestone_status: ["not_started", "in_progress", "completed", "overdue"],
      priority_level: ["low", "medium", "high", "critical"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "archived",
      ],
      project_task_status: ["todo", "in_progress", "review", "done"],
      registration_status: ["pending", "approved", "rejected"],
      skill_domain: ["ai_data", "software_dev", "research", "ui_ux", "general"],
      skill_type: ["primary", "secondary", "specialization"],
      task_status: ["idle", "working", "completed", "pending"],
      test_user_type: ["real", "primary_test", "secondary_test"],
    },
  },
} as const
