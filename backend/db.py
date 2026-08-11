import aiosqlite
import os
import uuid
import time
from typing import List, Optional

DB_PATH = os.environ.get("SMARTNOTES_DB_PATH", "smartnotes.db")

async def init_db():
    async with aiosqlite.connect(DB_PATH, uri=True) as db:
        # Create main notes table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                folder TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        
        # Create FTS5 virtual table for keyword search with porter stemming
        await db.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts 
            USING fts5(
                id UNINDEXED,
                title, 
                content, 
                tokenize='porter'
            )
        """)
        
        # Create triggers to keep FTS index in sync with main notes table
        await db.execute("""
            CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes
            BEGIN
                INSERT INTO notes_fts(id, title, content) 
                VALUES (new.id, new.title, new.content);
            END
        """)
        
        await db.execute("""
            CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes
            BEGIN
                UPDATE notes_fts SET 
                    title = new.title, 
                    content = new.content 
                WHERE id = new.id;
            END
        """)
        
        await db.execute("""
            CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes
            BEGIN
                DELETE FROM notes_fts WHERE id = old.id;
            END
        """)

        # Execute migrations based on user_version
        cursor = await db.execute("PRAGMA user_version")
        row = await cursor.fetchone()
        current_version = row[0] if row else 0
        
        # Define migrations
        async def migration_1(conn):
            await conn.execute("ALTER TABLE notes ADD COLUMN file_path TEXT")
            await conn.execute("ALTER TABLE notes ADD COLUMN content_hash TEXT")
        
        async def migration_2(conn):
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS links (
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    link_type TEXT NOT NULL DEFAULT 'auto',
                    similarity_score REAL DEFAULT 0,
                    created_at INTEGER,
                    PRIMARY KEY (source_id, target_id, link_type),
                    FOREIGN KEY (source_id) REFERENCES notes(id) ON DELETE CASCADE,
                    FOREIGN KEY (target_id) REFERENCES notes(id) ON DELETE CASCADE
                )
            """)
            
        migrations = {1: migration_1, 2: migration_2}
        
        target_version = max(migrations.keys()) if migrations else 0
        
        for version in range(current_version + 1, target_version + 1):
            if version in migrations:
                await migrations[version](db)
                await db.execute(f"PRAGMA user_version = {version}")
        
        await db.commit()

async def get_db_connection() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH, uri=True)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db
