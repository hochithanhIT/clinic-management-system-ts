import type { DateValue } from '@internationalized/date'

export type GenderValue = 'male' | 'female'

export interface ComboboxOption {
  value: number
  label: string
}

export interface PatientFormState {
  code: string | null
  fullName: string
  gender: GenderValue | undefined
  occupationId: number | null
  cityId: number | null
  wardId: number | null
  phone: string
  relativeName: string
  relativePhone: string
  reason: string
  roomId: number | null
}

export type MedicalRecordStatusFilterValue = 'all' | '0' | '1' | '2'

export interface MedicalRecordStatusOption {
  value: MedicalRecordStatusFilterValue
  label: string
}

export interface DateRangeValue {
  from: DateValue | undefined
  to: DateValue | undefined
}
