from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from django.core.validators import RegexValidator
import bleach


class Comment(MPTTModel):
    user_name = models.CharField(
        max_length=100,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9]+$',
                message='Имя пользователя может содержать только латинские буквы и цифры.'
            )
        ]
    )
    email = models.EmailField()
    home_page = models.URLField(blank=True, null=True)
    text = models.TextField()

    parent = TreeForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    file = models.FileField(upload_to='comment_files/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class MPTTMeta:
        order_insertion_by = ['-created_at']

    def save(self, *args, **kwargs):
        allowed_tags = ['a', 'code', 'i', 'strong']
        allowed_attrs = {
            'a': ['href', 'title']
        }
        self.text = bleach.clean(
            self.text,
            tags=allowed_tags,
            attributes=allowed_attrs,
            strip=True
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Comment by {self.user_name} at {self.created_at}"
