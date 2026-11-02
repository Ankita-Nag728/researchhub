"""Logging that never records passwords, tokens or other sensitive values."""

import logging
import re

# Authorization headers carry a scheme word first ("Bearer abc"): hide the scheme AND the credential.
_AUTH_HEADER = re.compile(r"(?i)\b(authorization)(\s*[=:]\s*)(?:\w+\s+)?[^\s,;&'\"]+")
# Anything that looks like  password=...  token: ...  secret ...  gets masked.
_SENSITIVE = re.compile(
    r"(?i)\b(password|passwd|token|secret|cookie|csrf)\b(\s*[=:]\s*)([^\s,;&'\"]+)"
)
# Also hide credentials embedded in URLs: scheme://user:password@host
_URL_CREDENTIALS = re.compile(r"(?i)(\w+(?:\+\w+)?://[^:/\s]+:)([^@\s]+)(@)")


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        message = _AUTH_HEADER.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", message)
        message = _SENSITIVE.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", message)
        message = _URL_CREDENTIALS.sub(r"\1[REDACTED]\3", message)
        record.msg = message
        record.args = ()
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.addFilter(RedactingFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # SQL statements can contain personal data, so only log them when explicitly debugging.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
