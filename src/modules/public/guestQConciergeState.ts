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

export const isRestaurantLike = (type: string) => /restaurant|cafe|café/.test((type || '').toLowerCase());

export const isSkipMessage = (message: string) =>
  /^(skip|later|not now|pass|no thanks?|nope|none|no)$/i.test(message.trim());

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
  if (hasDineIn && hasTakeaway) return 'both';
  if (hasTakeaway) return 'takeaway';
  if (hasDineIn) return 'dine_in';
  return '';
};

export const servicesFromServiceMode = (mode: string): string[] => {
  const normalized = mode.toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'both') return ['dine-in', 'takeaway'];
  if (normalized === 'takeaway') return ['takeaway'];
  if (normalized === 'dinein' || normalized === 'dine') return ['dine-in'];
  return mode ? [mode] : [];
};

export const canonicalizeServiceMode = (mode: string): string => {
  const normalized = mode.toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'both') return 'both';
  if (normalized === 'takeaway' || normalized === 'takeout') return 'takeaway';
  if (normalized === 'dinein' || normalized === 'dine') return 'dine_in';
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

  return {
    ...current,
    businessType: textOf(updates.businessType, 40) || current.businessType,
    businessName: textOf(updates.businessName, 100) || current.businessName,
    country: textOf(updates.country, 80) || current.country,
    email: textOf(updates.email, 160) || current.email,
    serviceMode,
    services,
    priorities: nextPriorities.length ? nextPriorities : current.priorities,
    tables: countOf(updates.tables) ?? current.tables,
    employees: countOf(updates.employees) ?? current.employees,
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
      return (
        {
          dine_in: 'Dine-in only',
          takeaway: 'Takeaway only',
          both: 'Dine-in and takeaway',
        }[setup.serviceMode || ''] || setup.serviceMode || ''
      );
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
    quickReplies: () => ['4 tables', '10 tables', '20 tables', 'Skip for now'],
  },
  {
    key: 'teamSize',
    label: 'Team size',
    required: () => false,
    applicable: () => true,
    hasValue: (s) => s.employees !== undefined,
    question: () => 'How many team members do you expect at the start?',
    confirmQuestion: (s) => `You mentioned ${s.employees} team members. Is that right?`,
    quickReplies: () => ['Just me', '2–5 people', '6–10 people', 'Skip for now'],
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
    quickReplies: () => ['Sales', 'Stock', 'Customers', 'Bookings', 'Team', 'Skip for now'],
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
    const knownCountries: Record<string, string> = {
      egypt: 'Egypt',
      sudan: 'Sudan',
      saudiarabia: 'Saudi Arabia',
      'saudi arabia': 'Saudi Arabia',
      uae: 'United Arab Emirates',
      unitedarabemirates: 'United Arab Emirates',
      uk: 'United Kingdom',
      unitedkingdom: 'United Kingdom',
      us: 'United States',
      usa: 'United States',
      unitedstates: 'United States',
    };
    const key = cleaned.toLowerCase().replace(/[-\s]/g, '');
    const country = knownCountries[key];
    if (country) updates.country = country;
  }

  if (
    (field === 'serviceMode' || (!setup.serviceMode && !field)) &&
    isRestaurantLike(setup.businessType)
  ) {
    if (/dine[-_ ]?in only/i.test(message)) updates.serviceMode = 'dine_in';
    else if (/take[-_ ]?away only|takeout only/i.test(message)) updates.serviceMode = 'takeaway';
    else if (/\bboth\b/i.test(message) || /dine[-_ ]?in and take[-_ ]?away/i.test(message))
      updates.serviceMode = 'both';
    else if (/dine[-_ ]?in/i.test(message) && !/take[-_ ]?away|takeout/i.test(message))
      updates.serviceMode = 'dine_in';
    else if (/take[-_ ]?away|takeout/i.test(message) && !/dine[-_ ]?in/i.test(message))
      updates.serviceMode = 'takeaway';
  }

  if (
    (field === 'tables' || (setup.tables === undefined && !field)) &&
    isRestaurantLike(setup.businessType)
  ) {
    const match = message.match(/(\d{1,4})\s*(?:table|tables)/i);
    if (match) updates.tables = Number(match[1]);
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

export const fallbackModules = (setup: GuestSetup) => {
  const modules = new Set<string>(['Dashboard', 'Q Assistant']);
  const type = (setup.businessType || '').toLowerCase();

  if (/restaurant|cafe|café/.test(type)) {
    ['Sales', 'Kitchen', 'Menu', 'Stock', 'Orders', 'Finance', 'Customers'].forEach((m) => modules.add(m));
    if (setup.serviceMode !== 'takeaway') {
      modules.add('Tables');
      modules.add('Bookings');
    }
  } else if (/retail|shop|pharmacy/.test(type)) {
    ['Sales', 'Stock', 'Customers', 'Team', 'Finance'].forEach((m) => modules.add(m));
  } else {
    ['Sales', 'Customers', 'Team', 'Finance', 'Bookings'].forEach((m) => modules.add(m));
  }

  if (setup.stockConcerns) modules.add('Stock');
  if (setup.bookings) modules.add('Bookings');

  return Array.from(modules);
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
  return next;
};
