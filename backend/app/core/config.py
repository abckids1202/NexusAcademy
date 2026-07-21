from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://nexus:nexus_dev_password@localhost:5432/nexus"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret"
    frontend_origin: str = "http://localhost:5173"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    ai_provider: str = "deterministic"

    class Config:
        env_file = ".env"

settings = Settings()

