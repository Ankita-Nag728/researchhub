from datetime import datetime
from typing import Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, StringConstraints, computed_field, model_validator
from typing import Annotated

from app.schemas.common import InputModel, SkillList, optional_text, optional_url, text

_COMMON_PASSWORDS = {
    "password123", "1234567890", "qwertyuiop", "password1234", "iloveyou123", "letmein1234",
    "admin12345", "welcome1234", "0123456789", "passwordpassword",
}


def _check_password(value: str) -> str:
    if not value.strip():
        raise ValueError("Password cannot be blank.")
    if value.lower() in _COMMON_PASSWORDS or len(set(value)) < 4:
        raise ValueError("That password is too easy to guess. Choose something longer or less predictable.")
    return value


# Length matters more than character mix; 10 to 128 characters.
Password = Annotated[str, StringConstraints(min_length=10, max_length=128), AfterValidator(_check_password)]


class RegisterIn(InputModel):
    full_name: text(2, 120)
    email: EmailStr
    password: Password
    confirm_password: str
    university: text(2, 160)
    department: text(2, 160)
    academic_year: text(1, 40)
    # Only public roles are accepted. "admin" fails validation, so it cannot be self-assigned.
    role: Literal["student", "researcher"] = "student"

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class LoginIn(InputModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    remember_me: bool = False


class ForgotPasswordIn(InputModel):
    email: EmailStr


class ResetPasswordIn(InputModel):
    token: Annotated[str, StringConstraints(min_length=20, max_length=200)]
    new_password: Password


class ChangePasswordIn(InputModel):
    current_password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    new_password: Password


class ProfileUpdateIn(InputModel):
    full_name: text(2, 120)
    university: text(2, 160)
    department: text(2, 160)
    academic_year: text(1, 40)
    bio: optional_text(1000) = None
    skills: SkillList = []
    github_url: optional_url(300) = None
    linkedin_url: optional_url(300) = None


class UserOut(BaseModel):
    """What the API may reveal about a user. There is no password_hash field, so it can never leak."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    university: str | None
    department: str | None
    academic_year: str | None
    bio: str | None
    skills: list[str]
    github_url: str | None
    linkedin_url: str | None
    role: str
    created_at: datetime

    @computed_field
    @property
    def profile_completion(self) -> int:
        checks = [self.university, self.department, self.academic_year, self.bio, self.skills, self.github_url or self.linkedin_url]
        return round(100 * sum(1 for c in checks if c) / len(checks))


class AdminUserOut(UserOut):
    is_active: bool
