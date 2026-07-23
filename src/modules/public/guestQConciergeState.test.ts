import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  emailPattern,
  FIELD_ORDER,
  fallbackModules,
  fieldDefByKey,
  initialJourney,
  initialSetup,
  isContinueMessage,
  isSkipMessage,
  mergeSetup,
  nextField,
  parseActiveAnswer,
  requiredComplete,
  requiredProgress,
  serviceModeFromServices,
  servicesFromServiceMode,
  syncJourney,
  type FieldKey,
  type FieldStatus,
} from './guestQConciergeState.js';

const baseSetup = () =>
  mergeSetup(initialSetup('Hello'), {
    businessType: 'restaurant',
    businessName: 'Noor',
    country: 'Spain',
    services: ['dine-in'],
    email: 'owner@noor.test',
  });

describe('guestQConciergeState', () => {
  it('deterministic FIELD_ORDER includes all field keys', () => {
    assert.deepEqual(FIELD_ORDER, [
      'businessType',
      'serviceMode',
      'businessName',
      'country',
      'email',
      'tables',
      'teamSize',
      'stockConcerns',
      'bookings',
      'priorities',
      'otherPreferences',
    ]);
  });

  it('nextField returns first missing required field', () => {
    const setup = initialSetup('Hello');
    const journey = initialJourney();
    assert.equal(nextField(setup, journey), 'businessType');
  });

  it('nextField skips confirmed and skipped fields', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const journey = syncJourney(setup, initialJourney(), 'businessType', false, true);
    assert.equal(journey.businessType, 'confirmed');
    assert.equal(nextField(setup, journey), 'serviceMode');
  });

  it('nextField skips non-applicable fields', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'retail shop' });
    const journey = syncJourney(setup, initialJourney(), 'businessType', false, true);
    assert.equal(nextField(setup, journey), 'businessName');
  });

  it('requiredComplete is false when required fields are only captured', () => {
    const setup = baseSetup();
    const journey = syncJourney(setup, initialJourney(), null, false, false);
    assert.equal(journey.serviceMode, 'captured');
    assert.equal(requiredComplete(setup, journey), false);
  });

  it('requiredComplete is true when required fields are confirmed', () => {
    const setup = baseSetup();
    const journey = syncJourney(setup, initialJourney(), null, false, true);
    assert.equal(requiredComplete(setup, journey), true);
  });

  it('requiredComplete is false when email is missing', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
      country: 'Spain',
      services: ['dine-in'],
    });
    const journey = syncJourney(setup, initialJourney(), null, false, true);
    assert.equal(requiredComplete(setup, journey), false);
  });

  it('requiredProgress counts only confirmed or skipped required fields', () => {
    const setup = baseSetup();
    const journey = syncJourney(setup, initialJourney(), null, false, true);
    const progress = requiredProgress(setup, journey);
    assert.equal(progress.total, 5); // businessType, serviceMode, businessName, country, email
    assert.equal(progress.done, 5);
  });

  it('parseActiveAnswer extracts service mode from natural text', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    assert.equal(parseActiveAnswer('Dine-in only', 'serviceMode', setup).serviceMode, 'dine_in');
    assert.equal(parseActiveAnswer('Takeaway only', 'serviceMode', setup).serviceMode, 'takeaway');
    assert.equal(parseActiveAnswer('Both dine-in and takeaway', 'serviceMode', setup).serviceMode, 'both');
  });

  it('parseActiveAnswer extracts table count', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    assert.equal(parseActiveAnswer('We have 12 tables', 'tables', setup).tables, 12);
  });

  it('parseActiveAnswer extracts team size', () => {
    const setup = initialSetup('Hello');
    assert.equal(parseActiveAnswer('Just me', 'teamSize', setup).employees, 1);
    assert.equal(parseActiveAnswer('8 employees', 'teamSize', setup).employees, 8);
  });

  it('parseActiveAnswer extracts priorities', () => {
    const setup = initialSetup('Hello');
    const updates = parseActiveAnswer('I care about sales, stock and customers', 'priorities', setup);
    assert.deepEqual(updates.priorities, ['Sales', 'Stock', 'Customers']);
  });

  it('skip and continue messages are recognized', () => {
    assert.equal(isSkipMessage('skip'), true);
    assert.equal(isSkipMessage('later'), true);
    assert.equal(isSkipMessage('none'), true);
    assert.equal(isSkipMessage('Egypt'), false);
    assert.equal(isContinueMessage('continue'), true);
    assert.equal(isContinueMessage('done'), true);
    assert.equal(isContinueMessage('Spain'), false);
  });

  it('captured required fields do not silently approve continue', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
      country: 'Spain',
      services: ['dine-in'],
      email: 'owner@noor.test',
    });
    const journey = syncJourney(setup, initialJourney(), null, false, false);
    assert.equal(journey.businessType, 'captured');
    assert.equal(requiredComplete(setup, journey), false);
  });

  it('optional fields never block requiredComplete', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
      country: 'Spain',
      services: ['dine-in'],
      email: 'owner@noor.test',
    });
    const journey = syncJourney(setup, initialJourney(), null, false, true);
    assert.equal(requiredComplete(setup, journey), true);
  });

  it('skipping an optional field marks it skipped and keeps requiredComplete true', () => {
    const setup = baseSetup();
    const base = syncJourney(setup, initialJourney(), null, false, true);
    const journey: Record<FieldKey, FieldStatus> = { ...base, tables: 'skipped' };
    assert.equal(requiredComplete(setup, journey), true);
    assert.equal(journey.tables, 'skipped');
  });

  it('serviceMode normalizes to canonical services array values', () => {
    assert.deepEqual(servicesFromServiceMode('dine_in'), ['dine-in']);
    assert.deepEqual(servicesFromServiceMode('takeaway'), ['takeaway']);
    assert.deepEqual(servicesFromServiceMode('both'), ['dine-in', 'takeaway']);
    assert.equal(serviceModeFromServices(['dine-in']), 'dine_in');
    assert.equal(serviceModeFromServices(['takeaway']), 'takeaway');
    assert.equal(serviceModeFromServices(['dine-in', 'takeaway']), 'both');
  });

  it('mergeSetup preserves services array compatibility', () => {
    const setup = mergeSetup(initialSetup('Hello'), { services: ['dine-in'] });
    assert.deepEqual(setup.services, ['dine-in']);
    assert.equal(setup.serviceMode, 'dine_in');
  });

  it('mergeSetup converts serviceMode to canonical services', () => {
    const setup = mergeSetup(initialSetup('Hello'), { serviceMode: 'both' });
    assert.deepEqual(setup.services, ['dine-in', 'takeaway']);
    assert.equal(setup.serviceMode, 'both');
  });

  it('fallbackModules includes Tables and Bookings for dine-in restaurants', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
    });
    const modules = fallbackModules(setup);
    assert.ok(modules.includes('Tables'));
    assert.ok(modules.includes('Bookings'));
  });

  it('fallbackModules omits Tables and Bookings for takeaway-only restaurants', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'takeaway',
    });
    const modules = fallbackModules(setup);
    assert.ok(!modules.includes('Tables'));
    assert.ok(!modules.includes('Bookings'));
  });

  it('email validation rejects invalid emails', () => {
    assert.equal(emailPattern.test('not-an-email'), false);
    assert.equal(emailPattern.test('valid@example.com'), true);
  });

  it('fieldDef hasValue rules match expected values', () => {
    const setup = baseSetup();
    assert.equal(fieldDefByKey.businessType.hasValue(setup), true);
    assert.equal(fieldDefByKey.serviceMode.hasValue(setup), true);
    assert.equal(fieldDefByKey.tables.hasValue(setup), false);
    assert.equal(fieldDefByKey.teamSize.hasValue(setup), false);
  });
});
