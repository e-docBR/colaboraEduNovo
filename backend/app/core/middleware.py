from flask import request, g, jsonify
from functools import wraps
from app.core.database import session_scope
from app.services.tenant_service import TenantService

def resolve_tenant_context():
    """
    Logic to resolve tenant and academic year from JWT, Host and headers.
    Sets g.tenant, g.tenant_id, and g.academic_year_id.
    Returns a Flask response if an error occurs, else None.
    """
    from flask_jwt_extended import get_jwt, verify_jwt_in_request
    from flask_jwt_extended.exceptions import NoAuthorizationError, JWTExtendedException
    
    tenant_id = None
    
    # 0. Ensure JWT is verified if present
    try:
        verify_jwt_in_request(optional=True)
    except JWTExtendedException:
        pass

    # 1. Get tenant_id from JWT (Source of Truth)
    jwt_tenant_id = None
    is_super_admin = False
    try:
        claims = get_jwt()
        jwt_tenant_id = claims.get("tenant_id")
        jwt_roles = claims.get("roles") or []
        is_super_admin = "super_admin" in jwt_roles
    except (NoAuthorizationError, RuntimeError):
        pass

    # 2. Try to get tenant_id from Header (Only allow for super_admin or if JWT is missing/optional)
    header_tenant_id = request.headers.get("X-Tenant-ID")
    
    if header_tenant_id and header_tenant_id.isdigit():
        candidate_id = int(header_tenant_id)
        if is_super_admin:
            # Super admins may context-switch tenants via header
            tenant_id = candidate_id
        elif jwt_tenant_id is not None:
            # Authenticated non-super_admin: ignore header, trust JWT exclusively
            tenant_id = jwt_tenant_id
        else:
            # No JWT present (public endpoints like /auth/login): accept header to resolve tenant
            tenant_id = candidate_id
    else:
        tenant_id = jwt_tenant_id


    host = request.headers.get("Host", "").split(":")[0] # remove port
    
    with session_scope() as session:
        service = TenantService(session)
        tenant = None
        
        if tenant_id is not None:
            tenant = service.repository.get(tenant_id)
        
        if not tenant:
            tenant = service.resolve_tenant(host)

        # DEV MODE FALLBACK — only active in development environment
        from app.core.config import settings
        if not tenant and settings.environment == "development" and host in ("localhost", "127.0.0.1"):
            tenant = service.repository.get(1)
            if not tenant:
                tenant = session.query(service.repository.model).first()

        if not tenant:
            return jsonify({"error": "Inquilino não identificado ou inválido"}), 404
        
        if not tenant.is_active:
             return jsonify({"error": "Acesso desativado para esta instituição"}), 403
        
        # Store in Flask GLOBAL g
        g.tenant = tenant
        g.tenant_id = tenant.id

        # 2. Resolve Academic Year
        # Priority: Header (explicit user choice) -> JWT claim -> Default current
        year_id = None

        # Header takes priority: represents the user's explicit year selection in the UI
        header_val = request.headers.get("X-Academic-Year-ID")
        if header_val and header_val.isdigit():
            year_id = int(header_val)

        # Fallback to JWT claim (set at login time)
        if not year_id:
            try:
                claims = get_jwt()
                if claims and "academic_year_id" in claims:
                    year_id = claims["academic_year_id"]
            except (NoAuthorizationError, RuntimeError):
                pass

        if year_id:
            # Validate the year actually belongs to this tenant before trusting it
            from app.models.academic_year import AcademicYear as AcademicYearModel
            valid_year = session.query(AcademicYearModel).filter(
                AcademicYearModel.id == year_id,
                AcademicYearModel.tenant_id == tenant.id,
            ).first()
            if valid_year:
                g.academic_year_id = valid_year.id
            else:
                # Invalid or cross-tenant year — fall through to current year
                year_id = None

        if not year_id:
            # Logic to find the current active academic year for this tenant
            from app.models.academic_year import AcademicYear
            current_year = session.query(AcademicYear).filter(
                AcademicYear.tenant_id == tenant.id,
                AcademicYear.is_current == True
            ).first()
            if current_year:
                g.academic_year_id = current_year.id
            else:
                g.academic_year_id = None
    return None

def tenant_required():
    """
    Decorator to ensure a valid tenant is present.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            error_response = resolve_tenant_context()
            if error_response:
                return error_response
            return f(*args, **kwargs)
        return decorated_function
    return decorator

