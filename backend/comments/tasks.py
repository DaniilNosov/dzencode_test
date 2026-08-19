import os
from PIL import Image
from celery import shared_task
from django.conf import settings


@shared_task
def resize_uploaded_image(relative_file_path):
    """
    Asynchronously resizes an uploaded image to fit within 320x240 pixels.
    Maintains the aspect ratio.
    """
    try:
        full_path = os.path.join(settings.MEDIA_ROOT, relative_file_path)

        if not os.path.exists(full_path):
            return f"Error: File not found at {full_path}"

        with Image.open(full_path) as img:
            if img.mode not in ('L', 'RGB', 'RGBA'):
                img = img.convert('RGBA')

            max_size = (320, 240)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            img.save(full_path)

        return f"Success: Resized {relative_file_path}"

    except Exception as e:
        return f"Error processing image {relative_file_path}: {str(e)}"
