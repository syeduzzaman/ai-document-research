import logging
from contextlib import asynccontextmanager
from uuid import UUID

import psycopg
from fastapi import FastAPI, HTTPException, Query, Response, UploadFile
from fastapi.responses import JSONResponse
from openai import APIError, OpenAI

from app.answers import ProviderError
from app.config import Settings
from app.documents import DocumentError
from app.embeddings import DemoEmbedder, OpenAIEmbedder
from app.repair import RepairCase, RepairChecklist, generate_checklist, sample_checklist
from app.repository import Repository
from app.schemas import (
    Answer,
    Bookmark,
    BookmarkNote,
    Document,
    PassagePage,
    Question,
    SearchQuery,
    Source,
    UploadResult,
)
from app.service import Assistant

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    repository = Repository(settings.database_url)
    client = (
        OpenAI(api_key=settings.openai_api_key, timeout=30.0, max_retries=1)
        if settings.mode == "openai" else None
    )
    embedder = OpenAIEmbedder(client, settings.embedding_model) if client else DemoEmbedder()
    assistant = Assistant(repository, embedder, settings, client)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        repository.initialize()
        if settings.seed_samples:
            for path in sorted(settings.samples_dir.glob("*.md")):
                assistant.ingest(path.name, path.read_bytes())
        yield
        if client:
            client.close()

    app = FastAPI(
        title="AI Document Research", version="0.1.0",
        description="Cited document research, saved evidence, and repair checklists.",
        lifespan=lifespan,
    )

    @app.exception_handler(DocumentError)
    async def document_error_handler(request, exc):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(ProviderError)
    async def provider_error_handler(request, exc):
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    @app.exception_handler(APIError)
    async def api_error_handler(request, exc):
        logger.warning("OpenAI request failed: %s", type(exc).__name__)
        return JSONResponse(status_code=502, content={"detail": "The AI provider is unavailable. Try again."})

    @app.exception_handler(psycopg.Error)
    async def database_error_handler(request, exc):
        logger.error("Database request failed: %s", type(exc).__name__)
        return JSONResponse(status_code=503, content={"detail": "The document database is unavailable."})

    @app.get("/api/health")
    def health():
        repository.ping()
        return {
            "status": "ok", "mode": settings.mode, "embedding_space": embedder.space,
            "supported_types": ["pdf", "txt", "md"], "max_upload_bytes": settings.max_upload_bytes,
        }

    @app.get("/api/documents", response_model=list[Document])
    def documents():
        return repository.list_documents(embedder.space)

    @app.post("/api/documents", response_model=UploadResult, status_code=201)
    def upload(file: UploadFile, response: Response):
        try:
            data = file.file.read(settings.max_upload_bytes + 1)
            if len(data) > settings.max_upload_bytes:
                raise HTTPException(status_code=413, detail="The file exceeds the 10 MiB upload limit.")
            document, created = assistant.ingest(file.filename or "document.txt", data)
            response.status_code = 201 if created else 200
            return UploadResult(document=Document(**document), created=created)
        finally:
            file.file.close()

    @app.delete("/api/documents/{document_id}", status_code=204)
    def delete_document(document_id: UUID):
        if not repository.delete(document_id):
            raise HTTPException(status_code=404, detail="Document not found.")
        return Response(status_code=204)

    @app.get("/api/documents/{document_id}/passages", response_model=PassagePage)
    def document_passages(document_id: UUID, offset: int = Query(0, ge=0), limit: int = Query(12, ge=1, le=30)):
        page = repository.document_passages(document_id, embedder.space, offset, limit)
        if page is None:
            raise HTTPException(status_code=404, detail="Document not found in this workspace.")
        return page

    @app.post("/api/search", response_model=list[Source])
    def search(query: SearchQuery):
        return assistant.retrieve(query.query, query.document_ids, query.top_k)

    @app.get("/api/bookmarks", response_model=list[Bookmark])
    def bookmarks():
        return repository.list_bookmarks(embedder.space)

    @app.put("/api/bookmarks/{chunk_id}", response_model=Bookmark)
    def save_bookmark(chunk_id: int):
        bookmark = repository.save_bookmark(chunk_id, embedder.space)
        if bookmark is None:
            raise HTTPException(status_code=404, detail="Passage not found in this workspace.")
        return bookmark

    @app.patch("/api/bookmarks/{chunk_id}", response_model=Bookmark)
    def update_bookmark(chunk_id: int, body: BookmarkNote):
        bookmark = repository.update_bookmark(chunk_id, embedder.space, body.note)
        if bookmark is None:
            raise HTTPException(status_code=404, detail="Saved passage not found in this workspace.")
        return bookmark

    @app.delete("/api/bookmarks/{chunk_id}", status_code=204)
    def delete_bookmark(chunk_id: int):
        if not repository.delete_bookmark(chunk_id, embedder.space):
            raise HTTPException(status_code=404, detail="Saved passage not found in this workspace.")
        return Response(status_code=204)

    @app.post("/api/ask", response_model=Answer)
    def ask(question: Question):
        return assistant.ask(question)

    @app.get("/api/repair-checklist/sample", response_model=RepairChecklist)
    def repair_sample():
        return sample_checklist(settings.samples_dir)

    @app.post("/api/repair-checklist", response_model=RepairChecklist)
    def repair_checklist(case: RepairCase):
        if client is None:
            raise HTTPException(status_code=409, detail="Enable OpenAI mode to generate a checklist from your files.")
        sources = assistant.retrieve(
            f"{case.scenario}\nRepair estimate submission photos, documents, and approvals.",
            case.document_ids,
            top_k=8,
        )
        return generate_checklist(client, settings.answer_model, case.scenario, sources)

    return app


app = create_app()
