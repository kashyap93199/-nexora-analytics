"""Small SQLAlchemy query helpers shared across routes."""

from sqlalchemy.sql.elements import ColumnElement

_LIKE_ESCAPE = "\\"


def like_pattern(term: str) -> str:
    """Build a `%term%` pattern with LIKE metacharacters (`%`, `_`, `\\`) escaped.

    Without this, searching for `_` or `%` matches every row and a user can
    probe data via wildcard patterns.
    """
    escaped = (
        term.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", _LIKE_ESCAPE + "%")
        .replace("_", _LIKE_ESCAPE + "_")
    )
    return f"%{escaped}%"


def icontains(column: ColumnElement, term: str) -> ColumnElement:
    """Case-insensitive "contains" match with properly escaped wildcards."""
    return column.ilike(like_pattern(term), escape=_LIKE_ESCAPE)
