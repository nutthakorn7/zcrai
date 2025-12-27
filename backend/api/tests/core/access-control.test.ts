import { describe, expect, it } from 'bun:test'
import { hasRolePermission } from '../../core/access/access-control'

describe('Access Control', () => {
    describe('hasRolePermission', () => {
        it('should allow superadmin to do anything', () => {
            expect(hasRolePermission('superadmin', 'hunting.run_query')).toBe(true);
            expect(hasRolePermission('superadmin', 'system.configure')).toBe(true);
        });

        it('should allow soc_analyst to hunt', () => {
            expect(hasRolePermission('soc_analyst', 'hunting.run_query')).toBe(true);
        });

        it('should deny customer from hunting', () => {
            expect(hasRolePermission('customer', 'hunting.run_query')).toBe(false);
        });

        it('should allow customer to manage cases', () => {
            expect(hasRolePermission('customer', 'cases.manage')).toBe(true);
        });

        it('should handle unknown roles gracefully (deny all)', () => {
            expect(hasRolePermission('unknown_role', 'hunting.run_query')).toBe(false);
        });
    });
});
