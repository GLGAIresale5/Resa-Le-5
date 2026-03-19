from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date
import csv, io
from collections import defaultdict

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from models.stock import (
    StockItem, StockItemCreate, StockItemUpdate, StockBulkUpdate,
    Delivery, DeliveryCreate, DeliveryScanRequest, DeliveryScanResult,
    OrderItem, AgentChatRequest,
    ZReportScanRequest, ZReportSaleItem, ZReportScanResult, ZReportCreate,
)
from agents.stock_agent import (
    parse_delivery_note, stock_chat, check_and_alert,
    parse_z_report, compute_auto_thresholds,
)
from supabase import create_client

router = APIRouter(prefix="/stocks", tags=["stocks"])


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


# =====================
# CATALOGUE (stock_items)
# =====================

@router.get("/items", response_model=List[StockItem])
async def list_stock_items(restaurant_id: UUID = Query(...), category: Optional[str] = None, user_id: str = Depends(get_current_user)):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    query = (
        supabase.table("stock_items")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .order("category")
        .order("sort_order")
    )
    if category:
        query = query.eq("category", category)
    return query.execute().data


@router.post("/items", response_model=StockItem)
async def create_stock_item(body: StockItemCreate, user_id: str = Depends(get_current_user)):
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    data = body.model_dump(mode="json")
    result = supabase.table("stock_items").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Erreur création article")
    return result.data[0]


@router.patch("/items/{item_id}", response_model=StockItem)
async def update_stock_item(item_id: UUID, body: StockItemUpdate, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    updates = {k: v for k, v in body.model_dump(mode="json").items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée")
    result = (
        supabase.table("stock_items")
        .update(updates)
        .eq("id", str(item_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Article introuvable")
    return result.data[0]


@router.delete("/items/{item_id}", status_code=204)
async def delete_stock_item(item_id: UUID, restaurant_id: UUID = Query(...), user_id: str = Depends(get_current_user)):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    result = (
        supabase.table("stock_items")
        .delete()
        .eq("id", str(item_id))
        .eq("restaurant_id", str(restaurant_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Article introuvable")


@router.patch("/items/{item_id}/stock")
async def update_stock_level(item_id: UUID, stock_current: float, restaurant_id: UUID = Query(...), user_id: str = Depends(get_current_user)):
    """Met à jour uniquement le niveau de stock, puis vérifie les alertes."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    result = (
        supabase.table("stock_items")
        .update({"stock_current": stock_current})
        .eq("id", str(item_id))
        .eq("restaurant_id", str(restaurant_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Article introuvable")

    # Vérifier les alertes sur tout le catalogue
    all_items = (
        supabase.table("stock_items")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .execute()
        .data
    )
    alert_result = check_and_alert(all_items)
    return {"item": result.data[0], "alerts": alert_result}


@router.post("/items/bulk-update")
async def bulk_update_stock(body: StockBulkUpdate, restaurant_id: UUID = Query(...), user_id: str = Depends(get_current_user)):
    """Mise à jour en masse — saisie initiale ou remise à zéro."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    updated = []
    for upd in body.updates:
        item_id = upd.get("id")
        stock_current = upd.get("stock_current")
        if item_id is None or stock_current is None:
            continue
        result = (
            supabase.table("stock_items")
            .update({"stock_current": float(stock_current)})
            .eq("id", str(item_id))
            .eq("restaurant_id", str(restaurant_id))
            .execute()
        )
        if result.data:
            updated.append(result.data[0])

    all_items = (
        supabase.table("stock_items")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .execute()
        .data
    )
    alert_result = check_and_alert(all_items)
    return {"updated_count": len(updated), "alerts": alert_result}


# =====================
# SEED — catalogue bar depuis le cadencier
# =====================

BAR_CATALOGUE = [
    # --- SOFT ---
    {"name": "Grenadine", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 3.0, "sort_order": 1},
    {"name": "Sirop Menthe", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 2.0, "sort_order": 2},
    {"name": "Sirop Fraise", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 2.0, "sort_order": 3},
    {"name": "Sirop Pêche", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 3.0, "supplier_milliet_price": 7.1, "sort_order": 4},
    {"name": "Sirop Citron", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 3.0, "supplier_milliet_price": 5.3, "sort_order": 5},
    {"name": "Sirop Sucre", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 2.0, "sort_order": 6},
    {"name": "Sirop Violet", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 0.25, "sort_order": 7},
    {"name": "Sirop Curaçao", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 0.5, "sort_order": 8},
    {"name": "Sirop Vanille", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 0.25, "sort_order": 9},
    {"name": "Sirop Cassis", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 0.25, "sort_order": 10},
    {"name": "Sirop Rantcho", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 0.25, "supplier_milliet_price": 4.85, "sort_order": 11},
    {"name": "Purée Passion", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 1.0, "supplier_milliet_price": 11.8, "sort_order": 12},
    {"name": "Purée Fruits Rouges", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 1.0, "sort_order": 13},
    {"name": "Purée Coco", "brand": "Monin", "category": "soft", "unit": "bouteille", "stock_min": 1.0, "supplier_milliet_price": 12.0, "sort_order": 14},
    {"name": "Limonade", "brand": "Garçon", "category": "soft", "unit": "bouteille", "stock_min": 12.0, "supplier_milliet_price": 1.58, "sort_order": 15},
    {"name": "Jus Orange", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 12.0, "supplier_milliet_price": 3.34, "sort_order": 16},
    {"name": "Jus Pomme", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 12.0, "supplier_milliet_price": 2.4, "sort_order": 17},
    {"name": "Jus Ananas", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 12.0, "supplier_milliet_price": 3.05, "sort_order": 18},
    {"name": "Jus Maracuja", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 6.0, "sort_order": 19},
    {"name": "Jus Citron", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 12.0, "supplier_milliet_price": 2.89, "sort_order": 20},
    {"name": "Jus Abricot", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 3.0, "sort_order": 21},
    {"name": "Jus Cranberry", "brand": "Granini", "category": "soft", "unit": "bouteille", "stock_min": 12.0, "supplier_milliet_price": 3.31, "sort_order": 22},
    {"name": "Coca Cola", "brand": "Coca-Cola", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 1.0, "supplier_milliet_price": 0.96, "sort_order": 23},
    {"name": "Coca Zéro", "brand": "Coca-Cola", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 1.0, "sort_order": 24},
    {"name": "Coca Cherry", "brand": "Coca-Cola", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 1.0, "sort_order": 25},
    {"name": "Orangina", "brand": "Orangina", "category": "soft", "packaging": "X49", "unit": "pack", "stock_min": 1.0, "sort_order": 26},
    {"name": "Tonic", "brand": "Schweppes", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 0.5, "sort_order": 27},
    {"name": "Schweppes Agrumes", "brand": "Schweppes", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 0.5, "sort_order": 28},
    {"name": "Ginger Ale", "brand": "Schweppes", "category": "soft", "packaging": "X12", "unit": "pack", "stock_min": 0.5, "sort_order": 29},
    {"name": "Pamplemousse", "brand": "La French", "category": "soft", "unit": "bouteille", "stock_min": 3.0, "sort_order": 30},
    {"name": "Red Bull", "brand": "Red Bull", "category": "soft", "unit": "canette", "stock_min": 12.0, "sort_order": 31},
    {"name": "Evian 1L", "brand": "Evian", "category": "soft", "packaging": "X12", "unit": "pack", "stock_min": 1.5, "supplier_milliet_price": 0.9, "sort_order": 32},
    {"name": "Evian 50cl", "brand": "Evian", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 1.0, "sort_order": 33},
    {"name": "Badoit 1L", "brand": "Badoit", "category": "soft", "packaging": "X12", "unit": "pack", "stock_min": 1.5, "supplier_milliet_price": 0.92, "sort_order": 34},
    {"name": "Badoit 50cl", "brand": "Badoit", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 1.0, "sort_order": 35},
    {"name": "Perrier 75cl", "brand": "Perrier", "category": "soft", "unit": "bouteille", "stock_min": 3.0, "sort_order": 36},
    {"name": "Perrier 33cl", "brand": "Perrier", "category": "soft", "packaging": "X24", "unit": "pack", "stock_min": 0.25, "supplier_milliet_price": 1.2, "sort_order": 37},
    {"name": "Thé Noir", "brand": "Lipton", "category": "soft", "packaging": "X100", "unit": "boite", "stock_min": 0.25, "supplier_metro_price": 8.16, "sort_order": 38},
    # --- SPIRITUEUX ---
    {"name": "Crème de Cassis", "brand": "Marie Brizard", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 1},
    {"name": "Crème de Mûre", "brand": "Marie Brizard", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 2},
    {"name": "Crème de Pêche", "brand": "Marie Brizard", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 3},
    {"name": "Martini Bianco", "brand": "Martini", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 4},
    {"name": "Martini Rosso", "brand": "Martini", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 5},
    {"name": "Noilly Prat Dry", "brand": "Noilly Prat", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 6},
    {"name": "Campari", "brand": "Campari", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 7},
    {"name": "Gin Bombay", "brand": "Bombay", "category": "spiritueux", "unit": "bouteille", "stock_min": 4.0, "sort_order": 8},
    {"name": "Ricard", "brand": "Ricard", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "sort_order": 9},
    {"name": "Porto", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 10},
    {"name": "Lillet Blanc", "brand": "Lillet", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 11},
    {"name": "Lillet Rosé", "brand": "Lillet", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 12},
    {"name": "Apérol", "brand": "Apérol", "category": "spiritueux", "unit": "bouteille", "stock_min": 3.0, "supplier_milliet_price": 16.87, "sort_order": 13},
    {"name": "Tequila Cazadores", "brand": "Cazadores", "category": "spiritueux", "unit": "bouteille", "stock_min": 2.0, "supplier_milliet_price": 31.52, "sort_order": 14},
    {"name": "Cointreau", "brand": "Cointreau", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "sort_order": 15},
    {"name": "Saint-Germain Sureau", "brand": "Saint-Germain", "category": "spiritueux", "unit": "bouteille", "stock_min": 4.0, "supplier_milliet_price": 33.91, "sort_order": 16},
    {"name": "Rhum Bacardi Oro", "brand": "Bacardi", "category": "spiritueux", "unit": "bouteille", "stock_min": 4.0, "sort_order": 17},
    {"name": "Kahlua", "brand": "Kahlua", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 18},
    {"name": "Cachaça Aguacana", "brand": "Aguacana", "category": "spiritueux", "unit": "bouteille", "stock_min": 4.0, "sort_order": 19},
    {"name": "Triple Sec", "brand": "Vedrenne", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "sort_order": 20},
    {"name": "Curaçao Bleu", "brand": "Vedrenne", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "sort_order": 21},
    {"name": "Soho", "brand": "Soho", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 22},
    {"name": "Tequila Patron Silver", "brand": "Patron", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 23},
    {"name": "Tequila Patron Reposado", "brand": "Patron", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "supplier_milliet_price": 54.52, "sort_order": 24},
    {"name": "Tequila Patron Añejo", "brand": "Patron", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 25},
    {"name": "Calvados", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 26},
    {"name": "Bailey's", "brand": "Bailey's", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "sort_order": 27},
    {"name": "Get 27", "brand": "Get", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "sort_order": 28},
    {"name": "Limoncello", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 29},
    {"name": "Amaretto", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 30},
    {"name": "Manzana", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 31},
    {"name": "Cognac", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 32},
    {"name": "Armagnac", "brand": None, "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 33},
    {"name": "Vodka 42 Below", "brand": "42 Below", "category": "spiritueux", "unit": "bouteille", "stock_min": 4.0, "supplier_milliet_price": 20.62, "sort_order": 34},
    {"name": "Vodka Grey Goose", "brand": "Grey Goose", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 35},
    {"name": "Rhum Diplomatico", "brand": "Diplomatico", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 36},
    {"name": "Rhum Santa Teresa", "brand": "Santa Teresa", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 37},
    {"name": "Whisky William's", "brand": "William's", "category": "spiritueux", "unit": "bouteille", "stock_min": 1.0, "supplier_milliet_price": 14.02, "sort_order": 38},
    {"name": "Whisky Jack Daniel's", "brand": "Jack Daniel's", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 39},
    {"name": "Whisky Glenmorangie", "brand": "Glenmorangie", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 40},
    {"name": "Whisky Lagavulin 16", "brand": "Lagavulin", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.25, "sort_order": 41},
    {"name": "Whisky Jameson", "brand": "Jameson", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.75, "sort_order": 42},
    {"name": "Jägermeister", "brand": "Jägermeister", "category": "spiritueux", "unit": "bouteille", "stock_min": 0.5, "sort_order": 43},
    # --- BIÈRES ---
    {"name": "Super Bock Blonde", "brand": "Super Bock", "category": "bieres", "unit": "bouteille", "stock_min": 6.0, "sort_order": 1},
    {"name": "Corona", "brand": "Corona", "category": "bieres", "unit": "bouteille", "stock_min": 6.0, "sort_order": 2},
    {"name": "Grimbergen Blonde", "brand": "Grimbergen", "category": "bieres", "unit": "bouteille", "stock_min": 6.0, "sort_order": 3},
    {"name": "Delirium Red", "brand": "Delirium", "category": "bieres", "packaging": "X24", "unit": "pack", "stock_min": 0.25, "sort_order": 4},
    {"name": "Picon", "brand": "Picon", "category": "bieres", "unit": "bouteille", "stock_min": 1.0, "sort_order": 5},
    {"name": "Cidre Brut", "brand": "Appie", "category": "bieres", "unit": "bouteille", "stock_min": 3.0, "sort_order": 6},
    {"name": "Bière Sans Alcool", "brand": "Bap Bap", "category": "bieres", "unit": "bouteille", "stock_min": 6.0, "sort_order": 7},
    {"name": "Pilsner", "brand": None, "category": "bieres", "unit": "bouteille", "stock_min": 1.5, "sort_order": 8},
    {"name": "Mission", "brand": None, "category": "bieres", "unit": "bouteille", "stock_min": 1.0, "sort_order": 9},
    {"name": "IPA", "brand": None, "category": "bieres", "unit": "bouteille", "stock_min": 1.5, "sort_order": 10},
    {"name": "Aube", "brand": None, "category": "bieres", "unit": "bouteille", "stock_min": 1.0, "sort_order": 11},
    # --- VINS ---
    {"name": "Prosecco", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 12.0, "sort_order": 1},
    {"name": "Champagne Brut", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 6.0, "sort_order": 2},
    {"name": "Brut EPC", "brand": "EPC", "category": "vins", "unit": "bouteille", "stock_min": 4.0, "sort_order": 3},
    {"name": "Blanc de Noir EPC", "brand": "EPC", "category": "vins", "unit": "bouteille", "stock_min": 2.0, "sort_order": 4},
    {"name": "Rosé EPC", "brand": "EPC", "category": "vins", "unit": "bouteille", "stock_min": 2.0, "sort_order": 5},
    {"name": "Blanc de Blanc EPC", "brand": "EPC", "category": "vins", "unit": "bouteille", "stock_min": 2.0, "sort_order": 6},
    {"name": "Viognier", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 12.0, "sort_order": 7},
    {"name": "Chardonnay", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 12.0, "sort_order": 8},
    {"name": "Gascogne", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 2.0, "sort_order": 9},
    {"name": "Vouvray Chapitre VII", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 1.0, "sort_order": 10},
    {"name": "Le Colombier de Brown", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 1.0, "sort_order": 11},
    {"name": "Gris de Gris", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 12.0, "sort_order": 12},
    {"name": "Cavalier 360", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 6.0, "sort_order": 13},
    {"name": "Merlot", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 6.0, "sort_order": 14},
    {"name": "Pinot Noir", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 6.0, "sort_order": 15},
    {"name": "Château du Lort", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 3.0, "sort_order": 16},
    {"name": "Châteauneuf-du-Pape", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 3.0, "sort_order": 17},
    {"name": "Terrasse du Larzac", "brand": None, "category": "vins", "unit": "bouteille", "stock_min": 2.0, "sort_order": 18},
    # --- FRAIS ---
    {"name": "Citron Jaune", "brand": None, "category": "frais", "unit": "kg", "stock_min": 0.5, "sort_order": 1},
    {"name": "Citron Vert", "brand": None, "category": "frais", "unit": "kg", "stock_min": 1.0, "sort_order": 2},
    {"name": "Orange", "brand": None, "category": "frais", "unit": "kg", "stock_min": 0.5, "sort_order": 3},
    {"name": "Menthe", "brand": None, "category": "frais", "unit": "botte", "stock_min": 4.0, "sort_order": 4},
]


@router.post("/seed")
async def seed_bar_catalogue(restaurant_id: UUID, user_id: str = Depends(get_current_user)):
    """Insère le catalogue bar depuis le cadencier. À appeler une seule fois."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    # Vérifier que le catalogue est vide
    existing = (
        supabase.table("stock_items")
        .select("id", count="exact")
        .eq("restaurant_id", str(restaurant_id))
        .execute()
    )
    if existing.count and existing.count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Catalogue déjà existant ({existing.count} articles). Supprimer avant de re-seeder."
        )

    items_to_insert = []
    for item in BAR_CATALOGUE:
        row = {
            "restaurant_id": str(restaurant_id),
            "name": item["name"],
            "brand": item.get("brand"),
            "category": item["category"],
            "packaging": item.get("packaging"),
            "unit": item.get("unit", "bouteille"),
            "stock_current": 0.0,
            "stock_min": item.get("stock_min", 1.0),
            "stock_reorder": None,
            "supplier_milliet_price": item.get("supplier_milliet_price"),
            "supplier_metro_price": item.get("supplier_metro_price"),
            "sort_order": item.get("sort_order", 0),
        }
        items_to_insert.append(row)

    result = supabase.table("stock_items").insert(items_to_insert).execute()
    return {"inserted": len(result.data), "message": "Catalogue bar seedé avec succès."}


# =====================
# LIVRAISONS
# =====================

@router.get("/deliveries")
async def list_deliveries(restaurant_id: UUID = Query(...), limit: int = 20, user_id: str = Depends(get_current_user)):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    deliveries = (
        supabase.table("deliveries")
        .select("*, delivery_items(*)")
        .eq("restaurant_id", str(restaurant_id))
        .order("delivery_date", desc=True)
        .limit(limit)
        .execute()
    )
    return deliveries.data


@router.post("/deliveries/scan", response_model=DeliveryScanResult)
async def scan_delivery_note(body: DeliveryScanRequest, user_id: str = Depends(get_current_user)):
    """OCR du bon de livraison via Claude Vision."""
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    catalogue = (
        supabase.table("stock_items")
        .select("id, name, brand, unit")
        .eq("restaurant_id", str(body.restaurant_id))
        .execute()
        .data
    )
    result = parse_delivery_note(body.image_base64, body.media_type, catalogue)
    return DeliveryScanResult(
        supplier_name=result.get("supplier_name"),
        delivery_date=result.get("delivery_date"),
        items=result.get("items", []),
        raw_text=result.get("raw_text", ""),
    )


@router.post("/deliveries")
async def create_delivery(body: DeliveryCreate, user_id: str = Depends(get_current_user)):
    """Enregistre une livraison et met à jour les stocks."""
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()

    # Créer la livraison
    delivery_row = {
        "restaurant_id": str(body.restaurant_id),
        "supplier_name": body.supplier_name,
        "delivery_date": str(body.delivery_date),
        "notes": body.notes,
    }
    delivery_result = supabase.table("deliveries").insert(delivery_row).execute()
    if not delivery_result.data:
        raise HTTPException(status_code=500, detail="Erreur création livraison")
    delivery_id = delivery_result.data[0]["id"]

    # Insérer les items et mettre à jour les stocks
    for item in body.items:
        item_row = {
            "delivery_id": delivery_id,
            "stock_item_id": str(item.get("stock_item_id")) if item.get("stock_item_id") else None,
            "item_name": item["item_name"],
            "quantity": float(item["quantity"]),
            "unit_price": item.get("unit_price"),
        }
        supabase.table("delivery_items").insert(item_row).execute()

        # Incrémenter le stock
        if item.get("stock_item_id"):
            current = (
                supabase.table("stock_items")
                .select("stock_current")
                .eq("id", str(item["stock_item_id"]))
                .single()
                .execute()
            )
            if current.data:
                new_stock = current.data["stock_current"] + float(item["quantity"])
                supabase.table("stock_items").update({"stock_current": new_stock}).eq("id", str(item["stock_item_id"])).execute()

    # Vérifier les alertes
    all_items = (
        supabase.table("stock_items")
        .select("*")
        .eq("restaurant_id", str(body.restaurant_id))
        .execute()
        .data
    )
    alert_result = check_and_alert(all_items)

    return {"delivery_id": delivery_id, "items_count": len(body.items), "alerts": alert_result}


# =====================
# BON DE COMMANDE
# =====================

@router.get("/order-list", response_model=List[OrderItem])
async def get_order_list(restaurant_id: UUID = Query(...), user_id: str = Depends(get_current_user)):
    """Retourne les articles sous seuil, triés par niveau d'alerte."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    items = (
        supabase.table("stock_items")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .execute()
        .data
    )

    order_items = []
    for item in items:
        if item["stock_current"] <= item["stock_min"]:
            level = "critical" if item["stock_current"] <= 0 else "warning"
            suggested = max(0.0, (item["stock_min"] * 2) - item["stock_current"])
            order_items.append(OrderItem(
                stock_item_id=item["id"],
                name=item["name"],
                brand=item.get("brand"),
                category=item["category"],
                unit=item["unit"],
                stock_current=item["stock_current"],
                stock_min=item["stock_min"],
                stock_reorder=item["stock_min"],
                alert_level=level,
                suggested_quantity=round(suggested, 2),
                supplier_milliet_price=item.get("supplier_milliet_price"),
                supplier_metro_price=item.get("supplier_metro_price"),
            ))

    # Critical en premier
    order_items.sort(key=lambda x: (0 if x.alert_level == "critical" else 1, x.category, x.name))
    return order_items


# =====================
# Z REPORT (ticket journalier)
# =====================

@router.post("/z-report/scan", response_model=ZReportScanResult)
async def scan_z_report(body: ZReportScanRequest, user_id: str = Depends(get_current_user)):
    """OCR du ticket Z via Claude Vision."""
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    catalogue = (
        supabase.table("stock_items")
        .select("id, name, brand, unit")
        .eq("restaurant_id", str(body.restaurant_id))
        .execute()
        .data
    )
    result = parse_z_report(body.image_base64, body.media_type, catalogue)
    return ZReportScanResult(
        sale_date=result.get("sale_date"),
        items=[ZReportSaleItem(**item) for item in result.get("items", [])],
        raw_text=result.get("raw_text", ""),
    )


@router.post("/z-report")
async def save_z_report(body: ZReportCreate, mode: str = Query("equilibre"), user_id: str = Depends(get_current_user)):
    """Enregistre les ventes du jour et recalcule les seuils automatiquement."""
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()

    saved_count = 0
    for item in body.items:
        stock_item_id = item.get("stock_item_id")
        if not stock_item_id:
            continue
        row = {
            "restaurant_id": str(body.restaurant_id),
            "stock_item_id": stock_item_id,
            "item_name": item["item_name"],
            "quantity_sold": float(item["quantity_sold"]),
            "sale_date": str(body.sale_date),
        }
        result = supabase.table("daily_sales").insert(row).execute()
        if result.data:
            saved_count += 1

    updated_thresholds = _recalculate_thresholds(supabase, str(body.restaurant_id), mode)
    return {"saved_count": saved_count, "updated_thresholds": updated_thresholds}


@router.post("/recalculate-thresholds")
async def recalculate_thresholds(restaurant_id: UUID = Query(...), mode: str = Query("equilibre"), user_id: str = Depends(get_current_user)):
    """Recalcule stock_min et stock_reorder de tous les articles depuis tout l'historique Z disponible."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    updated = _recalculate_thresholds(supabase, str(restaurant_id), mode)
    return {"updated_count": len(updated), "items": updated}


def _recalculate_thresholds(supabase, restaurant_id: str, mode: str = "equilibre") -> list:
    from datetime import date, timedelta
    from collections import defaultdict

    today = date.today()

    # Fenêtres de données :
    # 1. Les 30 derniers jours (période courante)
    # 2. Les 30 jours correspondants de l'année passée (même mois -1 an)
    # 3. Les 30 jours suivants de l'année passée (mois en cours -1 an)
    # Exemple : mars 2026 → fév 2026 + fév 2025 + mars 2025
    window_start_current = today - timedelta(days=30)
    window_start_prev_year = window_start_current.replace(year=window_start_current.year - 1)
    window_end_prev_year = today.replace(year=today.year - 1)

    def fetch_window(start: date, end: date):
        return (
            supabase.table("daily_sales")
            .select("stock_item_id, quantity_sold, sale_date")
            .eq("restaurant_id", restaurant_id)
            .gte("sale_date", str(start))
            .lte("sale_date", str(end))
            .execute()
            .data
        ) or []

    sales = (
        fetch_window(window_start_current, today)
        + fetch_window(window_start_prev_year, window_end_prev_year)
    )
    if not sales:
        return []

    by_item = defaultdict(list)
    for sale in sales:
        if sale.get("stock_item_id"):
            by_item[sale["stock_item_id"]].append(sale)

    updated = []
    for item_id, item_sales in by_item.items():
        thresholds = compute_auto_thresholds(item_id, item_sales, mode=mode)
        if thresholds:
            try:
                result = (
                    supabase.table("stock_items")
                    .update({
                        "stock_min": thresholds["stock_min"],
                        "stock_reorder": thresholds["stock_reorder"],
                        "auto_thresholds": True,
                    })
                    .eq("id", item_id)
                    .eq("restaurant_id", restaurant_id)
                    .execute()
                )
                if result.data:
                    updated.append({"id": item_id, **thresholds})
            except Exception:
                pass  # colonne auto_thresholds pas encore migrée

    return updated


# =====================
# IMPORT L'ADDITION CSV
# =====================

@router.post("/import-laddition")
async def import_laddition_csv(
    restaurant_id: UUID = Query(...),
    file: UploadFile = File(...),
    mode: str = Query("equilibre"),
    user_id: str = Depends(get_current_user),
):
    """Importe l'historique de ventes depuis un export CSV L'Addition (SalesDocumentLines)."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    lines = text.splitlines()

    # Trouver la ligne d'en-tête (commence par "Etablissement")
    header_idx = None
    for i, line in enumerate(lines):
        if line.startswith("Etablissement"):
            header_idx = i
            break

    if header_idx is None:
        raise HTTPException(
            status_code=400,
            detail="Format CSV non reconnu — ligne 'Etablissement' introuvable",
        )

    reader = csv.DictReader(lines[header_idx:], delimiter=";")

    supabase = get_supabase()

    # Charger le catalogue pour la correspondance par nom
    catalogue = (
        supabase.table("stock_items")
        .select("id, name")
        .eq("restaurant_id", str(restaurant_id))
        .execute()
        .data
    ) or []
    name_to_id = {item["name"].strip().lower(): item["id"] for item in catalogue}

    # Agréger les ventes par (date, nom_produit)
    aggregated: dict = defaultdict(float)
    dates_seen: set = set()

    for row in reader:
        nom = (row.get("Nom") or "").strip()
        jour = (row.get("Jour") or "").strip()
        qte_str = (row.get("Qte") or "1").replace(",", ".").strip()

        if not nom or nom == "-" or not jour:
            continue

        try:
            qte = float(qte_str)
        except ValueError:
            qte = 1.0

        aggregated[(jour, nom)] += qte
        dates_seen.add(jour)

    if not aggregated:
        raise HTTPException(
            status_code=400,
            detail="Aucune vente trouvée dans le fichier",
        )

    min_date = min(dates_seen)
    max_date = max(dates_seen)

    # Supprimer les entrées existantes sur la même période (éviter les doublons)
    supabase.table("daily_sales").delete().eq(
        "restaurant_id", str(restaurant_id)
    ).gte("sale_date", min_date).lte("sale_date", max_date).execute()

    # Préparer les lignes à insérer
    rows_to_insert = []
    matched_count = 0
    for (sale_date, item_name), qty in aggregated.items():
        matched_id = name_to_id.get(item_name.strip().lower())
        if matched_id:
            matched_count += 1
        rows_to_insert.append({
            "restaurant_id": str(restaurant_id),
            "stock_item_id": matched_id,
            "item_name": item_name,
            "quantity_sold": round(qty, 2),
            "sale_date": sale_date,
        })

    # Insérer par lots de 500
    inserted = 0
    for i in range(0, len(rows_to_insert), 500):
        batch = rows_to_insert[i:i + 500]
        result = supabase.table("daily_sales").insert(batch).execute()
        inserted += len(result.data)

    # Recalculer les seuils automatiques
    updated_thresholds = _recalculate_thresholds(supabase, str(restaurant_id), mode)

    return {
        "imported": inserted,
        "unique_products": len({k[1] for k in aggregated.keys()}),
        "matched_to_catalogue": matched_count,
        "days": len(dates_seen),
        "date_from": min_date,
        "date_to": max_date,
        "updated_thresholds": len(updated_thresholds),
    }


# =====================
# AGENT CHAT
# =====================

@router.post("/agent/chat")
async def agent_chat(body: AgentChatRequest, user_id: str = Depends(get_current_user)):
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    stock_items = (
        supabase.table("stock_items")
        .select("*")
        .eq("restaurant_id", str(body.restaurant_id))
        .execute()
        .data
    )
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    response = stock_chat(
        messages=messages,
        stock_items=stock_items,
        reservations_count=body.reservations_count,
        weather=body.weather,
        notes=body.notes,
    )
    return {"response": response}
