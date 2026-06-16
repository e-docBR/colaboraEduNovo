from app.core.crypto import encrypt_secret, decrypt_secret
from app.models import AIConfiguration, Tenant
from app.core.database import session_scope
from sqlalchemy import text

def test_base_crypto_functions():
    # Test normal encryption/decryption
    secret = "my_super_secret_api_key_123"
    encrypted = encrypt_secret(secret)
    assert encrypted.startswith("enc:")
    assert encrypted != secret

    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret

    # Test handling of None/Empty values
    assert encrypt_secret(None) is None
    assert decrypt_secret(None) is None
    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""

    # Test that encrypting an already encrypted value returns it directly
    assert encrypt_secret(encrypted) == encrypted

    # Test fallback compatibility (returns original string if not starting with "enc:")
    legacy_secret = "legacy_unencrypted_secret"
    assert decrypt_secret(legacy_secret) == legacy_secret

    # Test fallback on invalid decryption block
    invalid_encrypted = "enc:invalid_ciphertext_token_here_12345"
    assert decrypt_secret(invalid_encrypted) == invalid_encrypted


def test_orm_encrypted_secret_integration(flask_app):
    with session_scope() as session:
        # Create a test tenant
        tenant = Tenant(name="Crypto School", slug="crypto-school", is_active=True)
        session.add(tenant)
        session.flush()

        tenant_id = tenant.id

        # Seed AIConfiguration with api_key in plain text
        raw_key = "sk-proj-test123456789"
        config = AIConfiguration(
            tenant_id=tenant_id,
            is_active=True,
            provider="openai",
            model_name="gpt-4o-mini",
            api_key=raw_key
        )
        session.add(config)
        session.commit()

    # Now verify raw DB storage (ciphertext starts with "enc:")
    with session_scope() as session:
        # Check using a raw SQL text query to bypass the SQLAlchemy TypeDecorator
        stmt = text("SELECT api_key FROM ai_configurations WHERE tenant_id = :tenant_id")
        row = session.execute(stmt, {"tenant_id": tenant_id}).fetchone()
        assert row is not None
        db_value = row[0]
        assert db_value.startswith("enc:")
        assert db_value != raw_key

        # Check that querying via ORM transparently decrypts it
        db_config = session.query(AIConfiguration).filter_by(tenant_id=tenant_id).first()
        assert db_config is not None
        assert db_config.api_key == raw_key
