"""Analytics endpoints: revenue, sales, customers, products, categories, geo."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.auth.permissions import P_ANALYTICS_VIEW, P_SALES_VIEW
from app.database.db import get_db
from app.models import OrganizationMember
from app.services import analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _default_range() -> tuple[date, date]:
    end = date.today()
    return end - timedelta(days=29), end


def _range(start: date | None, end: date | None) -> tuple[date, date]:
    if start is None or end is None:
        return _default_range()
    return (start, end) if start <= end else (end, start)


@router.get("/revenue")
def revenue(
    start: date | None = Query(None),
    end: date | None = Query(None),
    interval: str = Query("month", pattern="^(day|week|month|year)$"),
    member: OrganizationMember = Depends(require_permission(P_ANALYTICS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    start, end = _range(start, end)
    return analytics.revenue_series(db, member.organization_id, start, end, interval)


@router.get("/sales")
def sales(
    start: date | None = Query(None),
    end: date | None = Query(None),
    interval: str = Query("month", pattern="^(day|week|month|year)$"),
    region: str | None = Query(None),
    channel: str | None = Query(None),
    product_id: int | None = Query(None),
    category_id: int | None = Query(None),
    member: OrganizationMember = Depends(require_permission(P_SALES_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    start, end = _range(start, end)
    metrics = analytics.sales_metrics(
        db, member.organization_id, start, end, region, channel, product_id, category_id
    )
    series = analytics.sales_series(
        db, member.organization_id, start, end, interval, region, channel, product_id, category_id
    )
    return {"metrics": metrics, "series": series}


@router.get("/customers")
def customers(
    start: date | None = Query(None),
    end: date | None = Query(None),
    interval: str = Query("month", pattern="^(day|week|month|year)$"),
    member: OrganizationMember = Depends(require_permission(P_ANALYTICS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    start, end = _range(start, end)
    return {
        "metrics": analytics.customer_analytics(db, member.organization_id, start, end),
        "series": analytics.customer_series(db, member.organization_id, start, end, interval),
    }


@router.get("/products")
def products(
    start: date | None = Query(None),
    end: date | None = Query(None),
    category_id: int | None = Query(None),
    member: OrganizationMember = Depends(require_permission(P_ANALYTICS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    start, end = _range(start, end)
    return {
        "performance": analytics.product_performance(db, member.organization_id, start, end, category_id),
        "best_sellers": analytics.top_products(db, member.organization_id, start, end, limit=5),
    }


@router.get("/categories")
def categories(
    start: date | None = Query(None),
    end: date | None = Query(None),
    member: OrganizationMember = Depends(require_permission(P_ANALYTICS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    start, end = _range(start, end)
    return {"by_category": analytics.revenue_by_category(db, member.organization_id, start, end)}


@router.get("/geographic")
def geographic(
    start: date | None = Query(None),
    end: date | None = Query(None),
    member: OrganizationMember = Depends(require_permission(P_ANALYTICS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    start, end = _range(start, end)
    return {"regions": analytics.geographic_performance(db, member.organization_id, start, end)}