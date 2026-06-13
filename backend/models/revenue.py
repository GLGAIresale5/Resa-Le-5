from pydantic import BaseModel, Field, validator
from typing import Optional, List, Literal
from datetime import date, datetime, timedelta
from uuid import UUID


PeriodType = Literal["day", "week", "month"]


class RevenueEntry(BaseModel):
    id: UUID
    restaurant_id: UUID
    period_type: PeriodType
    period_start: date
    period_end: date
    revenue_ht: float
    revenue_ttc: Optional[float] = None
    covers: Optional[int] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RevenueEntryCreate(BaseModel):
    restaurant_id: UUID
    period_type: PeriodType
    period_start: date
    period_end: Optional[date] = None
    revenue_ht: float
    revenue_ttc: Optional[float] = None
    covers: Optional[int] = None
    source: Optional[str] = None
    notes: Optional[str] = None

    @validator("period_end", always=True)
    def auto_period_end(cls, v, values):
        if v is not None:
            return v
        ptype = values.get("period_type")
        ps = values.get("period_start")
        if ptype is None or ps is None:
            return v
        if ptype == "day":
            return ps
        if ptype == "week":
            return ps + timedelta(days=6)
        if ptype == "month":
            next_m = (ps.replace(day=28) + timedelta(days=4)).replace(day=1)
            return next_m - timedelta(days=1)
        return v


class RevenueBulkCreate(BaseModel):
    restaurant_id: UUID
    entries: List[RevenueEntryCreate]


class RevenueAggregation(BaseModel):
    period_label: str
    period_start: date
    period_end: date
    revenue_ht: float
    revenue_ttc: Optional[float] = None
    covers: Optional[int] = None
    sources: List[str]


def aggregate_revenue_for_range(entries: list, range_start: date, range_end: date) -> dict:
    """
    Resolve revenue for a date range using anti-double-counting precedence:
    day > week > month.

    Algorithm: walk every day in [range_start, range_end]. For each day, find
    the highest-precision entry that covers it. Sum each day's daily share
    of its source entry (entry.revenue_ht / entry.day_count).

    Returns {revenue_ht, revenue_ttc, covers, sources_used}
    """
    by_priority = {"day": 0, "week": 1, "month": 2}
    sorted_entries = sorted(
        entries,
        key=lambda e: (by_priority.get(e["period_type"], 99), e["period_start"]),
    )

    total_ht = 0.0
    total_ttc = 0.0
    total_covers = 0
    sources_used = set()

    cur = range_start
    while cur <= range_end:
        best = None
        for e in sorted_entries:
            ps = e["period_start"] if isinstance(e["period_start"], date) else date.fromisoformat(e["period_start"])
            pe = e["period_end"] if isinstance(e["period_end"], date) else date.fromisoformat(e["period_end"])
            if ps <= cur <= pe:
                best = e
                break
        if best is not None:
            ps = best["period_start"] if isinstance(best["period_start"], date) else date.fromisoformat(best["period_start"])
            pe = best["period_end"] if isinstance(best["period_end"], date) else date.fromisoformat(best["period_end"])
            day_count = (pe - ps).days + 1
            total_ht += float(best["revenue_ht"]) / day_count
            if best.get("revenue_ttc") is not None:
                total_ttc += float(best["revenue_ttc"]) / day_count
            if best.get("covers") is not None:
                total_covers += float(best["covers"]) / day_count
            sources_used.add(best["period_type"])
        cur += timedelta(days=1)

    return {
        "revenue_ht": round(total_ht, 2),
        "revenue_ttc": round(total_ttc, 2) if total_ttc > 0 else None,
        "covers": int(round(total_covers)) if total_covers > 0 else None,
        "sources_used": sorted(sources_used),
    }
