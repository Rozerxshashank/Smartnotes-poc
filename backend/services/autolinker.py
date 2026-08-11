"""
Auto-linker service — creates automatic links between semantically similar notes.
Spec: threshold 0.75, configurable. link_type = 'auto' vs 'manual' for wikilinks.
"""
import logging
from backend.services.chromadb_store import get_all_embeddings_for_note, query_similar
from backend.db import get_db_connection

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLD = 0.75


async def run_autolink(note_id: str, threshold: float = DEFAULT_THRESHOLD):
    """
    After embedding a note, compare against all other notes.
    If cosine similarity > threshold, create an auto-link.
    
    ChromaDB uses cosine distance (0 = identical, 2 = opposite).
    Similarity = 1 - distance. So threshold 0.75 → distance < 0.25.
    """
    max_distance = 1.0 - threshold
    
    # Get embeddings for this note's chunks
    note_embeddings = get_all_embeddings_for_note(note_id)
    if not note_embeddings:
        return
    
    # For each chunk, find similar chunks from OTHER notes
    similar_notes = set()
    for item in note_embeddings:
        if item["embedding"] is None:
            continue
        results = query_similar(
            query_embedding=item["embedding"],
            k=20,
            exclude_note_id=note_id
        )
        for r in results:
            if r["distance"] <= max_distance:
                similar_notes.add((r["note_id"], 1.0 - r["distance"]))  # (target_id, similarity)
    
    if not similar_notes:
        return
    
    # Keep highest similarity per target note
    best_scores = {}
    for target_id, score in similar_notes:
        if target_id not in best_scores or score > best_scores[target_id]:
            best_scores[target_id] = score
    
    db = await get_db_connection()
    try:
        # Remove old auto-links from this note
        await db.execute(
            "DELETE FROM links WHERE source_id = ? AND link_type = 'auto'",
            (note_id,)
        )
        
        # Insert new auto-links
        for target_id, score in best_scores.items():
            await db.execute(
                "INSERT OR REPLACE INTO links (source_id, target_id, link_type, similarity_score) VALUES (?, ?, 'auto', ?)",
                (note_id, target_id, score)
            )
        
        await db.commit()
        logger.info(f"Auto-linked note {note_id} to {len(best_scores)} notes")
    finally:
        await db.close()
