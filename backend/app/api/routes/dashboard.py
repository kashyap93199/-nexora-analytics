"""Dashboard overview endpoint."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.auth.permissions import P_DASHBOARD_VIEW
from app.database.db import get_db
from app.models import OrganizationMember
from app.services import analytics

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _default_range() -> tuple[date, date]:
    end = date.today()
    start = end - timedelta(days=29)
    return start, end


def _interval_for(start: date, end: date) -> str:
    days = (end - start).days + 1
    if days <= 45:
        return "day"
    if days <= 180:
        return "week"
    if days <= 3 * 366:
        return "month"
    return "year"


@router.get("/overview")
def overview(
    start: date | None = Query(None),
    end: date | None = Query(None),
    member: OrganizationMember = Depends(require_permission(P_DASHBOARD_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    org_id = member.organization_id
    if start is None or end is None:
        start, end = _default_range()
    if start > end:
        start, end = end, start

    # Pick a chart granularity that suits the range so a 7-day view is not
    # collapsed into a single "month" bucket and a 2-year view is not 700 points.
    interval = _interval_for(start, end)
    kpis = analytics.kpis(db, org_id, start, end)
    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "interval": interval},
        "kpis": kpis,
        "revenue_series": analytics.revenue_series(db, org_id, start, end, interval),
        "sales_series": analytics.sales_series(db, org_id, start, end, interval),
        "customer_series": analytics.customer_series(db, org_id, start, end, interval),
        "revenue_by_category": analytics.revenue_by_category(db, org_id, start, end),
        "revenue_by_source": analytics.revenue_by_source(db, org_id, start, end),
        "geographic": analytics.geographic_performance(db, org_id, start, end),
        "top_products": analytics.top_products(db, org_id, start, end, limit=5),
        "recent_orders": analytics.recent_orders(db, org_id, limit=8),
        "low_stock": analytics.low_stock_products(db, org_id, limit=5),
    }