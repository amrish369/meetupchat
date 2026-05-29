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
      bans: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          session_id?: string
        }
        Relationships: []
      }
      match_queue: {
        Row: {
          filter_gender: string | null
          filter_region: string | null
          gender: string | null
          heartbeat_at: string
          is_premium: boolean
          joined_at: string
          region: string | null
          session_id: string
        }
        Insert: {
          filter_gender?: string | null
          filter_region?: string | null
          gender?: string | null
          heartbeat_at?: string
          is_premium?: boolean
          joined_at?: string
          region?: string | null
          session_id: string
        }
        Update: {
          filter_gender?: string | null
          filter_region?: string | null
          gender?: string | null
          heartbeat_at?: string
          is_premium?: boolean
          joined_at?: string
          region?: string | null
          session_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          caller: string
          created_at: string
          ended_at: string | null
          id: string
          room_id: string
          session_a: string
          session_b: string
        }
        Insert: {
          caller: string
          created_at?: string
          ended_at?: string | null
          id?: string
          room_id: string
          session_a: string
          session_b: string
        }
        Update: {
          caller?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          room_id?: string
          session_a?: string
          session_b?: string
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          amount_inr: number
          created_at: string
          id: string
          plan: string
          reviewed_at: string | null
          reviewer_note: string | null
          screenshot_path: string | null
          status: string
          upi_reference: string | null
          user_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          id?: string
          plan?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          screenshot_path?: string | null
          status?: string
          upi_reference?: string | null
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          id?: string
          plan?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          screenshot_path?: string | null
          status?: string
          upi_reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          gender: string | null
          is_premium: boolean
          premium_until: string | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          gender?: string | null
          is_premium?: boolean
          premium_until?: string | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          gender?: string | null
          is_premium?: boolean
          premium_until?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_session: string
          reporter_session: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_session: string
          reporter_session: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_session?: string
          reporter_session?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          referral_source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          referral_source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          referral_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_stale_queue: { Args: never; Returns: undefined }
      end_match: {
        Args: { p_room_id: string; p_session_id: string }
        Returns: undefined
      }
      find_active_match: {
        Args: { p_session_id: string }
        Returns: {
          is_caller: boolean
          match_id: string
          peer_session: string
          room_id: string
        }[]
      }
      heartbeat_queue: { Args: { p_session_id: string }; Returns: undefined }
      is_session_banned: { Args: { p_session_id: string }; Returns: boolean }
      leave_queue: { Args: { p_session_id: string }; Returns: undefined }
      online_count: { Args: never; Returns: number }
      request_match: {
        Args: {
          p_filter_gender?: string
          p_filter_region?: string
          p_gender?: string
          p_is_premium?: boolean
          p_region?: string
          p_session_id: string
        }
        Returns: {
          is_caller: boolean
          match_id: string
          peer_session: string
          room_id: string
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
