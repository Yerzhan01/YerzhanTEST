// Утилиты для преобразования между строковыми и числовыми кодами
// Обеспечивает обратную совместимость API

export const USER_ROLES = {
  // Строка -> Число
  admin: 1,
  manager: 2,
  financist: 3,
  // Число -> Строка
  1: 'admin',
  2: 'manager',
  3: 'financist'
} as const;

export const PROJECTS = {
  // Строка -> Число
  amazon: 1,
  shopify: 2,
  // Число -> Строка
  1: 'amazon',
  2: 'shopify'
} as const;

export const DEAL_STATUSES = {
  // Строка -> Число
  new: 1,
  in_progress: 2,
  prepayment: 3,
  partial: 4,
  completed: 5,
  cancelled: 6,
  frozen: 7,
  // Число -> Строка
  1: 'new',
  2: 'in_progress',
  3: 'prepayment',
  4: 'partial',
  5: 'completed',
  6: 'cancelled',
  7: 'frozen'
} as const;

export const RETURN_STATUSES = {
  // Строка -> Число
  requested: 1,
  processing: 2,
  completed: 3,
  rejected: 4,
  // Число -> Строка
  1: 'requested',
  2: 'processing',
  3: 'completed',
  4: 'rejected'
} as const;

export const PLAN_TYPES = {
  // Строка -> Число
  first_half: 1,
  second_half: 2,
  // Число -> Строка
  1: 'first_half',
  2: 'second_half'
} as const;

export const GENDERS = {
  // Строка -> Число
  male: 1,
  female: 2,
  // Число -> Строка
  1: 'male',
  2: 'female'
} as const;

// Типы для TypeScript
export type UserRoleString = 'admin' | 'manager' | 'financist';
export type UserRoleId = 1 | 2 | 3;

export type ProjectString = 'amazon' | 'shopify';
export type ProjectId = 1 | 2;

export type DealStatusString = 'new' | 'in_progress' | 'prepayment' | 'partial' | 'completed' | 'cancelled' | 'frozen';
export type DealStatusId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReturnStatusString = 'requested' | 'processing' | 'completed' | 'rejected';
export type ReturnStatusId = 1 | 2 | 3 | 4;

export type PlanTypeString = 'first_half' | 'second_half';
export type PlanTypeId = 1 | 2;

export type GenderString = 'male' | 'female';
export type GenderId = 1 | 2;

// Утилиты конвертации
export function roleToId(role: UserRoleString): UserRoleId {
  return USER_ROLES[role];
}

export function roleToString(id: UserRoleId): UserRoleString {
  return USER_ROLES[id];
}

export function projectToId(project: ProjectString): ProjectId {
  return PROJECTS[project];
}

export function projectToString(id: ProjectId): ProjectString {
  return PROJECTS[id];
}

export function dealStatusToId(status: DealStatusString): DealStatusId {
  return DEAL_STATUSES[status];
}

export function dealStatusToString(id: DealStatusId): DealStatusString {
  return DEAL_STATUSES[id];
}

export function returnStatusToId(status: ReturnStatusString): ReturnStatusId {
  return RETURN_STATUSES[status];
}

export function returnStatusToString(id: ReturnStatusId): ReturnStatusString {
  return RETURN_STATUSES[id];
}

export function planTypeToId(type: PlanTypeString): PlanTypeId {
  return PLAN_TYPES[type];
}

export function planTypeToString(id: PlanTypeId): PlanTypeString {
  return PLAN_TYPES[id];
}

export function genderToId(gender: GenderString): GenderId {
  return GENDERS[gender];
}

export function genderToString(id: GenderId): GenderString {
  return GENDERS[id];
}

// Универсальные конвертеры
export function convertToIds<T extends Record<string, any>>(
  data: T,
  fieldMappings: Record<string, (value: any) => number>
): T & Record<string, any> {
  const result = { ...data } as T & Record<string, any>;
  
  for (const [field, converter] of Object.entries(fieldMappings)) {
    if (result[field] !== undefined && result[field] !== null) {
      result[`${field}_id`] = converter(result[field]);
    }
  }
  
  return result;
}

export function convertToStrings<T extends Record<string, any>>(
  data: T,
  fieldMappings: Record<string, (value: number) => string>
): T & Record<string, any> {
  const result = { ...data } as T & Record<string, any>;
  
  for (const [field, converter] of Object.entries(fieldMappings)) {
    const idField = `${field}_id`;
    if (result[idField] !== undefined && result[idField] !== null) {
      result[field] = converter(result[idField]);
    }
  }
  
  return result;
}