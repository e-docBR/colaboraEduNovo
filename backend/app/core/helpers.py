"""Shared helpers for request parsing and query safety."""
from flask import request


def escape_like(value: str) -> str:
    """Escape LIKE metacharacters (%, _) so they are treated as literals."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def parse_pagination(max_per_page: int = 100, default_per_page: int = 20) -> tuple[int, int]:
    """Parse page/per_page from the current request query string."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(max_per_page, max(1, int(request.args.get("per_page", default_per_page))))
    except (ValueError, TypeError):
        page, per_page = 1, default_per_page
    return page, per_page
