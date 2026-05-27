"""
Downloads YouTube videos into the uploads volume so Frigate can ingest them
as a local file. Caches by video ID — re-saving a camera with the same URL
won't re-download.

Used by frigate_config when a camera's source_kind == 'youtube'.
"""
from __future__ import annotations
import asyncio
import logging
import re
from pathlib import Path

import yt_dlp

log = logging.getLogger("smartsnap.youtube")

UPLOADS_DIR = Path("/media/frigate/uploads")

_VIDEO_ID_RE = re.compile(
    r"(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})"
)


def video_id(url: str) -> str | None:
    m = _VIDEO_ID_RE.search(url or "")
    return m.group(1) if m else None


def _existing_for_id(vid: str) -> Path | None:
    if not UPLOADS_DIR.exists():
        return None
    for f in UPLOADS_DIR.iterdir():
        if f.is_file() and f.stem == f"yt_{vid}":
            return f
    return None


def _download_sync(url: str) -> Path:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    vid = video_id(url) or "unknown"
    cached = _existing_for_id(vid)
    if cached:
        log.info("youtube cache hit: %s -> %s", vid, cached)
        return cached

    out_template = str(UPLOADS_DIR / f"yt_{vid}.%(ext)s")
    opts = {
        "outtmpl": out_template,
        # Cap at 720p mp4 — Frigate downscales to detect-resolution anyway.
        "format": "best[ext=mp4][height<=720]/best[height<=720]/best[ext=mp4]/best",
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "retries": 3,
        "fragment_retries": 3,
        "socket_timeout": 30,
    }
    log.info("youtube download starting: %s", url)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    final = _existing_for_id(vid)
    if final is None:
        # Fall back: extractor may have used a different ext template.
        candidate = UPLOADS_DIR / f"yt_{vid}.mp4"
        if candidate.exists():
            final = candidate
    if final is None:
        raise FileNotFoundError(f"yt-dlp finished but no file matches yt_{vid}.*")
    log.info("youtube download done: %s (%.1f MB)", final, final.stat().st_size / 1_048_576)
    return final


async def ensure_local(url: str, timeout: float = 180.0) -> Path:
    """
    Async wrapper: returns the local path for a YouTube URL, downloading if needed.
    Runs yt-dlp on a worker thread so we don't block the event loop.
    """
    return await asyncio.wait_for(asyncio.to_thread(_download_sync, url), timeout=timeout)
