# PrepAI System Design — Plain English Glossary

> **Purpose of this document:** Explain every technical system design term used in PrepAI in **simple, beginner-friendly English** with real-world everyday examples.
> No complex jargon — just clear explanations so anyone reading this can understand the architecture instantly.

---

## Table of Terms

1. [Polyglot Persistence](#1-polyglot-persistence)
2. [C4 Architecture Model](#2-c4-architecture-model)
3. [ADR (Architecture Decision Record)](#3-adr-architecture-decision-record)
4. [SLO vs. SLA (Service Level Objectives)](#4-slo-vs-sla-service-level-objectives)
5. [p50, p95, p99 Latency (Percentiles)](#5-p50-p95-p99-latency-percentiles)
6. [Async Worker Queue (BullMQ)](#6-async-worker-queue-bullmq)
7. [RAG (Retrieval-Augmented Generation)](#7-rag-retrieval-augmented-generation)
8. [Vector Embeddings & pgvector](#8-vector-embeddings--pgvector)
9. [Rate Limiting & Quota (Redis INCR)](#9-rate-limiting--quota-redis-incr)
10. [Sandboxed Code Execution (Piston)](#10-sandboxed-code-execution-piston)
11. [Idempotency (Idempotency-Key)](#11-idempotency-idempotency-key)
12. [IDOR (Insecure Direct Object Reference)](#12-idor-insecure-direct-object-reference)
13. [RPO & RTO (Disaster Recovery)](#13-rpo--rto-disaster-recovery)
14. [Cache-Aside Pattern](#14-cache-aside-pattern)
15. [JWT (JSON Web Token)](#15-jwt-json-web-token)
16. [Webhook & Signature Verification](#16-webhook--signature-verification)
17. [Materialized Aggregation](#17-materialized-aggregation)

---

### 1. Polyglot Persistence

* **Simple Meaning:** Using **more than one type of database** in the same app because different kinds of data need different storage styles.
* **PrepAI Example:** 
  * **MongoDB** stores User Profiles and Question Banks because question structures change often and are document-like.
  * **PostgreSQL** stores Practice Sessions and Scores because session scores require strict financial-grade accuracy, historical joins, and analytics.
* **Real-World Analogy:** Keeping family photos in a flexible photo album (MongoDB), but writing money transactions in a strict bank ledger (PostgreSQL).

---

### 2. C4 Architecture Model

* **Simple Meaning:** A 4-level zooming map for software architecture, created by Simon Brown. Just like Google Maps (World $\rightarrow$ Country $\rightarrow$ City $\rightarrow$ Street view).
* **Levels in PrepAI:**
  * **Level 1 (Context):** The big picture (User $\rightarrow$ PrepAI $\rightarrow$ External Services like Clerk & NVIDIA AI).
  * **Level 2 (Containers):** The main applications & DBs (React Frontend, Fastify Backend, MongoDB, Postgres, Redis, Piston).
  * **Level 3 (Components):** The internal modules inside the backend (`TheoryModule`, `CodingModule`, `AuthGuard`).
  * **Level 4 (Code):** Individual TypeScript files and functions.
* **Real-World Analogy:** Looking at an architectural blueprint of a house (Level 1: the property, Level 2: the rooms, Level 3: the furniture layout).

---

### 3. ADR (Architecture Decision Record)

* **Simple Meaning:** A short 1-page document explaining **why** a specific technical choice was made, what other options were considered, and what the consequences are.
* **PrepAI Example:** ADR-0003 explains why we picked `pgvector` on Postgres instead of buying a standalone vector database like Pinecone.
* **Real-World Analogy:** A doctor writing a medical note explaining why they chose Medication A over Surgery, so future doctors know the exact reasoning.

---

### 4. SLO vs. SLA (Service Level Objectives)

* **Simple Meaning:**
  * **SLO (Service Level Objective):** Our internal target goal for speed and reliability (e.g. 99.5% uptime).
  * **SLA (Service Level Agreement):** The official promise made to paying customers with financial refunds if broken.
* **PrepAI Example:** Our target is that 99.9% of requests succeed for Premium users (SLO). If downtime exceeds this, we refund their monthly fee (SLA).
* **Real-World Analogy:** A pizza restaurant's internal goal is 20-minute delivery (SLO). Their public customer promise "Free pizza if delivered later than 30 minutes" is the SLA.

---

### 5. p50, p95, p99 Latency (Percentiles)

* **Simple Meaning:** Measuring response speed based on groups of requests rather than taking an average (because averages hide slow responses).
  * **p50 (Median):** The speed experienced by 50% of users.
  * **p95:** The speed experienced by 95% of users (only 5% were slower).
  * **p99:** Worst-case latency for 99% of users (1% outlier).
* **PrepAI Example:** p95 latency = 300ms means 95 out of 100 API requests finish in under 300 milliseconds.
* **Real-World Analogy:** If 95 out of 100 students finish an exam in under 45 minutes, the p95 completion time is 45 minutes, even if 1 student took 3 hours.

---

### 6. Async Worker Queue (BullMQ)

* **Simple Meaning:** A digital waiting line where slow background jobs (like AI evaluations or code compilation) are processed by worker computers so the main website stays fast and instant.
* **PrepAI Example:** When a user submits an answer, the API immediately returns `202 Accepted` (10ms) and pushes the evaluation job to BullMQ. A background worker calls NVIDIA NIM and saves the result without freezing the user's browser.
* **Real-World Analogy:** Ordering coffee at Starbucks. The cashier takes your payment and gives you a receipt immediately (instant HTTP response), while the barista makes your drink in the background (Async Worker).

---

### 7. RAG (Retrieval-Augmented Generation)

* **Simple Meaning:** Giving an AI an "open book" (your uploaded PDF documents) to search before it answers your question, so it doesn't make things up (hallucinate).
* **PrepAI Example:** When you upload a System Design PDF, PrepAI searches the PDF text chunks first and feeds them to NVIDIA NIM to generate accurate practice questions.
* **Real-World Analogy:** An open-book exam where a student looks up exact pages in a textbook before writing their answer, rather than relying on memory alone.

---

### 8. Vector Embeddings & pgvector

* **Simple Meaning:** Converting words, paragraphs, or documents into long lists of numbers (vectors) so a computer can measure how similar two ideas are mathematically. `pgvector` is a PostgreSQL extension that stores these numbers inside Postgres.
* **PrepAI Example:** Converting a PDF paragraph about "Database Sharding" into numbers so when a user searches for "horizontal scaling", Postgres instantly finds the matching PDF section.
* **Real-World Analogy:** Mapping words on a 3D map where words with similar meanings (like "dog" and "puppy") sit right next to each other.

---

### 9. Rate Limiting & Quota (Redis INCR)

* **Simple Meaning:** Counting how many actions a user performs (e.g. 3 practice sessions per day) and blocking them with an HTTP 429 error if they exceed their free limit. `Redis INCR` does this counting atomically in memory.
* **PrepAI Example:** Free users can start 3 theory sessions per day. Redis increments `quota:user123:2026-08-29:sessions` on each start.
* **Real-World Analogy:** A subway turnstile card that only lets you pass 3 times a day. On the 4th tap, the gate stays closed.

---

### 10. Sandboxed Code Execution (Piston)

* **Simple Meaning:** Running untrusted code written by users inside a locked, isolated container (sandbox) so it cannot hack the server, steal files, or consume all CPU memory.
* **PrepAI Example:** When a candidate submits JavaScript or Python code, PrepAI sends it to a Piston Docker container capped at 1 CPU core and 256 MB RAM with network access disabled (`--network=none`).
* **Real-World Analogy:** Handling dangerous chemicals inside a sealed glass biohazard box using rubber gloves.

---

### 11. Idempotency (Idempotency-Key)

* **Simple Meaning:** Ensuring that doing the exact same action multiple times (like double-clicking a button) results in **only ONE action taking place**.
* **PrepAI Example:** Sending an `Idempotency-Key: uuid-123` header on payment verification. If the network retries the request 3 times, the server charges the user only once and returns the cached response.
* **Real-World Analogy:** Pressing an elevator call button 10 times in a row fast—it only calls one elevator, not 10.

---

### 12. IDOR (Insecure Direct Object Reference)

* **Simple Meaning:** A critical security vulnerability where User A can view or edit User B's private data simply by changing an ID number in the web address or API payload.
* **PrepAI Example:** Preventing User A from viewing User B's score by ensuring every database query contains `WHERE userId = currentAuthenticatedUserId`.
* **Real-World Analogy:** Changing your locker ticket number from #10 to #11 and opening someone else's gym locker without showing proof of ownership.

---

### 13. RPO & RTO (Disaster Recovery)

* **Simple Meaning:**
  * **RPO (Recovery Point Objective):** How much data loss you can tolerate when a system crashes (e.g., last 5 minutes of data).
  * **RTO (Recovery Time Objective):** How long it takes to restore the system and bring it back online (e.g., 1 hour).
* **PrepAI Example:** PostgreSQL has an RPO of 5 minutes (via WAL log backups) and an RTO of 1 hour.
* **Real-World Analogy:** Your laptop auto-saves your essay every 5 minutes (RPO = max 5 minutes lost work). Re-booting your laptop takes 10 minutes (RTO = 10 minutes recovery time).

---

### 14. Cache-Aside Pattern

* **Simple Meaning:** Checking a super-fast in-memory cache (Redis) first. If the data is found (cache hit), return it immediately. If missing (cache miss), read from the main database and save a copy in Redis for next time.
* **PrepAI Example:** Fetching the list of interview topics (`GET /topics`). First read checks Redis (`topic:list`). If found, return in 5ms.
* **Real-World Analogy:** Keeping your favorite book on your desk (Cache) so you don't have to walk to the library (Main DB) every single time you want to read a page.

---

### 15. JWT (JSON Web Token)

* **Simple Meaning:** A digitally signed, tamper-proof pass badge given to a user by Clerk after login. The frontend includes this token in the `Authorization: Bearer <token>` header on every API request.
* **PrepAI Example:** The backend verifies the Clerk JWT signature in < 1ms to know exactly who `request.user.id` is without querying the database every time.
* **Real-World Analogy:** A stamped wristband given at a concert entrance so security lets you enter different rooms without checking your physical ID card again.

---

### 16. Webhook & Signature Verification

* **Simple Meaning:** 
  * **Webhook:** An automated HTTP notification sent from an external service (like Clerk or Razorpay) to our server when an event happens (e.g. `user.created` or `payment.captured`).
  * **Signature Verification:** Checking a secret cryptographic hash (Svix header) to prove the notification came from the real service and not a hacker.
* **Real-World Analogy:** A wax seal on a royal letter that proves the message was written by the King and hasn't been altered by anyone on the road.

---

### 17. Materialized Aggregation

* **Simple Meaning:** Pre-computing and saving the results of complex math (like average scores, weak topics, or total sessions) in advance so displaying user dashboards is instant.
* **PrepAI Example:** A nightly background job computes each user's top weak areas and writes them to a `UserWeaknessSnapshot` table.
* **Real-World Analogy:** A restaurant manager writing yesterday's total revenue on a chalkboard at night, rather than adding up thousands of paper receipts every time a boss asks for sales stats.
