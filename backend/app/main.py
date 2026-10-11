"""FastAPI app. Every router is mounted under /api; the OpenAPI schema at
/openapi.json is what `npm run gen:api` turns into frontend/src/lib/api-types.ts."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import (
    anatomy,
    buildings,
    cases,
    dashboard,
    evidence,
    graph,
    injuries,
    people,
    reconstruction,
    reports,
    review,
    search,
    timeline,
)

app = FastAPI(title="Evidentia API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    dashboard,
    cases,
    evidence,
    people,
    search,
    review,
    graph,
    timeline,
    reconstruction,
    injuries,
    anatomy,
    buildings,
    reports,
):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str | bool]:
    return {"status": "ok", "ai_enabled": get_settings().ai_enabled}
