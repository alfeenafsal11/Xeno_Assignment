from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    CHANNEL_SERVICE_URL: str = "http://localhost:8001"
    CRM_RECEIPT_URL: str = "http://localhost:8000/api/receipt"
    DEMO_EMAIL: str = "demo@xeno.ai"
    DEMO_PASSWORD: str = "demo123"
    DEMO_SECRET_KEY: str = "xeno-demo-jwt-secret-change-in-prod"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
