# SmartNotes

SmartNotes is a fully local AI notes app. It gives you an easy way to write markdown notes while letting you chat with your knowledge base, search semantically, and see how your notes connect in a visual knowledge graph.

Everything stays on your local machine for privacy. There are no cloud dependencies unless you explicitly choose to use a cloud AI provider.

## Features

* **Local First:** All notes are saved as standard Markdown files on your computer.
* **Smart Search:** Find what you are looking for by meaning, not just exact keywords.
* **Chat with your Notes:** Ask questions and get answers grounded purely in the notes you have written, complete with citations.
* **Auto-linking:** The app automatically finds related notes and links them for you.
* **Knowledge Graph:** Visualize the connections between all your notes.
* **GitHub Sync:** Easily backup or sync your notes to a private GitHub repository.

## Setup Instructions

This app uses an Electron frontend with React and a FastAPI Python backend. You will need Node.js and Python installed to run it.

### 1. Install Node Dependencies
Open a terminal in the project folder and run:
```bash
npm install
```

### 2. Setup the Python Backend
You need to create a Python virtual environment and install the required packages.
```bash
# Create a virtual environment named "venv"
python3 -m venv venv

# Activate it (Mac/Linux)
source venv/bin/activate
# Or on Windows:
# venv\Scripts\activate

# Install the dependencies
pip install fastapi uvicorn aiosqlite pydantic chromadb langchain-text-splitters sentence-transformers tiktoken ollama httpx
```

### 3. Setup Ollama (Recommended)
For the AI chat and embeddings to work locally, it is highly recommended to install Ollama.
1. Download Ollama from their official website.
2. Open a terminal and download the required models:
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```
*(If you do not have Ollama installed, the app will fall back to using your CPU for embeddings, but local chat will not be available unless you provide a cloud API key in the settings).*

### 4. Run the App
With the setup complete, you can start the application in development mode.
```bash
npm run dev
```

This will launch both the React frontend and the Python backend at the same time. The app will automatically create a `SmartNotes` folder in your Documents directory to store your markdown files.
