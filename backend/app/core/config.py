from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SYNAPSE_")

    db_path: str = "synapse.db"
    host: str = "127.0.0.1"
    port: int = 8000


settings = Settings()
