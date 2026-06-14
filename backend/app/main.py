from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import customers, orders, segments, campaigns, analytics, receipt, ai, auth

app = FastAPI(
    title="Xeno AI-Native CRM API",
    description="AI Marketing Copilot + Agent for D2C brands",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(segments.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(receipt.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


@app.get("/")
def root():
    return {
        "service": "Xeno CRM Backend",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
