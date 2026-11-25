import base64
import hashlib
import os
import uuid
from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, UploadFile, status

from app.config import settings

VAULT_MAGIC = b"PGIV1"
CHUNK_SIZE = 1024 * 1024  # 1 MB chunked streaming encryption/decryption

CBCT_EXTENSIONS = {"dcm", "dicom", "nii", "nii.gz", "zip", "rar", "glb", "stl", "obj"}
BLOCKED_EXTENSIONS = {
    "exe", "sh", "bat", "cmd", "ps1", "html", "htm", "js", "mjs", "svg", "php", "py", "pl", "rb", "dll", "so", "msi",
}
ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff",
    "pdf",
    "dcm", "dicom", "nii", "nii.gz", "zip", "rar", "glb", "stl", "obj",
}

EXTENSION_MIME_MAP = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "pdf": "application/pdf",
    "dcm": "application/dicom",
    "dicom": "application/dicom",
    "nii": "application/octet-stream",
    "nii.gz": "application/gzip",
    "zip": "application/zip",
    "rar": "application/vnd.rar",
    "glb": "model/gltf-binary",
    "stl": "model/stl",
    "obj": "model/obj",
}


@dataclass(slots=True)
class StoredFileResult:
    storage_key: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    is_encrypted: bool
    encryption_iv: str
    sha256_checksum: str


def _extract_extension(filename: str) -> str:
    """Extract normalized extension, supporting compound .nii.gz."""
    clean_name = Path(filename).name.strip().lower()
    if not clean_name or "." not in clean_name:
        return ""
    if clean_name.endswith(".nii.gz"):
        return "nii.gz"
    return clean_name.rsplit(".", 1)[-1]


def _validate_extension(filename: str) -> str:
    if not filename or not filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_FILENAME", "message": "Uploaded file must have a valid filename."},
        )

    ext = _extract_extension(filename)
    if ext in BLOCKED_EXTENSIONS or any(
        filename.lower().strip().endswith(f".{blocked}") for blocked in BLOCKED_EXTENSIONS
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "BLOCKED_FILE_TYPE",
                "message": f"Executable or active script file type '.{ext}' is strictly blocked.",
            },
        )

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_EXTENSION",
                "message": f"File extension '.{ext}' is not supported. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
            },
        )
    return ext


def _validate_magic_bytes(header: bytes, ext: str) -> None:
    """Validate file header magic bytes to prevent extension spoofing and active payload uploads."""
    if not header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "Uploaded file is empty."},
        )

    # Reject dangerous executable/script/HTML signatures regardless of extension
    trimmed_lower = header[:512].lstrip().lower()
    dangerous_prefixes = (
        b"mz",
        b"\x7felf",
        b"#!",
        b"<!doctype",
        b"<html",
        b"<script",
        b"<svg",
        b"<?php",
    )
    if header.startswith((b"MZ", b"\x7fELF", b"#!")) or any(
        trimmed_lower.startswith(sig) for sig in dangerous_prefixes
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DANGEROUS_CONTENT", "message": "Disallowed executable or active markup detected."},
        )

    valid = False
    if ext == "png":
        valid = header.startswith(b"\x89PNG\r\n\x1a\n")
    elif ext in {"jpg", "jpeg"}:
        valid = header.startswith(b"\xff\xd8\xff")
    elif ext == "webp":
        valid = len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    elif ext == "bmp":
        valid = header.startswith(b"BM")
    elif ext in {"tif", "tiff"}:
        valid = header.startswith((b"II*\x00", b"MM\x00*"))
    elif ext == "pdf":
        valid = header.lstrip().startswith(b"%PDF")
    elif ext in {"dcm", "dicom"}:
        valid = len(header) >= 132 and header[128:132] == b"DICM"
    elif ext == "zip":
        valid = header.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"))
    elif ext == "rar":
        valid = header.startswith(b"Rar!\x1a\x07")
    elif ext == "nii.gz":
        valid = header.startswith(b"\x1f\x8b")
    elif ext == "nii":
        valid = len(header) >= 348 and (
            header[:4] in (b"\x5c\x01\x00\x00", b"\x00\x00\x01\x5c", b"\x1c\x02\x00\x00", b"\x00\x00\x02\x1c")
            or header[344:348] in (b"ni1\x00", b"n+1\x00", b"n+2\x00")
        )
    elif ext == "glb":
        valid = header.startswith(b"glTF")
    elif ext == "stl":
        valid = trimmed_lower.startswith(b"solid ") or len(header) >= 84
    elif ext == "obj":
        try:
            sample = header[:2048].decode("utf-8")
            valid = "<script" not in sample.lower() and "<html" not in sample.lower()
        except UnicodeDecodeError:
            valid = False

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_MAGIC_BYTES",
                "message": f"File content signature does not match '.{ext}' format.",
            },
        )


def _max_bytes_for(ext: str, document_type: str) -> int:
    if document_type == "cbct" or ext in CBCT_EXTENSIONS:
        return settings.MAX_CBCT_SIZE_MB * 1024 * 1024
    return settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _load_or_create_aes_key(vault_dir: Path) -> bytes:
    """Resolve 32-byte AES-256 key from FILE_ENCRYPTION_KEY or persistent local dev .vault.key."""
    configured = (settings.FILE_ENCRYPTION_KEY or "").strip()
    if configured:
        # 64-char hex key
        if len(configured) == 64:
            try:
                raw = bytes.fromhex(configured)
                if len(raw) == 32:
                    return raw
            except ValueError:
                pass
        # Base64 key
        try:
            decoded = base64.urlsafe_b64decode(configured + "=" * (-len(configured) % 4))
            if len(decoded) == 32:
                return decoded
        except Exception:
            pass
        # Derive 32-byte key from passphrase
        return hashlib.sha256(configured.encode("utf-8")).digest()

    # Auto-generated local dev key persisted in uploads/.vault.key
    key_file = vault_dir.parent / ".vault.key"
    if key_file.exists():
        raw_hex = key_file.read_text(encoding="utf-8").strip()
        return bytes.fromhex(raw_hex)

    key_file.parent.mkdir(parents=True, exist_ok=True)
    new_key = os.urandom(32)
    key_file.write_text(new_key.hex(), encoding="utf-8")
    try:
        os.chmod(key_file, 0o600)
    except OSError:
        pass
    return new_key


def _chunk_nonce(base_nonce: bytes, idx: int) -> bytes:
    return hashlib.sha256(base_nonce + idx.to_bytes(8, "big")).digest()[:12]


class StorageBackend(ABC):
    """Abstract encrypted file vault interface supporting local AES-256-GCM and S3-compatible backends."""

    @abstractmethod
    async def save_encrypted_upload(
        self,
        patient_id: int,
        file: UploadFile,
        document_type: str = "other",
    ) -> StoredFileResult:
        """Validate, encrypt, and persist an uploaded file stream."""

    @abstractmethod
    def save_encrypted_bytes(
        self,
        patient_id: int,
        filename: str,
        raw_bytes: bytes,
        mime_type: str | None = None,
        document_type: str = "other",
    ) -> StoredFileResult:
        """Validate, encrypt, and persist raw bytes."""

    @abstractmethod
    def iter_decrypted_chunks(self, storage_key: str) -> Iterator[bytes]:
        """Yield decrypted plaintext chunks for streaming responses."""

    @abstractmethod
    def read_decrypted_bytes(self, storage_key: str) -> bytes:
        """Read and decrypt full file contents."""

    @abstractmethod
    def delete_object(self, storage_key: str) -> bool:
        """Delete an encrypted object by storage key."""


class LocalEncryptedStorageBackend(StorageBackend):
    """Local disk AES-256-GCM chunked streaming vault stored under backend/uploads/vault/{patient_id}/{uuid}.enc."""

    def __init__(self, vault_dir: str | Path | None = None):
        self.vault_dir = Path(vault_dir or settings.VAULT_DIR).resolve()
        self.vault_dir.mkdir(parents=True, exist_ok=True)
        self._key = _load_or_create_aes_key(self.vault_dir)
        self._aesgcm = AESGCM(self._key)

    def _resolve_key_path(self, storage_key: str) -> Path:
        if not storage_key or storage_key.startswith("/") or ".." in Path(storage_key).parts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_STORAGE_KEY", "message": "Invalid storage key."},
            )
        target = (self.vault_dir / storage_key).resolve()
        if not target.is_relative_to(self.vault_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PATH_TRAVERSAL_DETECTED", "message": "Access denied."},
            )
        return target

    async def save_encrypted_upload(
        self,
        patient_id: int,
        file: UploadFile,
        document_type: str = "other",
    ) -> StoredFileResult:
        ext = _validate_extension(file.filename or "")
        max_bytes = _max_bytes_for(ext, document_type)
        resolved_mime = EXTENSION_MIME_MAP.get(ext, file.content_type or "application/octet-stream")

        storage_key = f"{patient_id}/{uuid.uuid4().hex}.enc"
        dest = self._resolve_key_path(storage_key)
        dest.parent.mkdir(parents=True, exist_ok=True)

        base_nonce = os.urandom(12)
        sha256 = hashlib.sha256()
        total_size = 0
        chunk_idx = 0

        try:
            with open(dest, "wb") as out_f:
                out_f.write(VAULT_MAGIC)
                out_f.write(base_nonce)

                while True:
                    chunk = await file.read(CHUNK_SIZE)
                    if not chunk:
                        break

                    if chunk_idx == 0:
                        _validate_magic_bytes(chunk, ext)

                    total_size += len(chunk)
                    if total_size > max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                            detail={
                                "code": "FILE_TOO_LARGE",
                                "message": f"File exceeds maximum allowed size of {max_bytes // (1024 * 1024)} MB.",
                            },
                        )

                    sha256.update(chunk)
                    nonce = _chunk_nonce(base_nonce, chunk_idx)
                    aad = chunk_idx.to_bytes(8, "big")
                    ct = self._aesgcm.encrypt(nonce, chunk, aad)
                    out_f.write(len(ct).to_bytes(4, "big"))
                    out_f.write(ct)
                    chunk_idx += 1

            if total_size == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "EMPTY_FILE", "message": "Uploaded file cannot be empty."},
                )
        except Exception:
            if dest.exists():
                dest.unlink()
            raise

        return StoredFileResult(
            storage_key=storage_key,
            original_filename=Path(file.filename or f"upload.{ext}").name,
            mime_type=resolved_mime,
            file_size_bytes=total_size,
            is_encrypted=True,
            encryption_iv=base_nonce.hex(),
            sha256_checksum=sha256.hexdigest(),
        )

    def save_encrypted_bytes(
        self,
        patient_id: int,
        filename: str,
        raw_bytes: bytes,
        mime_type: str | None = None,
        document_type: str = "other",
    ) -> StoredFileResult:
        ext = _validate_extension(filename)
        max_bytes = _max_bytes_for(ext, document_type)
        if len(raw_bytes) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File exceeds maximum allowed size of {max_bytes // (1024 * 1024)} MB.",
                },
            )
        _validate_magic_bytes(raw_bytes[:2048], ext)

        resolved_mime = mime_type or EXTENSION_MIME_MAP.get(ext, "application/octet-stream")
        storage_key = f"{patient_id}/{uuid.uuid4().hex}.enc"
        dest = self._resolve_key_path(storage_key)
        dest.parent.mkdir(parents=True, exist_ok=True)

        base_nonce = os.urandom(12)
        sha256 = hashlib.sha256(raw_bytes).hexdigest()

        try:
            with open(dest, "wb") as out_f:
                out_f.write(VAULT_MAGIC)
                out_f.write(base_nonce)

                offset = 0
                chunk_idx = 0
                while offset < len(raw_bytes):
                    chunk = raw_bytes[offset : offset + CHUNK_SIZE]
                    nonce = _chunk_nonce(base_nonce, chunk_idx)
                    aad = chunk_idx.to_bytes(8, "big")
                    ct = self._aesgcm.encrypt(nonce, chunk, aad)
                    out_f.write(len(ct).to_bytes(4, "big"))
                    out_f.write(ct)
                    offset += len(chunk)
                    chunk_idx += 1
        except Exception:
            if dest.exists():
                dest.unlink()
            raise

        return StoredFileResult(
            storage_key=storage_key,
            original_filename=Path(filename).name,
            mime_type=resolved_mime,
            file_size_bytes=len(raw_bytes),
            is_encrypted=True,
            encryption_iv=base_nonce.hex(),
            sha256_checksum=sha256,
        )

    def iter_decrypted_chunks(self, storage_key: str) -> Iterator[bytes]:
        target = self._resolve_key_path(storage_key)
        if not target.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "FILE_NOT_FOUND", "message": "Requested encrypted file was not found in vault."},
            )

        with open(target, "rb") as in_f:
            magic = in_f.read(len(VAULT_MAGIC))
            if magic != VAULT_MAGIC:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "CORRUPTED_VAULT_FILE", "message": "Vault file header is invalid."},
                )
            base_nonce = in_f.read(12)
            if len(base_nonce) != 12:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "CORRUPTED_VAULT_FILE", "message": "Vault nonce header is truncated."},
                )

            chunk_idx = 0
            while True:
                len_bytes = in_f.read(4)
                if not len_bytes:
                    break
                if len(len_bytes) != 4:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail={"code": "CORRUPTED_VAULT_FILE", "message": "Vault chunk length prefix truncated."},
                    )
                ct_len = int.from_bytes(len_bytes, "big")
                ct = in_f.read(ct_len)
                if len(ct) != ct_len:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail={"code": "CORRUPTED_VAULT_FILE", "message": "Vault ciphertext chunk truncated."},
                    )
                nonce = _chunk_nonce(base_nonce, chunk_idx)
                aad = chunk_idx.to_bytes(8, "big")
                yield self._aesgcm.decrypt(nonce, ct, aad)
                chunk_idx += 1

    def read_decrypted_bytes(self, storage_key: str) -> bytes:
        return b"".join(self.iter_decrypted_chunks(storage_key))

    def delete_object(self, storage_key: str) -> bool:
        try:
            target = self._resolve_key_path(storage_key)
            if target.exists():
                target.unlink()
                return True
        except Exception:
            pass
        return False


class S3StorageBackend(StorageBackend):
    """
    Production S3 / MinIO storage hook (STORAGE_TYPE=s3).
    Retains the exact same StorageBackend interface and relative storage_key format.
    """

    def __init__(self):
        if not settings.S3_BUCKET:
            raise RuntimeError("STORAGE_TYPE=s3 requires S3_BUCKET configuration in environment.")
        self.bucket = settings.S3_BUCKET
        self.region = settings.S3_REGION
        self.endpoint_url = settings.S3_ENDPOINT_URL or None

    def _not_configured(self):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "code": "S3_CLIENT_REQUIRED",
                "message": "Install boto3 and configure S3 credentials to enable S3StorageBackend.",
            },
        )

    async def save_encrypted_upload(
        self,
        patient_id: int,
        file: UploadFile,
        document_type: str = "other",
    ) -> StoredFileResult:
        _validate_extension(file.filename or "")
        self._not_configured()

    def save_encrypted_bytes(
        self,
        patient_id: int,
        filename: str,
        raw_bytes: bytes,
        mime_type: str | None = None,
        document_type: str = "other",
    ) -> StoredFileResult:
        _validate_extension(filename)
        self._not_configured()

    def iter_decrypted_chunks(self, storage_key: str) -> Iterator[bytes]:
        self._not_configured()
        return iter(())

    def read_decrypted_bytes(self, storage_key: str) -> bytes:
        self._not_configured()
        return b""

    def delete_object(self, storage_key: str) -> bool:
        self._not_configured()
        return False


def get_storage_backend() -> StorageBackend:
    if settings.STORAGE_TYPE.lower() == "s3":
        return S3StorageBackend()
    return LocalEncryptedStorageBackend()


file_storage: StorageBackend = get_storage_backend()
