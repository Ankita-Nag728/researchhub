"""Command-line tools:

    python -m app.cli create-admin      (asks for email and password; nothing is hardcoded)
    python -m app.cli seed-demo         (adds clearly-labelled SAMPLE projects and papers)
"""

import getpass
import sys

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select

from app.core.security import hash_password
from app.database.session import get_session_factory
from app.models import User
from app.schemas.user import Password


def create_admin(email: str | None = None, full_name: str | None = None, password: str | None = None) -> User:
    from pydantic import EmailStr

    email = (email or input("Admin email: ")).strip().lower()
    TypeAdapter(EmailStr).validate_python(email)
    full_name = (full_name or input("Full name: ")).strip() or "Administrator"
    if password is None:
        password = getpass.getpass("Password (min 10 characters): ")
        if getpass.getpass("Repeat password: ") != password:
            raise SystemExit("Passwords did not match.")
    try:
        TypeAdapter(Password).validate_python(password)
    except ValidationError as exc:
        raise SystemExit(exc.errors()[0]["msg"])

    with get_session_factory()() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.role, user.password_hash, user.is_active = "admin", hash_password(password), True
            action = "promoted to admin"
        else:
            user = User(full_name=full_name, email=email, password_hash=hash_password(password), role="admin",
                        university="Administration", department="Administration", academic_year="n/a")
            db.add(user)
            action = "created"
        db.commit()
    print(f"Admin account {email} {action}.")
    return user


def main(argv: list[str]) -> None:
    command = argv[0] if argv else ""
    if command == "create-admin":
        create_admin()
    elif command == "seed-demo":
        from app.services.seed import seed_demo

        added = seed_demo()
        print(f"Sample data ready ({added['projects']} projects and {added['papers']} papers added).")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
