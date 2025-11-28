import type { GenderValue, ComboboxOption } from '../patientIntake/types'

export type { GenderValue, ComboboxOption }

export interface AdministrativePatientFormState {
  code: string | null
  fullName: string
  gender: GenderValue | undefined
  occupationId: number | null
  cityId: number | null
  wardId: number | null
  phone: string
  relativeName: string
  relativePhone: string
}
