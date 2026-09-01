export interface FormFieldOption {
  formFieldOptionId: number;
  optionValue: string;
  optionLabel: string;
  displayOrder: number;
  isActive: boolean;
}

export interface FormField {
  formFieldId: number;
  fieldKey: string;
  label: string;
  fieldType: string;
  placeholder: string | null;
  isRequired: boolean;
  isVisible: boolean;
  isEnabled: boolean;
  displayOrder: number;
  defaultValue: string | null;
  options: FormFieldOption[];
}

export interface UpdateFormFieldRequest {
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isVisible: boolean;
  isEnabled: boolean;
  displayOrder: number;
}

export interface CreateCustomFieldRequest {
  fieldKey: string;
  label: string;
  fieldType: string;
  placeholder?: string;
  isRequired: boolean;
  displayOrder: number;
  options?: string[];
}

export const FIELD_TYPES = [
  "TEXT", "TEXTAREA", "NUMBER", "DATE", "DATETIME",
  "DROPDOWN", "MULTISELECT", "CHECKBOX", "RADIO", "SWITCH", "EMAIL", "PHONE",
] as const;
