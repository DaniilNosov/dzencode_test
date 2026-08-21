import graphene
import math
import io
import base64
import random
import string
import uuid
import sys
from django.core.cache import cache
from PIL import Image, ImageDraw, ImageFont
from graphene_django import DjangoObjectType
from django.core.exceptions import ValidationError
from graphene_file_upload.scalars import Upload
from django.core.files.uploadedfile import InMemoryUploadedFile
from .models import Comment

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


class CommentType(DjangoObjectType):
    class Meta:
        model = Comment
        fields = ("id", "user_name", "email", "home_page", "text", "created_at", "parent", "children", "file")


class PaginatedComments(graphene.ObjectType):
    comments = graphene.List(CommentType)
    total_pages = graphene.Int()
    current_page = graphene.Int()


class CaptchaType(graphene.ObjectType):
    key = graphene.String()
    image = graphene.String()


class Query(graphene.ObjectType):
    root_comments = graphene.Field(
        PaginatedComments,
        order_by=graphene.String(),
        page=graphene.Int(),
        page_size=graphene.Int()
    )
    captcha = graphene.Field(CaptchaType)

    def resolve_captcha(root, info):
        text = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

        image = Image.new('RGB', (150, 50), color=(240, 240, 240))
        draw = ImageDraw.Draw(image)
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        small_img = Image.new('RGB', (60, 20), color=(240, 240, 240))
        small_draw = ImageDraw.Draw(small_img)
        small_draw.text((5, 2), text, font=font, fill=(50, 50, 50))
        image = small_img.resize((150, 50), Image.NEAREST)
        draw = ImageDraw.Draw(image)

        for _ in range(5):
            draw.line([(random.randint(0, 150), random.randint(0, 50)),
                       (random.randint(0, 150), random.randint(0, 50))], fill=(150, 150, 150), width=2)

        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')

        key = str(uuid.uuid4())
        cache.set(key, text, timeout=300)

        return CaptchaType(key=key, image=img_str)

    def resolve_root_comments(root, info, order_by='-created_at', page=1, page_size=25):
        queryset = Comment.objects.filter(parent__isnull=True).prefetch_related('children')

        allowed_fields = ['user_name', '-user_name', 'email', '-email', 'created_at', '-created_at']
        if order_by in allowed_fields:
            queryset = queryset.order_by(order_by)
        else:
            queryset = queryset.order_by('-created_at')

        total_items = queryset.count()
        total_pages = math.ceil(total_items / page_size) if total_items > 0 else 1

        if page < 1: page = 1
        if page > total_pages: page = total_pages

        start = (page - 1) * page_size
        end = start + page_size

        return PaginatedComments(comments=queryset[start:end], total_pages=total_pages, current_page=page)


class CreateComment(graphene.Mutation):
    class Arguments:
        user_name = graphene.String(required=True)
        email = graphene.String(required=True)
        text = graphene.String(required=True)
        home_page = graphene.String(required=False)
        parent_id = graphene.ID(required=False)
        file = Upload(required=False)
        captcha_key = graphene.String(required=True)
        captcha_value = graphene.String(required=True)

    comment = graphene.Field(CommentType)
    success = graphene.Boolean()
    errors = graphene.List(graphene.String)

    def mutate(self, info, user_name, email, text, captcha_key, captcha_value, home_page=None, parent_id=None,
               file=None):
        cached_captcha = cache.get(captcha_key)
        if not cached_captcha or cached_captcha.upper() != captcha_value.upper():
            return CreateComment(comment=None, success=False, errors=["Invalid CAPTCHA. Please try again."])

        cache.delete(captcha_key)

        if file:
            ext = file.name.split('.')[-1].lower()
            if ext == 'txt':
                if file.size > 100 * 1024:
                    return CreateComment(comment=None, success=False, errors=["Text file size must not exceed 100 KB."])
            elif ext in ['jpg', 'jpeg', 'png', 'gif']:
                try:
                    img = Image.open(file)
                    if img.width > 320 or img.height > 240:
                        img.thumbnail((320, 240), getattr(Image, 'Resampling', Image).LANCZOS)
                        output = io.BytesIO()
                        img_format = img.format if img.format else 'JPEG'
                        img.save(output, format=img_format)
                        output.seek(0)
                        file = InMemoryUploadedFile(
                            output, 'file', file.name, file.content_type, sys.getsizeof(output), None
                        )
                except Exception as e:
                    return CreateComment(comment=None, success=False, errors=["Error processing image file."])
            else:
                return CreateComment(comment=None, success=False,
                                     errors=["Unsupported file format. Allowed: JPG, GIF, PNG, TXT."])

        try:
            parent_comment = None
            if parent_id:
                parent_comment = Comment.objects.get(pk=parent_id)

            comment = Comment(
                user_name=user_name,
                email=email,
                text=text,
                home_page=home_page,
                parent=parent_comment,
                file=file
            )
            comment.full_clean()
            comment.save()

            try:
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    "comments",
                    {
                        "type": "send_notification",
                        "message": "new_comment"
                    }
                )
                print("WebSocket successfully sent from GraphQL")
            except Exception as ws_err:
                print(f"WebSocket Error: {ws_err}")

            return CreateComment(comment=comment, success=True, errors=None)

        except ValidationError as e:
            error_messages = [f"{field}: {', '.join(msgs)}" for field, msgs in e.message_dict.items()]
            return CreateComment(comment=None, success=False, errors=error_messages)
        except Exception as e:
            return CreateComment(comment=None, success=False, errors=[str(e)])


class Mutation(graphene.ObjectType):
    create_comment = CreateComment.Field()
