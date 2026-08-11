"""
Embedding pipeline — orchestrates chunking, embedding, ChromaDB upsert, and auto-linking.
Triggered as a BackgroundTask on every note save.
"""
import logging
from backend.services.chunker import chunk_note
from backend.services.embedder import embed_texts
from backend.services.chromadb_store import upsert_chunks, delete_note_chunks
from backend.services.autolinker import run_autolink

logger = logging.getLogger(__name__)

# Track indexing status
_indexing_status = {
    "is_indexing": False,
    "current_note_id": None,
    "queue_size": 0,
    "completed": 0,
    "total": 0,
}


def get_indexing_status() -> dict:
    return dict(_indexing_status)


async def embed_note(note_id: str, title: str, folder: str, content: str):
    """
    Full embedding pipeline for a single note.
    Run as a FastAPI BackgroundTask.
    """
    _indexing_status["is_indexing"] = True
    _indexing_status["current_note_id"] = note_id
    _indexing_status["queue_size"] = max(0, _indexing_status["queue_size"] - 1)
    
    try:
        # 1. Chunk the note
        chunks = chunk_note(note_id, title, folder, content or "")
        
        if not chunks:
            # Empty note — remove any existing chunks
            delete_note_chunks(note_id)
            return
        
        # 2. Generate embeddings
        texts = [c["text"] for c in chunks]
        embeddings = await embed_texts(texts)
        
        # 3. Remove old chunks then upsert new ones
        delete_note_chunks(note_id)
        upsert_chunks(chunks, embeddings)
        
        # 4. Run auto-linking
        await run_autolink(note_id)
        
        _indexing_status["completed"] += 1
        logger.info(f"Embedded note {note_id}: {len(chunks)} chunks")
        
    except Exception as e:
        logger.error(f"Embedding failed for note {note_id}: {e}")
    finally:
        _indexing_status["is_indexing"] = False
        _indexing_status["current_note_id"] = None


async def delete_note_embeddings(note_id: str):
    """Remove all embeddings and auto-links for a deleted note."""
    try:
        delete_note_chunks(note_id)
        from backend.db import get_db_connection
        db = await get_db_connection()
        try:
            await db.execute("DELETE FROM links WHERE source_id = ? OR target_id = ?", (note_id, note_id))
            await db.commit()
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to delete embeddings for note {note_id}: {e}")
