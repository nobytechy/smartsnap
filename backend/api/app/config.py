from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = ""
    supabase_service_key: str = ""
    mqtt_host: str = "mosquitto"
    mqtt_port: int = 1883
    frigate_url: str = "http://frigate:5000"
    ultramsg_instance_id: str = ""
    ultramsg_token: str = ""
    anthropic_api_key: str = ""


settings = Settings()
