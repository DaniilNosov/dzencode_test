import graphene
from graphene_django import DjangoObjectType
from .models import Comment

class CommentType(DjangoObjectType):
    class Meta:
        model = Comment
        fields = ("id", "user_name", "email", "home_page", "text", "created_at", "parent", "children", "file")

class Query(graphene.ObjectType):
    root_comments = graphene.List(CommentType)

    def resolve_root_comments(root, info):
        return Comment.objects.filter(parent__isnull=True).prefetch_related('children')
