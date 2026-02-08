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
