from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Document(BaseModel):
    id: UUID
    filename: str
    byte_size: int
    chunk_count: int
    created_at: datetime


class UploadResult(BaseModel):
    document: Document
    created: bool


class RetrievalScope(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    document_ids: list[UUID] = Field(default_factory=list, max_length=20)
    top_k: int = Field(default=3, ge=1, le=8)


class Question(RetrievalScope):
    question: str = Field(min_length=3, max_length=2000)


class SearchQuery(RetrievalScope):
    query: str = Field(min_length=3, max_length=2000)


class Passage(BaseModel):
    chunk_id: int
    document_id: UUID
    filename: str
    page: int
    chunk_index: int
    text: str


class PassagePage(BaseModel):
    passages: list[Passage]
    total: int


class Source(Passage):
    id: int
    score: float


class Bookmark(Passage):
    note: str
    created_at: datetime
    updated_at: datetime


class BookmarkNote(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    note: str = Field(max_length=2000)


class Answer(BaseModel):
    answer: str
    sources: list[Source]
    mode: Literal["demo", "openai"]
    refused: bool
    elapsed_ms: int
