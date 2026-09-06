"""Shared helpers for streaming CSV downloads."""

import csv
import io
import re
from collections.abc import Iterable

from fastapi.responses import StreamingResponse

# Cells starting with these characters are interpreted as formulas by Excel /
# Sheets ("CSV injection"). Prefix them with a quote so they render as text.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value: object) -> object:
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def safe_filename(name: str, fallback: str = "export") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    return cleaned or fallback


def csv_response(rows: Iterable[dict], fieldnames: list[str], filename: str) -> StreamingResponse:
    """Build a text/csv attachment from dict rows (keys not in fieldnames are ignored)."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({k: safe_cell(v) for k, v in row.items()})
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename(filename)}.csv"'},
    )
