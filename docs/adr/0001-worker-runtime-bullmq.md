# ADR 0001: Worker Runtime Uses BullMQ

- Status: Accepted
- Date: 2026-02-13
- Deciders: CorpSim maintainers

## Context

CorpSim currently runs simulation ticks in-process with a timer loop (`setTimeout`) inside the worker runtime.
Project architecture rules require Redis + BullMQ for worker scheduling and processing.

This mismatch creates two problems:

1. Documentation and implementation are out of sync.
2. Horizontal worker scaling and queue-level observability are blocked.

## Decision

CorpSim will migrate the worker runtime to BullMQ and Redis as the authoritative scheduling/processing layer.

The target model is:

- A BullMQ queue dedicated to simulation tick processing.
- A repeatable scheduler job that enqueues tick work on interval.
- A BullMQ worker processor that executes one deterministic simulation iteration per job.
- Concurrency and idempotency controls remain enforced in simulation/domain services.

## Transitional Rule

Until BullMQ migration is fully completed, the existing in-process loop is temporary and must run as a single worker instance only.
No new scaling assumptions may be made on top of the loop implementation.

## Consequences

Positive:

- Aligns implementation with project architecture requirements.
- Enables safer multi-instance worker deployment.
- Improves operational visibility (queue depth, retries, dead-letter behavior).

Negative:

- Adds integration complexity and deployment steps (queue setup, workers, scheduling).
- Requires migration work before further worker-runtime expansion.

## Migration Plan

1. Add BullMQ queue + scheduler bootstrap in `apps/worker`.
2. Move iteration execution behind a BullMQ processor.
3. Preserve existing deterministic/invariant checks from current loop.
4. Remove timer-loop startup path after parity verification.
5. Add worker runtime integration tests for queue scheduling and retry behavior.
