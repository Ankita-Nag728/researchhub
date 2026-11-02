"""Rate limiting (applied to login, register and password reset in Phase 5).

Uses the real client address. Behind a proxy (Render, Vercel rewrite) the proxy
must pass X-Forwarded-For; uvicorn is started with --proxy-headers so the
address is read correctly. In-memory storage is fine for one server process;
use Redis if you ever run several.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
