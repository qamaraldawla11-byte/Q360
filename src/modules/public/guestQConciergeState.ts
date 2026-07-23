import { normalizeCountry } from '../../utils/countryCurrency.ts';

export interface GuestSetup {
  initialRequest: string;
  businessType: string;
  businessName: string;
  country: string;
  services: string[];
  serviceMode?: string;
  tables?: number;
  employees?: number;
  priorities: string[];
  stockConcerns?: boolean;
  bookings?: boolean;
  otherPreferences?: string;
  email: string;
}

export type FieldKey =
  | 'businessType'
  | 'serviceMode'
  | 'businessName'
  | 'country'
  | 'email'
  | 'tables'
  | 'teamSize'
  | 'stockConcerns'
  | 'bookings'
  | 'priorities'
  | 'otherPreferences';

export type FieldStatus = 'missing' | 'captured' | 'confirmed' | 'skipped';

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const textOf = (value: unknown, maxLength = 140) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const listOf = (value: unknown, maxLength = 8) =>
  Array.isArray(value)
    ? value
        .map((item) => textOf(item, 80))
        .filter(Boolean)
        .slice(0, maxLength)
    : [];

export const countOf = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : undefined;
};

export const tableCountOf = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 && count < 10000 ? Math.floor(count) : undefined;
};

export const parseServiceCapabilities = (message: string): string[] => {
  const lower = message.toLowerCase();
  const hasDineIn = /dine[-_ ]?in|\bdine\b/.test(lower);
  const hasTakeaway = /take[-_ ]?away|takeout/.test(lower);
  const hasDelivery = /delivery|deliveries/.test(lower);
  const hasBoth = /\bboth\b/.test(lower);

  if (hasBoth) {
    const services = ['dine-in', 'takeaway'];
    if (hasDelivery) services.push('delivery');
    return services;
  }

  const services: string[] = [];
  if (hasDineIn) services.push('dine-in');
  if (hasTakeaway) services.push('takeaway');
  if (hasDelivery) services.push('delivery');
  return services;
};

export const serviceDisplayFromServices = (services: string[]): string => {
  const normalized = services.map((s) => s.toLowerCase().replace(/[-_\s]/g, ''));
  const hasDineIn = normalized.includes('dinein') || normalized.includes('dine');
  const hasTakeaway = normalized.includes('takeaway') || normalized.includes('takeout');
  const hasDelivery = normalized.includes('delivery');

  const parts: string[] = [];
  if (hasDineIn) parts.push('Dine-in');
  if (hasTakeaway) parts.push('Takeaway');
  if (hasDelivery) parts.push('Delivery');

  if (parts.length === 0) return '';
  if (parts.length === 1) return `${parts[0]} only`;
  if (parts.length === 2) return parts.join(' and ');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

export const isRestaurantLike = (type: string) => /restaurant|cafe|café/.test((type || '').toLowerCase());

export const isSkipMessage = (message: string) =>
  /^(skip(?:\s+for\s+now)?|later|not\s+now|pass|no\s+thanks?|nope|none|no(?:,\s*skip)?)$/i.test(
    message.trim(),
  );

export const isContinueMessage = (message: string) =>
  /^(continue|proceed|review|finish|done|next)$/i.test(message.trim());

export const isConfirmMessage = (message: string) =>
  /^(yes|yeah|yep|correct|right|that'?s right|looks good|ok|okay)$/i.test(message.trim());

export const isChangeMessage = (message: string) =>
  /^(no|change|edit|wrong|different|not correct|update it)$/i.test(message.trim());

export const isOwnerNameStatement = (message: string) =>
  /^(?:my name is|my name's|i am|i'm|call me)\s+[a-z0-9].*/i.test(message.trim());

export const ownerNameFromStatement = (message: string): string | undefined => {
  const match = message.trim().match(/^(?:my name is|my name's|i am|i'm|call me)\s+([a-z0-9][a-z0-9\s'&.-]{0,80})/i);
  return match?.[1].trim().replace(/[.,!]+$/, '');
};

export const serviceModeFromServices = (services: string[]): string => {
  const normalized = services.map((s) => s.toLowerCase().replace(/[-_\s]/g, ''));
  const hasDineIn = normalized.includes('dinein') || normalized.includes('dine');
  const hasTakeaway = normalized.includes('takeaway') || normalized.includes('takeout');
  const hasDelivery = normalized.includes('delivery');
  if (hasDineIn && hasTakeaway && hasDelivery) return 'dine_in_takeaway_delivery';
  if (hasDineIn && hasDelivery) return 'dine_in_delivery';
  if (hasTakeaway && hasDelivery) return 'takeaway_delivery';
  if (hasDineIn && hasTakeaway) return 'both';
  if (hasTakeaway) return 'takeaway';
  if (hasDineIn) return 'dine_in';
  if (hasDelivery) return 'delivery';
  return '';
};

export const servicesFromServiceMode = (mode: string): string[] => {
  const normalized = mode.toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'both') return ['dine-in', 'takeaway'];
  if (normalized === 'takeaway') return ['takeaway'];
  if (normalized === 'dinein' || normalized === 'dine') return ['dine-in'];
  if (normalized === 'delivery') return ['delivery'];
  if (normalized === 'dineindelivery') return ['dine-in', 'delivery'];
  if (normalized === 'takeawaydelivery') return ['takeaway', 'delivery'];
  if (normalized === 'dineintakeawaydelivery') return ['dine-in', 'takeaway', 'delivery'];
  return mode ? [mode] : [];
};

export const canonicalizeServiceMode = (mode: string): string => {
  const normalized = mode.toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'both') return 'both';
  if (normalized === 'takeaway' || normalized === 'takeout') return 'takeaway';
  if (normalized === 'dinein' || normalized === 'dine') return 'dine_in';
  if (normalized === 'delivery') return 'delivery';
  if (normalized === 'dineindelivery') return 'dine_in_delivery';
  if (normalized === 'takeawaydelivery') return 'takeaway_delivery';
  if (normalized === 'dineintakeawaydelivery') return 'dine_in_takeaway_delivery';
  return mode;
};

export const initialSetup = (initialRequest: string): GuestSetup => ({
  initialRequest,
  businessType: '',
  businessName: '',
  country: '',
  services: [],
  priorities: [],
  email: '',
});

export const initialJourney = (): Record<FieldKey, FieldStatus> => ({
  businessType: 'missing',
  serviceMode: 'missing',
  businessName: 'missing',
  country: 'missing',
  email: 'missing',
  tables: 'missing',
  teamSize: 'missing',
  stockConcerns: 'missing',
  bookings: 'missing',
  priorities: 'missing',
  otherPreferences: 'missing',
});

export const mergeSetup = (current: GuestSetup, updates?: Partial<GuestSetup>): GuestSetup => {
  if (!updates) return current;

  const nextServices = listOf(updates.services);
  const nextPriorities = listOf(updates.priorities);

  let serviceMode = textOf(updates.serviceMode, 40);
  if (!serviceMode && nextServices.length) {
    serviceMode = serviceModeFromServices(nextServices);
  }
  if (!serviceMode && current.serviceMode) {
    serviceMode = current.serviceMode;
  }
  const services = serviceMode ? servicesFromServiceMode(serviceMode) : nextServices.length ? nextServices : current.services;

  const nextCountryRaw = textOf(updates.country, 80) || current.country;
  const nextCountry = normalizeCountry(nextCountryRaw) || nextCountryRaw;

  return {
    ...current,
    businessType: textOf(updates.businessType, 40) || current.businessType,
    businessName: textOf(updates.businessName, 100) || current.businessName,
    country: nextCountry,
    email: textOf(updates.email, 160) || current.email,
    serviceMode,
    services,
    priorities: nextPriorities.length ? nextPriorities : current.priorities,
    tables: tableCountOf(updates.tables) ?? current.tables,
    employees: countOf(updates.employees) ?? current.employees,
    stockConcerns: updates.stockConcerns ?? current.stockConcerns,
    bookings: updates.bookings ?? current.bookings,
  };
};

type FieldDef = {
  key: FieldKey;
  label: string;
  required: (setup: GuestSetup) => boolean;
  applicable: (setup: GuestSetup) => boolean;
  hasValue: (setup: GuestSetup) => boolean;
  question: (setup: GuestSetup) => string;
  confirmQuestion: (setup: GuestSetup) => string;
  quickReplies: (setup: GuestSetup) => string[];
};

export const FIELD_ORDER: FieldKey[] = [
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
];

export const formatFieldValue = (key: FieldKey, setup: GuestSetup): string => {
  switch (key) {
    case 'businessType':
      return setup.businessType;
    case 'businessName':
      return setup.businessName;
    case 'country':
      return setup.country;
    case 'email':
      return setup.email;
    case 'serviceMode':
      return serviceDisplayFromServices(setup.services) || setup.serviceMode || '';
    case 'tables':
      return setup.tables !== undefined ? `${setup.tables} tables` : '';
    case 'teamSize':
      return setup.employees !== undefined ? `${setup.employees} team members` : '';
    case 'stockConcerns':
      return setup.stockConcerns ? 'Track stock' : '';
    case 'bookings':
      return setup.bookings ? 'Take bookings' : '';
    case 'priorities':
      return setup.priorities.join(', ');
    case 'otherPreferences':
      return setup.otherPreferences || '';
    default:
      return '';
  }
};

export const fieldDefs: FieldDef[] = [
  {
    key: 'businessType',
    label: 'Business type',
    required: () => true,
    applicable: () => true,
    hasValue: (s) => s.businessType.trim() !== '',
    question: () => 'What kind of business do you run?',
    confirmQuestion: (s) => `You mentioned “${s.businessType}” as your business type. Is that right?`,
    quickReplies: () => ['Restaurant', 'Café', 'Retail shop', 'Pharmacy', 'Service business', 'Other'],
  },
  {
    key: 'serviceMode',
    label: 'Service mode',
    required: (s) => isRestaurantLike(s.businessType),
    applicable: (s) => isRestaurantLike(s.businessType),
    hasValue: (s) => s.serviceMode !== undefined && s.serviceMode.trim() !== '',
    question: () => 'How will customers be served — dine-in, takeaway, or both?',
    confirmQuestion: (s) => `You mentioned “${formatFieldValue('serviceMode', s)}”. Is that right?`,
    quickReplies: () => ['Dine-in only', 'Takeaway only', 'Both dine-in and takeaway'],
  },
  {
    key: 'businessName',
    label: 'Business name',
    required: () => true,
    applicable: () => true,
    hasValue: (s) => s.businessName.trim() !== '',
    question: (s) => `What is the name of your ${s.businessType || 'business'}?`,
    confirmQuestion: (s) => `You mentioned “${s.businessName}” as the business name. Is that right?`,
    quickReplies: () => [],
  },
  {
    key: 'country',
    label: 'Country',
    required: () => true,
    applicable: () => true,
    hasValue: (s) => s.country.trim() !== '',
    question: (s) =>
      `Which country will ${s.businessName ? `“${s.businessName}”` : 'the business'} operate in?`,
    confirmQuestion: (s) => `You mentioned “${s.country}”. Is that the correct country?`,
    quickReplies: () => ['Egypt', 'Saudi Arabia', 'United Arab Emirates', 'United Kingdom', 'United States'],
  },
  {
    key: 'email',
    label: 'Owner email',
    required: () => true,
    applicable: () => true,
    hasValue: (s) => emailPattern.test(s.email),
    question: () => 'Which email should receive your secure sign-in code?',
    confirmQuestion: (s) => `You mentioned “${s.email}” as the email. Is that correct?`,
    quickReplies: () => [],
  },
  {
    key: 'tables',
    label: 'Tables',
    required: () => false,
    applicable: (s) => isRestaurantLike(s.businessType),
    hasValue: (s) => s.tables !== undefined,
    question: () => 'How many tables do you expect to manage?',
    confirmQuestion: (s) => `You mentioned ${s.tables} tables. Is that right?`,
    quickReplies: () => ['4 tables', '10 tables', '20 tables'],
  },
  {
    key: 'teamSize',
    label: 'Team size',
    required: () => false,
    applicable: () => true,
    hasValue: (s) => s.employees !== undefined,
    question: () => 'How many team members do you expect at the start?',
    confirmQuestion: (s) => `You mentioned ${s.employees} team members. Is that right?`,
    quickReplies: () => ['Just me', '2–5 people', '6–10 people'],
  },
  {
    key: 'stockConcerns',
    label: 'Stock concerns',
    required: () => false,
    applicable: () => true,
    hasValue: (s) => s.stockConcerns === true,
    question: () => 'Do you want to track stock and inventory from day one?',
    confirmQuestion: () => 'You mentioned you want to track stock. Is that right?',
    quickReplies: () => ['Yes, track stock', 'No, skip'],
  },
  {
    key: 'bookings',
    label: 'Bookings',
    required: () => false,
    applicable: () => true,
    hasValue: (s) => s.bookings === true,
    question: () => 'Will you take table or appointment bookings?',
    confirmQuestion: () => 'You mentioned you want bookings. Is that right?',
    quickReplies: () => ['Yes, take bookings', 'No, skip'],
  },
  {
    key: 'priorities',
    label: 'Priorities',
    required: () => false,
    applicable: () => true,
    hasValue: (s) => s.priorities.length > 0,
    question: () => 'What matters most for your setup right now?',
    confirmQuestion: (s) => `You mentioned “${s.priorities.join(', ')}”. Is that right?`,
    quickReplies: () => ['Sales', 'Stock', 'Customers', 'Bookings', 'Team'],
  },
  {
    key: 'otherPreferences',
    label: 'Other preferences',
    required: () => false,
    applicable: () => true,
    hasValue: (s) => s.otherPreferences !== undefined && s.otherPreferences !== '',
    question: () => 'Any other setup preferences you want Q to know about?',
    confirmQuestion: (s) => `You mentioned “${s.otherPreferences}”. Is that right?`,
    quickReplies: () => ['No, that’s all'],
  },
];

export const fieldDefByKey = Object.fromEntries(fieldDefs.map((def) => [def.key, def])) as Record<
  FieldKey,
  FieldDef
>;

export const requiredFields = (setup: GuestSetup) =>
  FIELD_ORDER.filter((key) => fieldDefByKey[key].applicable(setup) && fieldDefByKey[key].required(setup));

export const requiredComplete = (setup: GuestSetup, journey: Record<FieldKey, FieldStatus>) =>
  requiredFields(setup).every((key) => {
    const status = journey[key];
    return (
      (status === 'confirmed' || status === 'skipped') &&
      fieldDefByKey[key].hasValue(setup)
    );
  });

export const requiredProgress = (setup: GuestSetup, journey: Record<FieldKey, FieldStatus>) => {
  const req = requiredFields(setup);
  const done = req.filter(
    (key) => fieldDefByKey[key].hasValue(setup) && (journey[key] === 'confirmed' || journey[key] === 'skipped'),
  ).length;
  return { done, total: req.length };
};

export const nextField = (setup: GuestSetup, journey: Record<FieldKey, FieldStatus>): FieldKey | null => {
  for (const key of FIELD_ORDER) {
    const def = fieldDefByKey[key];
    if (!def.applicable(setup)) continue;
    const status = journey[key];
    if (status !== 'confirmed' && status !== 'skipped') return key;
  }
  return null;
};

export const parseActiveAnswer = (
  message: string,
  field: FieldKey | null,
  setup: GuestSetup,
): Partial<GuestSetup> => {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const updates: Partial<GuestSetup> = {};

  // Active/direct business type answers (e.g. quick replies).
  if ((field === 'businessType' || (!setup.businessType && !field)) && !updates.businessType) {
    if (/restaurant/i.test(lower)) updates.businessType = 'restaurant';
    else if (/caf[ée]/i.test(lower)) updates.businessType = 'cafe';
    else if (/pharmacy/i.test(lower)) updates.businessType = 'pharmacy';
    else if (/retail|shop|store/i.test(lower)) updates.businessType = 'retail shop';
    else if (/service|salon|agency/i.test(lower)) updates.businessType = 'service business';
    else if (field === 'businessType' && trimmed) updates.businessType = trimmed.slice(0, 40);
  }

  // Active/direct business name answers. Strictly accept only when the active field is
  // businessName, and reject answers that are obviously a country or priority.
  if (field === 'businessName' && !updates.businessName) {
    if (!isOwnerNameStatement(trimmed)) {
      const explicitName = trimmed.match(
        /(?:my\s+(?:restaurant|caf[ée]|cafe|business|shop)\s+is\s+(?:called|named)|the\s+(?:restaurant|caf[ée]|cafe|business|shop)\s+name\s+is|business\s+name(?:\s+is)?|call\s+(?:the\s+)?(?:my\s+)?(?:shop|business|restaurant|cafe|caf[ée]))\s+([a-z0-9][a-z0-9 '&.-]{0,99})/i,
      );
      if (explicitName) {
        updates.businessName = explicitName[1].trim().replace(/[.,!]+$/, '');
      } else {
        const lowerTrimmed = trimmed.toLowerCase();
        const countryOnlyPattern = /^(egypt|sudan|saudi arabia|uae|united arab emirates|uk|united kingdom|us|usa|united states)$/i;
        const priorityOnlyPattern = /^(fast checkout|quick checkout|sales|stock|customers|bookings|team|finance|kitchen)$/i;
        if (countryOnlyPattern.test(lowerTrimmed) || priorityOnlyPattern.test(lowerTrimmed)) {
          return updates;
        }
        if (
          trimmed.length > 0 &&
          trimmed.length <= 100 &&
          !isSkipMessage(trimmed) &&
          !isConfirmMessage(trimmed) &&
          !isChangeMessage(trimmed)
        ) {
          updates.businessName = trimmed.slice(0, 100);
        }
      }
    }
  }

  // Active/direct country answers (e.g. quick replies like "Egypt"). Only recognized
  // countries and aliases are accepted; arbitrary raw text is never stored as country.
  if (field === 'country' && !updates.country) {
    const cleaned = trimmed.replace(/[.!?]$/, '');
    const country = normalizeCountry(cleaned);
    if (country) updates.country = country;
  }

  if (
    (field === 'serviceMode' || (!setup.serviceMode && !field)) &&
    isRestaurantLike(setup.businessType)
  ) {
    const services = parseServiceCapabilities(message);
    if (services.length) {
      updates.serviceMode = serviceModeFromServices(services);
      updates.services = services;
      if (!services.includes('dine-in') && setup.tables === undefined) {
        updates.tables = 0;
      }
    }
  }

  if (
    (field === 'tables' || (setup.tables === undefined && !field)) &&
    isRestaurantLike(setup.businessType)
  ) {
    const noTables =
      /\b(?:no|zero|0)\s+tables|counter service,\s*no\s+tables|\btakeaway\s+only|\bdelivery\s+only|\btakeaway\s+and\s+delivery\s+only/i.test(
        message,
      );
    if (noTables) {
      updates.tables = 0;
    } else {
      const match = message.match(/(\d{1,4})\s*(?:table|tables)/i);
      if (match) updates.tables = Number(match[1]);
    }
  }

  if (field === 'teamSize' || (setup.employees === undefined && !field)) {
    if (/just me|only me|myself|1 person/i.test(message)) updates.employees = 1;
    else {
      const match = message.match(/(\d{1,5})\s*(?:employee|employees|staff|team members?|people|persons?)/i);
      if (match) updates.employees = Number(match[1]);
    }
  }

  if (field === 'priorities' || (setup.priorities.length === 0 && !field)) {
    const add: string[] = [];
    if (/sales|selling/i.test(lower)) add.push('Sales');
    if (/stock|inventory/i.test(lower)) add.push('Stock');
    if (/customer|guest/i.test(lower)) add.push('Customers');
    if (/booking|reservation|appointment/i.test(lower)) add.push('Bookings');
    if (/team|staff|hr/i.test(lower)) add.push('Team');
    if (/finance|accounting/i.test(lower)) add.push('Finance');
    if (/menu|kitchen/i.test(lower)) add.push('Kitchen');
    if (/\b(?:fast|quick)\s+checkout\b/i.test(lower)) add.push('Fast checkout');
    if (add.length) updates.priorities = [...new Set([...setup.priorities, ...add])];
  }

  if (field === 'stockConcerns' || (setup.stockConcerns === undefined && !field)) {
    if (/yes|track stock|stock|inventory/i.test(lower)) updates.stockConcerns = true;
  }

  if (field === 'bookings' || (setup.bookings === undefined && !field)) {
    if (/yes|booking|reservation|appointment/i.test(lower)) updates.bookings = true;
  }

  if (field === 'otherPreferences' || (setup.otherPreferences === undefined && !field)) {
    updates.otherPreferences = trimmed.slice(0, 400);
  }

  return updates;
};

const MODULE_ORDER = [
  'Dashboard',
  'Sales',
  'Kitchen',
  'Menu',
  'Tables',
  'Stock',
  'Team',
  'Customers',
  'Reports',
  'Finance',
  'Q Assistant',
  'Bookings',
];

const RESTAURANT_BASE_MODULES = [
  'Dashboard',
  'Sales',
  'Kitchen',
  'Menu',
  'Customers',
  'Reports',
  'Finance',
  'Q Assistant',
];

export const fallbackModules = (setup: GuestSetup) => {
  const selected = new Set<string>();
  const type = (setup.businessType || '').toLowerCase();
  const isFoodBusiness = /restaurant|cafe|café/.test(type);

  if (isFoodBusiness) {
    RESTAURANT_BASE_MODULES.forEach((module) => selected.add(module));
    if (setup.services.includes('dine-in') && setup.tables !== 0) {
      selected.add('Tables');
    }
    if ((setup.employees ?? 1) > 1) {
      selected.add('Team');
    }
  } else if (/retail|shop|pharmacy/.test(type)) {
    ['Sales', 'Stock', 'Customers', 'Team', 'Finance'].forEach((module) => selected.add(module));
  } else {
    ['Sales', 'Customers', 'Team', 'Finance', 'Bookings'].forEach((module) => selected.add(module));
  }

  if (setup.stockConcerns) selected.add('Stock');
  if (setup.bookings) selected.add('Bookings');

  return MODULE_ORDER.filter((module) => selected.has(module));
};

export const syncJourney = (
  nextSetup: GuestSetup,
  journey: Record<FieldKey, FieldStatus>,
  pendingField: FieldKey | null,
  wasSkip: boolean,
  _markVolunteeredConfirmed?: boolean,
): Record<FieldKey, FieldStatus> => {
  const next: Record<FieldKey, FieldStatus> = { ...journey };
  for (const key of FIELD_ORDER) {
    const def = fieldDefByKey[key];
    if (!def.hasValue(nextSetup)) continue;

    // Confirmed and skipped states are authoritative and must never be overwritten.
    if (next[key] === 'confirmed' || next[key] === 'skipped') continue;

    if (key === pendingField && !wasSkip) {
      // An explicit answer to the currently active field is treated as confirmed.
      next[key] = 'confirmed';
    } else if (next[key] === 'missing') {
      // Values filled in by backend inference remain captured until explicitly confirmed.
      next[key] = 'captured';
    }
    // Existing captured values stay captured.
  }

  // Side-effect: no-table service setups skip the tables question.
  if (nextSetup.tables === 0 && next.tables !== 'confirmed' && next.tables !== 'skipped') {
    next.tables = 'skipped';
  }

  return next;
};

/**
 * Returns true when the backend prose is asking the given field.
 * Matches the field's guided question, confirmation question, or a question
 * that ends with ? and mentions the field label.
 */
export const replyAsksField = (reply: string, field: FieldKey, setup: GuestSetup): boolean => {
  if (!reply) return false;
  const def = fieldDefByKey[field];
  const question = def.question(setup).toLowerCase();
  const confirm = def.confirmQuestion(setup).toLowerCase();
  const label = def.label.toLowerCase();
  const normalized = reply.toLowerCase().trim();
  return (
    normalized.includes(question) ||
    normalized.includes(confirm) ||
    (normalized.includes(label) && normalized.endsWith('?'))
  );
};

/**
 * Classifies a backend reply relative to the current journey:
 * - 'intended': the reply asks the next field the frontend intends to ask.
 * - 'stale':    the reply asks a confirmed, skipped, or off-sequence field.
 * - 'prose':    the reply is an acknowledgement or unrelated prose.
 */
export const classifyBackendReply = (
  reply: string,
  setup: GuestSetup,
  journey: Record<FieldKey, FieldStatus>,
): 'intended' | 'stale' | 'prose' => {
  const trimmed = textOf(reply);
  if (!trimmed) return 'prose';
  const intended = nextField(setup, journey);
  if (intended && replyAsksField(trimmed, intended, setup)) return 'intended';
  for (const key of FIELD_ORDER) {
    if (!fieldDefByKey[key].applicable(setup)) continue;
    if (replyAsksField(trimmed, key, setup)) return 'stale';
  }
  return 'prose';
};

/**
 * Decides what to render after a backend response:
 * - If the backend already asked the intended next question, show it and activate
 *   that field; do not append a duplicate local question.
 * - If the backend asked a stale/off-sequence question, suppress it and ask the
 *   intended field locally exactly once.
 * - Otherwise show the backend prose and ask the intended field once.
 * - When no intended field remains, move to review-ready.
 */
export const determineNextPresentation = (
  backendReply: string | undefined,
  setup: GuestSetup,
  journey: Record<FieldKey, FieldStatus>,
): {
  backendReply: string | null;
  next: { type: 'activate'; field: FieldKey } | { type: 'ask'; field: FieldKey } | { type: 'review' };
} => {
  const reply = textOf(backendReply);
  const intended = nextField(setup, journey);
  const classification = classifyBackendReply(reply, setup, journey);

  if (!intended) {
    return { backendReply: classification === 'stale' ? null : reply, next: { type: 'review' } };
  }

  if (classification === 'intended') {
    return { backendReply: reply, next: { type: 'activate', field: intended } };
  }

  return {
    backendReply: classification === 'stale' ? null : reply,
    next: { type: 'ask', field: intended },
  };
};

/** Quick replies derived directly from the current active field and journey state. */
export const deriveQuickReplies = (
  field: FieldKey | null,
  setup: GuestSetup,
  journey: Record<FieldKey, FieldStatus>,
): string[] => {
  if (!field) return [];
  const def = fieldDefByKey[field];
  const status = journey[field];
  return status === 'captured' ? ['Yes, that’s right', 'Change it'] : def.quickReplies(setup);
};

/** Returns true when a quick-reply label does not belong to the active field. */
export const isStaleQuickReply = (
  reply: string,
  field: FieldKey,
  setup: GuestSetup,
  journey: Record<FieldKey, FieldStatus>,
): boolean => !deriveQuickReplies(field, setup, journey).includes(reply);

/** Returns true when an in-flight response belongs to an older journey revision. */
export const isStaleRevision = (requestRevision: number, currentRevision: number): boolean =>
  requestRevision !== currentRevision;

/** Returns true when the field's own quick replies already contain a skip action. */
export const hasInlineSkip = (field: FieldKey): boolean =>
  fieldDefByKey[field].quickReplies(initialSetup('')).some((reply) => isSkipMessage(reply));
