import graphene
import math
from graphene_django import DjangoObjectType
from graphene_file_upload.scalars import Upload
from django.core.exceptions import ValidationError
from .models import Comment


class CommentType(DjangoObjectType):
    class Meta:
        model = Comment
        fields = ("id", "user_name", "email", "home_page", "text", "created_at", "parent", "children", "file")


class PaginatedComments(graphene.ObjectType):
    comments = graphene.List(CommentType)
    total_pages = graphene.Int()
    current_page = graphene.Int()


class Query(graphene.ObjectType):
    root_comments = graphene.Field(
        PaginatedComments,
        order_by=graphene.String(),
        page=graphene.Int(),
        page_size=graphene.Int()
    )

    def resolve_root_comments(root, info, order_by='-created_at', page=1, page_size=25):
        queryset = Comment.objects.filter(parent__isnull=True).prefetch_related('children')

        allowed_fields = [
            'user_name', '-user_name',
            'email', '-email',
            'created_at', '-created_at'
        ]

        if order_by in allowed_fields:
            queryset = queryset.order_by(order_by)
        else:
            queryset = queryset.order_by('-created_at')

        total_items = queryset.count()
        total_pages = math.ceil(total_items / page_size) if total_items > 0 else 1

        if page < 1:
            page = 1
        if page > total_pages:
            page = total_pages

        start = (page - 1) * page_size
        end = start + page_size

        return PaginatedComments(
            comments=queryset[start:end],
            total_pages=total_pages,
            current_page=page
        )


class CreateComment(graphene.Mutation):
    class Arguments:
        user_name = graphene.String(required=True)
        email = graphene.String(required=True)
        text = graphene.String(required=True)
        home_page = graphene.String(required=False)
        parent_id = graphene.ID(required=False)
        file = Upload(required=False)

    comment = graphene.Field(CommentType)
    success = graphene.Boolean()
    errors = graphene.List(graphene.String)

    def mutate(self, info, user_name, email, text, home_page=None, parent_id=None, file=None):
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

            return CreateComment(comment=comment, success=True, errors=None)

        except ValidationError as e:
            error_messages = [f"{field}: {', '.join(msgs)}" for field, msgs in e.message_dict.items()]
            return CreateComment(comment=None, success=False, errors=error_messages)
        except Exception as e:
            return CreateComment(comment=None, success=False, errors=[str(e)])


class Mutation(graphene.ObjectType):
    create_comment = CreateComment.Field()
