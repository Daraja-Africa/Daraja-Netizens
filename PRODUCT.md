# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are enterprise staff, facilitators, and administrators running secure virtual meetings, events, and attendance-driven sessions. They need to launch rooms, verify participants, and monitor engagement without managing unreliable public conferencing infrastructure.

## Product Purpose

Daraja Netizens provides a secure, self-hosted video conferencing platform for enterprise collaboration and attendance tracking. Success means a host can create a meeting, grant access through a validated JWT flow, and generate reliable attendance/telemetry records from live sessions.

## Positioning

The product differentiates itself through a self-hosted Jitsi architecture, secure room access, and telemetry designed for compliance and operational visibility. It is positioned as a practical alternative to public video services for organizations that need data control, domain security, and formal participation records.

## Operating Context

The core workflow is: create a room, validate a participant or host, join a secure conference, capture live session telemetry, and record attendance summaries. The platform is designed for business meetings, hosted sessions, and enterprise collaboration inside controlled domains and trust boundaries.

## Capabilities and Constraints

- self-hosted Jitsi deployment using Prosody, Jicofo, JVB, and TURN
- secure room access issued via short-lived JWT tokens
- attendance logs and session telemetry exported from client event hooks
- PWA-first web experience with an Android-compatible deployment path
- PostgreSQL and Redis-backed backend design for persistence and async telemetry buffering
- public conferencing infrastructure is explicitly avoided in production due to rate limits and security constraints

## Brand Commitments

The platform name is Daraja Netizens. The product should feel premium, confident, and operationally trustworthy without becoming flashy or gimmicky. It is enterprise-focused and security-conscious, with a modern dark interface and precision-oriented controls.

## Evidence on Hand

- Daraja Netizens Development Plan.docx in the repository root
- Jitsi-first architecture and JWT-based room security documented in the brief
- local monorepo scaffolding for a React frontend and Express API
- Docker-based local infrastructure for Postgres and Redis

## Product Principles

1. Security is a product feature, not a late-stage add-on.
2. Meeting quality and operational visibility matter as much as conversation flow.
3. Attendance telemetry must be trustworthy, auditable, and resilient under load.
4. The product should feel premium and enterprise-ready without sacrificing usability.

## Accessibility & Inclusion

The product should support keyboard usage, strong contrast, accessible labels, and clear status messaging. It must avoid hidden assumptions about device capabilities or participant environment.
