export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      claims: {
        Row: {
          claimer_id: string;
          created_at: string;
          id: string;
          item_id: string;
          quantity: number;
          share_name_with_recipient: boolean;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          claimer_id?: string;
          created_at?: string;
          id?: string;
          item_id: string;
          quantity?: number;
          share_name_with_recipient?: boolean;
          status: string;
          updated_at?: string;
        };
        Update: {
          claimer_id?: string;
          created_at?: string;
          id?: string;
          item_id?: string;
          quantity?: number;
          share_name_with_recipient?: boolean;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claims_claimer_id_fkey";
            columns: ["claimer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      item_claim_totals: {
        Row: {
          item_id: string;
          list_id: string;
          purchased_qty: number;
          reserved_qty: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          item_id: string;
          list_id: string;
          purchased_qty?: number;
          reserved_qty?: number;
          updated_at?: string;
        };
        Update: {
          item_id?: string;
          list_id?: string;
          purchased_qty?: number;
          reserved_qty?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_claim_totals_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_claim_totals_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          image_url: string | null;
          list_id: string;
          notes: string | null;
          price_cents: number | null;
          priority: number;
          quantity_wanted: number;
          removed_at: string | null;
          sort_order: number | null;
          title: string;
          updated_at: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          image_url?: string | null;
          list_id: string;
          notes?: string | null;
          price_cents?: number | null;
          priority?: number;
          quantity_wanted?: number;
          removed_at?: string | null;
          sort_order?: number | null;
          title: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          image_url?: string | null;
          list_id?: string;
          notes?: string | null;
          price_cents?: number | null;
          priority?: number;
          quantity_wanted?: number;
          removed_at?: string | null;
          sort_order?: number | null;
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      list_members: {
        Row: {
          joined_at: string;
          list_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          joined_at?: string;
          list_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          list_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          archived_at: string | null;
          created_at: string;
          description: string | null;
          event_date: string | null;
          event_date_set_at: string | null;
          id: string;
          invite_token: string;
          owner_id: string;
          recipient_is_owner: boolean;
          recipient_name: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          event_date?: string | null;
          event_date_set_at?: string | null;
          id?: string;
          invite_token?: string;
          owner_id?: string;
          recipient_is_owner?: boolean;
          recipient_name?: string | null;
          title: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          event_date?: string | null;
          event_date_set_at?: string | null;
          id?: string;
          invite_token?: string;
          owner_id?: string;
          recipient_is_owner?: boolean;
          recipient_name?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_gift_reveal: {
        Args: { p_list_id: string };
        Returns: {
          currency: string;
          givers: string[];
          image_url: string;
          item_id: string;
          price_cents: number;
          purchased_qty: number;
          title: string;
          url: string;
        }[];
      };
      join_list: { Args: { p_invite_token: string }; Returns: string };
      my_shopping: {
        Args: Record<PropertyKey, never>;
        Returns: {
          claim_id: string;
          claimed_at: string;
          currency: string;
          event_date: string;
          image_url: string;
          item_edited: boolean;
          item_id: string;
          item_removed: boolean;
          item_title: string;
          list_id: string;
          list_title: string;
          notes: string;
          price_cents: number;
          quantity: number;
          quantity_wanted: number;
          recipient_name: string;
          share_name_with_recipient: boolean;
          status: string;
          url: string;
        }[];
      };
      rotate_invite_token: { Args: { p_list_id: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
