"""
Embedder service — generates embeddings using Ollama, Mistral, or SBERT fallback.
Spec: Ollama nomic-embed-text → Mistral API → bundled all-MiniLM-L6-v2
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded SBERT model
_sbert_model = None


def _get_sbert_model():
    """Lazy-load the SBERT fallback model."""
    global _sbert_model
    if _sbert_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_path = os.path.join(os.path.dirname(__file__), "..", "..", "resources", "models", "all-MiniLM-L6-v2")
            if os.path.exists(model_path):
                _sbert_model = SentenceTransformer(model_path)
            else:
                # Download from hub as fallback
                _sbert_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SBERT fallback model loaded")
        except Exception as e:
            logger.error(f"Failed to load SBERT model: {e}")
            raise
    return _sbert_model


async def embed_texts(texts: list[str], provider: str = "auto") -> list[list[float]]:
    """
    Embed a list of texts using the configured provider.
    
    Args:
        texts: List of strings to embed
        provider: "ollama", "mistral", "sbert", or "auto" (tries in order)
    
    Returns:
        List of embedding vectors (list of floats)
    """
    if not texts:
        return []
    
    if provider == "auto":
        # Try Ollama first, then SBERT fallback
        try:
            return await _embed_ollama(texts)
        except Exception as e:
            logger.warning(f"Ollama embedding failed: {e}, falling back to SBERT")
            return _embed_sbert(texts)
    elif provider == "ollama":
        return await _embed_ollama(texts)
    elif provider == "mistral":
        return await _embed_mistral(texts)
    elif provider == "sbert":
        return _embed_sbert(texts)
    else:
        raise ValueError(f"Unknown embedding provider: {provider}")


async def _embed_ollama(texts: list[str]) -> list[list[float]]:
    """Embed using Ollama's nomic-embed-text model."""
    import ollama
    
    embeddings = []
    for text in texts:
        response = ollama.embed(model="nomic-embed-text", input=text)
        embeddings.append(response["embeddings"][0])
    return embeddings


async def _embed_mistral(texts: list[str]) -> list[list[float]]:
    """Embed using Mistral's API."""
    import httpx
    
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError("MISTRAL_API_KEY not set")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.mistral.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "mistral-embed", "input": texts}
        )
        response.raise_for_status()
        data = response.json()
        return [item["embedding"] for item in data["data"]]


def _embed_sbert(texts: list[str]) -> list[list[float]]:
    """Embed using bundled SentenceTransformers model (CPU, 384-dim)."""
    model = _get_sbert_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    return [e.tolist() for e in embeddings]
