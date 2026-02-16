# CorpSim Security Audit Report

**Date:** 2026-02-16  
**Auditor:** GitHub Copilot Agent  
**Scope:** Primary focus on apps/api, with review of shared packages and configuration  
**Version:** Current codebase state

---

## Executive Summary

This comprehensive security audit examined the CorpSim codebase with primary emphasis on the API layer. The audit assessed authentication/authorization flows, input validation, error handling, data access boundaries, role-based access control, dependency vulnerabilities, and configuration security.

**Overall Security Posture:** **GOOD** with some areas requiring attention

**Key Findings:**
- ✅ **0 Critical vulnerabilities** in dependencies
- ⚠️ **2 High-severity issues** requiring immediate attention
- ⚠️ **5 Medium-severity issues** recommended for remediation
- ✅ Strong authentication foundation with better-auth
- ✅ Comprehensive input validation via NestJS ValidationPipe
- ✅ Proper use of Prisma ORM preventing SQL injection

---

## 1. Authentication & Authorization Assessment

### 🟢 Strengths

**1.1 Authentication Framework**
- **Implementation:** better-auth library with Prisma adapter
- **Methods Supported:**
  - Email/password authentication
  - OAuth providers (Google, GitHub, Microsoft, Discord)
  - Two-factor authentication (TOTP + backup codes)
  - Username-based authentication
- **Session Management:**
  - Session-based authentication with secure cookies (enabled in production)
  - Configurable session expiration
  - IP address and user agent tracking
  - Support for session impersonation (for admin support)

**1.2 Authorization Controls**
- `@CurrentPlayerId()` decorator enforces authentication on player endpoints
- Admin role validation prevents admin accounts from accessing player gameplay
- Comma-separated role support in `User.role` field
- Admin protection mechanisms:
  - Admin accounts cannot be banned
  - Main admin role cannot be removed
  - Only main admin can remove other admin roles
  - Admin accounts cannot link external OAuth providers

**1.3 Rate Limiting**
- Comprehensive rate limiting on authentication endpoints
- Configurable per-route limits:
  - Sign-in: 8 requests per 5 minutes
  - Sign-up: 5 requests per 15 minutes
  - Two-factor: 10 requests per 5 minutes
  - Password reset: 5 requests per 15 minutes
- Storage options: memory, database, or secondary-storage
- IPv6 subnet handling for accurate client tracking

### 🟡 Weaknesses

**1.4 High Severity: Public Endpoints Exposing Sensitive Data**

**Affected Endpoints:**
```
GET /v1/companies                    - Lists ALL companies with cash balances
GET /v1/companies/specializations    - Lists specialization options  
GET /v1/market/candles               - Market price data
GET /v1/market/analytics/summary     - Market analytics
GET /v1/market/trades                - All trade history
GET /v1/players/registry             - All player usernames/handles
```

**Risk:** Players can enumerate all companies and their financial status without authentication, enabling:
- Market manipulation through information asymmetry
- Player enumeration and targeting
- Social engineering attacks
- Unfair competitive advantages

**Recommendation:**
```typescript
// Add authentication requirement
@Get()
async listCompanies(@CurrentPlayerId() playerId: string) {
  // Option 1: Only show player's own companies
  // Option 2: Segment by region/visibility rules
  // Option 3: Add opt-in public profile feature
}

// Protect player registry
@Get('registry')
async getPlayerRegistry(@CurrentPlayerId() playerId: string) {
  // Return only necessary data for authenticated users
}
```

**1.5 Medium Severity: Missing Rate Limiting on Admin Operations**

**Affected Operations:**
- Financial refunds (`POST /v1/support/refunds`)
- Order cancellations (`POST /v1/moderation/orders/:orderId/cancel`)
- Account unlinking (`POST /v1/support/accounts/:accountId/unlink`)
- Company data transfers (`POST /v1/support/users/:userId/transfer`)

**Risk:** Compromised admin account could abuse financial operations

**Recommendation:**
```typescript
import { Throttle } from '@nestjs/throttler';

@Post('refunds')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
async createRefund(@Body() body: CreateRefundDto) {
  // Implementation
}
```

---

## 2. Input Validation & Error Handling

### 🟢 Strengths

**2.1 Global ValidationPipe Configuration**
```typescript
// apps/api/src/main.ts
new ValidationPipe({
  whitelist: true,              // Strips unknown properties
  forbidNonWhitelisted: true,   // Errors on unknown properties
  forbidUnknownValues: true,    // Rejects unknown values
  transform: false,             // Type safety preserved
  stopAtFirstError: true        // Performance optimization
})
```

**2.2 Numeric Input Constraints**
- Consistent validation on pagination limits (max 500-10,000)
- BigInt usage for financial values (prevents overflow)
- Proper integer parsing with bounds checking
- Transform functions validate and constrain numeric inputs

**2.3 Error Handling**
- Custom `HttpErrorFilter` maps domain errors to HTTP responses
- Handles domain invariants, optimistic lock conflicts, forbidden/not-found errors
- No sensitive data leaked in error responses to clients
- Proper logging with context for debugging

### 🟡 Weaknesses

**2.4 Medium Severity: Missing Path Parameter Validation**

**Affected Endpoints:**
```typescript
// support.controller.ts
@Post('users/:userId/transfer')
async transferCompanies(@Param('userId') userId: string)

// companies.controller.ts
@Get(':companyId')
async getCompany(@Param('companyId') companyId: string)
```

**Risk:** While NestJS validates types, string formats/lengths aren't constrained

**Recommendation:**
```typescript
// Create DTO for path parameters
import { IsString, Length, Matches } from 'class-validator';

export class CompanyParamDto {
  @IsString()
  @Length(20, 30) // Typical CUID length
  @Matches(/^[a-z0-9]+$/) // CUID format
  companyId: string;
}

// Use in controller
@Get(':companyId')
async getCompany(@Param() params: CompanyParamDto) {
  const { companyId } = params;
  // Implementation
}
```

**2.5 Low Severity: Error Stack Traces in Bootstrap**

**Location:** `apps/api/src/main.ts:105`

```typescript
logger.error("API bootstrap failed", error instanceof Error ? error.stack : error);
```

**Risk:** Stack traces in logs may expose file paths/system information

**Recommendation:**
```typescript
if (process.env.NODE_ENV === 'production') {
  logger.error("API bootstrap failed", error instanceof Error ? error.message : 'Unknown error');
} else {
  logger.error("API bootstrap failed", error instanceof Error ? error.stack : error);
}
```

---

## 3. Data Access Boundaries & Authorization

### 🟢 Strengths

**3.1 Database Security**
- Prisma ORM prevents SQL injection through parameterized queries
- Transactional consistency for financial operations
- Proper foreign key constraints and cascade rules
- Optimistic locking on critical state (WorldTickState)

**3.2 Schema Design**
- Separate Player and Company entities
- Clear ownership relationships (`Company.ownerPlayerId`)
- Reserved cash/inventory tracking prevents double-spending
- Audit trail via `LedgerEntry` for all financial transactions

**3.3 Middleware Protection**
- `SchemaReadinessMiddleware`: Blocks API calls until migrations complete
- `MaintenanceModeMiddleware`: Blocks write operations during maintenance
- Applied globally to prevent accidental bypass

### 🟡 Weaknesses

**3.4 Medium Severity: Template Literals in $queryRaw**

**Locations:**
- `moderation.controller.ts:144-146`
- `support.controller.ts:162-179`

```typescript
// Current implementation
const result = await prisma.$queryRaw<Array<{ role: string | null }>>`
  SELECT role FROM "user" WHERE id = ${userId} LIMIT 1
`;
```

**Risk:** While Prisma parameterizes these safely, reliance on implicit escaping could lead to vulnerabilities if implementation changes

**Recommendation:**
```typescript
// Use explicit Prisma.sql for clarity
import { Prisma } from '@prisma/client';

const result = await prisma.$queryRaw<Array<{ role: string | null }>>(
  Prisma.sql`SELECT role FROM "user" WHERE id = ${userId} LIMIT 1`
);

// Better: Use Prisma Client directly
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { role: true }
});
```

**3.5 Low Severity: $queryRawUnsafe Usage**

**Location:** `schema-readiness.service.ts:132-134`

```typescript
const result = await prisma.$queryRawUnsafe<Array<{ applied_migrations: number }>>(
  `SELECT COUNT(*)::int AS applied_migrations FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`
);
```

**Risk:** Flagged as "unsafe" by Prisma. Currently hardcoded (safe), but sets precedent

**Recommendation:**
```typescript
// Use $queryRaw with Prisma.sql
const result = await prisma.$queryRaw<Array<{ applied_migrations: number }>>(
  Prisma.sql`SELECT COUNT(*)::int AS applied_migrations FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`
);
```

---

## 4. Cryptographic Security

### 🟡 Weaknesses

**4.1 Medium Severity: Timing-Unsafe Token Comparison**

**Locations:**
- `world.controller.ts:69`
- `ops.controller.ts:69`

```typescript
const providedToken = /* extracted from header */;
const configuredToken = process.env.CORPSIM_OPS_TOKEN?.trim();

if (providedToken !== configuredToken) {
  throw new UnauthorizedException('Invalid ops token');
}
```

**Risk:** String comparison vulnerable to timing attacks allowing token enumeration

**Recommendation:**
```typescript
import { timingSafeEqual } from 'node:crypto';

function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

// Use in controller
if (!configuredToken || !timingSafeCompare(providedToken, configuredToken)) {
  throw new UnauthorizedException('Invalid ops token');
}
```

**4.2 Info: Password Hashing**

✅ **Secure:** better-auth handles password hashing with industry-standard algorithms (verified in library implementation)

---

## 5. Dependency Vulnerabilities

### 🟢 No Vulnerabilities Found

**Audit Results:**
```bash
pnpm audit
```

**Summary:**
- **Total Dependencies:** 859
- **Critical:** 0
- **High:** 0
- **Moderate:** 0
- **Low:** 0
- **Info:** 0

**Recommendation:** Continue monitoring with automated dependency scanning (Dependabot, Snyk, or GitHub Security Alerts)

---

## 6. Configuration Security

### 🟢 Strengths

**6.1 Environment Variable Handling**
- All sensitive values in environment variables (never hardcoded)
- `.env.example` documents required configuration without secrets
- Production enforcement for critical secrets:
  ```typescript
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET environment variable is required in production");
  }
  ```

**6.2 CORS Configuration**
- Strict origin whitelist from environment variables
- Localhost allowed only in non-production
- Credentials support enabled for authenticated requests
- Dynamic origin validation function

**6.3 Security Defaults**
- Secure cookies enabled in production
- Rate limiting enabled by default (disabled only in tests)
- Database schema readiness enforcement
- Maintenance mode support for safe deployments

### 🟡 Weaknesses

**6.4 Info: Default Development Secrets**

**Location:** `apps/api/src/lib/auth.ts:528`

```typescript
if (process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET environment variable is required in production");
}
return "corpsim-dev-only-better-auth-secret"; // Fallback for dev
```

**Risk:** None in production (enforced), but could lead to confusion in staging environments

**Recommendation:**
```typescript
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}
```

**6.5 Info: OAuth Client Secrets in Environment**

**Current State:** OAuth secrets stored in plain environment variables

**Recommendation:** Consider using secret management solutions for production:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Doppler

---

## 7. Business Logic Security

### 🟢 Strengths

**7.1 Transactional Integrity**
- Financial operations use database transactions
- Reserved cash/inventory prevents double-spending
- Optimistic locking on world tick state prevents concurrent modifications
- Audit trails for all economic actions

**7.2 Invariant Enforcement**
- Domain errors properly mapped to HTTP responses
- Invalid state transitions rejected by service layer
- Admin account protections enforced at database hook level

**7.3 Separation of Concerns**
- Thin controllers delegate to services
- Domain logic isolated from HTTP layer
- No business logic in middleware or guards

---

## 8. Additional Recommendations

### 8.1 Security Headers

**Add Security Headers Middleware:**
```typescript
// apps/api/src/main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 8.2 API Rate Limiting

**Add Global Rate Limiting:**
```typescript
// Install @nestjs/throttler if not present
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    // other imports
  ],
})
export class AppModule {}
```

### 8.3 Logging & Monitoring

**Enhance Audit Logging:**
```typescript
// Add structured logging for security events
logger.log({
  event: 'auth.login.success',
  userId: user.id,
  ip: request.ip,
  userAgent: request.headers['user-agent'],
  timestamp: new Date().toISOString(),
});
```

### 8.4 Security Testing

**Add Security Tests:**
```typescript
// apps/api/test/security.integration.test.ts
describe('Security', () => {
  it('should reject unauthenticated requests to protected endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/companies/:companyId')
      .expect(401);
  });

  it('should prevent CSRF attacks', async () => {
    // Test CSRF protection
  });

  it('should sanitize error messages', async () => {
    // Test that errors don't leak sensitive data
  });
});
```

### 8.5 Documentation

**Create Security Runbook:**
- Incident response procedures
- Secret rotation processes
- Security update workflow
- Vulnerability disclosure policy

---

## 9. Priority Remediation Plan

### Immediate (Within 1 Sprint)

1. ✅ **Add authentication to public endpoints**
   - `GET /v1/companies` - require auth or implement visibility rules
   - `GET /v1/players/registry` - require auth
   - Market endpoints - evaluate data sensitivity

2. ✅ **Implement timing-safe token comparison**
   - Update `world.controller.ts` and `ops.controller.ts`

3. ✅ **Add rate limiting to admin operations**
   - Refunds, cancellations, transfers

### Short-term (Within 1-2 Sprints)

4. ✅ **Add path parameter validation DTOs**
   - Create validation DTOs for all path parameters
   - Enforce CUID format validation

5. ✅ **Replace template literal $queryRaw**
   - Use explicit `Prisma.sql` or Prisma Client methods

6. ✅ **Add security headers**
   - Implement helmet middleware

### Long-term (Future Iterations)

7. ✅ **Implement comprehensive security testing**
   - Add security-focused integration tests
   - Set up automated security scanning in CI/CD

8. ✅ **Secret management solution**
   - Evaluate and implement secret management for production

9. ✅ **Security monitoring & alerting**
   - Implement structured logging
   - Set up alerts for security events

---

## 10. Compliance Notes

### GDPR Considerations
- ✅ Player data stored with proper consent model
- ✅ Email verification support
- ⚠️ **Todo:** Implement data export/deletion endpoints for GDPR compliance

### OWASP Top 10 (2021)
- ✅ A01 Broken Access Control - **Protected** (with noted improvements needed)
- ✅ A02 Cryptographic Failures - **Minimal Risk** (better-auth handles crypto)
- ✅ A03 Injection - **Protected** (Prisma ORM + validation)
- ✅ A04 Insecure Design - **Good** (domain-driven design, invariants)
- ✅ A05 Security Misconfiguration - **Good** (defaults secure, production enforcement)
- ✅ A06 Vulnerable Components - **Clean** (0 vulnerabilities)
- ⚠️ A07 Authentication Failures - **Room for Improvement** (rate limiting on admin ops)
- ✅ A08 Software & Data Integrity - **Good** (transactions, optimistic locking)
- ⚠️ A09 Logging & Monitoring - **Basic** (could be enhanced)
- ✅ A10 Server-Side Request Forgery - **Not Applicable** (no SSRF vectors found)

---

## 11. Conclusion

The CorpSim codebase demonstrates a **solid security foundation** with comprehensive authentication, proper use of Prisma ORM, and thoughtful domain design. The identified issues are primarily related to **access control granularity** and **defensive security practices** rather than fundamental vulnerabilities.

**Security Maturity Level:** **Moderate to High**

The recommended fixes are straightforward and can be implemented incrementally without significant architectural changes. Priority should be given to authentication requirements on public endpoints and rate limiting on sensitive admin operations.

**Next Steps:**
1. Review and approve this audit report
2. Create tickets for immediate priority items
3. Assign ownership for each remediation task
4. Schedule security review cadence (quarterly recommended)
5. Implement automated security scanning in CI/CD pipeline

---

**Audit Completed:** 2026-02-16  
**Report Version:** 1.0  
**Status:** FINAL
