from typing import Any, Dict, Optional

class AppError(Exception):
    """Base error class for application."""
    def __init__(self, message: str, status_code: int = 400, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload

    def to_dict(self) -> Dict[str, Any]:
        rv = dict(self.payload or ())
        rv['error'] = self.message
        return rv

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: Any = None):
        msg = f"{resource} não encontrado(a)"
        if resource_id:
            msg += f" com id {resource_id}"
        super().__init__(msg, status_code=404)

class ValidationError(AppError):
    def __init__(self, message: str, errors: Any = None):
        super().__init__(message, status_code=422, payload={"details": errors})

class UnauthorizedError(AppError):
    def __init__(self, message: str = "Não autorizado"):
        super().__init__(message, status_code=401)

class ForbiddenError(AppError):
    def __init__(self, message: str = "Acesso negado"):
        super().__init__(message, status_code=403)
