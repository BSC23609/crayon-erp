import os

class Settings:
    database_url: str = os.environ.get("DATABASE_URL", "postgresql://postgres@localhost:5432/crayon")
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-only-change-me")
    hub_sso_secret: str = os.environ.get("HUB_SSO_SECRET", "dev-only-hub-secret")
    tally_connector_key: str = os.environ.get("TALLY_CONNECTOR_KEY", "dev-only-tally-key")
    session_hours: int = int(os.environ.get("SESSION_HOURS", "12"))
    cookie_secure: bool = os.environ.get("COOKIE_SECURE", "1") == "1"
    env: str = os.environ.get("APP_ENV", "development")

settings = Settings()
