from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SYNAPSE_")

    db_path: str = "synapse.db"
    host: str = "127.0.0.1"
    port: int = 8000

    # Local embedding model, fetched once and then run offline on CPU.
    # e5 is retrieval-tuned and multilingual, so memories written in any
    # language stay searchable.
    embedding_model: str = "intfloat/multilingual-e5-large"
    embedding_dim: int = 1024

    # The canvas is served from its own origin in both dev and Docker.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


settings = Settings()
