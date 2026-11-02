"""Reusable validated types. Every text field is trimmed, stripped of control
characters and length-limited; every URL must be http(s)."""

import math
import re
import unicodedata
from typing import Annotated, Generic, TypeVar
from urllib.parse import urlparse

from fastapi import Path
from pydantic import AfterValidator, BaseModel, ConfigDict, Field

T = TypeVar("T")

MAX_ID = 2_147_483_647  # largest value the database's integer id columns can hold
# Used for ids in URLs and request bodies, so an absurd id is a clean 422, never a database error.
PathId = Annotated[int, Path(ge=1, le=MAX_ID)]
BodyId = Annotated[int, Field(ge=1, le=MAX_ID)]


def strip_controls(value: str) -> str:
    value = unicodedata.normalize("NFC", value)
    return "".join(ch for ch in value if ch in "\n\t" or unicodedata.category(ch)[0] != "C").strip()


def text(min_len: int = 1, max_len: int = 200):
    def check(value: str) -> str:
        value = strip_controls(value)
        if len(value) < min_len:
            raise ValueError("This field is required." if min_len == 1 else f"Must be at least {min_len} characters.")
        if len(value) > max_len:
            raise ValueError(f"Must be at most {max_len} characters.")
        return value

    return Annotated[str, AfterValidator(check)]


def optional_text(max_len: int = 200):
    def check(value: str | None) -> str | None:
        if value is None:
            return None
        value = strip_controls(value)
        if len(value) > max_len:
            raise ValueError(f"Must be at most {max_len} characters.")
        return value or None

    return Annotated[str | None, AfterValidator(check)]


def _url(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    value = strip_controls(value)
    if not value:
        return None
    if len(value) > max_len or re.search(r"\s", value):
        raise ValueError("Enter a valid web address.")
    parts = urlparse(value)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("Enter a valid web address starting with http:// or https://")
    return value


def optional_url(max_len: int = 300):
    return Annotated[str | None, AfterValidator(lambda v: _url(v, max_len))]


def required_url(max_len: int = 500):
    def check(value: str) -> str:
        result = _url(value, max_len)
        if result is None:
            raise ValueError("Enter a valid web address starting with http:// or https://")
        return result

    return Annotated[str, AfterValidator(check)]


def _skills(values: list[str]) -> list[str]:
    cleaned = []
    for item in values:
        item = strip_controls(item)
        if item and len(item) <= 60 and item.lower() not in {c.lower() for c in cleaned}:
            cleaned.append(item)
    if len(cleaned) > 20:
        raise ValueError("Add at most 20 skills.")
    return cleaned


SkillList = Annotated[list[str], AfterValidator(_skills)]


class InputModel(BaseModel):
    """Base for request bodies: unknown fields are rejected (blocks mass-assignment like {"role": "admin"})."""

    model_config = ConfigDict(extra="forbid")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


def make_page(items, total: int, page: int, page_size: int) -> dict:
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": max(1, math.ceil(total / page_size)) if total else 0}


def like_pattern(term: str) -> str:
    """Escapes % and _ so a search for '100%' is literal, not a wildcard."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
