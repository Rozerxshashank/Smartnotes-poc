"""
Importer router — import Obsidian / plain markdown folders.
Spec: Parse [[wikilinks]], preserve folder structure, queue background embedding.
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
import os
import re
import uuid
import time
import hashlib
from backend.db import get_db_connection
from backend.config import SMARTNOTES_DIR
from backend.services.pipeline import embed_note

router = APIRouter(prefix="/import", tags=["import"])


class ImportRequest(BaseModel):
    folder_path: str


async def db_dep():
    db = await get_db_connection()
    try:
        yield db
    finally:
        await db.close()


def extract_wikilinks(content: str) -> list[str]:
    """Extract [[wikilink]] targets from content."""
    return re.findall(r'\[\[([^\]]+)\]\]', content)


@router.post("/folder")
async def import_folder(req: ImportRequest, background_tasks: BackgroundTasks, db=Depends(db_dep)):
    """
    Import all .md files from a folder.
    Returns count immediately, queues embedding in background.
    """
    folder_path = req.folder_path
    if not os.path.isdir(folder_path):
        return {"error": "Folder not found", "count": 0}
    
    imported = []
    
    for root, dirs, files in os.walk(folder_path):
        # Compute relative folder path
        rel_folder = os.path.relpath(root, folder_path)
        if rel_folder == ".":
            rel_folder = ""
        
        for filename in files:
            if not filename.endswith(".md"):
                continue
            
            filepath = os.path.join(root, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            title = os.path.splitext(filename)[0]
            note_id = str(uuid.uuid4())
            now = int(time.time())
            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            
            # Copy file into SmartNotes dir
            dest_filename = filename
            dest_path = os.path.join(SMARTNOTES_DIR, dest_filename)
            counter = 1
            while os.path.exists(dest_path):
                dest_filename = f"{title} ({counter}).md"
                dest_path = os.path.join(SMARTNOTES_DIR, dest_filename)
                counter += 1
            
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            await db.execute(
                "INSERT INTO notes (id, title, content, folder, created_at, updated_at, file_path, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (note_id, title, content, rel_folder, now, now, dest_path, content_hash)
            )
            
            imported.append({"id": note_id, "title": title, "folder": rel_folder})
            
            # Queue background embedding
            background_tasks.add_task(embed_note, note_id, title, rel_folder, content)
    
    await db.commit()
    
    # Parse wikilinks and create manual links
    for item in imported:
        async with db.execute("SELECT content FROM notes WHERE id = ?", (item["id"],)) as cursor:
            row = await cursor.fetchone()
            if row and row[0]:
                wikilinks = extract_wikilinks(row[0])
                for link_title in wikilinks:
                    # Find the target note by title
                    async with db.execute("SELECT id FROM notes WHERE title = ?", (link_title,)) as c2:
                        target = await c2.fetchone()
                        if target:
                            await db.execute(
                                "INSERT OR IGNORE INTO links (source_id, target_id, link_type, similarity_score) VALUES (?, ?, 'manual', 1.0)",
                                (item["id"], target[0])
                            )
    await db.commit()
    
    return {"count": len(imported), "notes": imported}
