/**
 * Domain Error Types
 *
 * @module domain/errors
 *
 * ## Purpose
 * Defines typed domain errors for business logic violations and constraint failures.
 * These errors represent invariant violations in the simulation's economic and
 * operational rules, providing clear semantics for error handling across layers.
 *
 * ## Error Types
 *
 * ### DomainInvariantError
 * Base error for all domain constraint violations. Represents any breach of
 * business rules, invariants, or domain logic constraints. All other domain
 * errors extend this base class.
 *
 * ### NotFoundError
 * Entity doesn't exist in the system. Used when resource lookups fail
 * (e.g., company, recipe, item, order not found). Extends DomainInvariantError.
 *
 * ### ForbiddenError
 * Operation not permitted due to authorization or permission constraints.
 * Used when validation passes but the operation is not allowed for this actor
 * (e.g., attempting to modify another company's resources).
 *
 * ### OptimisticLockConflictError
 * Concurrent modification detected during optimistic locking. Thrown when
 * a lock version mismatch occurs, indicating another transaction modified
 * the state between read and write. Signals that the client should retry
 * with fresh state.
 *
 * ### InsufficientFundsError
 * Account lacks available cash for the requested operation. Thrown when
 * buy order reservation or cash expense exceeds available (non-reserved)
 * balance. Prevents overspending and ensures cash integrity.
 *
 * ### InsufficientInventoryError
 * Stock unavailable for the requested operation. Thrown when sell order
 * reservation or production input consumption exceeds available (non-reserved)
 * inventory. Prevents overselling and ensures inventory integrity.
 *
 * ## Usage Patterns
 * - Thrown by domain services during validation
 * - Caught at API boundaries and mapped to HTTP status codes
 * - Used to enforce invariants before state mutations
 * - Provide clear error messages for debugging and client feedback
 *
 * ## Error Handling Strategy
 * - Domain layer: Throw typed errors with descriptive messages
 * - Service layer: Propagate or catch for specific handling
 * - API layer: Map to appropriate HTTP codes (400/404/409/422/500)
 * - Never silently swallow these errors - they indicate contract violations
 */
export class DomainInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainInvariantError";
  }
}

export class NotFoundError extends DomainInvariantError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends DomainInvariantError {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class OptimisticLockConflictError extends DomainInvariantError {
  constructor(message: string) {
    super(message);
    this.name = "OptimisticLockConflictError";
  }
}

export class InsufficientFundsError extends DomainInvariantError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

export class InsufficientInventoryError extends DomainInvariantError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientInventoryError";
  }
}
