# Security Remediation Guide

This document provides implementation guidance for addressing the security findings in the Security Audit Report.

## Critical & High Priority Fixes

### 1. Add Authentication to Public Endpoints

#### Issue
Several endpoints expose sensitive data without requiring authentication:
- `GET /v1/companies` - Lists all companies with cash balances
- `GET /v1/players/registry` - Lists all player handles
- Market analytics endpoints

#### Fix: Require Authentication on Company List

**File:** `apps/api/src/companies/companies.controller.ts`

```typescript
// BEFORE (line 16-19)
@Get()
async list() {
  return this.companiesService.listCompanies();
}

// AFTER - Option 1: Require authentication, return only player's companies
@Get()
async list(@CurrentPlayerId() playerId: string) {
  return this.companiesService.listPlayerCompanies(playerId);
}

// AFTER - Option 2: Require authentication, implement visibility rules
@Get()
async list(@CurrentPlayerId() playerId: string) {
  // Return all companies, but with restricted fields for non-owned companies
  return this.companiesService.listCompaniesWithVisibility(playerId);
}
```

**Service Implementation (Option 2 - Recommended):**

```typescript
// apps/api/src/companies/companies.service.ts

async listCompaniesWithVisibility(requestingPlayerId: string) {
  const companies = await this.prisma.company.findMany({
    include: {
      region: {
        select: { id: true, name: true, code: true }
      }
    }
  });

  return companies.map(company => {
    const isOwned = company.ownerPlayerId === requestingPlayerId;
    
    // If owned by requesting player, return full details
    if (isOwned) {
      return {
        id: company.id,
        code: company.code,
        name: company.name,
        specialization: company.specialization,
        cashCents: company.cashCents,
        reservedCashCents: company.reservedCashCents,
        workforceCapacity: company.workforceCapacity,
        region: company.region,
        isOwned: true
      };
    }
    
    // For other companies, return only public information
    return {
      id: company.id,
      code: company.code,
      name: company.name,
      specialization: company.specialization,
      region: company.region,
      isOwned: false
      // Note: cashCents and other sensitive fields are omitted
    };
  });
}
```

#### Fix: Protect Player Registry

**File:** `apps/api/src/players/players.controller.ts`

```typescript
// BEFORE (line 23-26)
@Get("registry")
async registry() {
  return this.playersService.listPlayerRegistry();
}

// AFTER - Require authentication
@Get("registry")
async registry(@CurrentPlayerId() playerId: string) {
  return this.playersService.listPlayerRegistry(playerId);
}
```

**Service Implementation:**

```typescript
// apps/api/src/players/players.service.ts

async listPlayerRegistry(requestingPlayerId: string) {
  // Option 1: Only return minimal public data
  return this.prisma.player.findMany({
    select: {
      id: true,
      handle: true,
      // Don't expose createdAt, companies, etc.
    },
    orderBy: {
      handle: 'asc'
    }
  });
  
  // Option 2: Only return registry if user has completed tutorial
  const requester = await this.prisma.player.findUnique({
    where: { id: requestingPlayerId },
    select: { tutorialCompletedAt: true }
  });
  
  if (!requester?.tutorialCompletedAt) {
    throw new ForbiddenException('Complete tutorial to access player registry');
  }
  
  return this.prisma.player.findMany({
    select: {
      id: true,
      handle: true,
    },
    orderBy: {
      handle: 'asc'
    }
  });
}
```

### 2. Implement Timing-Safe Token Comparison

#### Issue
Bearer token comparison vulnerable to timing attacks in ops endpoints.

**Files:** 
- `apps/api/src/world/world.controller.ts`
- `apps/api/src/ops/ops.controller.ts`

#### Fix: Create Timing-Safe Comparison Utility

**New File:** `apps/api/src/common/utils/timing-safe-compare.ts`

```typescript
import { timingSafeEqual } from 'node:crypto';

/**
 * Compare two strings in constant time to prevent timing attacks.
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  // Handle null/undefined cases
  if (!a || !b) {
    return false;
  }
  
  // Ensure equal length to prevent timing leak
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
```

#### Update World Controller

**File:** `apps/api/src/world/world.controller.ts`

```typescript
import { timingSafeCompare } from '../common/utils/timing-safe-compare';

// BEFORE (around line 69)
const providedToken = /* ... */;
const configuredToken = process.env.CORPSIM_OPS_TOKEN?.trim();

if (providedToken !== configuredToken) {
  throw new UnauthorizedException('Invalid ops token');
}

// AFTER
const providedToken = /* ... */;
const configuredToken = process.env.CORPSIM_OPS_TOKEN?.trim();

if (!configuredToken || !timingSafeCompare(providedToken, configuredToken)) {
  throw new UnauthorizedException('Invalid ops token');
}
```

#### Update Ops Controller

**File:** `apps/api/src/ops/ops.controller.ts`

```typescript
import { timingSafeCompare } from '../common/utils/timing-safe-compare';

// Apply same fix as above (around line 69)
if (!configuredToken || !timingSafeCompare(providedToken, configuredToken)) {
  throw new UnauthorizedException('Invalid ops token');
}
```

### 3. Add Rate Limiting to Admin Operations

#### Issue
Admin operations (refunds, transfers) lack rate limiting.

#### Fix: Install and Configure Throttler

**Step 1: Install Dependencies (if not already installed)**

```bash
pnpm add @nestjs/throttler
```

**Step 2: Configure Throttler Module**

**File:** `apps/api/src/app.module.ts`

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    // Add ThrottlerModule
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000, // 60 seconds
      limit: 100, // 100 requests per minute
    }]),
    // ... other imports
  ],
  providers: [
    // ... other providers
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

**Step 3: Apply Rate Limits to Admin Endpoints**

**File:** `apps/api/src/support/support.controller.ts`

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('v1/support')
export class SupportController {
  // Refund operations - stricter limit
  @Post('refunds')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  async createRefund(/* ... */) {
    // Implementation
  }
  
  // Account unlinking - moderate limit
  @Post('accounts/:accountId/unlink')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 per minute
  async unlinkAccount(/* ... */) {
    // Implementation
  }
  
  // Company transfer - strict limit
  @Post('users/:userId/transfer')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  async transferCompanies(/* ... */) {
    // Implementation
  }
}
```

**File:** `apps/api/src/moderation/moderation.controller.ts`

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('v1/moderation')
export class ModerationController {
  // Order cancellation
  @Post('orders/:orderId/cancel')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 per minute
  async cancelOrder(/* ... */) {
    // Implementation
  }
}
```

## Medium Priority Fixes

### 4. Add Path Parameter Validation

#### Issue
Path parameters lack format validation (e.g., CUID format).

#### Fix: Create Reusable Validation DTOs

**New File:** `apps/api/src/common/dto/cuid-param.dto.ts`

```typescript
import { IsString, Length, Matches } from 'class-validator';

/**
 * Base DTO for validating CUID path parameters.
 * CUIDs are typically 25 characters long and contain lowercase alphanumeric characters.
 */
export class CuidParamDto {
  @IsString()
  @Length(20, 30, {
    message: 'ID must be between 20 and 30 characters'
  })
  @Matches(/^[a-z0-9]+$/, {
    message: 'ID must contain only lowercase letters and numbers'
  })
  id: string;
}

/**
 * DTO for validating userId path parameter
 */
export class UserIdParamDto {
  @IsString()
  @Length(20, 30)
  @Matches(/^[a-z0-9]+$/)
  userId: string;
}

/**
 * DTO for validating orderId path parameter
 */
export class OrderIdParamDto {
  @IsString()
  @Length(20, 30)
  @Matches(/^[a-z0-9]+$/)
  orderId: string;
}

/**
 * DTO for validating accountId path parameter
 */
export class AccountIdParamDto {
  @IsString()
  @Length(20, 30)
  @Matches(/^[a-z0-9]+$/)
  accountId: string;
}
```

#### Update Support Controller

**File:** `apps/api/src/support/support.controller.ts`

```typescript
import { UserIdParamDto, AccountIdParamDto } from '../common/dto/cuid-param.dto';

// BEFORE
@Post('users/:userId/transfer')
async transferCompanies(@Param('userId') userId: string, /* ... */) {
  // Implementation
}

// AFTER
@Post('users/:userId/transfer')
async transferCompanies(@Param() params: UserIdParamDto, /* ... */) {
  const { userId } = params;
  // Implementation
}

// BEFORE
@Post('accounts/:accountId/unlink')
async unlinkAccount(@Param('accountId') accountId: string, /* ... */) {
  // Implementation
}

// AFTER
@Post('accounts/:accountId/unlink')
async unlinkAccount(@Param() params: AccountIdParamDto, /* ... */) {
  const { accountId } = params;
  // Implementation
}
```

### 5. Replace Template Literal $queryRaw

#### Issue
Using template literals in `$queryRaw` relies on implicit parameterization.

**Files:**
- `apps/api/src/moderation/moderation.controller.ts`
- `apps/api/src/support/support.controller.ts`

#### Fix Option 1: Use Prisma Client (Recommended)

**File:** `apps/api/src/moderation/moderation.controller.ts` (around line 144-146)

```typescript
// BEFORE
const result = await this.prisma.$queryRaw<Array<{ role: string | null }>>`
  SELECT role FROM "user" WHERE id = ${userId} LIMIT 1
`;

// AFTER
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  select: { role: true }
});

const result = user ? [{ role: user.role }] : [];
```

#### Fix Option 2: Use Explicit Prisma.sql

```typescript
import { Prisma } from '@prisma/client';

// If raw SQL is absolutely necessary
const result = await this.prisma.$queryRaw<Array<{ role: string | null }>>(
  Prisma.sql`SELECT role FROM "user" WHERE id = ${userId} LIMIT 1`
);
```

**File:** `apps/api/src/schema-readiness/schema-readiness.service.ts` (line 132-134)

```typescript
import { Prisma } from '@prisma/client';

// BEFORE
const result = await prisma.$queryRawUnsafe<Array<{ applied_migrations: number }>>(
  `SELECT COUNT(*)::int AS applied_migrations FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`
);

// AFTER
const result = await prisma.$queryRaw<Array<{ applied_migrations: number }>>(
  Prisma.sql`SELECT COUNT(*)::int AS applied_migrations FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`
);
```

## Long-Term Improvements

### 6. Add Security Headers

**File:** `apps/api/src/main.ts`

```typescript
// Add after app creation
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false
  });
  
  // Add security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // May need adjustment based on frontend
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  }));
  
  // ... rest of configuration
}
```

### 7. Enhanced Error Handling

**File:** `apps/api/src/main.ts`

```typescript
bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  
  if (process.env.NODE_ENV === 'production') {
    // In production, log minimal error details
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('API bootstrap failed', message);
  } else {
    // In development, log full stack trace
    logger.error('API bootstrap failed', error instanceof Error ? error.stack : error);
  }
  
  process.exitCode = 1;
});
```

### 8. Structured Security Logging

**New File:** `apps/api/src/common/utils/security-logger.ts`

```typescript
import { Logger } from '@nestjs/common';

export class SecurityLogger {
  private readonly logger = new Logger('Security');

  logAuthSuccess(userId: string, ip: string | undefined, userAgent: string | undefined) {
    this.logger.log({
      event: 'auth.login.success',
      userId,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  logAuthFailure(reason: string, ip: string | undefined, userAgent: string | undefined) {
    this.logger.warn({
      event: 'auth.login.failure',
      reason,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  logAdminAction(action: string, adminId: string, targetId: string | undefined) {
    this.logger.log({
      event: 'admin.action',
      action,
      adminId,
      targetId,
      timestamp: new Date().toISOString(),
    });
  }

  logSuspiciousActivity(description: string, userId: string | undefined, ip: string | undefined) {
    this.logger.warn({
      event: 'security.suspicious_activity',
      description,
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Testing Security Fixes

### Example Security Tests

**File:** `apps/api/test/security.integration.test.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security (Integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      await request(app.getHttpServer())
        .get('/v1/companies')
        .expect(401);
    });

    it('should reject requests with invalid bearer token', async () => {
      await request(app.getHttpServer())
        .get('/v1/companies')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on admin refund endpoint', async () => {
      const adminToken = 'test-admin-token'; // Mock token
      
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/v1/support/refunds')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ /* refund data */ });
      }
      
      // Next request should be rate limited
      await request(app.getHttpServer())
        .post('/v1/support/refunds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ /* refund data */ })
        .expect(429); // Too Many Requests
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid CUID format in path parameters', async () => {
      await request(app.getHttpServer())
        .get('/v1/companies/invalid-id!')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });

    it('should reject path parameters that are too long', async () => {
      const longId = 'a'.repeat(100);
      await request(app.getHttpServer())
        .get(`/v1/companies/${longId}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });
  });
});
```

## Deployment Checklist

Before deploying these security fixes:

- [ ] Review all changes with security team
- [ ] Update environment variables in production
- [ ] Test all authentication flows
- [ ] Verify rate limiting doesn't affect legitimate users
- [ ] Confirm no breaking changes for frontend
- [ ] Update API documentation
- [ ] Run full test suite
- [ ] Perform penetration testing on staging
- [ ] Monitor logs after deployment for issues
- [ ] Document rollback plan

## Monitoring After Deployment

After deploying security fixes, monitor:

1. **Authentication metrics:**
   - Login success/failure rates
   - Rate limit triggers
   - Suspicious authentication patterns

2. **Performance impact:**
   - Response time changes
   - Database query performance
   - Memory usage

3. **Error rates:**
   - 401 Unauthorized responses
   - 429 Rate Limit responses
   - 403 Forbidden responses

4. **User feedback:**
   - Support tickets related to access issues
   - User complaints about performance

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-16  
**Status:** Implementation Ready
