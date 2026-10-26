from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title="CardRoute API",
    docs_url="/api/docs" if settings().app_env != "production" else None,
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings().frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With"],
)


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method in ("POST", "PATCH", "PUT", "DELETE"):
        origin = request.headers.get("origin")
        if origin and origin != settings().frontend_url:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        if request.headers.get("x-requested-with") != "CardRoute":
            return JSONResponse(
                {"detail": "Required request header missing"}, status_code=403
            )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Frame-Options"] = "DENY"
    return response


@app.exception_handler(RequestValidationError)
async def validation(request, exc):
    return JSONResponse(
        {
            "detail": "Please check the submitted fields.",
            "errors": [
                {"field": str(e["loc"][-1]), "message": e["msg"]} for e in exc.errors()
            ],
        },
        status_code=422,
    )


@app.exception_handler(Exception)
async def unexpected(request, exc):
    return JSONResponse({"detail": "An unexpected error occurred"}, status_code=500)


app.include_router(router)

# The Docker build serves the compiled SPA from the same origin as the API.
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

static_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found")
        return FileResponse(static_dir / "index.html")
