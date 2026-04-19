# Schemr

**Vision:** A lightweight, centralized workspace for creating, storing, and retrieving diagrammatic thinking using a frictionless drawing interface.
**For:** Developers, tech leads, and knowledge workers who frequently sketch architectures, flows, and ideas.
**Solves:** Fragmentation of visual artifacts by providing a persistent, searchable repository for diagrams created with Excalidraw.

## Goals

- Enable users to create and persist diagrams with <2s save latency and reliable retrieval (99% success rate).
- Provide a simple index/list view to access previously created diagrams within 1 interaction (no deep navigation).

## Tech Stack

**Core:**

- Framework: Next.js 16 (App Router)
- Language: TypeScript 5
- Styling: Tailwind CSS 4

**Key dependencies:** 

- Excalidraw (drawing engine)
- Prisma (data access layer)
- PostgreSQL (persistence)
- Zod (runtime validation)
- NextAuth.js (authentication)

## Scope

**v1 includes:**

- Embed Excalidraw as the primary drawing interface.
- Persist and load diagrams (JSON-based) via backend API.
- Basic listing/index of saved diagrams (name + last updated).
- User authentication and ownership of diagrams (each user accesses only their data).

**Explicitly out of scope:**

- Real-time collaboration (multi-user editing)
- Fine-grained versioning / history diffing

## Infrastructure

- **Deploy:** Vercel
- **Database:** PostgreSQL (existing managed instance for staging/prod)
- **Local dev:** Docker image with PostgreSQL

## Constraints

- Timeline: 1–2 weeks for a functional MVP.
- Technical: Client-heavy rendering (Excalidraw) with simple JSON persistence; no real-time infra.
- Resources: Single developer; minimal operational overhead preferred.
