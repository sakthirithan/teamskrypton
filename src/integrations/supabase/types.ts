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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_status: Database["public"]["Enums"]["task_status"] | null
          department: string
          email: string
          full_name: string
          id: string
          is_direct_access: boolean | null
          is_test: boolean | null
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_status?: Database["public"]["Enums"]["task_status"] | null
          department: string
          email: string
          full_name: string
          id?: string
          is_direct_access?: boolean | null
          is_test?: boolean | null
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_status?: Database["public"]["Enums"]["task_status"] | null
          department?: string
          email?: string
          full_name?: string
          id?: string
          is_direct_access?: boolean | null
          is_test?: boolean | null
          phone_number?: string | null
          updated_at?: string
          user_id?: string
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
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["krypton_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["krypton_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_captain_or_vice: { Args: { _user_id: string }; Returns: boolean }
      is_leadership: { Args: { _user_id: string }; Returns: boolean }
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
      registration_status: "pending" | "approved" | "rejected"
      task_status: "idle" | "working" | "completed" | "pending"
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
      registration_status: ["pending", "approved", "rejected"],
      task_status: ["idle", "working", "completed", "pending"],
    },
  },
} as const
