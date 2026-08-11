from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
import uuid
import time
import os
import re
import hashlib
from typing import List, Optional
from backend.db import get_db_connection
from backend.config import SMARTNOTES_DIR
from backend.services.pipeline import embed_note, delete_note_embeddings

router = APIRouter(prefix="/notes", tags=["notes"])

# --- Utilities ---

def compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def sanitize_title(title: str) -> str:
    # Remove illegal characters for filesystems
    s = re.sub(r'[<>:"/\\|?*]', '', title)
    s = s.strip()
    return s if s else "Untitled"

async def get_free_filename(db, sanitized_title: str, current_note_id: str = None) -> str:
    base_name = f"{sanitized_title}.md"
    
    async def is_free(name):
        path = os.path.join(SMARTNOTES_DIR, name)
        # Check if another note claims this path in the DB
        async with db.execute("SELECT id FROM notes WHERE file_path = ?", (path,)) as cursor:
            row = await cursor.fetchone()
            if row:
                # If the row belongs to the current note, it's "free" for us to reuse
                if row[0] == current_note_id:
                    return True
                # Another note owns this path
                return False
        # No DB entry claims this path. Check filesystem for orphan files.
        if os.path.exists(path):
            return False
        return True

    if await is_free(base_name):
        return base_name
        
    # Append (1), (2), etc. — always start from 1 so deleted slots are reclaimed
    counter = 1
    while True:
        name = f"{sanitized_title} ({counter}).md"
        if await is_free(name):
            return name
        counter += 1

# --- Schemas ---

class NoteBase(BaseModel):
    title: str = Field(..., title="Title of the note")
    content: Optional[str] = ""
    folder: Optional[str] = ""

class NoteCreate(NoteBase):
    pass

class NoteUpdate(NoteBase):
    title: Optional[str] = None
    content: Optional[str] = None
    folder: Optional[str] = None

class NoteResponse(NoteBase):
    id: str
    created_at: int
    updated_at: int
    file_path: Optional[str] = None
    content_hash: Optional[str] = None

# --- Dependencies ---

async def db_dep():
    db = await get_db_connection()
    try:
        yield db
    finally:
        await db.close()

# --- Endpoints ---

@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate, background_tasks: BackgroundTasks, db = Depends(db_dep)):
    note_id = str(uuid.uuid4())
    now = int(time.time())
    
    sanitized = sanitize_title(note.title)
    filename = await get_free_filename(db, sanitized, current_note_id=note_id)
    file_path = os.path.join(SMARTNOTES_DIR, filename)
    
    content_str = note.content or ""
    content_hash = compute_hash(content_str)
    
    # 1. WRITE TO DB FIRST
    await db.execute(
        "INSERT INTO notes (id, title, content, folder, created_at, updated_at, file_path, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (note_id, note.title, note.content, note.folder, now, now, file_path, content_hash)
    )
    await db.commit()
    
    # 2. WRITE TO DISK
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content_str)
    
    # 3. BACKGROUND EMBED
    background_tasks.add_task(embed_note, note_id, note.title, note.folder or "", content_str)
    
    return {
        "id": note_id,
        "title": note.title,
        "content": note.content,
        "folder": note.folder,
        "created_at": now,
        "updated_at": now,
        "file_path": file_path,
        "content_hash": content_hash
    }

@router.get("/", response_model=List[NoteResponse])
async def list_notes(db = Depends(db_dep)):
    async with db.execute("SELECT * FROM notes ORDER BY updated_at DESC") as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str, db = Depends(db_dep)):
    async with db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return dict(row)

@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note_update: NoteUpdate, background_tasks: BackgroundTasks, db = Depends(db_dep)):
    async with db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)) as cursor:
        existing = await cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Note not found")
    
    existing_dict = dict(existing)
    now = int(time.time())
    
    new_title = note_update.title if note_update.title is not None else existing_dict["title"]
    new_content = note_update.content if note_update.content is not None else (existing_dict["content"] or "")
    new_folder = note_update.folder if note_update.folder is not None else existing_dict["folder"]
    
    content_hash = compute_hash(new_content)
    
    old_file_path = existing_dict.get("file_path")
    
    # Did title change? Might need rename
    if note_update.title is not None and note_update.title != existing_dict["title"]:
        sanitized = sanitize_title(new_title)
        new_filename = await get_free_filename(db, sanitized, current_note_id=note_id)
        new_file_path = os.path.join(SMARTNOTES_DIR, new_filename)
    else:
        new_file_path = old_file_path
        
    # If old_file_path is None (e.g. legacy row), calculate a new path
    if not new_file_path:
        sanitized = sanitize_title(new_title)
        new_filename = await get_free_filename(db, sanitized, current_note_id=note_id)
        new_file_path = os.path.join(SMARTNOTES_DIR, new_filename)

    # 1. WRITE TO DB FIRST
    await db.execute(
        "UPDATE notes SET title = ?, content = ?, folder = ?, updated_at = ?, file_path = ?, content_hash = ? WHERE id = ?",
        (new_title, new_content, new_folder, now, new_file_path, content_hash, note_id)
    )
    await db.commit()
    
    # 2. WRITE/RENAME ON DISK
    if old_file_path and old_file_path != new_file_path and os.path.exists(old_file_path):
        os.rename(old_file_path, new_file_path)
        
    with open(new_file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    # 3. BACKGROUND EMBED
    background_tasks.add_task(embed_note, note_id, new_title, new_folder or "", new_content)
    
    # Fetch and return updated note
    async with db.execute("SELECT * FROM notes WHERE id = ?", (note_id,)) as cursor:
        updated_row = await cursor.fetchone()
        if not updated_row:
            raise HTTPException(status_code=404, detail="Note not found after update")
        return dict(updated_row)

@router.delete("/{note_id}")
async def delete_note(note_id: str, background_tasks: BackgroundTasks, db = Depends(db_dep)):
    async with db.execute("SELECT id, file_path FROM notes WHERE id = ?", (note_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
            
        file_path = row[1]
            
    await db.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    await db.commit()
    
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    
    # Clean up embeddings and links
    background_tasks.add_task(delete_note_embeddings, note_id)
    
    return {"status": "deleted", "id": note_id}

@router.get("/{note_id}/links")
async def get_note_links(note_id: str, db = Depends(db_dep)):
    # Fetch all notes that are linked to this note, or this note links to
    query = """
        SELECT DISTINCT n.id, n.title 
        FROM notes n
        JOIN links l ON (n.id = l.target_id OR n.id = l.source_id)
        WHERE (l.source_id = ? OR l.target_id = ?) AND n.id != ?
    """
    async with db.execute(query, (note_id, note_id, note_id)) as cursor:
        rows = await cursor.fetchall()
        return [{"id": row["id"], "title": row["title"]} for row in rows]
