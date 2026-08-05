# Migration Test Template

This template generates comprehensive tests for infrastructure migrations (ECS to EKS, legacy to modern, etc.)

## Test Categories

1. **Pre-Migration Validation**
   - Verify current state documentation
   - Check dependencies and integrations
   - Validate backup procedures

2. **Migration Execution**
   - Happy path migration
   - Rollback procedures
   - Partial failure recovery

3. **Post-Migration Validation**
   - Health checks in new environment
   - Performance comparison
   - Data integrity verification

4. **Cutover Testing**
   - Traffic shift validation
   - DNS propagation
   - Service discovery

5. **Decommission Verification**
   - Old resources cleanup
   - No lingering connections
   - Cost verification

## Example Test Scenarios

- Verify argodeploy/ folder configured in repository
- ArgoCD pipeline deploys successfully to SIT
- ArgoCD pipeline deploys successfully to STAGE
- Health checks passing on EKS (all environments)
- PROD deployment via ArgoCD (pod running, no traffic)
- PROD traffic cutover complete (API Gateway pointing to EKS LB)
- ECS tasks scaled to 0 after validation period
- Monitoring/alerting configured for EKS deployment