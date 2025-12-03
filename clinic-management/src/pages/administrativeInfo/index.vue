<script setup lang="ts">
definePage({
  alias: '/administrative-info/',
  meta: {
    requiresAuth: true,
  },
})

import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import type { AcceptableValue } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { toast } from 'vue-sonner'

import AdministrativeFilters from '@/components/administrativeInfo/AdministrativeFilters.vue'
import AdministrativePatientForm from '@/components/administrativeInfo/AdministrativePatientForm.vue'
import AdministrativeTable from '@/components/administrativeInfo/AdministrativeTable.vue'
import type {
  AdministrativePatientFormState,
  ComboboxOption,
  GenderValue,
} from '@/components/administrativeInfo/types'
import type {
  MedicalRecordStatusFilterValue,
  MedicalRecordStatusOption,
} from '@/components/patientIntake/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/services/http'
import { getCities, getProvinces } from '@/services/location'
import { getMedicalRecords } from '@/services/medicalRecord'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import { getOccupations } from '@/services/occupation'
import { getPatient, updatePatient } from '@/services/patient'
import type { PatientSummary, UpdatePatientPayload } from '@/services/patient'
import { getRooms } from '@/services/room'
import type { PaginationMeta } from '@/services/types'

const FETCH_LIMIT = 100
const OCCUPATION_PAGE_SIZE = 40
const DEFAULT_MEDICAL_RECORD_PAGE_SIZE = 20
const MEDICAL_RECORD_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const timeZone = getLocalTimeZone()
const maxBirthDate = today(timeZone)

const genderOptions: Array<{ value: GenderValue; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const genderValueMap: Record<GenderValue, number> = {
  male: 1,
  female: 0,
}

const medicalRecordStatusOptions: MedicalRecordStatusOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: '0', label: 'Pending' },
  { value: '1', label: 'In progress' },
  { value: '2', label: 'Completed' },
]

const medicalRecordStatusLabelMap: Record<number, string> = {
  0: 'Pending',
  1: 'In progress',
  2: 'Completed',
}

const medicalRecordStatusClassMap: Record<number, string> = {
  0: 'bg-amber-100 text-amber-800',
  1: 'bg-sky-100 text-sky-800',
  2: 'bg-emerald-100 text-emerald-800',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const medicalRecords = ref<MedicalRecordSummary[]>([])
const medicalRecordsLoading = ref(false)
const medicalRecordsPagination = ref<PaginationMeta | null>(null)

const recordsPage = ref(1)
const recordsPageSize = ref(DEFAULT_MEDICAL_RECORD_PAGE_SIZE)

const recordFilters = reactive({
  patientCode: '',
  patientName: '',
  status: 'all' as MedicalRecordStatusFilterValue,
  roomId: null as number | null,
})

const appliedRecordFilters = ref({
  patientCode: '',
  patientName: '',
  status: 'all' as MedicalRecordStatusFilterValue,
  roomId: null as number | null,
  from: null as Date | null,
  to: null as Date | null,
})

const recordsFromRaw = ref<unknown>(undefined)
const recordsToRaw = ref<unknown>(undefined)

const recordsFromModel = computed<DateValue | undefined>({
  get: () => recordsFromRaw.value as DateValue | undefined,
  set: (value: DateValue | undefined) => {
    recordsFromRaw.value = value
  },
})

const recordsToModel = computed<DateValue | undefined>({
  get: () => recordsToRaw.value as DateValue | undefined,
  set: (value: DateValue | undefined) => {
    recordsToRaw.value = value
  },
})

const recordsHasFromDate = computed(() => Boolean(recordsFromRaw.value))
const recordsHasToDate = computed(() => Boolean(recordsToRaw.value))

const recordsFromLabel = computed(() => {
  const value = recordsFromRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  return dateFormatter.format(value.toDate(timeZone))
})

const recordsToLabel = computed(() => {
  const value = recordsToRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  return dateFormatter.format(value.toDate(timeZone))
})

const startOfDay = (value: Date): Date => {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

const endOfDay = (value: Date): Date => {
  const result = new Date(value)
  result.setHours(23, 59, 59, 999)
  return result
}

const resolveDateValue = (value: unknown): Date | null => {
  if (!value || typeof value !== 'object' || typeof (value as DateValue).toDate !== 'function') {
    return null
  }

  return (value as DateValue).toDate(timeZone)
}

const ensureOptionRetained = (
  options: ComboboxOption[],
  currentValue: number | null,
): number | null => {
  if (currentValue === null) {
    return null
  }

  const exists = options.some((option) => option.value === currentValue)
  return exists ? currentValue : null
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateFormatter.format(date)
}

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateTimeFormatter.format(date)
}

const getGenderLabel = (value: number): string => {
  if (value === 1) {
    return 'Male'
  }

  if (value === 0) {
    return 'Female'
  }

  return 'Other'
}

const getStatusLabel = (value: number): string => {
  return medicalRecordStatusLabelMap[value] ?? 'Unknown'
}

const getStatusClass = (value: number): string => {
  return medicalRecordStatusClassMap[value] ?? 'bg-muted text-muted-foreground'
}

const filteredMedicalRecords = computed(() => {
  const { patientCode, patientName, status, roomId, from, to } = appliedRecordFilters.value
  const codeFilter = patientCode.trim().toLowerCase()
  const nameFilter = patientName.trim().toLowerCase()

  return medicalRecords.value.filter((record) => {
    const recordDate = new Date(record.enteredAt)

    if (from && !Number.isNaN(recordDate.getTime()) && recordDate < from) {
      return false
    }

    if (to && !Number.isNaN(recordDate.getTime()) && recordDate > to) {
      return false
    }

    if (status !== 'all' && String(record.status) !== status) {
      return false
    }

    if (roomId !== null && record.clinicRoom?.id !== roomId) {
      return false
    }

    if (codeFilter && !(record.patient.code ?? '').toLowerCase().includes(codeFilter)) {
      return false
    }

    if (nameFilter && !(record.patient.fullName ?? '').toLowerCase().includes(nameFilter)) {
      return false
    }

    return true
  })
})

const recordsSummary = computed(() => {
  const pagination = medicalRecordsPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No matching patients found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)

  return `Showing ${filteredMedicalRecords.value.length} of ${pagination.total} medical records (records ${start}-${end}).`
})

const roomOptions = ref<ComboboxOption[]>([])
const loadingRooms = ref(false)

const loadRooms = async () => {
  loadingRooms.value = true
  try {
    const { rooms } = await getRooms({ limit: FETCH_LIMIT })
    const options = rooms.map((room) => ({
      value: room.id,
      label: `${room.name} · ${room.departmentName}`,
    }))
    roomOptions.value = options
    recordFilters.roomId = ensureOptionRetained(options, recordFilters.roomId)
    appliedRecordFilters.value.roomId = ensureOptionRetained(
      options,
      appliedRecordFilters.value.roomId,
    )
  } catch (error) {
    toast.error('Unable to load clinic rooms.')
    console.error(error)
  } finally {
    loadingRooms.value = false
  }
}

const loadMedicalRecords = async () => {
  medicalRecordsLoading.value = true
  try {
    const statusFilter =
      appliedRecordFilters.value.status !== 'all'
        ? Number(appliedRecordFilters.value.status)
        : undefined

    const searchTerm =
      appliedRecordFilters.value.patientCode.trim() ||
      appliedRecordFilters.value.patientName.trim() ||
      undefined

    const { medicalRecords: records, pagination } = await getMedicalRecords({
      page: recordsPage.value,
      limit: recordsPageSize.value,
      status: statusFilter,
      roomId: appliedRecordFilters.value.roomId ?? undefined,
      enteredFrom: appliedRecordFilters.value.from ?? undefined,
      enteredTo: appliedRecordFilters.value.to ?? undefined,
      search: searchTerm,
    })

    medicalRecords.value = records
    medicalRecordsPagination.value = pagination
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Unable to load patients. Please try again.'
    toast.error(message)
  } finally {
    medicalRecordsLoading.value = false
  }
}

const applyFilters = async () => {
  const fromDate = resolveDateValue(recordsFromRaw.value)
  const toDate = resolveDateValue(recordsToRaw.value)

  appliedRecordFilters.value = {
    patientCode: recordFilters.patientCode.trim(),
    patientName: recordFilters.patientName.trim(),
    status: recordFilters.status,
    roomId: recordFilters.roomId,
    from: fromDate ? startOfDay(fromDate) : null,
    to: toDate ? endOfDay(toDate) : null,
  }

  recordsPage.value = 1
  await loadMedicalRecords()
}

const handleFiltersSearch = async () => {
  await applyFilters()
}

const handleFiltersReset = async () => {
  const todayValue = today(timeZone)
  const baseDate = todayValue.toDate(timeZone)

  recordFilters.patientCode = ''
  recordFilters.patientName = ''
  recordFilters.status = 'all'
  recordFilters.roomId = null

  recordsFromRaw.value = todayValue
  recordsToRaw.value = todayValue

  appliedRecordFilters.value = {
    patientCode: '',
    patientName: '',
    status: 'all',
    roomId: null,
    from: startOfDay(baseDate),
    to: endOfDay(baseDate),
  }

  recordsPage.value = 1
  await loadMedicalRecords()
}

const handleRecordsPageChange = async (page: number) => {
  if (medicalRecordsLoading.value || page === recordsPage.value) {
    return
  }

  recordsPage.value = page
  await loadMedicalRecords()
}

const handleRecordsPageSizeChange = async (value: AcceptableValue) => {
  if (value === null || typeof value === 'boolean') {
    return
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed === recordsPageSize.value) {
    return
  }

  recordsPageSize.value = parsed
  recordsPage.value = 1
  await loadMedicalRecords()
}

const focusField = (fieldId: string) => {
  if (typeof window === 'undefined') {
    return
  }

  requestAnimationFrame(() => {
    const element = document.getElementById(fieldId)
    if (element instanceof HTMLElement) {
      if (
        (element instanceof HTMLButtonElement ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement) &&
        element.disabled
      ) {
        return
      }

      element.focus()
      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  })
}

const extractValidationMessage = (details: unknown): string | null => {
  if (!details || typeof details !== 'object') {
    return null
  }

  const payload = details as { errors?: Record<string, unknown> }
  if (!payload.errors || typeof payload.errors !== 'object') {
    return null
  }

  for (const raw of Object.values(payload.errors)) {
    if (Array.isArray(raw)) {
      const message = raw.find((item): item is string => typeof item === 'string')
      if (message) {
        return message
      }
    }
  }

  return null
}

const editDialogOpen = ref(false)
const editingRecord = ref<MedicalRecordSummary | null>(null)
const isLoadingPatientDetails = ref(false)
const isEditSubmitting = ref(false)
const isInitializingEditForm = ref(false)

const editForm = reactive<AdministrativePatientFormState>({
  code: null,
  fullName: '',
  gender: undefined,
  occupationId: null,
  cityId: null,
  wardId: null,
  phone: '',
  relativeName: '',
  relativePhone: '',
})

const editFormErrors = ref<string[]>([])
const editBirthDateRaw = ref<unknown>(undefined)

const editBirthDateModel = computed<DateValue | undefined>({
  get: () => editBirthDateRaw.value as DateValue | undefined,
  set: (value: DateValue | undefined) => {
    editBirthDateRaw.value = value
  },
})

const editHasBirthDate = computed(() => Boolean(editBirthDateRaw.value))

const editBirthDateLabel = computed(() => {
  const value = editBirthDateRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  return dateFormatter.format(value.toDate(timeZone))
})

const editAgeDisplay = computed(() => {
  const value = editBirthDateRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return ''
  }

  const birthDate = value.toDate(timeZone)
  const now = new Date()

  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  const dayDiff = now.getDate() - birthDate.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }

  return age >= 0 ? String(age) : ''
})

const occupationOptions = ref<ComboboxOption[]>([])
const occupationPagination = reactive({ page: 0, totalPages: 0 })
const occupationSearchTerm = ref('')
const loadingOccupations = ref(false)
const loadingMoreOccupations = ref(false)
let occupationRequestCounter = 0

const occupationHasMore = computed(() => {
  if (occupationPagination.totalPages === 0) {
    return false
  }

  return occupationPagination.page < occupationPagination.totalPages
})

const updateOccupationOptions = (options: ComboboxOption[], reset: boolean) => {
  if (reset) {
    occupationOptions.value = options
  } else {
    const merged = [...occupationOptions.value]
    for (const option of options) {
      if (!merged.some((existing) => existing.value === option.value)) {
        merged.push(option)
      }
    }
    occupationOptions.value = merged
  }
}

const fetchOccupations = async (
  page: number,
  searchTerm: string,
  { reset }: { reset: boolean },
) => {
  occupationRequestCounter += 1
  const requestId = occupationRequestCounter
  const isResetRequest = reset

  if (!isResetRequest && loadingMoreOccupations.value) {
    return
  }

  if (isResetRequest) {
    loadingOccupations.value = true
  } else {
    loadingMoreOccupations.value = true
  }

  try {
    const { occupations, pagination } = await getOccupations({
      page,
      limit: OCCUPATION_PAGE_SIZE,
      search: searchTerm.trim() || undefined,
    })

    const options = occupations.map((occupation) => ({
      value: occupation.id,
      label: occupation.name,
    }))

    if (requestId === occupationRequestCounter) {
      updateOccupationOptions(options, reset)
      occupationPagination.page = pagination.page
      occupationPagination.totalPages = pagination.totalPages
    }
  } catch (error) {
    toast.error('Unable to load occupations.')
    console.error(error)
  } finally {
    if (isResetRequest) {
      if (requestId === occupationRequestCounter) {
        loadingOccupations.value = false
      }
    } else {
      loadingMoreOccupations.value = false
    }
  }
}

const loadOccupations = async ({ reset }: { reset: boolean }) => {
  if (reset) {
    occupationPagination.page = 0
    occupationPagination.totalPages = 0
  }

  const nextPage = reset ? 1 : occupationPagination.page + 1
  await fetchOccupations(nextPage, occupationSearchTerm.value, { reset })
}

let occupationSearchTimeout: ReturnType<typeof setTimeout> | null = null

const handleOccupationSearch = (value: string) => {
  occupationSearchTerm.value = value
  if (occupationSearchTimeout) {
    clearTimeout(occupationSearchTimeout)
  }

  occupationSearchTimeout = setTimeout(() => {
    void loadOccupations({ reset: true })
  }, 200)
}

const handleOccupationLoadMore = () => {
  if (!occupationHasMore.value) {
    return
  }

  void loadOccupations({ reset: false })
}

const handleOccupationOpenChange = (isOpen: boolean) => {
  if (!isOpen || occupationOptions.value.length > 0) {
    return
  }

  occupationSearchTerm.value = ''
  void loadOccupations({ reset: true })
}

const cityOptions = ref<ComboboxOption[]>([])
const loadingCities = ref(false)

const ensureOptionPresent = (target: Ref<ComboboxOption[]>, option: ComboboxOption | null) => {
  if (!option) {
    return
  }

  if (!target.value.some((existing) => existing.value === option.value)) {
    target.value = [...target.value, option]
  }
}

const loadCities = async () => {
  loadingCities.value = true
  try {
    const { cities } = await getCities({ limit: FETCH_LIMIT })
    const options = cities.map((city) => ({
      value: city.id,
      label: city.name,
    }))
    cityOptions.value = options
    editForm.cityId = ensureOptionRetained(options, editForm.cityId)
  } catch (error) {
    toast.error('Unable to load cities.')
    console.error(error)
  } finally {
    loadingCities.value = false
  }
}

const wardOptions = ref<ComboboxOption[]>([])
const loadingWards = ref(false)

const loadWards = async (cityId: number, presetWardId: number | null = null) => {
  loadingWards.value = true
  try {
    const { provinces } = await getProvinces({ cityId, limit: FETCH_LIMIT })
    const options = provinces.map((province) => ({
      value: province.id,
      label: province.name,
    }))
    wardOptions.value = options

    if (presetWardId !== null) {
      editForm.wardId = ensureOptionRetained(options, presetWardId)
    } else {
      editForm.wardId = ensureOptionRetained(options, editForm.wardId)
    }
  } catch (error) {
    toast.error('Unable to load wards.')
    console.error(error)
  } finally {
    loadingWards.value = false
  }
}

const clearEditFormErrors = () => {
  editFormErrors.value = []
}

const setEditFormError = (message: string, focusId?: string) => {
  editFormErrors.value = [message]
  if (focusId) {
    focusField(focusId)
  }
}

const resetEditForm = () => {
  editForm.code = null
  editForm.fullName = ''
  editForm.gender = undefined
  editForm.occupationId = null
  editForm.cityId = null
  editForm.wardId = null
  editForm.phone = ''
  editForm.relativeName = ''
  editForm.relativePhone = ''
  editBirthDateRaw.value = undefined
  wardOptions.value = []
  clearEditFormErrors()
}

const extractDatePortion = (value: string): string | null => {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? (match[1] ?? null) : null
}

const parsePatientBirthDate = (value: string | null | undefined): DateValue | undefined => {
  if (!value) {
    return undefined
  }

  const datePortion = extractDatePortion(value)
  if (!datePortion) {
    return undefined
  }

  try {
    return parseDate(datePortion)
  } catch {
    return undefined
  }
}

const formatDateValueForApi = (value: DateValue): string => {
  if (
    value &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof (value as { toString: () => string }).toString === 'function'
  ) {
    return (value as { toString: () => string }).toString()
  }

  const date =
    value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
      ? value.toDate(timeZone)
      : null
  if (!date) {
    throw new Error('Invalid date value provided.')
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const populateEditForm = async (patient: PatientSummary) => {
  isInitializingEditForm.value = true

  editForm.code = patient.code
  editForm.fullName = patient.fullName
  editForm.gender = patient.gender === 1 ? 'male' : patient.gender === 0 ? 'female' : undefined
  editForm.occupationId = patient.occupation?.id ?? null
  editForm.cityId = patient.ward?.city?.id ?? null
  editForm.phone = patient.phone ?? ''
  editForm.relativeName = patient.relativeName ?? ''
  editForm.relativePhone = patient.relativePhone ?? ''
  editBirthDateRaw.value = parsePatientBirthDate(patient.birthDate)

  const occupationOption = patient.occupation
    ? { value: patient.occupation.id, label: patient.occupation.name }
    : null
  const cityOption = patient.ward?.city
    ? { value: patient.ward.city.id, label: patient.ward.city.name }
    : null
  const wardOption = patient.ward ? { value: patient.ward.id, label: patient.ward.name } : null

  ensureOptionPresent(occupationOptions, occupationOption)
  ensureOptionPresent(cityOptions, cityOption)
  ensureOptionPresent(wardOptions, wardOption)

  const wardId = patient.ward?.id ?? null
  const cityId = patient.ward?.city?.id ?? null

  if (cityId) {
    await loadWards(cityId, wardId)
  } else {
    wardOptions.value = []
    editForm.wardId = null
  }

  isInitializingEditForm.value = false
}

const openEditDialog = async (record: MedicalRecordSummary) => {
  if (medicalRecordsLoading.value || isEditSubmitting.value || isLoadingPatientDetails.value) {
    return
  }

  resetEditForm()
  editingRecord.value = record
  editDialogOpen.value = true
  isLoadingPatientDetails.value = true
  clearEditFormErrors()

  try {
    if (occupationOptions.value.length === 0) {
      await loadOccupations({ reset: true })
    }

    if (cityOptions.value.length === 0) {
      await loadCities()
    }

    const patient = await getPatient(record.patient.id)
    await populateEditForm(patient)
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load patient information. Please try again.'
    editFormErrors.value = [message]
  } finally {
    isLoadingPatientDetails.value = false
    isInitializingEditForm.value = false
  }
}

const handleEditDialogOpenChange = (open: boolean) => {
  if (isEditSubmitting.value || isLoadingPatientDetails.value) {
    editDialogOpen.value = true
    return
  }

  editDialogOpen.value = open
  if (!open) {
    editingRecord.value = null
    resetEditForm()
  }
}

const editActionDisabled = computed(
  () => medicalRecordsLoading.value || isLoadingPatientDetails.value || isEditSubmitting.value,
)

const handleEditBirthDateUpdate = (value: DateValue | undefined) => {
  editBirthDateModel.value = value
}

const handleEditFormUpdate = (value: AdministrativePatientFormState) => {
  Object.assign(editForm, value)
}

const handleEditCancel = () => {
  if (isEditSubmitting.value) {
    return
  }

  editDialogOpen.value = false
}

const handleEditSave = async () => {
  if (isEditSubmitting.value || isLoadingPatientDetails.value) {
    return
  }

  clearEditFormErrors()

  const record = editingRecord.value
  if (!record) {
    toast.error('Unable to determine which patient to update.')
    return
  }

  const patientId = record.patient.id
  const trimmedName = editForm.fullName.trim()

  if (!trimmedName) {
    setEditFormError('Please enter the patient full name.', 'admin-patient-name')
    return
  }

  const birthDateValue = editBirthDateModel.value
  const birthDate = resolveDateValue(birthDateValue)
  if (!birthDateValue || !birthDate) {
    setEditFormError('Please select a date of birth.', 'admin-patient-birthdate')
    return
  }

  if (!editForm.gender) {
    setEditFormError('Please select a gender.', 'admin-patient-gender')
    return
  }

  if (!editForm.occupationId) {
    setEditFormError('Please select an occupation.', 'admin-patient-occupation')
    return
  }

  if (!editForm.cityId) {
    setEditFormError('Please select a city or province.', 'admin-patient-city')
    return
  }

  if (!editForm.wardId) {
    setEditFormError('Please select a ward.', 'admin-patient-ward')
    return
  }

  const phone = editForm.phone.trim()
  const relativeName = editForm.relativeName.trim()
  const relativePhone = editForm.relativePhone.trim()

  const payload: UpdatePatientPayload = {
    hoTen: trimmedName,
    ngaySinh: formatDateValueForApi(birthDateValue),
    gioiTinh: genderValueMap[editForm.gender],
    ngheNghiepId: editForm.occupationId,
    xaPhuongId: editForm.wardId,
  }

  if (phone) {
    payload.sdt = phone
  }
  if (relativeName) {
    payload.hoTenNguoiNha = relativeName
  }
  if (relativePhone) {
    payload.sdtNguoiNha = relativePhone
  }

  isEditSubmitting.value = true
  try {
    await updatePatient(patientId, payload)
    toast.success('Patient information updated successfully.')
    editDialogOpen.value = false
    await loadMedicalRecords()
  } catch (error) {
    const message =
      error instanceof ApiError
        ? (extractValidationMessage(error.details) ?? error.message)
        : 'Unable to save patient information. Please try again.'
    setEditFormError(message)
  } finally {
    isEditSubmitting.value = false
  }
}

const handleRecordsFromUpdate = (value: DateValue | undefined) => {
  recordsFromModel.value = value
}

const handleRecordsToUpdate = (value: DateValue | undefined) => {
  recordsToModel.value = value
}

const editDialogDescription = computed(() => {
  const record = editingRecord.value
  if (!record) {
    return 'Update patient administrative information.'
  }

  return `Edit administrative information for ${record.patient.fullName}.`
})

watch(
  () => editForm.cityId,
  (cityId) => {
    if (isInitializingEditForm.value) {
      return
    }

    editForm.wardId = null
    wardOptions.value = []

    if (cityId) {
      void loadWards(cityId)
    }
  },
)

onMounted(async () => {
  await loadRooms()
  await handleFiltersReset()
})

onBeforeUnmount(() => {
  if (occupationSearchTimeout) {
    clearTimeout(occupationSearchTimeout)
    occupationSearchTimeout = null
  }
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-7xl px-4">
      <Card>
        <CardHeader class="space-y-2">
          <CardTitle>Administrative Information</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <AdministrativeFilters
            :patient-code="recordFilters.patientCode"
            :patient-name="recordFilters.patientName"
            :status="recordFilters.status"
            :room-id="recordFilters.roomId"
            :status-options="medicalRecordStatusOptions"
            :room-options="roomOptions"
            :loading-rooms="loadingRooms"
            :records-page-size="recordsPageSize"
            :page-size-options="MEDICAL_RECORD_PAGE_SIZE_OPTIONS"
            :is-loading="medicalRecordsLoading"
            :from-date="recordsFromModel"
            :to-date="recordsToModel"
            :from-label="recordsFromLabel"
            :to-label="recordsToLabel"
            :has-from-date="recordsHasFromDate"
            :has-to-date="recordsHasToDate"
            @update:patient-code="recordFilters.patientCode = $event"
            @update:patient-name="recordFilters.patientName = $event"
            @update:status="recordFilters.status = $event"
            @update:room-id="recordFilters.roomId = $event"
            @update:from="handleRecordsFromUpdate"
            @update:to="handleRecordsToUpdate"
            @update:page-size="handleRecordsPageSizeChange"
            @search="handleFiltersSearch"
            @reset="handleFiltersReset"
          />

          <AdministrativeTable
            :filtered-records="filteredMedicalRecords"
            :is-loading="medicalRecordsLoading"
            :pagination="medicalRecordsPagination"
            :current-page="recordsPage"
            :action-disabled="editActionDisabled"
            :records-summary="recordsSummary"
            :format-date="formatDate"
            :format-date-time="formatDateTime"
            :get-gender-label="getGenderLabel"
            :get-status-label="getStatusLabel"
            :get-status-class="getStatusClass"
            @page-change="handleRecordsPageChange"
            @edit="openEditDialog"
          />
        </CardContent>
      </Card>
    </div>

    <Dialog :open="editDialogOpen" @update:open="handleEditDialogOpenChange">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Administrative Information</DialogTitle>
          <DialogDescription>
            {{ editDialogDescription }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="!editingRecord" class="py-6 text-sm text-muted-foreground">
          No patient available for editing.
        </div>
        <div v-else>
          <div v-if="isLoadingPatientDetails" class="py-6 text-sm text-muted-foreground">
            Loading patient information...
          </div>
          <AdministrativePatientForm
            v-else
            :form="editForm"
            :form-errors="editFormErrors"
            :birth-date="editBirthDateModel"
            :max-birth-date="maxBirthDate"
            :has-birth-date="editHasBirthDate"
            :birth-date-label="editBirthDateLabel"
            :age-display="editAgeDisplay"
            :gender-options="genderOptions"
            :occupation-options="occupationOptions"
            :city-options="cityOptions"
            :ward-options="wardOptions"
            :loading-occupations="loadingOccupations"
            :loading-more-occupations="loadingMoreOccupations"
            :occupation-has-more="occupationHasMore"
            :loading-cities="loadingCities"
            :loading-wards="loadingWards"
            :is-submitting="isEditSubmitting"
            @update:form="handleEditFormUpdate"
            @update:birth-date="handleEditBirthDateUpdate"
            @occupation-search="handleOccupationSearch"
            @occupation-load-more="handleOccupationLoadMore"
            @occupation-open-change="handleOccupationOpenChange"
            @cancel="handleEditCancel"
            @save="handleEditSave"
          />
        </div>
      </DialogContent>
    </Dialog>
  </section>
</template>
