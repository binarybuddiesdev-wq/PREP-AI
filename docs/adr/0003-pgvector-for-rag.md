# ADR-0003: pgvector (not Pinecone/Qdrant) for RAG embeddings

## Status
Accepted, 2026-08-29

## Context

The PDF Study mode generates questions via RAG over user-uploaded PDFs. We
need a vector store. Options:

1. **pgvector** — Postgres extension, lives in our existing Postgres
2. **Pinecone** — managed vector DB, separate service
3. **Qdrant** — open-source, self-hosted
4. **Weaviate** — open-source, more features
5. **MongoDB Atlas Vector Search** — since we already have Atlas

## Decision

We will use **pgvector** inside the existing PostgreSQL instance.

Schema:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE pdf_chunk (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id       UUID NOT NULL REFERENCES pdf_source(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,
  embedding    VECTOR(1024) NOT NULL,    -- 1024-d from NVIDIA nv-embed-v1
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON pdf_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON pdf_chunk (user_id, pdf_id) WHERE deleted_at IS NULL;
```

Query: `SELECT id, content FROM pdf_chunk WHERE user_id = $1 AND deleted_at IS NULL ORDER BY embedding <=> $2 LIMIT 8;`

## Consequences

**Easier:**
- One database for transactional + vector data — single backup, single
  connection pool, single transaction boundary
- Metadata filtering is SQL: `WHERE user_id = $1 AND pdf_id = $2` joins
  naturally with the relational tables
- No new vendor / managed service
- Free and open-source

**Harder:**
- pgvector tops out around 10M vectors per table at acceptable latency;
  if we cross that we migrate to Qdrant or Pinecone
- Index tuning (`lists` parameter) is needed as data grows — re-index
  periodically
- Slower than dedicated vector DBs at extreme scale (>50M vectors)
- Recall at default settings is good but not best-in-class; may need
  re-ranking for premium tier

## Alternatives considered

- **Pinecone.** Rejected for v1: another vendor, another bill, another
  compliance surface. Reconsider if pgvector becomes a bottleneck.
- **Qdrant.** Rejected for v1: another service to operate. Better recall and
  filtering, but the dev cost is not justified at our scale.
- **MongoDB Atlas Vector Search.** Rejected: keeps us locked to Atlas; we'd
  prefer to be able to self-host Postgres if needed.

## References

- [pgvector docs](https://github.com/pgvector/pgvector)
- [Supabase: pgvector vs Pinecone](https://supabase.com/blog/pgvector-vs-pinecone)
- `Decisions/DECISIONS-1.md` §"PDF as Question Sources"
- [SYSTEM_DESIGN_REVIEW.md §B.7](../../SYSTEM_DESIGN_REVIEW.md)
