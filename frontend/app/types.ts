export type ReviewSource = "google" | "tripadvisor" | "thefork";
export type ReviewStatus = "pending" | "responded" | "ignored";
export type ResponseStatus = "draft" | "approved" | "published";

export interface Review {
  id: string;
  restaurant_id: string;
  source: ReviewSource;
  external_id?: string;
  author_name?: string;
  rating?: number;
  content?: string;
  review_date?: string;
  status: ReviewStatus;
  created_at?: string;
}

export interface ReviewResponse {
  id: string;
  review_id: string;
  generated_text: string;
  final_text?: string;
  status: ResponseStatus;
  published_at?: string;
  created_at?: string;
}

export interface GenerateResponseResult {
  review_id: string;
  generated_text: string;
  response_id: string;
}

// --- Posts (réseaux sociaux) ---

export type PostStatus = "draft" | "approved" | "published";

export interface PostCaptions {
  instagram: string;
  facebook: string;
}

export interface Post {
  id: string;
  restaurant_id: string;
  context: string;
  photo_url?: string;
  generated_text?: string;
  final_text?: string;
  captions?: PostCaptions;
  platforms: string[];
  status: PostStatus;
  scheduled_at?: string;
  published_at?: string;
  created_at?: string;
}

export interface GeneratePostResult {
  post_id: string;
  captions: PostCaptions;
  generated_text: string;
}

// --- Réservations ---

export type TableShape = "square" | "round" | "rectangle";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "no_show";
export type ReservationSource = "manual" | "phone" | "google" | "instagram" | "facebook" | "web";

export interface FloorPlan {
  id: string;
  restaurant_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  reservable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantTable {
  id: string;
  floor_plan_id: string;
  restaurant_id: string;
  name: string;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: TableShape;
  rotation?: number;
  snap?: boolean;
  movable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
  table_id?: string | null;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  guest_count: number;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM"
  duration: number;
  source: ReservationSource;
  status: ReservationStatus;
  notes?: string;
  grouped_table_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

// --- Stocks ---

export type StockCategory =
  | "soft" | "spiritueux" | "bieres" | "vins" | "frais"
  | "viandes" | "poissons" | "legumes" | "epicerie" | "laitiers";
export type AlertLevel = "ok" | "warning" | "critical";

export interface StockItem {
  id: string;
  restaurant_id: string;
  name: string;
  brand?: string;
  category: StockCategory;
  packaging?: string;
  unit: string;
  stock_current: number;
  stock_min: number;
  stock_reorder?: number;
  supplier_milliet_price?: number;
  supplier_metro_price?: number;
  auto_thresholds?: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ZReportSaleItem {
  item_name: string;
  quantity_sold: number;
  matched_stock_item_id?: string;
}

export interface ZReportScanResult {
  sale_date?: string;
  items: ZReportSaleItem[];
  raw_text: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  stock_item_id?: string;
  item_name: string;
  quantity: number;
  unit_price?: number;
}

export interface Delivery {
  id: string;
  restaurant_id: string;
  supplier_name?: string;
  delivery_date: string;
  notes?: string;
  items: DeliveryItem[];
  created_at?: string;
}

export interface ScannedDeliveryItem {
  item_name: string;
  quantity: number;
  unit_price?: number;
  matched_stock_item_id?: string;
}

export interface DeliveryScanResult {
  supplier_name?: string;
  delivery_date?: string;
  items: ScannedDeliveryItem[];
  raw_text: string;
}

export interface OrderItem {
  stock_item_id: string;
  name: string;
  brand?: string;
  category: StockCategory;
  unit: string;
  stock_current: number;
  stock_min: number;
  stock_reorder: number;
  alert_level: "warning" | "critical";
  suggested_quantity?: number;
  supplier_milliet_price?: number;
  supplier_metro_price?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Publication Meta ---

export interface PublishResult {
  post_id: string;
  mode: "immediate" | "scheduled";
  scheduled_at?: string;
  results: {
    instagram?: { status: string; id?: string; detail?: string };
    facebook?: { status: string; id?: string; detail?: string };
  };
}

export interface PublishAlert {
  day_name: string;
  date: string;
  hours_until: number;
}

export interface ReservationCreate {
  restaurant_id: string;
  table_id?: string | null;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  guest_count: number;
  date: string;
  time: string;
  duration?: number;
  source?: ReservationSource;
  status?: ReservationStatus;
  notes?: string;
  grouped_table_ids?: string[];
}
