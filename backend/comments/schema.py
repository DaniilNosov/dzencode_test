import graphene
from graphene_django import DjangoObjectType
from django.core.exceptions import ValidationError
from .models import Comment

class CommentType(DjangoObjectType):
    class Meta:
        model = Comment
        fields = ("id", "user_name", "email", "home_page", "text", "created_at", "parent", "children", "file")

class Query(graphene.ObjectType):
    root_comments = graphene.List(CommentType)

    def resolve_root_comments(root, info):
        return Comment.objects.filter(parent__isnull=True).prefetch_related('children')


class CreateComment(graphene.Mutation):
    class Arguments:
        user_name = graphene.String(required=True)
        email = graphene.String(required=True)
        text = graphene.String(required=True)
        home_page = graphene.String(required=False)
        parent_id = graphene.ID(required=False)

    comment = graphene.Field(CommentType)
    success = graphene.Boolean()
    errors = graphene.List(graphene.String)

    def mutate(self, info, user_name, email, text, home_page=None, parent_id=None):
        try:
            parent_comment = None
            if parent_id:
                parent_comment = Comment.objects.get(pk=parent_id)

            comment = Comment(
                user_name=user_name,
                email=email,
                text=text,
                home_page=home_page,
                parent=parent_comment
            )
            # Обязательно вызываем full_clean, чтобы сработал наш RegexValidator
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
