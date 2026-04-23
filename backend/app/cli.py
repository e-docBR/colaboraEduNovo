"""Custom Flask CLI commands for database lifecycle."""
import random
import secrets
from decimal import Decimal

import click

from .core.database import Base, engine, session_scope
from .core.security import hash_password
from .models import Aluno, Nota, Usuario, Tenant, AcademicYear
from .services.accounts import ensure_aluno_user


TURMAS = [
    ("6º A", "Matutino"),
    ("7º B", "Vespertino"),
    ("8º C", "Noturno"),
]
DISCIPLINAS = [
    "Matemática",
    "Língua Portuguesa",
    "Ciências",
    "História",
    "Geografia",
]


def register_cli(app):
    @app.cli.command("init-db")
    def init_db_command():
        """Create database tables using SQLAlchemy metadata."""
        Base.metadata.create_all(bind=engine)
        click.secho("Database schema initialized.", fg="green")

    @app.cli.command("drop-db")
    def drop_db_command():
        """Drop all database tables."""
        if click.confirm("This will delete ALL data. Continue?", abort=True):
            Base.metadata.drop_all(bind=engine)
            click.secho("Database schema dropped.", fg="red")

    @app.cli.command("seed-demo")
    def seed_demo_command():
        """Populate the database with demo data for local development."""
        Base.metadata.create_all(bind=engine)
        with session_scope() as session:
            # Create default Tenant and Academic Year
            tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
            if not tenant:
                tenant = Tenant(name="Escola ColaboraFREI", slug="default")
                session.add(tenant)
                session.flush()

            year = session.query(AcademicYear).filter(AcademicYear.tenant_id == tenant.id, AcademicYear.label == "2026").first()
            if not year:
                year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
                session.add(year)
                session.flush()

            if session.query(Aluno).count() > 0:
                click.secho("Demo data already exists, skipping seeding.", fg="yellow")
                return

            alunos: list[Aluno] = []
            for idx, (turma, turno) in enumerate(TURMAS, start=1):
                for seq in range(1, 9):
                    aluno = Aluno(
                        matricula=f"{idx}{seq:03}",
                        nome=f"Aluno {turma} #{seq}",
                        turma=turma,
                        turno=turno,
                        tenant_id=tenant.id,
                        academic_year_id=year.id,
                    )
                    session.add(aluno)
                    alunos.append(aluno)
            session.flush()

            for aluno in alunos:
                ensure_aluno_user(session, aluno)

            for aluno in alunos:
                for disciplina in DISCIPLINAS:
                    notas = [Decimal(str(random.uniform(12, 18))) for _ in range(3)]
                    total = sum(notas) / len(notas)
                    session.add(
                        Nota(
                            aluno_id=aluno.id,
                            disciplina=disciplina,
                            disciplina_normalizada=disciplina.upper(),
                            trimestre1=notas[0],
                            trimestre2=notas[1],
                            trimestre3=notas[2],
                            total=total,
                            faltas=random.randint(0, 10),
                            situacao="APR" if total >= 14 else "REC",
                            tenant_id=tenant.id,
                            academic_year_id=year.id,
                        )
                    )

            click.secho("Demo data seeded (includes admin/admin).", fg="green")

    @app.cli.command("create-superadmin")
    @click.option("--username", default="superadmin", help="Super Admin username")
    @click.option("--password", default=None, help="Super Admin password (auto-generated if omitted)")
    def create_superadmin_command(username, password):
        """Create a super admin user with a secure random password."""
        Base.metadata.create_all(bind=engine)
        generated = False
        if not password:
            password = secrets.token_urlsafe(16)
            generated = True
        with session_scope() as session:
            admin = session.query(Usuario).filter(Usuario.username == username).first()
            if not admin:
                admin = Usuario(
                    username=username,
                    password_hash=hash_password(password),
                    role="super_admin",
                    is_admin=True,
                    tenant_id=None
                )
                session.add(admin)
                click.secho(f"Super Admin '{username}' criado.", fg="green")
            else:
                admin.password_hash = hash_password(password)
                click.secho(f"Super Admin '{username}' atualizado.", fg="yellow")
        if generated:
            click.secho(f"Senha gerada (guarde em local seguro): {password}", fg="cyan")

    @app.cli.command("create-admin")
    @click.option("--username", default="admin", help="Admin username")
    @click.option("--password", default=None, help="Admin password (auto-generated if omitted)")
    @click.option("--tenant-slug", default="default", help="Tenant slug")
    @click.option("--tenant-name", default="Escola ColaboraEdu", help="Tenant display name")
    def create_admin_command(username, password, tenant_slug, tenant_name):
        """Create an admin user and default tenant/year if they don't exist."""
        Base.metadata.create_all(bind=engine)
        generated = False
        if not password:
            password = secrets.token_urlsafe(16)
            generated = True
        with session_scope() as session:
            tenant = session.query(Tenant).filter(Tenant.slug == tenant_slug).first()
            if not tenant:
                tenant = Tenant(name=tenant_name, slug=tenant_slug)
                session.add(tenant)
                session.flush()
                click.echo(f"Tenant '{tenant_slug}' criado.")

            import datetime
            current_year = str(datetime.date.today().year)
            year = session.query(AcademicYear).filter(AcademicYear.tenant_id == tenant.id, AcademicYear.label == current_year).first()
            if not year:
                year = AcademicYear(tenant_id=tenant.id, label=current_year, is_current=True)
                session.add(year)
                session.flush()
                click.echo(f"Ano letivo '{current_year}' criado.")

            admin = session.query(Usuario).filter(Usuario.username == username).first()
            if not admin:
                admin = Usuario(
                    username=username,
                    password_hash=hash_password(password),
                    role="admin",
                    is_admin=True,
                    tenant_id=tenant.id,
                    must_change_password=True,
                )
                session.add(admin)
                click.secho(f"Admin '{username}' criado (deve trocar a senha no primeiro login).", fg="green")
            else:
                click.secho(f"Usuário '{username}' já existe.", fg="yellow")
        if generated:
            click.secho(f"Senha gerada (guarde em local seguro): {password}", fg="cyan")

    @app.cli.command("reprocess-pdfs")
    def reprocess_pdfs_command():
        """Reprocess all PDFs in the upload folder."""
        from pathlib import Path
        from .core.config import settings
        from .services.ingestion import enqueue_pdf
        from .models import Tenant
        
        upload_path = Path(settings.upload_folder)
        if not upload_path.exists():
            click.echo("Cloud uploads folder not found.")
            return

        with session_scope() as session:
            tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
            if not tenant:
                click.echo("Default tenant not found.")
                return
            
            count = 0
            # glob matches recursively
            for pdf_file in upload_path.rglob("*.pdf"):
                # Guess turno/turma from path if possible (assumes /data/uploads/TURNO/TURMA/file.pdf)
                rel_path = pdf_file.relative_to(upload_path)
                parts = rel_path.parts
                
                turno = parts[0] if len(parts) >= 2 else None
                turma = parts[1] if len(parts) >= 3 else None
                
                enqueue_pdf(pdf_file, turno=turno, turma=turma, tenant_id=tenant.id)
                count += 1
                click.echo(f"Enqueued: {rel_path}")
            
            click.secho(f"Enqueued {count} files for reprocessing.", fg="green")

    # ── Grupo de manutenção ──────────────────────────────────────────────────
    maintenance = app.cli.group("maintenance")(lambda: None)
    maintenance.__doc__ = "Comandos de manutenção do banco de dados."

    @maintenance.command("clean-audit")
    @click.option("--days", default=365, show_default=True, help="Reter logs dos últimos N dias; apagar o restante.")
    @click.option("--dry-run", is_flag=True, default=False, help="Mostrar quantos registros seriam apagados sem deletar.")
    def clean_audit_command(days: int, dry_run: bool):
        """Remove registros de audit_logs mais antigos que N dias.

        Exemplo:\n
            flask maintenance clean-audit --days 180\n
            flask maintenance clean-audit --days 365 --dry-run
        """
        import datetime
        from sqlalchemy import text

        if days < 30:
            click.secho("⚠  Mínimo de 30 dias para retenção.", fg="red")
            return

        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)

        with session_scope() as session:
            from .models.audit_log import AuditLog

            count_q = session.query(AuditLog).filter(AuditLog.timestamp < cutoff)
            count = count_q.count()

            if dry_run:
                click.secho(
                    f"[dry-run] {count} registros seriam removidos (anteriores a {cutoff.date()}).",
                    fg="yellow",
                )
                return

            if count == 0:
                click.secho("Nenhum registro antigo encontrado.", fg="green")
                return

            # DELETE em lote usando SQL direto (evita carregar ORM objects na memória)
            deleted = session.execute(
                text("DELETE FROM audit_logs WHERE timestamp < :cutoff"),
                {"cutoff": cutoff},
            )
            click.secho(
                f"✅  {deleted.rowcount} registros removidos (retidos: últimos {days} dias).",
                fg="green",
            )

    @maintenance.command("schedule-clean-audit")
    @click.option("--days", default=365, show_default=True, help="Retenção em dias usada no job agendado.")
    def schedule_clean_audit_command(days: int):
        """Enfileira o job de limpeza de audit log no RQ para execução imediata."""
        from rq import Queue
        from redis import Redis
        from .core.config import settings

        redis_conn = Redis.from_url(settings.redis_url)
        q = Queue(connection=redis_conn)
        job = q.enqueue(_run_clean_audit_task, days)
        click.secho(f"Job enfileirado: {job.id}", fg="green")


def _run_clean_audit_task(days: int) -> str:
    """RQ task: remove audit_logs mais antigos que *days* dias."""
    import datetime
    from sqlalchemy import text
    from .core.database import session_scope

    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    with session_scope() as session:
        result = session.execute(
            text("DELETE FROM audit_logs WHERE timestamp < :cutoff"),
            {"cutoff": cutoff},
        )
        return f"Deleted {result.rowcount} audit_log rows older than {days} days."
