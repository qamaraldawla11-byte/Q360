import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  MODULE_MANAGEMENT_ROLES,
  moduleAccessAllows,
} from '../services/moduleAccessControl.js';

// The staff route imports database and auth dependencies at module load time.
// Set the minimum environment markers so we can load the pure allowlist constant
// without touching a real database or reading secrets from disk.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://unit:test@localhost:5432/unit';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-must-be-at-least-32-bytes-long';

const { modules } = await import('./staff.js');

const validatesModuleAccess = (moduleAccess: string[]) =>
  Array.isArray(moduleAccess) && moduleAccess.every((x) => typeof x === 'string' && modules.has(x));

describe('staff module access allowlist', () => {
  it('accepts quotes in an explicit non-manager staff module-access list', () => {
    assert.ok(validatesModuleAccess(['quotes']));
    assert.ok(validatesModuleAccess(['pos', 'quotes', 'customers']));
    assert.ok(modules.has('quotes'));
  });

  it('rejects invalid module keys', () => {
    assert.ok(!validatesModuleAccess(['superuser']));
    assert.ok(!validatesModuleAccess(['pos', 'superuser']));
    assert.ok(!modules.has('superuser'));
  });

  it('preserves every existing valid module key', () => {
    const expected = new Set([
      'dashboard',
      'pos',
      'kds',
      'menu',
      'tables',
      'inventory',
      'payments',
      'daily-report',
      'staff',
      'finance',
      'customers',
      'quotes',
    ]);
    assert.deepStrictEqual(modules, expected);
  });
});

describe('staff manager/owner authorization bypass', () => {
  it('management roles bypass moduleAccess unchanged', () => {
    for (const role of MODULE_MANAGEMENT_ROLES) {
      assert.equal(moduleAccessAllows(role, [], 'quotes'), true);
      assert.equal(moduleAccessAllows(role, [], 'customers'), true);
      assert.equal(moduleAccessAllows(role, ['quotes'], 'finance'), true);
    }
  });

  it('non-management staff still require explicit module access', () => {
    assert.equal(moduleAccessAllows('waiter', ['quotes'], 'quotes'), true);
    assert.equal(moduleAccessAllows('waiter', [], 'quotes'), false);
    assert.equal(moduleAccessAllows('cashier', ['pos'], 'quotes'), false);
  });
});
