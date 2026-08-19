import graphene
import comments.schema

class Query(comments.schema.Query, graphene.ObjectType):
    pass

schema = graphene.Schema(query=Query)
