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
      achievements: {
        Row: {
          code: string
          description: string
          icon: string
          name: string
          reward_coins: number
          sort_order: number
        }
        Insert: {
          code: string
          description: string
          icon: string
          name: string
          reward_coins?: number
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          name?: string
          reward_coins?: number
          sort_order?: number
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
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
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      coins_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          coins_awarded: number
          created_at: string
          streak_after: number
          user_id: string
        }
        Insert: {
          checkin_date: string
          coins_awarded: number
          created_at?: string
          streak_after: number
          user_id: string
        }
        Update: {
          checkin_date?: string
          coins_awarded?: number
          created_at?: string
          streak_after?: number
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      friend_messages: {
        Row: {
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          text?: string
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          coins_spent: number
          created_at: string
          gift_code: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          coins_spent: number
          created_at?: string
          gift_code: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          coins_spent?: number
          created_at?: string
          gift_code?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_code_fkey"
            columns: ["gift_code"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["code"]
          },
        ]
      }
      gifts: {
        Row: {
          code: string
          emoji: string
          name: string
          price_coins: number
          sort_order: number
        }
        Insert: {
          code: string
          emoji: string
          name: string
          price_coins: number
          sort_order?: number
        }
        Update: {
          code?: string
          emoji?: string
          name?: string
          price_coins?: number
          sort_order?: number
        }
        Relationships: []
      }
      match_queue: {
        Row: {
          filter_gender: string | null
          filter_region: string | null
          gender: string | null
          heartbeat_at: string
          interests: string[] | null
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
          interests?: string[] | null
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
          interests?: string[] | null
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
      profile_visitors: {
        Row: {
          id: string
          profile_id: string
          visited_at: string
          visitor_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          visited_at?: string
          visitor_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          visited_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_until: string | null
          bio: string | null
          coins: number
          country: string | null
          created_at: string
          display_name: string | null
          gender: string | null
          interests: string[]
          is_premium: boolean
          last_checkin: string | null
          plan: string
          premium_until: string | null
          referral_code: string | null
          referred_by: string | null
          region: string | null
          streak_days: number
          trust_score: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          coins?: number
          country?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          interests?: string[]
          is_premium?: boolean
          last_checkin?: string | null
          plan?: string
          premium_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          region?: string | null
          streak_days?: number
          trust_score?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          coins?: number
          country?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          interests?: string[]
          is_premium?: boolean
          last_checkin?: string | null
          plan?: string
          premium_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          region?: string | null
          streak_days?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_coins: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_coins?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_coins?: number
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
      room_messages: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          room_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          room_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          room_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string | null
          id: string
          is_official: boolean
          name: string
          slug: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_official?: boolean
          name: string
          slug: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_official?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      spin_history: {
        Row: {
          id: string
          prize_coins: number
          prize_label: string
          spun_at: string
          user_id: string
        }
        Insert: {
          id?: string
          prize_coins: number
          prize_label: string
          spun_at?: string
          user_id: string
        }
        Update: {
          id?: string
          prize_coins?: number
          prize_label?: string
          spun_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_code: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
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
      admin_adjust_coins: {
        Args: { p_delta: number; p_reason?: string; p_user: string }
        Returns: number
      }
      admin_approve_payment: {
        Args: { p_days: number; p_plan: string; p_submission: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { p_days: number; p_reason?: string; p_user: string }
        Returns: undefined
      }
      admin_daily_revenue: {
        Args: { p_days?: number }
        Returns: {
          day: string
          revenue: number
        }[]
      }
      admin_daily_signups: {
        Args: { p_days?: number }
        Returns: {
          day: string
          signups: number
        }[]
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_grant_plan: {
        Args: { p_days: number; p_plan: string; p_user: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          banned_until: string
          coins: number
          country: string
          created_at: string
          display_name: string
          is_premium: boolean
          plan: string
          premium_until: string
          region: string
          user_id: string
          username: string
        }[]
      }
      admin_payment_screenshot_url: {
        Args: { p_submission: string }
        Returns: string
      }
      admin_reject_payment: {
        Args: { p_note?: string; p_submission: string }
        Returns: undefined
      }
      admin_unban_user: { Args: { p_user: string }; Returns: undefined }
      award_achievement: {
        Args: { p_code: string; p_user: string }
        Returns: boolean
      }
      check_achievements: {
        Args: never
        Returns: {
          awarded: boolean
          code: string
        }[]
      }
      claim_daily_checkin: {
        Args: never
        Returns: {
          awarded: number
          balance: number
          streak: number
        }[]
      }
      cleanup_stale_queue: { Args: never; Returns: undefined }
      country_leaderboard: {
        Args: { p_country: string }
        Returns: {
          avatar_url: string
          coins: number
          display_name: string
          is_premium: boolean
          streak_days: number
          user_id: string
          username: string
        }[]
      }
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
      friend_conversations: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          last_at: string
          last_text: string
          peer_id: string
          unread: number
          username: string
        }[]
      }
      global_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          coins: number
          display_name: string
          is_premium: boolean
          streak_days: number
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_queue: { Args: { p_session_id: string }; Returns: undefined }
      is_session_banned: { Args: { p_session_id: string }; Returns: boolean }
      leave_queue: { Args: { p_session_id: string }; Returns: undefined }
      my_activity: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          delta: number
          id: string
          reason: string
        }[]
      }
      my_match_history: {
        Args: { p_limit?: number; p_offset?: number; p_session_id: string }
        Returns: {
          duration_sec: number
          ended_at: string
          id: string
          peer_session: string
          room_id: string
          started_at: string
        }[]
      }
      my_visitors: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
          visited_at: string
          visitor_id: string
        }[]
      }
      online_count: { Args: never; Returns: number }
      public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          coins: number
          created_at: string
          display_name: string
          interests: string[]
          is_premium: boolean
          region: string
          streak_days: number
          trust_score: number
          user_id: string
          username: string
        }[]
      }
      record_profile_visit: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      redeem_referral: { Args: { p_code: string }; Returns: Json }
      request_match: {
        Args: {
          p_filter_gender?: string
          p_filter_region?: string
          p_gender?: string
          p_interests?: string[]
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
      send_gift: {
        Args: { p_gift_code: string; p_message?: string; p_receiver: string }
        Returns: Json
      }
      spin_wheel: {
        Args: never
        Returns: {
          balance: number
          label: string
          prize: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
