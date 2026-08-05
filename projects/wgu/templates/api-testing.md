# API Testing Template

This template generates comprehensive API test cases with protocol-level validation.

## Test Categories

1. **Functional Testing**
   - GET/POST/PUT/DELETE operations
   - Query parameters and body validation
   - Response schema validation

2. **Error Handling**
   - Invalid input validation
   - Authentication failures
   - Rate limiting responses
   - Timeout scenarios

3. **Security Testing**
   - SQL injection prevention
   - XSS attack prevention
   - Authentication bypass attempts
   - Authorization checks

4. **Performance Testing**
   - Response time thresholds
   - Concurrent request handling
   - Load testing patterns

5. **Integration Testing**
   - Upstream service dependencies
   - Downstream service calls
   - Message queue interactions

## Example Test Scenarios

- GET /api/users returns user list with correct status code
- POST /api/users creates user with valid data
- POST /api/users rejects invalid email format
- GET /api/users requires authentication token
- GET /api/users returns 403 for unauthorized access
- DELETE /api/users/:id removes user and returns 204