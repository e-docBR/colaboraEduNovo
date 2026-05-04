"""Application settings loaded via pydantic-settings."""
from functools import lru_cache
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = Field(default="development", alias="FLASK_ENV")
    secret_key: str = Field(default="dev-key", alias="SECRET_KEY")
    jwt_secret_key: str = Field(default="dev-jwt", alias="JWT_SECRET_KEY")
    database_url: str = Field(default="sqlite:///../data/boletins.db", alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    allowed_origins: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"], alias="ALLOWED_ORIGINS")
    upload_folder: str = Field(default="../data/uploads", alias="UPLOAD_FOLDER")
    max_upload_size_mb: int = Field(default=20, alias="MAX_UPLOAD_SIZE_MB")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    flask_debug: bool = Field(default=False, alias="FLASK_DEBUG")
    
    # SMTP Settings
    smtp_server: str = Field(default="smtp.gmail.com", alias="SMTP_SERVER")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")   # STARTTLS — porta 587
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")  # SSL direto — porta 465
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="suporte@colaboraedu.com", alias="SMTP_FROM")

    # WhatsApp Settings (Webhook/Evolution API)
    whatsapp_api_url: str = Field(default="", alias="WHATSAPP_API_URL")
    whatsapp_api_token: str = Field(default="", alias="WHATSAPP_API_TOKEN")
    whatsapp_instance: str = Field(default="", alias="WHATSAPP_INSTANCE")
    # Error monitoring
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")

    # Commercial Settings
    commercial_mode: str = Field(default="saas", alias="COMMERCIAL_MODE") # saas or dedicated
    enable_registration: bool = Field(default=True, alias="ENABLE_REGISTRATION")
    brand_name: str = Field(default="ColaboraEdu", alias="BRAND_NAME")
    frontend_url: str = Field(default="http://localhost:5173", alias="FRONTEND_URL")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "populate_by_name": True,
        "extra": "ignore"
    }

    @model_validator(mode='after')
    def validate_production_secrets(self) -> 'Settings':
        if self.environment == "production":
            if self.secret_key in ("dev-key", "") or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY insegura para produção")
            if self.jwt_secret_key in ("dev-jwt", "") or len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY insegura para produção")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
