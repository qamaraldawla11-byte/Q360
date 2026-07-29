import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  decideModuleAccess,
  moduleAccessAllows,
  MODULE_MANAGEMENT_ROLES,
} from './moduleAccessControl.js';
import {
  decideSharedModuleEnabled,
  getModulePolicy,
  SHARED_MANAGED_MODULE_KEYS,
  sharedModulePolicies,
} from './restaurantModulePolicies.js';

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

// CORE-M1 — shared module entitlement policy (pure, no DB):
//   canonical shared row exists  → authoritative (explicit disabled wins; no legacy fallback)
//   canonical shared row absent  → temporary legacy 'restaurant/customers' fallback (customers only)
//   quotes                       → defaultEnabled = true, no legacy fallback
//   scope resolution             → shared policies never resolve under workspace scopes;
//                                  unknown workspace/module combos fail closed (undefined)
describe('shared module entitlement policy (CORE-M1)', () => {
  const customersPolicy = getModulePolicy('shared', 'customers')!;
  const quotesPolicy = getModulePolicy('shared', 'quotes')!;
  const legacyCustomersPolicy = getModulePolicy('restaurant', 'customers')!;

  describe('scope resolution fails closed', () => {
    it('shared customers and quotes resolve under the canonical shared scope', () => {
      assert.equal(customersPolicy.moduleKey, 'customers');
      assert.equal(quotesPolicy.moduleKey, 'quotes');
      assert.equal(quotesPolicy.defaultEnabled, true, 'shared/quotes.defaultEnabled must stay true');
    });

    it('shared policies never resolve under workspace-specific scopes', () => {
      assert.equal(getModulePolicy('restaurant', 'quotes'), undefined);
      assert.equal(getModulePolicy('retail', 'customers'), undefined);
      assert.equal(getModulePolicy('services', 'quotes'), undefined);
    });

    it('unknown workspace or module combinations resolve to undefined', () => {
      assert.equal(getModulePolicy('unknown-workspace', 'customers'), undefined);
      assert.equal(getModulePolicy('shared', 'pos'), undefined);
      assert.equal(getModulePolicy('restaurant', 'unknown-module'), undefined);
    });

    it('shared-managed module keys are exactly customers and quotes', () => {
      assert.deepEqual([...SHARED_MANAGED_MODULE_KEYS].sort(), ['customers', 'quotes']);
      assert.equal(sharedModulePolicies.length, 2);
    });
  });

  describe('canonical shared row is authoritative', () => {
    it('enabled shared row permits', () => {
      assert.equal(decideSharedModuleEnabled(customersPolicy, { enabled: true }), true);
      assert.equal(decideSharedModuleEnabled(quotesPolicy, { enabled: true }), true);
    });

    it('disabled shared row blocks and never falls back to legacy', () => {
      assert.equal(
        decideSharedModuleEnabled(customersPolicy, { enabled: false }, { policy: legacyCustomersPolicy, row: { enabled: true } }),
        false,
        'explicit shared disabled must override a legacy enabled row',
      );
      assert.equal(decideSharedModuleEnabled(quotesPolicy, { enabled: false }), false);
    });

    it('enabled shared row ignores a legacy disabled row', () => {
      assert.equal(
        decideSharedModuleEnabled(customersPolicy, { enabled: true }, { policy: legacyCustomersPolicy, row: { enabled: false } }),
        true,
      );
    });
  });

  describe('legacy fallback applies only when the shared row is absent', () => {
    it('customers: missing shared row + missing legacy row uses legacy default (enabled)', () => {
      assert.equal(
        decideSharedModuleEnabled(customersPolicy, undefined, { policy: legacyCustomersPolicy, row: undefined }),
        true,
      );
    });

    it('customers: missing shared row + legacy enabled row permits', () => {
      assert.equal(
        decideSharedModuleEnabled(customersPolicy, null, { policy: legacyCustomersPolicy, row: { enabled: true } }),
        true,
      );
    });

    it('customers: missing shared row + legacy disabled row blocks', () => {
      assert.equal(
        decideSharedModuleEnabled(customersPolicy, undefined, { policy: legacyCustomersPolicy, row: { enabled: false } }),
        false,
      );
    });

    it('quotes: missing shared row uses defaultEnabled=true with no legacy fallback', () => {
      assert.equal(decideSharedModuleEnabled(quotesPolicy, undefined), true);
      assert.equal(decideSharedModuleEnabled(quotesPolicy, null), true);
    });
  });
});
