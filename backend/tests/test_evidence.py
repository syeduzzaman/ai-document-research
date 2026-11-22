from uuid import uuid4

from app.config import Settings
from app.documents import Chunk
from app.embeddings import DemoEmbedder
from app.repository import Repository


def test_search_and_paginated_browsing_use_the_requested_documents(client):
    text = "The warehouse has a bicycle warranty of 42 months. " * 30
    upload = client.post("/api/documents", files={"file": ("warranty.txt", text.encode(), "text/plain")})
    document = upload.json()["document"]
    first = client.get(f"/api/documents/{document['id']}/passages", params={"limit": 1})
    second = client.get(f"/api/documents/{document['id']}/passages", params={"offset": 1, "limit": 1})
    assert first.status_code == second.status_code == 200
    assert first.json()["total"] == second.json()["total"] == document["chunk_count"]
    assert first.json()["passages"][0]["chunk_index"] == 0
    assert second.json()["passages"][0]["chunk_index"] == 1
    beyond_end = client.get(f"/api/documents/{document['id']}/passages", params={"offset": 500})
    assert beyond_end.json() == {"passages": [], "total": document["chunk_count"]}
    assert client.get(f"/api/documents/{uuid4()}/passages").status_code == 404

    query = {"query": "bicycle warranty", "document_ids": [document["id"]], "top_k": 1}
    result = client.post("/api/search", json=query)
    assert result.status_code == 200
    assert result.json()[0]["document_id"] == document["id"]
    assert "42 months" in result.json()[0]["text"]
    assert client.post("/api/search", json={**query, "document_ids": [str(uuid4())]}).json() == []


def test_bookmark_edits_survive_duplicate_saves_and_cascade_on_document_delete(client):
    upload = client.post("/api/documents", files={"file": ("policy.txt", b"Backups run daily.", "text/plain")})
    document_id = upload.json()["document"]["id"]
    passage = client.get(f"/api/documents/{document_id}/passages").json()["passages"][0]
    path = f"/api/bookmarks/{passage['chunk_id']}"
    assert client.put(path).json()["note"] == ""
    assert client.patch(path, json={"note": " Review this cadence. "}).json()["note"] == "Review this cadence."
    assert client.put(path).json()["note"] == "Review this cadence."
    assert client.get("/api/bookmarks").json()[0]["text"] == "Backups run daily."
    assert client.delete(path).status_code == 204
    assert client.get("/api/bookmarks").json() == []
    assert client.put(path).status_code == 200
    assert client.delete(f"/api/documents/{document_id}").status_code == 204
    assert client.get("/api/bookmarks").json() == []
    assert client.put(path).status_code == 404


def test_evidence_endpoints_do_not_expose_other_embedding_spaces(client, settings: Settings):
    repository = Repository(settings.database_url)
    document, _ = repository.insert(
        "hidden.txt", "other-space-digest", "other-space", 12,
        [Chunk("Hidden text.", page=1, index=0)], DemoEmbedder().embed(["Hidden text."]),
    )
    passage = repository.document_passages(document["id"], "other-space", 0, 1)["passages"][0]
    repository.save_bookmark(passage["chunk_id"], "other-space")
    path = f"/api/bookmarks/{passage['chunk_id']}"
    assert client.get(f"/api/documents/{document['id']}/passages").status_code == 404
    assert client.get("/api/bookmarks").json() == []
    assert client.put(path).status_code == 404
    assert client.patch(path, json={"note": "new note"}).status_code == 404
    assert client.delete(path).status_code == 404
