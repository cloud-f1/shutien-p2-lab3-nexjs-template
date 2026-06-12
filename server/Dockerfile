FROM python:3.12-slim AS base

# Install uv for fast, reliable dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install deps first for layer caching (production only, no dev extras)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini .
COPY alembic/ ./alembic/
COPY app/ ./app/

# Non-root user for security
RUN adduser --disabled-password --no-create-home appuser
USER appuser

# Use the venv created by uv sync directly (no uv run at runtime)
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"

EXPOSE 8080
CMD ["sh", "-c", "for i in 1 2 3 4 5; do alembic upgrade head && break || sleep 5; done && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
