"""
Hybrid search — combines vector search (ChromaDB) + keyword search (FTS5) via RRF.
"""
import logging
from backend.services.chromadb_store import query_similar
from backend.services.embedder import embed_texts
from backend.db import get_db_connection

logger = logging.getLogger(__name__)


async def vector_search(query: str, k: int = 10) -> list[dict]:
    """Search via ChromaDB semantic similarity."""
    query_embeddings = await embed_texts([query])
    if not query_embeddings:
        return []
    
    results = query_similar(query_embedding=query_embeddings[0], k=k)
    return results


async def keyword_search(query: str, k: int = 10) -> list[dict]:
    """Search via SQLite FTS5 keyword match."""
    db = await get_db_connection()
    try:
        # FTS5 match query
        async with db.execute(
            """
            SELECT notes.id, notes.title, notes.content, notes.folder,
                   bm25(notes_fts) as rank
            FROM notes_fts
            JOIN notes ON notes.id = notes_fts.id
            WHERE notes_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (query, k)
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "note_id": row[0],
                    "title": row[1],
                    "content": row[2],
                    "folder": row[3],
                    "rank": row[4],
                }
                for row in rows
            ]
    finally:
        await db.close()


def reciprocal_rank_fusion(vector_results: list, keyword_results: list, k: int = 60) -> list[dict]:
    """
    Merge vector and keyword results using Reciprocal Rank Fusion.
    RRF score = sum(1 / (k + rank)) across result lists.
    """
    scores = {}  # note_id -> {score, data}
    
    # Score vector results
    for rank, item in enumerate(vector_results):
        note_id = item["note_id"]
        rrf_score = 1.0 / (k + rank + 1)
        if note_id not in scores:
            scores[note_id] = {"score": 0, "note_id": note_id, "text": item.get("text", "")}
        scores[note_id]["score"] += rrf_score
    
    # Score keyword results
    for rank, item in enumerate(keyword_results):
        note_id = item["note_id"]
        rrf_score = 1.0 / (k + rank + 1)
        if note_id not in scores:
            scores[note_id] = {
                "score": 0,
                "note_id": note_id,
                "text": item.get("content", "")[:500],
                "title": item.get("title", ""),
            }
        scores[note_id]["score"] += rrf_score
        # Prefer keyword result's title if available
        if "title" in item:
            scores[note_id]["title"] = item["title"]
    
    # Sort by RRF score descending
    ranked = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
    return ranked


async def hybrid_search(query: str, k: int = 10) -> list[dict]:
    """
    Run vector + keyword search concurrently, merge with RRF.
    Returns top-k results with note_id, title, text snippet, and score.
    """
    import asyncio
    
    vector_task = vector_search(query, k=k * 2)
    keyword_task = keyword_search(query, k=k * 2)
    
    vector_results, keyword_results = await asyncio.gather(vector_task, keyword_task)
    
    merged = reciprocal_rank_fusion(vector_results, keyword_results)
    
    # Enrich with note titles from DB
    db = await get_db_connection()
    try:
        for item in merged[:k]:
            if "title" not in item or not item.get("title"):
                async with db.execute("SELECT title FROM notes WHERE id = ?", (item["note_id"],)) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        item["title"] = row[0]
    finally:
        await db.close()
    
    return merged[:k]
