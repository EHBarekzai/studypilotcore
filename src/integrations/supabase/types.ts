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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_activity: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          score: number | null
          subject_id: string | null
          topic: string | null
          total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          score?: number | null
          subject_id?: string | null
          topic?: string | null
          total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          score?: number | null
          subject_id?: string | null
          topic?: string | null
          total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_activity_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          category: string
          created_at: string
          details: Json
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          category?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          category?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          created_at: string
          difficulty: string
          exam_date: string
          id: string
          location: string | null
          notes: string | null
          start_time: string | null
          subject_id: string | null
          title: string
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          exam_date: string
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          subject_id?: string | null
          title: string
          topics?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          exam_date?: string
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          subject_id?: string | null
          title?: string
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          payload: Json
          payment_id: string | null
          processed: boolean
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          provider_event_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          activated_at: string | null
          amount_received: string | null
          chain: string | null
          checkout_url: string | null
          coin: string | null
          created_at: string
          environment: string
          error: string | null
          fiat_amount: number
          fiat_currency: string
          id: string
          order_id: string
          paid_at: string | null
          plan_id: string
          provider: string
          provider_payment_id: string | null
          status: string
          tx_hash: string | null
          updated_at: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          amount_received?: string | null
          chain?: string | null
          checkout_url?: string | null
          coin?: string | null
          created_at?: string
          environment?: string
          error?: string | null
          fiat_amount: number
          fiat_currency?: string
          id?: string
          order_id: string
          paid_at?: string | null
          plan_id: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          amount_received?: string | null
          chain?: string | null
          checkout_url?: string | null
          coin?: string | null
          created_at?: string
          environment?: string
          error?: string | null
          fiat_amount?: number
          fiat_currency?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          plan_id?: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_summaries: {
        Row: {
          created_at: string
          id: string
          result: Json
          scope: string | null
          source_name: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          result?: Json
          scope?: string | null
          source_name?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          result?: Json
          scope?: string | null
          source_name?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      planned_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number
          exam_id: string | null
          focus: string | null
          id: string
          session_date: string
          source: string
          start_time: string | null
          status: string
          subject_id: string | null
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          exam_id?: string | null
          focus?: string | null
          id?: string
          session_date: string
          source?: string
          start_time?: string | null
          status?: string
          subject_id?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          exam_id?: string | null
          focus?: string | null
          id?: string
          session_date?: string
          source?: string
          start_time?: string | null
          status?: string
          subject_id?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_sessions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          id: string
          limits: Json
          name: string
          period_days: number
          price_cents: number
          purchasable: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id: string
          limits?: Json
          name: string
          period_days?: number
          price_cents?: number
          purchasable?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          limits?: Json
          name?: string
          period_days?: number
          price_cents?: number
          purchasable?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          daily_study_minutes: number
          education_level: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          preferred_days: string[]
          preferred_end_hour: number
          preferred_start_hour: number
          study_goals: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          daily_study_minutes?: number
          education_level?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          preferred_days?: string[]
          preferred_end_hour?: number
          preferred_start_hour?: number
          study_goals?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          account_status?: string
          created_at?: string
          daily_study_minutes?: number
          education_level?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          preferred_days?: string[]
          preferred_end_hour?: number
          preferred_start_hour?: number
          study_goals?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          name: string
          size_bytes?: number
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          blocks: Json
          created_at: string
          end_date: string | null
          id: string
          start_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_minutes: number
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          subject_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          subject_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          difficulty: string
          icon: string
          id: string
          name: string
          priority: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          difficulty?: string
          icon?: string
          id?: string
          name: string
          priority?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          difficulty?: string
          icon?: string
          id?: string
          name?: string
          priority?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          id: string
          last_payment_id: string | null
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end: string
          id?: string
          last_payment_id?: string | null
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          id?: string
          last_payment_id?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          difficulty: string
          due_date: string | null
          estimated_minutes: number
          id: string
          notes: string | null
          priority: string
          status: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          due_date?: string | null
          estimated_minutes?: number
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          due_date?: string | null
          estimated_minutes?: number
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          metric: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          metric: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          metric?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_request_notes: {
        Row: {
          author_email: string | null
          created_at: string
          id: string
          note: string
          request_id: string
        }
        Insert: {
          author_email?: string | null
          created_at?: string
          id?: string
          note: string
          request_id: string
        }
        Update: {
          author_email?: string | null
          created_at?: string
          id?: string
          note?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "user_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_requests: {
        Row: {
          admin_reply: string | null
          attachment_name: string | null
          attachment_path: string | null
          category: string
          created_at: string
          id: string
          message: string
          replied_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          replied_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          replied_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      billing_cycle_start: { Args: { _user_id: string }; Returns: string }
      consume_pdf_summary: { Args: { _size_bytes: number }; Returns: Json }
      consume_usage: {
        Args: { _amount?: number; _metric: string }
        Returns: Json
      }
      effective_plan: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pdf_summary_status: { Args: never; Returns: Json }
      refund_pdf_summary: {
        Args: { _period: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
