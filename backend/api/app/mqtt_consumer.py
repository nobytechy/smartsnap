"""
Subscribes to Frigate's MQTT events. Hands each `new` event to the rules engine,
which decides whether to write a row + fire alerts.
"""
from __future__ import annotations
import asyncio
import json
import logging
import threading

import paho.mqtt.client as mqtt

from .config import settings
from . import rules_engine

log = logging.getLogger("smartsnap.mqtt")


class FrigateMQTT:
    def __init__(self) -> None:
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="smartsnap-api")
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def start(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        self._loop = loop or asyncio.get_event_loop()
        log.info("connecting to mqtt %s:%s", settings.mqtt_host, settings.mqtt_port)
        try:
            self._client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=60)
        except OSError as e:
            log.warning("mqtt connect failed: %s — running without live events", e)
            return
        self._thread = threading.Thread(target=self._client.loop_forever, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        try:
            self._client.disconnect()
        except Exception:  # noqa: BLE001
            pass

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        log.info("mqtt connected: %s", reason_code)
        client.subscribe("frigate/events")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload)
        except json.JSONDecodeError:
            return
        if msg.topic != "frigate/events":
            return
        if payload.get("type") != "new":
            return
        after = payload.get("after") or {}
        if not after:
            return
        # Hand off to the rules engine on the asyncio loop.
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(rules_engine.evaluate(after), self._loop)
        else:
            log.warning("event arrived but no asyncio loop; dropping")


_mqtt: FrigateMQTT | None = None


def start_mqtt(loop: asyncio.AbstractEventLoop | None = None) -> None:
    global _mqtt
    if _mqtt is None:
        _mqtt = FrigateMQTT()
        _mqtt.start(loop)


def stop_mqtt() -> None:
    global _mqtt
    if _mqtt is not None:
        _mqtt.stop()
        _mqtt = None
