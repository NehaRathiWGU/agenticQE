# Security Testing Template

This template generates comprehensive security test cases following OWASP guidelines.

## Test Categories

1. **Authentication Testing**
   - Brute force protection
   - Session management
   - Password complexity requirements
   - MFA/2FA flows

2. **Authorization Testing**
   - RBAC validation
   - ACL checks
   - Privilege escalation prevention
   - Insecure direct object references

3. **Input Validation Testing**
   - SQL injection prevention
   - XSS attack prevention
   - Command injection prevention
   - Path traversal prevention

4. **Data Protection Testing**
   - Encryption at rest
   - Encryption in transit
   - Sensitive data masking
   - PCI compliance

5. **API Security Testing**
   - Rate limiting
   - Authentication headers
   - CORS configuration
   - Swagger/OpenAPI exposure

## Example Test Scenarios

- User cannot login with invalid credentials (3 attempts)
- Session expires after 30 minutes of inactivity
- Admin role cannot access user-only endpoints
- SQL injection attempt returns 400 error
- XSS attempt is sanitized/escaped
- Password must contain uppercase, lowercase, number, special char
- Sensitive data is masked in logs