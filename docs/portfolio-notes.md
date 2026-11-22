# Explaining this project in an interview

## Short introduction

"I built a document research workspace with Python/FastAPI, PostgreSQL/pgvector, and React with JavaScript and Tailwind CSS. Users can ask questions, open page-level citations, explore the underlying passages, and save evidence with notes. I built a repair estimate workflow that turns cited procedures into a trackable checklist and highlights items for manual review. The project includes a no-key demo and an optional OpenAI pipeline for semantic retrieval and answer generation."

Adjust this wording to reflect what you have personally run, reviewed and understood.

## Useful discussion points

- Why retrieval is needed: provide document context instead of expecting an LLM to know private business information.
- Why citations need application checks: a model-generated reference is not evidence until it maps to a stored source.
- Why model namespaces matter: mixing embedding spaces silently breaks similarity search.
- How saved evidence relates to the document lifecycle. The database stores a chunk reference and note, and removes both references and notes when a source document is deleted.
- Why a lexical demo is useful: reproducible behavior and no API cost during reviews.
- What is measured: retrieval ranking, expected facts and explicit refusals on a small fixture.
- What is not proven: broad answer correctness, production reliability or complete prompt injection resistance.
- What to improve next: hybrid retrieval, reranking, larger evaluations, background ingestion and user isolation.

## CV example

**AI Document Research · Full-stack RAG workspace**

- Built a React, JavaScript, and Tailwind CSS workspace backed by a Python/FastAPI API and PostgreSQL/pgvector, with document ingestion, semantic retrieval via OpenAI, and inspectable page-level citations.
- Developed a persistent evidence notebook and an exportable repair estimate checklist. Verified ingestion, document-scoped search, source provenance, and notebook persistence with Pytest and Playwright.

Do not add latency, accuracy or user-count claims until you have measured them in a stated environment.
