from io import BytesIO
from xhtml2pdf import pisa
from flask import render_template

class DocumentService:
    @staticmethod
    def generate_pdf_from_html(html_content: str) -> BytesIO:
        """Converts HTML content to a PDF file in memory."""
        dest = BytesIO()
        pisa_status = pisa.CreatePDF(html_content, dest=dest)
        if pisa_status.err:
            raise Exception("Erro ao gerar PDF")
        dest.seek(0)
        return dest

    @staticmethod
    def render_bulletin_html(aluno_data: dict, school_name: str, year: str) -> str:
        """Renders the HTML template for a school bulletin."""
        # This will use a Flask template. We need to ensure the template exists.
        return render_template(
            "documents/bulletin.html",
            aluno=aluno_data,
            school_name=school_name,
            year=year
        )
