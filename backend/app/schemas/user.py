from datetime import datetime
from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict,
    model_validator,
    field_validator,
)


class Login(BaseModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize(cls, v):
        return v.lower()


class Register(Login):
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, v):
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @model_validator(mode="after")
    def matching(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords must match")
        return self


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    model_config = ConfigDict(extra="forbid")
    _clean = field_validator("name")(classmethod(lambda cls, v: Register.clean_name(v)))


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
