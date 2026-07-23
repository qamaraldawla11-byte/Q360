import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  classifyBackendReply,
  determineNextPresentation,
  deriveQuickReplies,
  emailPattern,
  FIELD_ORDER,
  fallbackModules,
  fieldDefByKey,
  hasInlineSkip,
  initialJourney,
  initialSetup,
  isContinueMessage,
  isSkipMessage,
  isStaleQuickReply,
  isStaleRevision,
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
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
    };
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
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
    };
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
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
    };
    assert.equal(requiredComplete(setup, journey), true);
  });

  it('skipping an optional field marks it skipped and keeps requiredComplete true', () => {
    const setup = baseSetup();
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
      tables: 'skipped',
    };
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

  it('country quick reply becomes confirmed and nextField does not return country', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
      serviceMode: 'dine_in',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
    };
    const updates = parseActiveAnswer('Egypt', 'country', setup);
    assert.equal(updates.country, 'Egypt');
    const nextSetup = mergeSetup(setup, updates);
    const nextJourney = syncJourney(nextSetup, journey, 'country', false, false);
    assert.equal(nextJourney.country, 'confirmed');
    assert.notEqual(nextField(nextSetup, nextJourney), 'country');
  });

  it('service-mode quick reply becomes confirmed', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
    };
    const updates = parseActiveAnswer('Dine-in only', 'serviceMode', setup);
    assert.equal(updates.serviceMode, 'dine_in');
    const nextSetup = mergeSetup(setup, updates);
    const nextJourney = syncJourney(nextSetup, journey, 'serviceMode', false, false);
    assert.equal(nextJourney.serviceMode, 'confirmed');
  });

  it('"my name is Muhanad" does not set businessName', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const updates = parseActiveAnswer('my name is Muhanad', 'businessName', setup);
    assert.equal(updates.businessName, undefined);
  });

  it('"my restaurant is called Noor" sets businessName', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const updates = parseActiveAnswer('my restaurant is called Noor', 'businessName', setup);
    assert.equal(updates.businessName, 'Noor');
  });

  it('direct Noor while businessName is active confirms businessName', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
    };
    const updates = parseActiveAnswer('Noor', 'businessName', setup);
    assert.equal(updates.businessName, 'Noor');
    const nextSetup = mergeSetup(setup, updates);
    const nextJourney = syncJourney(nextSetup, journey, 'businessName', false, false);
    assert.equal(nextJourney.businessName, 'confirmed');
  });

  it('stale captured state cannot overwrite an explicitly confirmed active answer', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      businessName: 'captured',
    };
    const nextJourney = syncJourney(setup, journey, 'businessName', false, false);
    assert.equal(nextJourney.businessName, 'confirmed');
  });

  // M7.2 regression tests for strict active-field validation and authoritative states.
  it('Noor becomes businessName when businessName is active', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const updates = parseActiveAnswer('Noor', 'businessName', setup);
    assert.equal(updates.businessName, 'Noor');
  });

  it('Sudan becomes country when country is active', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant', businessName: 'Noor' });
    const updates = parseActiveAnswer('Sudan', 'country', setup);
    assert.equal(updates.country, 'Sudan');
  });

  it('fast checkout becomes a priority when priorities is active', () => {
    const setup = initialSetup('Hello');
    const updates = parseActiveAnswer('fast checkout', 'priorities', setup);
    assert.deepEqual(updates.priorities, ['Fast checkout']);
  });

  it('active country does not accept fast checkout as country', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant', businessName: 'Noor' });
    const updates = parseActiveAnswer('fast checkout', 'country', setup);
    assert.equal(updates.country, undefined);
  });

  it('active businessName does not accept Sudan as businessName', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const updates = parseActiveAnswer('Sudan', 'businessName', setup);
    assert.equal(updates.businessName, undefined);
  });

  it('confirmed businessName cannot be overwritten by backend inference', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      businessName: 'confirmed',
    };
    const backendSetup = mergeSetup(setup, { businessName: 'Another Name' });
    const nextJourney = syncJourney(backendSetup, journey, null, false, false);
    assert.equal(nextJourney.businessName, 'confirmed');
  });

  it('confirmed country cannot be overwritten by backend inference', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
      country: 'Sudan',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
    };
    const backendSetup = mergeSetup(setup, { country: 'Egypt' });
    const nextJourney = syncJourney(backendSetup, journey, null, false, false);
    assert.equal(nextJourney.country, 'confirmed');
  });

  it('skipped bookings remains skipped after backend returns bookings-related text', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
      country: 'Sudan',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      bookings: 'skipped',
    };
    const backendSetup = mergeSetup(setup, { bookings: true });
    const nextJourney = syncJourney(backendSetup, journey, null, false, false);
    assert.equal(nextJourney.bookings, 'skipped');
  });

  it('first-response inference becomes captured, not confirmed', () => {
    const setup = mergeSetup(initialSetup('Hello'), { businessType: 'restaurant' });
    const journey = syncJourney(setup, initialJourney(), null, false, false);
    assert.equal(journey.businessType, 'captured');
  });

  it('explicit correction can replace a confirmed field', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      businessName: 'Noor',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      businessName: 'confirmed',
    };
    const correctedSetup = mergeSetup(setup, { businessName: 'Cairo Bites' });
    const nextJourney = syncJourney(correctedSetup, { ...journey, businessName: 'missing' }, 'businessName', false, false);
    assert.equal(nextJourney.businessName, 'confirmed');
    assert.equal(correctedSetup.businessName, 'Cairo Bites');
  });

  // Conversational sequencing, duplicate-question prevention, and active-control sync.
  it('backend acknowledgement + local next prompt creates one question', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
      businessName: 'Noor',
      country: 'Sudan',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
    };
    const reply = 'Dine-in only it is.';
    assert.equal(classifyBackendReply(reply, setup, journey), 'prose');
    assert.equal(nextField(setup, journey), 'email');
    const presentation = determineNextPresentation(reply, setup, journey);
    assert.equal(presentation.backendReply, reply);
    assert.equal(presentation.next.type, 'ask');
    assert.equal((presentation.next as { type: 'ask'; field: FieldKey }).field, 'email');
  });

  it('backend repeated country question is suppressed', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
      businessName: 'Noor',
      country: 'Sudan',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
    };
    const reply = 'Which country will Noor operate in?';
    assert.equal(classifyBackendReply(reply, setup, journey), 'stale');
    const presentation = determineNextPresentation(reply, setup, journey);
    assert.equal(presentation.backendReply, null);
    assert.equal(presentation.next.type, 'ask');
    assert.equal((presentation.next as { type: 'ask'; field: FieldKey }).field, 'email');
  });

  it('skipped bookings is never asked again', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
      businessName: 'Noor',
      country: 'Sudan',
      email: 'owner@noor.test',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
      tables: 'skipped',
      teamSize: 'skipped',
      stockConcerns: 'skipped',
      bookings: 'skipped',
    };
    assert.notEqual(nextField(setup, journey), 'bookings');
    const reply = 'Will you take table or appointment bookings?';
    assert.equal(classifyBackendReply(reply, setup, journey), 'stale');
    const presentation = determineNextPresentation(reply, setup, journey);
    assert.equal(presentation.backendReply, null);
    assert.equal(presentation.next.type, 'ask');
    assert.equal((presentation.next as { type: 'ask'; field: FieldKey }).field, 'priorities');
  });

  it('stale booking quick reply cannot answer stock field', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
      businessName: 'Noor',
      country: 'Sudan',
      email: 'owner@noor.test',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
      tables: 'skipped',
      teamSize: 'skipped',
    };
    const stockReplies = deriveQuickReplies('stockConcerns', setup, journey);
    assert.ok(!stockReplies.includes('Yes, take bookings'));
    assert.equal(isStaleQuickReply('Yes, take bookings', 'stockConcerns', setup, journey), true);
  });

  it('active-field change clears previous quick replies', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
      businessName: 'Noor',
      country: 'Sudan',
      email: 'owner@noor.test',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
      tables: 'skipped',
      teamSize: 'skipped',
      stockConcerns: 'skipped',
    };
    const bookingReplies = deriveQuickReplies('bookings', setup, journey);
    assert.ok(bookingReplies.includes('Yes, take bookings'));
    const priorityReplies = deriveQuickReplies('priorities', setup, journey);
    assert.ok(!priorityReplies.includes('Yes, take bookings'));
  });

  it('stale async response from revision N cannot alter revision N+1', () => {
    assert.equal(isStaleRevision(1, 2), true);
    assert.equal(isStaleRevision(2, 2), false);
  });

  it('review-ready clears active field and quick replies', () => {
    const setup = mergeSetup(initialSetup('Hello'), {
      businessType: 'restaurant',
      serviceMode: 'dine_in',
      businessName: 'Noor',
      country: 'Sudan',
      email: 'owner@noor.test',
      priorities: ['Fast checkout'],
      otherPreferences: 'none',
    });
    const journey: Record<FieldKey, FieldStatus> = {
      ...initialJourney(),
      businessType: 'confirmed',
      serviceMode: 'confirmed',
      businessName: 'confirmed',
      country: 'confirmed',
      email: 'confirmed',
      tables: 'skipped',
      teamSize: 'skipped',
      stockConcerns: 'skipped',
      bookings: 'skipped',
      priorities: 'confirmed',
      otherPreferences: 'confirmed',
    };
    assert.equal(nextField(setup, journey), null);
    assert.deepEqual(deriveQuickReplies(null, setup, journey), []);
    const presentation = determineNextPresentation('Thanks — I have everything I need.', setup, journey);
    assert.equal(presentation.backendReply, 'Thanks — I have everything I need.');
    assert.equal(presentation.next.type, 'review');
  });

  it('only one Skip for now control is rendered', () => {
    // Fields with an inline skip chip/button hide the global action-bar skip.
    assert.equal(hasInlineSkip('stockConcerns'), true);
    assert.equal(hasInlineSkip('bookings'), true);
    // Fields without an inline skip rely on the single global action-bar skip.
    assert.equal(hasInlineSkip('tables'), false);
    assert.equal(hasInlineSkip('teamSize'), false);
    assert.equal(hasInlineSkip('priorities'), false);
  });

  it('skip message recognizes No, skip and Skip for now', () => {
    assert.equal(isSkipMessage('No, skip'), true);
    assert.equal(isSkipMessage('Skip for now'), true);
    assert.equal(isSkipMessage('skip'), true);
    assert.equal(isSkipMessage('Egypt'), false);
  });
});
