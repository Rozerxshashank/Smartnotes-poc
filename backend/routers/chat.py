"""
Chat router — SSE streaming RAG endpoint.
Spec: GET /api/ask/stream, grounded answers from notes only, with citations.
"""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
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


class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    provider: Optional[str] = "ollama"
    api_key: Optional[str] = None

async def _generate_stream(messages: List[Message], provider: str = "ollama", api_key: str = None):
    """
    RAG pipeline:
    1. Hybrid search for relevant chunks using the latest user message
    2. Build context from top results
    3. Stream response from Ollama using conversation history
    """
    if not messages:
        return
        
    # Get the latest question for RAG search
    latest_msg = messages[-1].content
    
    # 1. Retrieve relevant chunks
    results = await hybrid_search(latest_msg, k=5)
    
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
    
    # Limit conversation history to last 10 messages to avoid lag and token limits
    history_to_send = messages[-10:] if len(messages) > 10 else messages
    
    # 3. Stream from AI provider
    try:
        if provider == "gemini":
            from google import genai
            if not api_key:
                raise ValueError("Gemini API key is required but not provided in settings.")
            
            client = genai.Client(api_key=api_key)
            gemini_contents = []
            
            # Add system instruction as the first user message
            gemini_contents.append({"role": "user", "parts": [{"text": system_message}]})
            gemini_contents.append({"role": "model", "parts": [{"text": "Understood. I will answer based only on the notes provided."}]})
            
            for m in history_to_send:
                role = "user" if m.role == "user" else "model"
                gemini_contents.append({"role": role, "parts": [{"text": m.content}]})
                
            response = client.models.generate_content_stream(
                model="gemini-1.5-flash",
                contents=gemini_contents
            )
            for chunk in response:
                if chunk.text:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.text})}\n\n"
                    await asyncio.sleep(0)
                    
        else:
            import ollama
            
            ollama_messages = [{"role": "system", "content": system_message}]
            for m in history_to_send:
                ollama_messages.append({"role": m.role, "content": m.content})
                
            stream = ollama.chat(
                model="llama3.2",
                messages=ollama_messages,
                stream=True
            )
            
            for chunk in stream:
                token = chunk["message"]["content"]
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                await asyncio.sleep(0)  # Yield control to event loop
        
    except Exception as e:
        logger.error(f"AI streaming error: {e}")
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            clean_msg = "Error: Rate limit exceeded. You have run out of Gemini API tokens for now. Please wait a moment and try again."
        elif "API key not valid" in err_str or "400" in err_str:
            clean_msg = "Error: Invalid API key. Please check your Gemini API key in settings."
        else:
            clean_msg = f"Error from AI Provider ({provider}): {err_str}"
        yield f"data: {json.dumps({'type': 'token', 'content': clean_msg})}\n\n"
    
    # Final event with sources
    yield f"data: {json.dumps({'type': 'done', 'sources': sources})}\n\n"


@router.post("/stream")
async def ask_stream(request_data: ChatRequest, request: Request):
    """
    SSE streaming endpoint for RAG chat.
    Client consumes via EventSource API (using fetch POST).
    """
    async def event_generator():
        async for event in _generate_stream(request_data.messages, request_data.provider, request_data.api_key):
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
