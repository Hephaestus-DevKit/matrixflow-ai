import os


def env_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


MAX_FILE_BYTES = env_int("SIDECAR_MAX_FILE_BYTES", 20 * 1024 * 1024)
MAX_EXTRACTED_CHARS = env_int("SIDECAR_MAX_EXTRACTED_CHARS", 5_000_000)
MAX_PDF_PAGES = env_int("SIDECAR_MAX_PDF_PAGES", 1_000)
MAX_DOCX_FILES = env_int("SIDECAR_MAX_DOCX_FILES", 10_000)
MAX_DOCX_UNCOMPRESSED_BYTES = env_int("SIDECAR_MAX_DOCX_UNCOMPRESSED_BYTES", 100 * 1024 * 1024)
MAX_CHUNKS = env_int("SIDECAR_MAX_CHUNKS", 10_000)
