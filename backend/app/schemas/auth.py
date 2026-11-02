from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.common import Password, text


def _lower_email(v: str) -> str:
    return v.strip().lower()


class RegisterIn(BaseModel):
    full_name: text(2, 120)
    email: EmailStr
    password: Password
    confirm_password: str
    university: text(2, 160)
    department: text(2, 160)
    academic_year: text(1, 40)
    # Only these roles can be chosen publicly. "admin" is impossible here by design.
    role: Literal["student", "researcher"] = "student"

    _email = field_validator("email", mode="after")(_lower_email)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False

    _email = field_validator("email", mode="after")(_lower_email)


class ForgotPasswordIn(BaseModel):
    email: EmailStr

    _email = field_validator("email", mode="after")(_lower_email)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: Password
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self
