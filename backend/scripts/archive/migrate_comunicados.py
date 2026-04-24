from sqlalchemy import text
from app import create_app
from app.core.database import session_scope

app = create_app()

with app.app_context():
    with session_scope() as session:
        try:
            session.execute(text("ALTER TABLE comunicados ADD COLUMN arquivado BOOLEAN DEFAULT FALSE"))
            print("Column 'arquivado' added successfully.")
        except Exception as e:
            print(f"Error (maybe column exists): {e}")
