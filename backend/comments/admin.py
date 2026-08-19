from django.contrib import admin
from mptt.admin import MPTTModelAdmin
from .models import Comment

@admin.register(Comment)
class CommentAdmin(MPTTModelAdmin):
    list_display = ('user_name', 'email', 'created_at')
    search_fields = ('user_name', 'email', 'text')
    mptt_level_indent = 20
