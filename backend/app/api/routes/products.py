"""Product and category CRUD endpoints (organization-scoped)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import pagination_params, require_permission
from app.auth.permissions import P_PRODUCTS_MANAGE, P_PRODUCTS_VIEW, P_SALES_EXPORT
from app.database.db import get_db
from app.models import Category, OrganizationMember, Product
from app.schemas.catalog import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.schemas.common import MessageOut, Page
from app.utils.audit import write_audit
from app.utils.csv_export import csv_response
from app.utils.query import icontains

router = APIRouter(prefix="/products", tags=["products"])
categories_router = APIRouter(prefix="/categories", tags=["categories"])


def _get_product(db: Session, org_id: int, product_id: int) -> Product:
    product = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id == product_id, Product.organization_id == org_id)
        .first()
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def _to_out(product: Product) -> ProductOut:
    out = ProductOut.model_validate(product)
    out.category_name = product.category.name if product.category else None
    return out


def _assert_sku_available(db: Session, org_id: int, sku: str, exclude_id: int | None = None) -> None:
    """SKUs identify products within an organization; reject duplicates early (409)."""
    query = db.query(Product.id).filter(Product.organization_id == org_id, func.lower(Product.sku) == sku.lower())
    if exclude_id is not None:
        query = query.filter(Product.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"A product with SKU '{sku}' already exists")


def _assert_category_in_org(db: Session, org_id: int, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found in your organization")
    return category


@router.get("/export")
def export_products(
    search: str | None = Query(None, max_length=120),
    category_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status", pattern="^(active|draft|archived)$"),
    member: OrganizationMember = Depends(require_permission(P_SALES_EXPORT)),
    db: Session = Depends(get_db),
):
    """Download the catalog (with inventory value) as CSV."""
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.organization_id == member.organization_id)
    if search:
        query = query.filter(or_(icontains(Product.name, search), icontains(Product.sku, search)))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if status_filter:
        query = query.filter(Product.status == status_filter)
    products = query.order_by(Product.name.asc(), Product.id.asc()).limit(10_000).all()
    rows = [
        {
            "SKU": p.sku,
            "Product": p.name,
            "Category": p.category.name if p.category else "",
            "Status": p.status,
            "Price": float(p.price),
            "Cost": float(p.cost),
            "Margin %": round((float(p.price) - float(p.cost)) / float(p.price) * 100, 1) if float(p.price) else 0.0,
            "Stock": p.stock,
            "Inventory value": round(float(p.cost) * p.stock, 2),
        }
        for p in products
    ]
    fieldnames = ["SKU", "Product", "Category", "Status", "Price", "Cost", "Margin %", "Stock", "Inventory value"]
    write_audit(db, member.organization_id, member.user_id, "products.exported", "product", None, {"rows": len(rows)})
    return csv_response(rows, fieldnames, "products")


@router.get("", response_model=Page[ProductOut])
def list_products(
    search: str | None = Query(None, max_length=120),
    category_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status", pattern="^(active|draft|archived)$"),
    sort: str = Query("name", pattern="^(name|price|stock|created_at)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    pagination: tuple[int, int] = Depends(pagination_params),
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_VIEW)),
    db: Session = Depends(get_db),
) -> Page[ProductOut]:
    page, page_size = pagination
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.organization_id == member.organization_id)
    if search:
        query = query.filter(or_(icontains(Product.name, search), icontains(Product.sku, search)))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if status_filter:
        query = query.filter(Product.status == status_filter)

    total = query.count()
    sort_col = getattr(Product, sort)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc(), Product.id.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return Page(
        items=[_to_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_MANAGE)),
    db: Session = Depends(get_db),
) -> ProductOut:
    if payload.category_id:
        _assert_category_in_org(db, member.organization_id, payload.category_id)
    _assert_sku_available(db, member.organization_id, payload.sku)
    product = Product(organization_id=member.organization_id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    write_audit(db, member.organization_id, member.user_id, "product.created", "product", product.id)
    return _to_out(product)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_VIEW)),
    db: Session = Depends(get_db),
) -> ProductOut:
    return _to_out(_get_product(db, member.organization_id, product_id))


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_MANAGE)),
    db: Session = Depends(get_db),
) -> ProductOut:
    product = _get_product(db, member.organization_id, product_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("category_id") is not None:
        _assert_category_in_org(db, member.organization_id, data["category_id"])
    if data.get("sku"):
        _assert_sku_available(db, member.organization_id, data["sku"], exclude_id=product.id)
    for key, value in data.items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    write_audit(db, member.organization_id, member.user_id, "product.updated", "product", product.id)
    return _to_out(product)


@router.delete("/{product_id}", response_model=MessageOut)
def delete_product(
    product_id: int,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_MANAGE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    product = _get_product(db, member.organization_id, product_id)
    name, sku = product.name, product.sku
    db.delete(product)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "product.deleted", "product", product_id, {"name": name, "sku": sku})
    return MessageOut(message="Product deleted")


# Categories ------------------------------------------------------------------


@categories_router.get("", response_model=list[CategoryOut])
def list_categories(
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_VIEW)),
    db: Session = Depends(get_db),
) -> list[CategoryOut]:
    return (
        db.query(Category)
        .filter(Category.organization_id == member.organization_id)
        .order_by(Category.name.asc())
        .all()
    )


@categories_router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_MANAGE)),
    db: Session = Depends(get_db),
) -> CategoryOut:
    duplicate = (
        db.query(Category.id)
        .filter(Category.organization_id == member.organization_id, func.lower(Category.name) == payload.name.lower())
        .first()
    )
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"A category named '{payload.name}' already exists")
    category = Category(organization_id=member.organization_id, **payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    write_audit(db, member.organization_id, member.user_id, "category.created", "category", category.id)
    return category


@categories_router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_MANAGE)),
    db: Session = Depends(get_db),
) -> CategoryOut:
    category = db.get(Category, category_id)
    if category is None or category.organization_id != member.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


@categories_router.delete("/{category_id}", response_model=MessageOut)
def delete_category(
    category_id: int,
    member: OrganizationMember = Depends(require_permission(P_PRODUCTS_MANAGE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    category = db.get(Category, category_id)
    if category is None or category.organization_id != member.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    db.delete(category)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "category.deleted", "category", category_id)
    return MessageOut(message="Category deleted")