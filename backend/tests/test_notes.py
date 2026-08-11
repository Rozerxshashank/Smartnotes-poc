import os
import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport

import tempfile
temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
temp_notes_dir = tempfile.mkdtemp(suffix="_notes")

os.environ["SMARTNOTES_DB_PATH"] = temp_db_path
os.environ["SMARTNOTES_DIR"] = temp_notes_dir
os.environ["IPC_TOKEN"] = "test-token-123"

from backend.main import app
from backend.db import init_db

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    # Initialize the in-memory database
    await init_db()
    yield

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_403_missing_token(client: AsyncClient):
    response = await client.get("/api/notes/")
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_403_invalid_token(client: AsyncClient):
    response = await client.get("/api/notes/", headers={"X-IPC-Token": "wrong-token"})
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_create_note(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    data = {"title": "Test Note", "content": "This is a test"}
    response = await client.post("/api/notes/", json=data, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["title"] == "Test Note"
    assert "id" in res_data
    return res_data["id"]

@pytest.mark.asyncio
async def test_get_notes(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    # Create one first
    await client.post("/api/notes/", json={"title": "Test Note 1"}, headers=headers)
    await client.post("/api/notes/", json={"title": "Test Note 2"}, headers=headers)
    
    response = await client.get("/api/notes/", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 2

@pytest.mark.asyncio
async def test_get_single_note(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    create_res = await client.post("/api/notes/", json={"title": "Test Note Single"}, headers=headers)
    note_id = create_res.json()["id"]
    
    response = await client.get(f"/api/notes/{note_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Test Note Single"

@pytest.mark.asyncio
async def test_404_not_found(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    response = await client.get("/api/notes/non-existent-id", headers=headers)
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_update_note(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    create_res = await client.post("/api/notes/", json={"title": "Old Title"}, headers=headers)
    note_id = create_res.json()["id"]
    
    update_res = await client.put(f"/api/notes/{note_id}", json={"title": "New Title"}, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "New Title"

@pytest.mark.asyncio
async def test_delete_note(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    create_res = await client.post("/api/notes/", json={"title": "To Delete"}, headers=headers)
    note_id = create_res.json()["id"]
    
    del_res = await client.delete(f"/api/notes/{note_id}", headers=headers)
    assert del_res.status_code == 200
    
    # Verify it's gone
    get_res = await client.get(f"/api/notes/{note_id}", headers=headers)
    assert get_res.status_code == 404


# --- Milestone 5 Tests: File Sync ---

@pytest.mark.asyncio
async def test_create_note_writes_file_to_disk(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    data = {"title": "Disk Test", "content": "Hello from disk"}
    res = await client.post("/api/notes/", json=data, headers=headers)
    assert res.status_code == 200
    res_data = res.json()
    
    assert res_data["file_path"] is not None
    assert res_data["content_hash"] is not None
    assert os.path.exists(res_data["file_path"])
    
    with open(res_data["file_path"], "r") as f:
        assert f.read() == "Hello from disk"

@pytest.mark.asyncio
async def test_content_hash_is_sha256(client: AsyncClient):
    import hashlib
    headers = {"X-IPC-Token": "test-token-123"}
    content = "hash me please"
    res = await client.post("/api/notes/", json={"title": "Hash Test", "content": content}, headers=headers)
    expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
    assert res.json()["content_hash"] == expected

@pytest.mark.asyncio
async def test_duplicate_title_increments_filename(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    res1 = await client.post("/api/notes/", json={"title": "Duplicate"}, headers=headers)
    res2 = await client.post("/api/notes/", json={"title": "Duplicate"}, headers=headers)
    
    path1 = res1.json()["file_path"]
    path2 = res2.json()["file_path"]
    
    assert path1 != path2
    assert path1.endswith("Duplicate.md")
    assert path2.endswith("Duplicate (1).md")

@pytest.mark.asyncio
async def test_update_renames_file_on_title_change(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    res = await client.post("/api/notes/", json={"title": "Before Rename", "content": "body"}, headers=headers)
    note_id = res.json()["id"]
    old_path = res.json()["file_path"]
    
    update_res = await client.put(f"/api/notes/{note_id}", json={"title": "After Rename"}, headers=headers)
    new_path = update_res.json()["file_path"]
    
    assert new_path != old_path
    assert not os.path.exists(old_path)
    assert os.path.exists(new_path)

@pytest.mark.asyncio
async def test_delete_removes_file_from_disk(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    res = await client.post("/api/notes/", json={"title": "Will Be Deleted"}, headers=headers)
    file_path = res.json()["file_path"]
    assert os.path.exists(file_path)
    
    await client.delete(f"/api/notes/{res.json()['id']}", headers=headers)
    assert not os.path.exists(file_path)

@pytest.mark.asyncio
async def test_sync_internal_save_ignored(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    res = await client.post("/api/notes/", json={"title": "Sync Test", "content": "same content"}, headers=headers)
    file_path = res.json()["file_path"]
    
    # Simulate Chokidar firing for an internal save (hash should match)
    sync_res = await client.post("/api/sync/fs-event", json={"event": "change", "path": file_path}, headers=headers)
    assert sync_res.status_code == 200
    assert sync_res.json()["reason"] == "Internal save"

@pytest.mark.asyncio
async def test_sync_external_edit_detected(client: AsyncClient):
    headers = {"X-IPC-Token": "test-token-123"}
    res = await client.post("/api/notes/", json={"title": "Sync External", "content": "original"}, headers=headers)
    file_path = res.json()["file_path"]
    
    # Simulate an external editor changing the file
    with open(file_path, "w") as f:
        f.write("externally modified content")
    
    sync_res = await client.post("/api/sync/fs-event", json={"event": "change", "path": file_path}, headers=headers)
    assert sync_res.status_code == 200
    assert sync_res.json()["action"] == "logged_external_edit"
