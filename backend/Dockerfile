FROM python:3.12-slim AS builder

WORKDIR /build

# Install build-time system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    pkg-config \
    libcairo2-dev \
    libffi-dev \
    libxml2-dev \
    libxslt-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy project definition and install Python deps
COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary pycairo && \
    pip install --no-cache-dir --prefer-binary . gunicorn flask-migrate flask-cors


# ── Runtime stage (no compilers) ─────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install only runtime native libs (no gcc/dev headers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpq5 \
    libxml2 \
    libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .
RUN chmod +x entrypoint.sh

# Create non-root user for production
RUN groupadd -g 1001 app && useradd -u 1001 -g app -s /bin/sh -m app && \
    mkdir -p /data/uploads && chown -R app:app /data /app
USER app

# Expose port
EXPOSE 5000

ENTRYPOINT ["./entrypoint.sh"]
# Default command for production (can be overridden in compose for dev)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:create_app()"]
