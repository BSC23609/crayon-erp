import time
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from .routers import auth, meta, resources, indent, dashboard, tally, admin

app = FastAPI(title="Crayon ERP API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1024)

@app.middleware("http")
async def timing(request: Request, call_next):
    t = time.perf_counter()
    response = await call_next(request)
    response.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - t) * 1000:.1f}"
    response.headers.setdefault("Cache-Control", "no-store")
    return response

for r in (auth, meta, dashboard, indent, resources, tally, admin):
    app.include_router(r.router)
