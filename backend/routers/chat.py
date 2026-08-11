"""
Chat router — SSE streaming RAG endpoint.
Spec: GET /api/ask/stream, grounded answers from notes only, with citations.
"""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from backend.services.search import hybrid_search
from backend.db import get_db_connection
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ask", tags=["chat"])

SYSTEM_PROMPT = """You are SmartNotes AI, a helpful assistant that answers questions based ONLY on the user's notes.

RULES:
1. ONLY use information from the provided note excerpts below. Do NOT use your general knowledge.
2. For every claim you make, cite the source note using the format [Note: Title].
3. If the answer cannot be found in the provided notes, say "I couldn't find information about that in your notes." Do NOT hallucinate or make up answers.
4. Be concise but thorough.

USER'S NOTES:
{context}
"""


async def _generate_stream(question: str):
    """
    RAG pipeline:
    1. Hybrid search for relevant chunks
    2. Build context from top results
    3. Stream response from Ollama
    """
    # 1. Retrieve relevant chunks
    results = await hybrid_search(question, k=5)
    
    if not results:
        msg = "I couldn't find any relevant notes to answer your question."
        yield f"data: {json.dumps({'type': 'token', 'content': msg})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'sources': []})}\n\n"
        return
    
    # 2. Build context from results
    sources = []
    context_parts = []
    
    db = await get_db_connection()
    try:
        for r in results:
            note_id = r["note_id"]
            async with db.execute("SELECT title, content FROM notes WHERE id = ?", (note_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    title = row[0]
                    content = row[1][:2000] if row[1] else ""  # Limit context size
                    context_parts.append(f"--- Note: {title} ---\n{content}\n")
                    if note_id not in [s["id"] for s in sources]:
                        sources.append({"id": note_id, "title": title})
    finally:
        await db.close()
    
    context = "\n".join(context_parts)
    system_message = SYSTEM_PROMPT.format(context=context)
    
    # 3. Stream from Ollama
    try:
        import ollama
        
        stream = ollama.chat(
            model="llama3.2",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": question}
            ],
            stream=True
        )
        
        for chunk in stream:
            token = chunk["message"]["content"]
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            await asyncio.sleep(0)  # Yield control to event loop
        
    except Exception as e:
        logger.error(f"Ollama streaming error: {e}")
        yield f"data: {json.dumps({'type': 'token', 'content': f'Error connecting to Ollama: {str(e)}. Make sure Ollama is running with llama3.2 model installed.'})}\n\n"
    
    # Final event with sources
    yield f"data: {json.dumps({'type': 'done', 'sources': sources})}\n\n"


@router.get("/stream")
async def ask_stream(q: str, request: Request):
    """
    SSE streaming endpoint for RAG chat.
    Client consumes via EventSource API.
    """
    async def event_generator():
        async for event in _generate_stream(q):
            # Check if client disconnected
            if await request.is_disconnected():
                logger.info("Client disconnected, stopping stream")
                break
            yield event
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
