FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (gcc and libpq-dev for postgres)
RUN apt-get update && apt-get install -y \
    gcc \
    pkg-config \
    libcairo2-dev \
    libffi-dev \
    libxml2-dev \
    libxslt-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy project definition
COPY pyproject.toml README.md ./
COPY app ./app

# Install dependencies (requires app code to be present for setuptools build)
RUN pip install --no-cache-dir . gunicorn flask-migrate flask-cors

# Copy application code (overwriting if needed, effectively adding other files like migrations)
COPY . .
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 5000

ENTRYPOINT ["./entrypoint.sh"]
# Default command for production (can be overridden in compose for dev)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:create_app()"]

