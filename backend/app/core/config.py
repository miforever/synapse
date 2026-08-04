from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SYNAPSE_")

    db_path: str = "synapse.db"
    host: str = "127.0.0.1"
    port: int = 8000

    # The canvas is served from its own origin in both dev and Docker.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


settings = Settings()
