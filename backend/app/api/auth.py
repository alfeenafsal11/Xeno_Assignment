from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["auth"])
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(payload: LoginRequest):
    if payload.email != settings.DEMO_EMAIL or payload.password != settings.DEMO_PASSWORD:
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode(
        {"sub": payload.email, "type": "demo"},
        settings.DEMO_SECRET_KEY,
        algorithm="HS256",
    )
    return {"access_token": token, "token_type": "bearer"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.DEMO_SECRET_KEY,
            algorithms=["HS256"],
        )
        return payload.get("sub", "demo_user")
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
