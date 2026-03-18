import {
  GenerateResponseResult,
  GeneratePostResult,
  Post,
  Review,
  FloorPlan,
  RestaurantTable,
  Reservation,
  ReservationCreate,
  StockItem,
  Delivery,
  DeliveryScanResult,
  OrderItem,
  ChatMessage,
  ZReportScanResult,
  PublishResult,
  PublishAlert,
} from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchReviews(
  restaurantId: string,
  status: string
): Promise<Review[]> {
  const res = await fetch(
    `${API_URL}/reviews/?restaurant_id=${restaurantId}&status=${status}`
  );
  if (!res.ok) throw new Error("Erreur lors du chargement des avis");
  return res.json();
}

export async function generateResponse(
  reviewId: string,
  restaurantId: string
): Promise<GenerateResponseResult> {
  const res = await fetch(`${API_URL}/reviews/${reviewId}/generate-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ review_id: reviewId, restaurant_id: restaurantId }),
  });
  if (!res.ok) throw new Error("Erreur lors de la génération");
  return res.json();
}

export async function approveResponse(
  reviewId: string,
  responseId: string,
  finalText?: string
): Promise<void> {
  const params = new URLSearchParams();
  if (finalText) params.set("final_text", finalText);

  const res = await fetch(
    `${API_URL}/reviews/${reviewId}/response/${responseId}/approve?${params}`,
    { method: "PATCH" }
  );
  if (!res.ok) throw new Error("Erreur lors de l'approbation");
}

// --- Posts (réseaux sociaux) ---

export async function fetchPosts(
  restaurantId: string,
  status: string = "draft"
): Promise<Post[]> {
  const res = await fetch(
    `${API_URL}/posts/?restaurant_id=${restaurantId}&status=${status}`
  );
  if (!res.ok) throw new Error("Erreur lors du chargement des posts");
  return res.json();
}

export async function generatePost(
  restaurantId: string,
  context: string,
  platforms: string[],
  photoBase64?: string,
  photoMediaType?: string
): Promise<GeneratePostResult> {
  const res = await fetch(`${API_URL}/posts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      context,
      platforms,
      photo_base64: photoBase64 ?? null,
      photo_media_type: photoMediaType ?? "image/jpeg",
    }),
  });
  if (!res.ok) throw new Error("Erreur lors de la génération du post");
  return res.json();
}

export async function approvePost(
  postId: string,
  finalText?: string
): Promise<void> {
  const res = await fetch(`${API_URL}/posts/${postId}/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ final_text: finalText ?? null }),
  });
  if (!res.ok) throw new Error("Erreur lors de l'approbation du post");
}

// --- Publication Meta ---

export async function publishPost(
  postId: string,
  scheduledAt?: string
): Promise<PublishResult> {
  const res = await fetch(`${API_URL}/meta/publish/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scheduled_at: scheduledAt ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Erreur lors de la publication");
  }
  return res.json();
}

export async function fetchPublishAlerts(
  restaurantId: string,
  publishDays: number[]
): Promise<PublishAlert[]> {
  const days = publishDays.join(",");
  const res = await fetch(
    `${API_URL}/posts/alerts?restaurant_id=${restaurantId}&publish_days=${days}`
  );
  if (!res.ok) return [];
  return res.json();
}

// --- Réservations ---

export async function fetchFloorPlans(restaurantId: string): Promise<FloorPlan[]> {
  const res = await fetch(`${API_URL}/reservations/floor-plans?restaurant_id=${restaurantId}`);
  if (!res.ok) throw new Error("Erreur lors du chargement des plans");
  return res.json();
}

export async function createFloorPlan(data: {
  restaurant_id: string;
  name: string;
  sort_order?: number;
}): Promise<FloorPlan> {
  const res = await fetch(`${API_URL}/reservations/floor-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la création du plan");
  return res.json();
}

export async function updateFloorPlan(
  planId: string,
  data: { name?: string; reservable?: boolean }
): Promise<FloorPlan> {
  const res = await fetch(`${API_URL}/reservations/floor-plans/${planId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour du plan");
  return res.json();
}

export async function deleteFloorPlan(planId: string): Promise<void> {
  const res = await fetch(`${API_URL}/reservations/floor-plans/${planId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erreur lors de la suppression du plan");
}

export async function fetchTables(
  restaurantId: string,
  floorPlanId?: string
): Promise<RestaurantTable[]> {
  let url = `${API_URL}/reservations/tables?restaurant_id=${restaurantId}`;
  if (floorPlanId) url += `&floor_plan_id=${floorPlanId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur lors du chargement des tables");
  return res.json();
}

export async function createTable(data: {
  floor_plan_id: string;
  restaurant_id: string;
  name: string;
  capacity: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  shape?: string;
  rotation?: number;
  movable?: boolean;
  premium?: boolean;
}): Promise<RestaurantTable> {
  const res = await fetch(`${API_URL}/reservations/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la création de la table");
  return res.json();
}

export async function updateTable(
  tableId: string,
  data: Partial<{ name: string; capacity: number; x: number; y: number; width: number; height: number; shape: string; rotation: number; snap: boolean; movable: boolean; premium: boolean }>
): Promise<RestaurantTable> {
  const res = await fetch(`${API_URL}/reservations/tables/${tableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour de la table");
  return res.json();
}

export async function deleteTable(tableId: string): Promise<void> {
  const res = await fetch(`${API_URL}/reservations/tables/${tableId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erreur lors de la suppression de la table");
}

export async function fetchReservations(
  restaurantId: string,
  date?: string,
  status?: string
): Promise<Reservation[]> {
  let url = `${API_URL}/reservations/?restaurant_id=${restaurantId}`;
  if (date) url += `&date=${date}`;
  if (status) url += `&status=${status}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur lors du chargement des réservations");
  return res.json();
}

export async function createReservation(data: ReservationCreate): Promise<Reservation> {
  const res = await fetch(`${API_URL}/reservations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Erreur lors de la création de la réservation");
  }
  return res.json();
}

export async function updateReservation(
  reservationId: string,
  data: Partial<ReservationCreate>
): Promise<Reservation> {
  const res = await fetch(`${API_URL}/reservations/${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour de la réservation");
  return res.json();
}

export async function confirmReservation(reservationId: string): Promise<Reservation> {
  const res = await fetch(`${API_URL}/reservations/${reservationId}/confirm`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Erreur lors de la confirmation de la réservation");
  return res.json();
}

export async function cancelReservation(reservationId: string): Promise<Reservation> {
  const res = await fetch(`${API_URL}/reservations/${reservationId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Erreur lors de l'annulation de la réservation");
  return res.json();
}

export async function deleteReservation(reservationId: string): Promise<void> {
  const res = await fetch(`${API_URL}/reservations/${reservationId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erreur lors de la suppression de la réservation");
}

// --- Stocks ---

export async function fetchStockItems(restaurantId: string, category?: string): Promise<StockItem[]> {
  let url = `${API_URL}/stocks/items?restaurant_id=${restaurantId}`;
  if (category) url += `&category=${category}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur chargement stocks");
  return res.json();
}

export async function createStockItem(data: {
  restaurant_id: string;
  name: string;
  brand?: string | null;
  category: StockCategory;
  unit: string;
  stock_current?: number;
  stock_min: number;
  stock_reorder?: number | null;
  supplier_milliet_price?: number | null;
  supplier_metro_price?: number | null;
}): Promise<StockItem> {
  const res = await fetch(`${API_URL}/stocks/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur création article");
  return res.json();
}

export async function deleteStockItem(itemId: string, restaurantId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/stocks/items/${itemId}?restaurant_id=${restaurantId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Erreur suppression article");
}

export async function updateStockItem(
  itemId: string,
  updates: Partial<{
    name: string;
    brand: string | null;
    unit: string;
    stock_min: number;
    stock_reorder: number | null;
    supplier_milliet_price: number | null;
    supplier_metro_price: number | null;
  }>
): Promise<StockItem> {
  const res = await fetch(`${API_URL}/stocks/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Erreur mise à jour article");
  return res.json();
}

export async function updateStockLevel(
  itemId: string,
  stockCurrent: number,
  restaurantId: string
): Promise<{ item: StockItem; alerts: object }> {
  const res = await fetch(
    `${API_URL}/stocks/items/${itemId}/stock?restaurant_id=${restaurantId}&stock_current=${stockCurrent}`,
    { method: "PATCH" }
  );
  if (!res.ok) throw new Error("Erreur mise à jour stock");
  return res.json();
}

export async function bulkUpdateStock(
  restaurantId: string,
  updates: { id: string; stock_current: number }[]
): Promise<{ updated_count: number; alerts: object }> {
  const res = await fetch(
    `${API_URL}/stocks/items/bulk-update?restaurant_id=${restaurantId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    }
  );
  if (!res.ok) throw new Error("Erreur mise à jour en masse");
  return res.json();
}

export async function seedBarCatalogue(restaurantId: string): Promise<{ inserted: number }> {
  const res = await fetch(`${API_URL}/stocks/seed?restaurant_id=${restaurantId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Erreur seed catalogue");
  }
  return res.json();
}

export async function fetchDeliveries(restaurantId: string): Promise<Delivery[]> {
  const res = await fetch(`${API_URL}/stocks/deliveries?restaurant_id=${restaurantId}`);
  if (!res.ok) throw new Error("Erreur chargement livraisons");
  return res.json();
}

export async function scanDeliveryNote(
  restaurantId: string,
  imageBase64: string,
  mediaType: string
): Promise<DeliveryScanResult> {
  const res = await fetch(`${API_URL}/stocks/deliveries/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      image_base64: imageBase64,
      media_type: mediaType,
    }),
  });
  if (!res.ok) throw new Error("Erreur scan bon de livraison");
  return res.json();
}

export async function createDelivery(data: {
  restaurant_id: string;
  supplier_name?: string;
  delivery_date: string;
  notes?: string;
  items: object[];
}): Promise<{ delivery_id: string; items_count: number; alerts: object }> {
  const res = await fetch(`${API_URL}/stocks/deliveries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur création livraison");
  return res.json();
}

export async function fetchOrderList(restaurantId: string): Promise<OrderItem[]> {
  const res = await fetch(`${API_URL}/stocks/order-list?restaurant_id=${restaurantId}`);
  if (!res.ok) throw new Error("Erreur chargement bon de commande");
  return res.json();
}

export async function scanZReport(
  restaurantId: string,
  imageBase64: string,
  mediaType: string,
  saleDate?: string,
): Promise<ZReportScanResult> {
  const res = await fetch(`${API_URL}/stocks/z-report/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      image_base64: imageBase64,
      media_type: mediaType,
      sale_date: saleDate ?? null,
    }),
  });
  if (!res.ok) throw new Error("Erreur scan ticket Z");
  return res.json();
}

export async function saveZReport(
  data: { restaurant_id: string; sale_date: string; items: object[] },
  mode: string = "equilibre"
): Promise<{ saved_count: number; updated_thresholds: object[] }> {
  const res = await fetch(`${API_URL}/stocks/z-report?mode=${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur enregistrement Z");
  return res.json();
}

export async function recalculateThresholds(
  restaurantId: string,
  mode: string = "equilibre"
): Promise<{ updated_count: number; items: object[] }> {
  const res = await fetch(
    `${API_URL}/stocks/recalculate-thresholds?restaurant_id=${restaurantId}&mode=${mode}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Erreur recalcul seuils");
  return res.json();
}

export async function importLAdditionCsv(
  restaurantId: string,
  file: File,
  mode: string = "equilibre"
): Promise<{
  imported: number;
  unique_products: number;
  matched_to_catalogue: number;
  days: number;
  date_from: string;
  date_to: string;
  updated_thresholds: number;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_URL}/stocks/import-laddition?restaurant_id=${restaurantId}&mode=${mode}`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Erreur import L'Addition");
  }
  return res.json();
}

export async function stockAgentChat(
  restaurantId: string,
  messages: ChatMessage[],
  context?: { reservations_count?: number; weather?: string; notes?: string }
): Promise<{ response: string }> {
  const res = await fetch(`${API_URL}/stocks/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      messages,
      ...context,
    }),
  });
  if (!res.ok) throw new Error("Erreur agent stocks");
  return res.json();
}
