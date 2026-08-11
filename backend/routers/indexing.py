from fastapi import APIRouter, Depends
from backend.db import get_db_connection
from backend.services.pipeline import get_indexing_status

router = APIRouter(prefix="/indexing", tags=["indexing"])


async def db_dep():
    db = await get_db_connection()
    try:
        yield db
    finally:
        await db.close()


@router.get("/status")
async def indexing_status():
    """Return current indexing status for the UI indicator."""
    return get_indexing_status()
