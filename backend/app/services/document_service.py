from io import BytesIO
from xhtml2pdf import pisa
from flask import render_template

class DocumentService:
    @staticmethod
    def generate_pdf_from_html(html_content: str) -> BytesIO:
        """Converts HTML content to a PDF file in memory."""
        dest = BytesIO()

        def pisa_link_callback(uri, rel):
            import os
            from ..core.config import settings
            if uri.startswith("/api/v1/static/logos/"):
                filename = uri.replace("/api/v1/static/logos/", "")
                return os.path.abspath(os.path.join(settings.upload_folder, "logos", filename))
            elif uri.startswith("/api/v1/static/photos/"):
                filename = uri.replace("/api/v1/static/photos/", "")
                return os.path.abspath(os.path.join(settings.upload_folder, "photos", filename))
            return uri

        pisa_status = pisa.CreatePDF(html_content, dest=dest, link_callback=pisa_link_callback)
        if pisa_status.err:
            raise Exception("Erro ao gerar PDF")
        dest.seek(0)
        return dest

    @staticmethod
    def render_bulletin_html(aluno_data: dict, school_name: str, year: str, logo_url: str | None = None, passing_grade: float = 50.0, primary_color: str = "#3f2a74") -> str:
        """Renders the HTML template for a school bulletin."""
        return render_template(
            "documents/bulletin.html",
            aluno=aluno_data,
            school_name=school_name,
            year=year,
            logo_url=logo_url,
            passing_grade=passing_grade,
            primary_color=primary_color
        )
