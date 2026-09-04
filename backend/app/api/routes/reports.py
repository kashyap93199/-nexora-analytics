"""Report endpoints: generate snapshots, list, view, export CSV, delete."""

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.auth.permissions import P_REPORTS_CREATE, P_REPORTS_VIEW
from app.database.db import get_db
from app.models import Notification, OrganizationMember, Report
from app.schemas.common import MessageOut
from app.schemas.engagement import ReportCreate
from app.services import analytics
from app.utils.audit import write_audit

router = APIRouter(prefix="/reports", tags=["reports"])


def _snapshot(db: Session, org_id: int, report_type: str, start, end) -> dict:
    start_date, end_date = start.date(), end.date()
    if report_type == "sales":
        return {"metrics": analytics.sales_metrics(db, org_id, start_date, end_date)}
    if report_type == "revenue":
        return {
            "kpis": analytics.kpis(db, org_id, start_date, end_date),
            "series": analytics.revenue_series(db, org_id, start_date, end_date, "month"),
            "by_category": analytics.revenue_by_category(db, org_id, start_date, end_date),
            "by_source": analytics.revenue_by_source(db, org_id, start_date, end_date),
        }
    if report_type == "customer":
        return {"metrics": analytics.customer_analytics(db, org_id, start_date, end_date)}
    if report_type == "product":
        return {"products": analytics.product_performance(db, org_id, start_date, end_date)}
    # performance
    return {
        "kpis": analytics.kpis(db, org_id, start_date, end_date),
        "top_products": analytics.top_products(db, org_id, start_date, end_date, limit=10),
        "geographic": analytics.geographic_performance(db, org_id, start_date, end_date),
        "customer_metrics": analytics.customer_analytics(db, org_id, start_date, end_date),
    }


@router.get("")
def list_reports(
    type_filter: str | None = Query(None, alias="type"),
    member: OrganizationMember = Depends(require_permission(P_REPORTS_VIEW)),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Report).filter(Report.organization_id == member.organization_id)
    if type_filter:
        query = query.filter(Report.type == type_filter)
    reports = query.order_by(Report.created_at.desc()).limit(100).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "type": r.type,
            "filters": json.loads(r.filters or "{}"),
            "status": r.status,
            "created_at": r.created_at,
            "created_by_name": r.creator.full_name if r.creator else None,
        }
        for r in reports
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    member: OrganizationMember = Depends(require_permission(P_REPORTS_CREATE)),
    db: Session = Depends(get_db),
) -> dict:
    data = _snapshot(db, member.organization_id, payload.type, payload.start_date, payload.end_date)
    filters = {
        "start": payload.start_date.isoformat(),
        "end": payload.end_date.isoformat(),
        **payload.filters,
    }
    report = Report(
        organization_id=member.organization_id,
        created_by=member.user_id,
        name=payload.name,
        type=payload.type,
        filters=json.dumps(filters),
        data=json.dumps(data, default=str),
        status="ready",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    db.add(
        Notification(
            organization_id=member.organization_id,
            user_id=member.user_id,
            title="Report generated",
            message=f"Your {payload.type} report '{payload.name}' is ready.",
            type="report",
        )
    )
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "report.created", "report", report.id)
    return {
        "id": report.id,
        "name": report.name,
        "type": report.type,
        "filters": json.loads(report.filters or "{}"),
        "status": report.status,
        "created_at": report.created_at,
        "created_by_name": member.user.full_name,
    }


@router.get("/{report_id}")
def get_report(
    report_id: int,
    member: OrganizationMember = Depends(require_permission(P_REPORTS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    report = db.query(Report).filter(Report.id == report_id, Report.organization_id == member.organization_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return {
        "id": report.id,
        "name": report.name,
        "type": report.type,
        "filters": json.loads(report.filters or "{}"),
        "status": report.status,
        "created_at": report.created_at,
        "created_by_name": report.creator.full_name if report.creator else None,
        "data": json.loads(report.data or "{}"),
    }


@router.get("/{report_id}/export")
def export_report(report_id: int, member: OrganizationMember = Depends(require_permission(P_REPORTS_CREATE)), db: Session = Depends(get_db)) -> StreamingResponse:
    report = db.query(Report).filter(Report.id == report_id, Report.organization_id == member.organization_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    data = json.loads(report.data or "{}")
    rows: list[dict] = []
    if report.type == "product":
        for p in data.get("products", []):
            rows.append(
                {
                    "Product": p["name"],
                    "Category": p.get("category", ""),
                    "Units Sold": p["units_sold"],
                    "Revenue": p["revenue"],
                    "Profit": p["profit"],
                    "Margin %": p["margin"],
                    "Trend %": p["trend"],
                }
            )
    elif report.type == "revenue":
        for k, v in data.get("kpis", {}).items():
            rows.append({"Metric": k, "Value": v})
        for p in data.get("series", {}).get("points", []):
            rows.append({"Period": p["label"], "Revenue": p["value"], "Orders": p["count"]})
        for c in data.get("by_category", []):
            rows.append({"Category": c["name"], "Revenue": c["value"]})
    elif report.type == "sales":
        for k, v in data.get("metrics", {}).items():
            rows.append({"Metric": k, "Value": v})
    elif report.type == "customer":
        for k, v in data.get("metrics", {}).items():
            rows.append({"Metric": k, "Value": v})
    else:  # performance
        for k, v in data.get("kpis", {}).items():
            rows.append({"Metric": k, "Value": v})
        for p in data.get("top_products", []):
            rows.append({"Top Product": p["name"], "Revenue": p["revenue"], "Units": p["units_sold"]})

    if not rows:
        rows = [{"message": "No data"}]

    # Some report types mix row shapes (e.g. revenue: Metric rows then Period
    # rows). Union all keys so every column appears and no row is dropped.
    fieldnames = []
    for row in rows:
        for key in row.keys():
            if key not in fieldnames:
                fieldnames.append(key)

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    buffer.seek(0)

    filename = f"{report.name.replace(' ', '_')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{report_id}", response_model=MessageOut)
def delete_report(
    report_id: int,
    member: OrganizationMember = Depends(require_permission(P_REPORTS_CREATE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    report = db.query(Report).filter(Report.id == report_id, Report.organization_id == member.organization_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    db.delete(report)
    db.commit()
    return MessageOut(message="Report deleted")