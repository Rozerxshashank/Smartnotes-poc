import os
from fastapi import FastAPI, Header, HTTPException, Depends
import uvicorn

from contextlib import asynccontextmanager
from backend.db import init_db
from backend.routers import notes, sync, search, chat, graph, indexing, importer
from backend.config import init_config

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the notes directory and database on startup
    init_config()
    await init_db()
    yield
    # Cleanup on shutdown (if any)

app = FastAPI(lifespan=lifespan)

IPC_TOKEN = os.environ.get("IPC_TOKEN")

async def verify_ipc_token(x_ipc_token: str = Header(None)):
    if not IPC_TOKEN:
        raise HTTPException(status_code=500, detail="IPC_TOKEN env var not set")
    
    if x_ipc_token != IPC_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid IPC token")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Create a sub-router for all actual endpoints that requires the token
api_router = FastAPI(dependencies=[Depends(verify_ipc_token)])

api_router.include_router(notes.router)
api_router.include_router(sync.router)
api_router.include_router(search.router)
api_router.include_router(chat.router)
api_router.include_router(graph.router)
api_router.include_router(indexing.router)
api_router.include_router(importer.router)

app.mount("/api", api_router)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
