from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    anthropic_api_key: str
    database_url: str = "sqlite+aiosqlite:///./sapientia.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    tutor_model: str = "claude-opus-4-7"
    learner_sim_model: str = "claude-haiku-4-5-20251001"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()