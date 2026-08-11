from fastapi import APIRouter, Depends
from backend.services.search import hybrid_search

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def search_notes(q: str, k: int = 10):
    """Hybrid search endpoint combining vector + FTS5 via RRF."""
    if not q.strip():
        return []
    
    results = await hybrid_search(q, k=k)
    return results
