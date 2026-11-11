"""AWS S3 Storage Service using boto3 (EC2 IAM Role or ~/.aws/credentials) with local fallback."""

import asyncio
import logging
import os
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


class UploadValidationError(ValueError):
    """Raised when an uploaded media file fails type or size validation."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class S3StorageService:
    """Service to handle AWS S3 media uploads matching Terraform infrastructure."""

    MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
    ALLOWED_IMAGE_MIME_TO_EXT = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.region = settings.AWS_REGION
        self.public_url = settings.S3_PUBLIC_URL.rstrip("/") if settings.S3_PUBLIC_URL else ""
        self.upload_dir = settings.UPLOAD_DIR

    def _get_s3_client(self):
        """Build boto3 S3 client using ~/.aws/credentials or EC2 IAM Instance Profile."""
        if not self.bucket_name:
            return None
        return boto3.client("s3", region_name=self.region or "us-east-1")

    def _build_public_url(self, key: str) -> str:
        if self.public_url:
            return f"{self.public_url}/{key}"
        region = self.region or "us-east-1"
        if region == "us-east-1":
            return f"https://{self.bucket_name}.s3.amazonaws.com/{key}"
        return f"https://{self.bucket_name}.s3.{region}.amazonaws.com/{key}"

    async def upload_file(self, file: UploadFile, folder: str = "uploads") -> str:
        """Validate and upload a raster image UploadFile to AWS S3 with local fallback."""
        content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
        file_ext = self.ALLOWED_IMAGE_MIME_TO_EXT.get(content_type)
        if not file_ext:
            raise UploadValidationError(
                "Uploaded file must be a PNG, JPEG, WebP, or GIF image.",
                status_code=400,
            )

        contents = await file.read(self.MAX_UPLOAD_BYTES + 1)
        if len(contents) > self.MAX_UPLOAD_BYTES:
            raise UploadValidationError(
                "Uploaded image must be 10MB or smaller.",
                status_code=413,
            )

        clean_folder = folder.strip("/")
        key = f"{clean_folder}/{uuid.uuid4().hex}{file_ext}"

        s3_client = self._get_s3_client()
        if s3_client:
            try:
                await asyncio.to_thread(
                    s3_client.put_object,
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=contents,
                    ContentType=content_type,
                )
                url = self._build_public_url(key)
                logger.info(f"Uploaded file to S3: {url}")
                return url
            except (NoCredentialsError, BotoCoreError, ClientError) as exc:
                logger.error(f"S3 upload failed ({self.bucket_name}/{key}): {exc}. Falling back to local storage.")

        os.makedirs(self.upload_dir, exist_ok=True)
        local_filename = f"{uuid.uuid4().hex}{file_ext}"
        local_path = os.path.join(self.upload_dir, local_filename)
        with open(local_path, "wb") as f:
            f.write(contents)

        return f"/static/uploads/{local_filename}"


s3_storage_service = S3StorageService()
