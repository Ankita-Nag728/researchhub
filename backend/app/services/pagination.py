import math

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def paginate(db: Session, stmt: Select, page: int, page_size: int, unique: bool = False) -> tuple[list, int, int]:
    """Returns (rows, total, total_pages) for one page of a query."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.limit(page_size).offset((page - 1) * page_size))
    rows = rows.unique().all() if unique else rows.all()
    return rows, total, max(1, math.ceil(total / page_size)) if total else 1


def like_pattern(term: str) -> str:
    """Makes user text safe for LIKE: % and _ are treated as ordinary characters."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
