"""
ChromaDB Store — embedded vector store for semantic search.
Spec: Dual-index pattern — ChromaDB for vectors, SQLite for metadata.
"""
import os
import logging
import chromadb
from chromadb.config import Settings as ChromaSettings

logger = logging.getLogger(__name__)

_client = None
_collection = None

CHROMA_DIR = os.environ.get("SMARTNOTES_CHROMA_DIR", os.path.join(
    os.path.expanduser("~"), ".smartnotes", "chromadb"
))


def get_collection():
    """Get or initialize the ChromaDB collection."""
    global _client, _collection
    if _collection is None:
        os.makedirs(CHROMA_DIR, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = _client.get_or_create_collection(
            name="smartnotes",
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"ChromaDB collection initialized at {CHROMA_DIR}")
    return _collection


def upsert_chunks(chunks: list[dict], embeddings: list[list[float]]):
    """
    Upsert note chunks into ChromaDB.
    
    Args:
        chunks: List of chunk dicts from chunker (must have chunk_id, text, note_id, index)
        embeddings: Corresponding embedding vectors
    """
    collection = get_collection()
    
    if len(chunks) == 0 or len(embeddings) == 0:
        return
    
    ids = [c["chunk_id"] for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [{"note_id": c["note_id"], "chunk_index": c["index"]} for c in chunks]
    
    collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )
    logger.info(f"Upserted {len(chunks)} chunks for note {chunks[0]['note_id']}")


def delete_note_chunks(note_id: str):
    """Remove all chunks for a note from ChromaDB."""
    collection = get_collection()
    
    # Query to find all chunks for this note
    results = collection.get(
        where={"note_id": note_id}
    )
    
    if results["ids"]:
        collection.delete(ids=results["ids"])
        logger.info(f"Deleted {len(results['ids'])} chunks for note {note_id}")


def query_similar(query_embedding: list[float], k: int = 10, exclude_note_id: str = None) -> list[dict]:
    """
    Query ChromaDB for similar chunks.
    
    Returns list of {chunk_id, note_id, text, distance, chunk_index}
    """
    collection = get_collection()
    
    where_filter = None
    if exclude_note_id:
        where_filter = {"note_id": {"$ne": exclude_note_id}}
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=k,
        where=where_filter,
        include=["documents", "metadatas", "distances"]
    )
    
    items = []
    if results["ids"] and results["ids"][0]:
        for i, chunk_id in enumerate(results["ids"][0]):
            items.append({
                "chunk_id": chunk_id,
                "note_id": results["metadatas"][0][i]["note_id"],
                "text": results["documents"][0][i],
                "distance": results["distances"][0][i],
                "chunk_index": results["metadatas"][0][i]["chunk_index"],
            })
    
    return items


def get_all_embeddings_for_note(note_id: str) -> list[dict]:
    """Get all stored embeddings for a note (for auto-linking)."""
    collection = get_collection()
    results = collection.get(
        where={"note_id": note_id},
        include=["embeddings", "metadatas"]
    )
    
    items = []
    if results["ids"]:
        for i, chunk_id in enumerate(results["ids"]):
            items.append({
                "chunk_id": chunk_id,
                "embedding": results["embeddings"][i] if results["embeddings"] else None,
                "note_id": note_id,
            })
    return items
