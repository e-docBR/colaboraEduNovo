from flask import jsonify
from pydantic import ValidationError as PydanticValidationError
from .exceptions import AppError

def register_error_handlers(app):
    # Quando Redis cai em tempo de execução, o Flask-Limiter levanta StorageError.
    # Retornamos 503 para que o cliente saiba que o serviço está temporariamente
    # indisponível em vez de silenciosamente permitir requisições ilimitadas.
    try:
        from limits.errors import StorageError

        @app.errorhandler(StorageError)
        def handle_storage_error(_error):
            from loguru import logger as _logger
            _logger.error("Rate limit storage (Redis) unavailable — returning 503")
            return jsonify({"error": "Serviço temporariamente indisponível. Tente novamente em instantes."}), 503
    except ImportError:
        pass
    
    @app.errorhandler(AppError)
    def handle_app_error(error):
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    @app.errorhandler(PydanticValidationError)
    def handle_pydantic_error(error):
        # Format pydantic errors nicely
        errors = []
        for e in error.errors():
            loc = ".".join(str(i) for i in e["loc"])
            errors.append({"field": loc, "message": e["msg"]})
        
        response = jsonify({"error": "Erro de validação", "details": errors})
        response.status_code = 422
        return response

    @app.errorhandler(401)
    def handle_401(_error):
        return jsonify({"error": "Autenticação necessária"}), 401

    @app.errorhandler(403)
    def handle_403(_error):
        return jsonify({"error": "Acesso negado"}), 403

    @app.errorhandler(404)
    def handle_404(_error):
        return jsonify({"error": "Recurso não encontrado"}), 404

    @app.errorhandler(405)
    def handle_405(_error):
        return jsonify({"error": "Método não permitido"}), 405

    @app.errorhandler(500)
    def handle_500(error):
        from loguru import logger
        logger.error("Internal server error: {}", error)
        return jsonify({"error": "Erro interno do servidor"}), 500
