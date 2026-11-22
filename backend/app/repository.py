from pathlib import Path
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row

from app.documents import Chunk
from app.embeddings import vector_literal

PASSAGE_COLUMNS = "c.id AS chunk_id, d.id AS document_id, d.filename, c.page, c.chunk_index, c.content AS text"
BOOKMARK_COLUMNS = f"{PASSAGE_COLUMNS}, b.note, b.created_at, b.updated_at"


class Repository:
    def __init__(self, database_url: str):
        self.database_url = database_url

    def connect(self):
        return psycopg.connect(self.database_url, row_factory=dict_row, connect_timeout=5)

    def initialize(self):
        with self.connect() as connection:
            connection.execute(Path(__file__).with_name("schema.sql").read_text())

    def ping(self):
        with self.connect() as connection:
            connection.execute("SELECT 1")

    def list_documents(self, space: str):
        with self.connect() as connection:
            return connection.execute(
                "SELECT * FROM documents WHERE embedding_space = %s ORDER BY created_at DESC",
                (space,),
            ).fetchall()

    def insert(self, filename: str, digest: str, space: str, byte_size: int,
               chunks: list[Chunk], vectors: list[list[float]]):
        with self.connect() as connection:
            document = connection.execute(
                """INSERT INTO documents (id, filename, checksum, embedding_space, byte_size, chunk_count)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (checksum, embedding_space) DO NOTHING RETURNING *""",
                (uuid4(), filename, digest, space, byte_size, len(chunks)),
            ).fetchone()
            if document is None:
                return connection.execute(
                    "SELECT * FROM documents WHERE checksum = %s AND embedding_space = %s",
                    (digest, space),
                ).fetchone(), False
            with connection.cursor() as cursor:
                cursor.executemany(
                    """INSERT INTO chunks (document_id, chunk_index, page, content, embedding)
                    VALUES (%s, %s, %s, %s, %s::vector)""",
                    [(document["id"], chunk.index, chunk.page, chunk.text, vector_literal(vector))
                     for chunk, vector in zip(chunks, vectors, strict=True)],
                )
            return document, True

    def delete(self, document_id: UUID) -> bool:
        with self.connect() as connection:
            result = connection.execute("DELETE FROM documents WHERE id = %s", (document_id,))
            return result.rowcount > 0

    def document_passages(self, document_id: UUID, space: str, offset: int, limit: int):
        with self.connect() as connection:
            rows = connection.execute(
                f"""SELECT {PASSAGE_COLUMNS}, d.chunk_count
                FROM documents d
                LEFT JOIN LATERAL (
                    SELECT id, page, chunk_index, content FROM chunks
                    WHERE document_id = d.id ORDER BY chunk_index OFFSET %s LIMIT %s
                ) c ON true
                WHERE d.id = %s AND d.embedding_space = %s
                ORDER BY c.chunk_index""",
                (offset, limit, document_id, space),
            ).fetchall()
        if not rows:
            return None
        return {"passages": [row for row in rows if row["chunk_id"] is not None], "total": rows[0]["chunk_count"]}

    def list_bookmarks(self, space: str):
        with self.connect() as connection:
            return connection.execute(
                f"""SELECT {BOOKMARK_COLUMNS}
                FROM bookmarks b JOIN chunks c ON c.id = b.chunk_id JOIN documents d ON d.id = c.document_id
                WHERE d.embedding_space = %s ORDER BY b.created_at DESC, b.chunk_id DESC""",
                (space,),
            ).fetchall()

    def save_bookmark(self, chunk_id: int, space: str):
        with self.connect() as connection:
            return connection.execute(
                f"""WITH saved AS (
                    INSERT INTO bookmarks (chunk_id)
                    SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id
                    WHERE c.id = %s AND d.embedding_space = %s FOR KEY SHARE OF c
                    ON CONFLICT (chunk_id) DO UPDATE SET chunk_id = EXCLUDED.chunk_id
                    RETURNING *
                )
                SELECT {BOOKMARK_COLUMNS}
                FROM saved b JOIN chunks c ON c.id = b.chunk_id JOIN documents d ON d.id = c.document_id""",
                (chunk_id, space),
            ).fetchone()

    def update_bookmark(self, chunk_id: int, space: str, note: str):
        with self.connect() as connection:
            return connection.execute(
                f"""UPDATE bookmarks b SET note = %s, updated_at = now()
                FROM chunks c JOIN documents d ON d.id = c.document_id
                WHERE b.chunk_id = c.id AND b.chunk_id = %s AND d.embedding_space = %s
                RETURNING {BOOKMARK_COLUMNS}""",
                (note, chunk_id, space),
            ).fetchone()

    def delete_bookmark(self, chunk_id: int, space: str) -> bool:
        with self.connect() as connection:
            result = connection.execute(
                """DELETE FROM bookmarks b USING chunks c, documents d
                WHERE b.chunk_id = c.id AND c.document_id = d.id
                AND b.chunk_id = %s AND d.embedding_space = %s""",
                (chunk_id, space),
            )
            return result.rowcount > 0

    def search(self, vector: list[float], space: str, document_ids: list[UUID], limit: int):
        literal = vector_literal(vector)
        with self.connect() as connection:
            return connection.execute(
                """SELECT c.id AS chunk_id, d.id AS document_id, d.filename, c.page,
                c.chunk_index, c.content, 1 - (c.embedding <=> %s::vector) AS score
                FROM chunks c JOIN documents d ON d.id = c.document_id
                WHERE d.embedding_space = %s
                AND (cardinality(%s::uuid[]) = 0 OR d.id = ANY(%s::uuid[]))
                ORDER BY c.embedding <=> %s::vector, c.id
                LIMIT %s""",
                (literal, space, document_ids, document_ids, literal, limit),
            ).fetchall()
