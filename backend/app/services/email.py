"""Sends the password-reset email.

- With SMTP_HOST configured, sends a real email.
- In development without SMTP, prints the link to the server console so you can click it.
- In production without SMTP, logs a warning (never the link) so a token can't leak into logs.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_password_reset(to_email: str, link: str) -> None:
    settings = get_settings()
    if settings.smtp_host:
        message = EmailMessage()
        message["Subject"] = "Reset your ResearchHub password"
        message["From"] = settings.smtp_from
        message["To"] = to_email
        message.set_content(
            "Someone asked to reset the password for your ResearchHub account.\n\n"
            f"Choose a new password here (the link works once and expires in 30 minutes):\n{link}\n\n"
            "If this was not you, you can ignore this email."
        )
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.starttls()
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
        except Exception as exc:  # never let an email problem reveal whether the account exists
            logger.error("Could not send password reset email: %s", type(exc).__name__)
    elif settings.environment == "development":
        print(f"\n[DEV ONLY] Password reset link for {to_email}:\n{link}\n", flush=True)
    else:
        logger.warning("Password reset requested but no email provider (SMTP_HOST) is configured.")
