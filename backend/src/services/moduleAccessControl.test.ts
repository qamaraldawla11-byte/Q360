import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  decideModuleAccess,
  moduleAccessAllows,
  MODULE_MANAGEMENT_ROLES,
} from './moduleAccessControl.js';

// M5.8 contract:
//   management roles (owner/admin/manager)  → always allowed
//   moduleAccess null / undefined           → legacy unrestricted (allowed)
//   moduleAccess []                         → explicit deny-all
//   moduleAccess ['x']                      → allowed only for listed modules

describe('moduleAccessControl', () => {
  describe('management bypass', () => {
    it('owner is allowed regardless of moduleAccess', () => {
      assert.equal(moduleAccessAllows('owner', [], 'inventory'), true);
      assert.equal(moduleAccessAllows('owner', null, 'inventory'), true);
      assert.equal(moduleAccessAllows('owner', ['kds'], 'inventory'), true);
    });

    it('admin is allowed regardless of moduleAccess', () => {
      assert.equal(moduleAccessAllows('admin', [], 'finance'), true);
    });

    it('manager is allowed regardless of moduleAccess', () => {
      assert.equal(moduleAccessAllows('manager', [], 'staff'), true);
    });

    it('legacy owner regression: owner with null moduleAccess keeps full access', () => {
      for (const key of ['tables', 'inventory', 'staff', 'finance', 'customers']) {
        assert.equal(moduleAccessAllows('owner', null, key), true, `owner/null must access ${key}`);
      }
    });

    it('management role set is exactly owner/admin/manager', () => {
      assert.deepEqual([...MODULE_MANAGEMENT_ROLES].sort(), ['admin', 'manager', 'owner']);
    });
  });

  describe('legacy compatibility (null / undefined)', () => {
    it('null moduleAccess is allowed (legacy unrestricted)', () => {
      assert.equal(moduleAccessAllows('waiter', null, 'inventory'), true);
      assert.equal(moduleAccessAllows('user', null, 'customers'), true);
    });

    it('undefined moduleAccess is allowed (legacy unrestricted)', () => {
      assert.equal(moduleAccessAllows('waiter', undefined, 'inventory'), true);
      assert.equal(moduleAccessAllows('kitchen', undefined, 'staff'), true);
    });
  });

  describe('explicit denial', () => {
    it('empty array denies every module', () => {
      assert.equal(moduleAccessAllows('waiter', [], 'inventory'), false);
      assert.equal(moduleAccessAllows('cashier', [], 'finance'), false);
      assert.equal(moduleAccessAllows('staff', [], 'customers'), false);
    });

    it('explicit array denies modules not listed', () => {
      assert.equal(moduleAccessAllows('waiter', ['pos', 'tables'], 'inventory'), false);
      assert.equal(moduleAccessAllows('kitchen', ['kds'], 'staff'), false);
    });
  });

  describe('explicit allowlist', () => {
    it('matching module is allowed', () => {
      assert.equal(moduleAccessAllows('waiter', ['tables', 'pos'], 'tables'), true);
      assert.equal(moduleAccessAllows('staff', ['inventory'], 'inventory'), true);
    });

    it('decision reasons are stable', () => {
      assert.equal(decideModuleAccess('owner', [], 'x').reason, 'management_bypass');
      assert.equal(decideModuleAccess('waiter', null, 'x').reason, 'legacy_unrestricted');
      assert.equal(decideModuleAccess('waiter', undefined, 'x').reason, 'legacy_unrestricted');
      assert.equal(decideModuleAccess('waiter', [], 'x').reason, 'explicit_deny_all');
      assert.equal(decideModuleAccess('waiter', ['x'], 'x').reason, 'explicit_allow');
      assert.equal(decideModuleAccess('waiter', ['y'], 'x').reason, 'explicit_deny');
    });
  });

  describe('edge cases', () => {
    it('null role with null moduleAccess is legacy-allowed, with [] denied', () => {
      assert.equal(moduleAccessAllows(null, null, 'inventory'), true);
      assert.equal(moduleAccessAllows(undefined, undefined, 'inventory'), true);
      assert.equal(moduleAccessAllows(null, [], 'inventory'), false);
    });

    it('non-array truthy moduleAccess is treated as deny-all (defensive)', () => {
      assert.equal(moduleAccessAllows('waiter', 'inventory' as unknown as string[], 'inventory'), false);
    });
  });
});
