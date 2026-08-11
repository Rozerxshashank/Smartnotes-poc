"""
Chunker service — splits note content into chunks for embedding.
Spec: 512-token window, 64-token overlap, markdown-aware, title-injected prefix.
"""
from langchain_text_splitters import RecursiveCharacterTextSplitter
import re


def strip_yaml_frontmatter(content: str) -> str:
    """Strip YAML front matter from markdown content."""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            return content[end + 3:].strip()
    return content


def chunk_note(note_id: str, title: str, folder: str, content: str) -> list[dict]:
    """
    Split a note into chunks suitable for embedding.
    
    Returns a list of dicts: [{"chunk_id": str, "text": str, "note_id": str, "index": int}]
    """
    content = strip_yaml_frontmatter(content or "")
    
    if not content.strip():
        return []
    
    # RecursiveCharacterTextSplitter with markdown-aware separators
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=64,
        length_function=len,  # character-based approximation (1 token ≈ 4 chars → 512 tokens ≈ 2048 chars)
        separators=[
            "\n\n",   # Paragraphs first
            "\n",     # Then newlines
            ". ",     # Then sentences
            " ",      # Then words
            ""        # Last resort
        ],
        is_separator_regex=False,
    )
    
    chunks = splitter.split_text(content)
    
    # Title injection prefix per §8
    folder_prefix = f" > {folder}" if folder else ""
    title_prefix = f"Title: {title}{folder_prefix}\n\n"
    
    result = []
    for i, chunk_text in enumerate(chunks):
        prefixed_text = title_prefix + chunk_text
        result.append({
            "chunk_id": f"{note_id}_chunk_{i}",
            "text": prefixed_text,
            "note_id": note_id,
            "index": i,
            "raw_text": chunk_text,  # Without title prefix, for display
        })
    
    return result
