<!--
Sync Impact Report:
Version change: INITIAL → 1.0.0
Added sections: All (initial constitution)
Templates requiring updates: ⚠ All templates pending initial spec
Follow-up TODOs: None
-->

# Voice Chat Agent Constitution

## Core Principles

### I. Simplicity First (MANDATORY)
Every feature MUST be implemented using the simplest approach that works. Over-engineering is rejected. The implementation priority is: (1) Make it work, (2) Make it right, (3) Make it fast. Code without user demand is waste.

**Rationale**: Complex code is unmaintainable code. Simple solutions are debuggable, testable, and evolvable.

### II. Never Break User Experience (IRON LAW)
Once an API endpoint is published, backward compatibility is non-negotiable. Frontend interaction flows MUST NOT break due to backend changes. Any change that causes existing functionality to fail is a bug, regardless of theoretical correctness.

**Rationale**: Users depend on consistent behavior. Breaking changes destroy trust and waste integration effort.

### III. Real-time First (CORE ARCHITECTURE)
Chat MUST be real-time. WebSocket is the primary transport mechanism. HTTP polling is unacceptable for core chat functionality. Voice streaming MUST maintain low latency (<200ms end-to-end).

**Rationale**: Chat is fundamentally a real-time interaction. Polling creates poor UX and wastes resources.

### IV. Observability (DEBUGGING REQUIREMENT)
All errors MUST be logged with context. Every user-visible state MUST be traceable to backend events. Debug information MUST be clear enough to reproduce issues from logs alone.

**Rationale**: Debugging production issues without observability is impossible. Logs are the only truth when things break.

### V. Progressive Enhancement (LAYERED IMPLEMENTATION)
Basic text chat MUST work independently. Voice and file upload are enhancement layers that fail gracefully. Core functionality MUST NOT depend on advanced features.

**Rationale**: Reliability comes from isolating complexity. Core features should work even when enhancements fail.

## Technical Constraints

### Stack Requirements
- **Frontend**: React 18+ with TypeScript, styled with TailwindCSS
- **Backend**: Python 3.11+ with FastAPI framework
- **Real-time**: WebSocket for chat, Server-Sent Events (SSE) acceptable for streaming responses
- **Voice**: Web Speech API (browser native) for input; OpenAI Whisper API or similar for advanced features
- **File Storage**: Local filesystem for development; S3-compatible storage optional for production
- **Database**: SQLite for local development; PostgreSQL for production deployment
- **API Documentation**: OpenAPI/Swagger auto-generated from FastAPI

### Performance Standards
- WebSocket message delivery: <100ms p95
- Voice transcription start: <500ms from speech end
- File upload handling: streaming, no RAM buffering for files >10MB
- Frontend initial load: <2s on 3G connection

## Development Workflow

### Test-First Development
Tests MUST be written before implementation. The cycle is:
1. Write failing test
2. Get user/reviewer approval on test cases
3. Implement minimum code to pass tests
4. Refactor while keeping tests green

### Code Quality Gates
- **Complexity limit**: Functions with >3 levels of indentation MUST be refactored before merge
- **File size**: No single file >500 lines (imports excluded)
- **Type coverage**: 100% type annotations in Python backend, no `any` types in TypeScript frontend
- **Test coverage**: Minimum 80% line coverage, 100% for API endpoints

### Review Requirements
All code changes require review that verifies:
1. Compliance with constitutional principles
2. Test coverage meets standards
3. No unnecessary complexity introduced
4. API changes maintain backward compatibility

## Governance

### Amendment Procedure
This constitution supersedes all other project documentation. Amendments require:
1. Written justification for the change
2. Impact analysis on existing code
3. Migration plan if breaking changes needed
4. Version bump according to semantic versioning

### Versioning Policy
- **MAJOR**: Backward-incompatible principle changes or removals
- **MINOR**: New principles added or material expansion of existing ones
- **PATCH**: Clarifications, typo fixes, non-semantic refinements

### Compliance Review
All pull requests MUST include a compliance section verifying no constitutional violations. Complexity MUST be justified with concrete user benefit. When principles conflict, simplicity wins.

**Version**: 1.0.0 | **Ratified**: 2025-10-06 | **Last Amended**: 2025-10-06
