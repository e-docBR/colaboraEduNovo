from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt

def require_roles(*roles):
    """
    Decorator to restrict access to specific roles.
    Matches any of the provided roles.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            claims = get_jwt()
            user_roles = claims.get("roles", [])
            
            # Check if user has at least one of the required roles
            if not any(role in user_roles for role in roles):
                return jsonify({
                    "error": "Acesso negado",
                    "message": f"Esta ação requer uma das seguintes permissões: {', '.join(roles)}"
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    """Shorthand for admin-only endpoints."""
    return require_roles("admin", "super_admin")(f)
