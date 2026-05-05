import os
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from app import create_app
from app.core.database import Base, SessionLocal, session_scope
import app.core.database
from app.models import AcademicYear, Tenant, Usuario
from app.core.security import hash_password


class FakeRedis:
    def __init__(self):
        self.store = {}

    def ping(self):
        return True

    def setex(self, key, _ttl, value):
        self.store[key] = value
        return True

    def exists(self, key):
        return 1 if key in self.store else 0

    def getdel(self, key):
        return self.store.pop(key, None)

    def get(self, key):
        return self.store.get(key)

    def incr(self, key):
        value = int(self.store.get(key, 0)) + 1
        self.store[key] = value
        return value


@pytest.fixture(scope="session")
def db_engine():
    db_path = "test_boletins.db"
    db_url = f"sqlite:///{db_path}"
    
    # Create test engine
    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    
    # Patch the global engine and SessionLocal
    app.core.database.engine = test_engine
    SessionLocal.configure(bind=test_engine)
    
    # Create tables
    Base.metadata.create_all(bind=test_engine)
    
    yield test_engine
    
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(db_path):
        os.remove(db_path)

@pytest.fixture(scope="session")
def flask_app(db_engine):
    # We don't need to reload config if we patched the database engine/session
    import app.core.config as config_module
    original_redis_url = config_module.settings.redis_url
    original_upload_folder = config_module.settings.upload_folder
    config_module.settings.redis_url = None
    config_module.settings.upload_folder = "/tmp/colaboraedu-test-uploads"
    Path(config_module.settings.upload_folder).mkdir(parents=True, exist_ok=True)
    app = create_app()
    app.config.update({
        "TESTING": True,
        "RATELIMIT_ENABLED": False,
    })
    config_module.settings.redis_url = original_redis_url
    import app.core.cache as cache_module
    cache_module.redis_client = FakeRedis()
    yield app
    config_module.settings.upload_folder = original_upload_folder

@pytest.fixture(scope="function")
def client(flask_app):
    return flask_app.test_client()

@pytest.fixture(scope="function")
def session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    
    # Bind session to the connection
    session = SessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def admin_user(db_engine):
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Escola Teste", slug="default", is_active=True)
            session.add(tenant)
            session.flush()

        year = session.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant.id,
            AcademicYear.label == "2026",
        ).first()
        if not year:
            session.add(AcademicYear(tenant_id=tenant.id, label="2026", is_current=True))

        user = session.query(Usuario).filter(
            Usuario.username == "admin_test",
            Usuario.tenant_id == tenant.id,
        ).first()
        if not user:
            user = Usuario(
                username="admin_test",
                role="admin",
                is_admin=True,
                tenant_id=tenant.id,
            )
            session.add(user)
        user.password_hash = hash_password("admin123")
        user.must_change_password = False
        return user

@pytest.fixture(scope="function")
def auth_headers(client, admin_user):
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "admin123",
        "tenant_slug": "default",
    })
    token = response.json["access_token"]
    return {"Authorization": f"Bearer {token}"}
