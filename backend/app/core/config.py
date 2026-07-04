"""
Centralized application configuration.

We use pydantic-settings so that:
  1. All config values are validated at startup (fail fast, not later).
  2. Every other file imports one `settings` object instead of scattering
     os.getenv() calls throughout the codebase.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Voice SDK Backend"
    debug: bool = True

    backend_api_key: str

    azure_speech_key: str
    azure_speech_region: str

    database_url: str = "sqlite:///./voice_sdk.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()