import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Comment


class FileUploadView(APIView):
    def post(self, request, comment_id):
        try:
            comment = Comment.objects.get(id=comment_id)
        except Comment.DoesNotExist:
            return Response({"error": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file given"}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(file_obj.name)[1].lower()
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.txt']

        if ext not in allowed_extensions:
            return Response(
                {"error": f"Format {ext} not supported. Allowed: JPG, PNG, GIF, TXT"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if ext == '.txt' and file_obj.size > 100 * 1024:
            return Response(
                {"error": "The size of TXT cannot be over than 100KB"},
                status=status.HTTP_400_BAD_REQUEST
            )

        comment.file = file_obj
        comment.save()


        return Response({
            "success": True,
            "message": "Файл успешно загружен",
            "file_url": comment.file.url
        }, status=status.HTTP_200_OK)
