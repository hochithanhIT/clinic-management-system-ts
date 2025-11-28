<script setup lang="ts">
definePage({
  alias: '/patient-intake/',
  meta: {
    requiresAuth: true,
  },
})

import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'
import { AlertCircle } from 'lucide-vue-next'
import type { AcceptableValue } from 'reka-ui'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PatientIntakeForm from '../../components/patientIntake/PatientIntakeForm.vue'
import MedicalRecordsFilters from '../../components/patientIntake/MedicalRecordsFilters.vue'
import MedicalRecordsTable from '../../components/patientIntake/MedicalRecordsTable.vue'
import DeletePatientDialog from '../../components/patientIntake/DeletePatientDialog.vue'
import type {
  ComboboxOption,
  GenderValue,
  MedicalRecordStatusFilterValue,
  MedicalRecordStatusOption,
  PatientFormState,
} from '../../components/patientIntake/types'

import { ApiError } from '@/services/http'
import { getOccupations } from '@/services/occupation'
import { getCities, getProvinces } from '@/services/location'
import { getRooms } from '@/services/room'
import { createPatient, deletePatient } from '@/services/patient'
import { createMedicalRecord, getMedicalRecords } from '@/services/medicalRecord'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import type { PaginationMeta } from '@/services/types'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

const activeTab = ref('intake')

const timeZone = getLocalTimeZone()
const maxBirthDate = today(timeZone)

const form = reactive<PatientFormState>({
  code: null,
  fullName: '',
  gender: undefined,
  occupationId: null,
  cityId: null,
  wardId: null,
  phone: '',
  relativeName: '',
  relativePhone: '',
  reason: '',
  roomId: null,
})

const formErrors = ref<string[]>([])

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

const birthDateRaw = ref<unknown>(undefined)

const birthDateModel = computed<DateValue | undefined>({
  get: () => birthDateRaw.value as DateValue | undefined,
  set: (value: DateValue | undefined) => {
    birthDateRaw.value = value
  },
})

const genderOptions: Array<{ value: GenderValue; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const occupationOptions = ref<ComboboxOption[]>([])
const cityOptions = ref<ComboboxOption[]>([])
const wardOptions = ref<ComboboxOption[]>([])
const roomOptions = ref<ComboboxOption[]>([])

const occupationPagination = reactive({ page: 0, totalPages: 0 })
const occupationSearchTerm = ref('')
const loadingOccupations = ref(false)
const loadingMoreOccupations = ref(false)
const loadingCities = ref(false)
const loadingWards = ref(false)
const loadingRooms = ref(false)
const isSubmitting = ref(false)
const deletingPatientId = ref<number | null>(null)
const deleteDialogOpen = ref(false)
const pendingDeleteRecord = ref<MedicalRecordSummary | null>(null)
const isDeletingPatient = computed(() => deletingPatientId.value !== null)
const pendingDeletePatientName = computed(() => pendingDeleteRecord.value?.patient.fullName ?? '')
const pendingDeletePatientCode = computed(() => pendingDeleteRecord.value?.patient.code ?? '')
const pendingDeletePatientDisplay = computed(() => {
  const name = pendingDeletePatientName.value
  const code = pendingDeletePatientCode.value

  if (!name) {
    return ''
  }

  return code ? `${name} (Code: ${code})` : name
})

let occupationRequestCounter = 0

const hasBirthDate = computed(() => Boolean(birthDateRaw.value))

const birthDateLabel = computed(() => {
  const value = birthDateRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Select birth date'
  }

  const date = value.toDate(timeZone)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
})

const ageDisplay = computed(() => {
  const value = birthDateRaw.value as DateValue | undefined
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

const handleLoadError = (message: string) => {
  toast.error(message)
}

const FETCH_LIMIT = 100
const OCCUPATION_PAGE_SIZE = 40

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const { room: storedRoom } = storeToRefs(workspaceStore)

const genderValueMap: Record<GenderValue, number> = {
  male: 1,
  female: 0,
}

const DEFAULT_MEDICAL_RECORD_PAGE_SIZE = 20
const MEDICAL_RECORD_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

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

const recordErrors = ref<string[]>([])

const appliedRecordFilters = ref<{
  patientCode: string
  patientName: string
  status: MedicalRecordStatusFilterValue
  roomId: number | null
  from: Date | null
  to: Date | null
}>({
  patientCode: '',
  patientName: '',
  status: 'all',
  roomId: null,
  from: null,
  to: null,
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

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

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

const getStatusLabel = (status: number): string => {
  return medicalRecordStatusLabelMap[status] ?? 'Unknown'
}

const getStatusClass = (status: number): string => {
  return medicalRecordStatusClassMap[status] ?? 'bg-muted text-muted-foreground'
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

const filteredMedicalRecords = computed(() => {
  const { patientCode, patientName, status, roomId, from, to } = appliedRecordFilters.value
  const codeFilter = patientCode.trim().toLowerCase()
  const nameFilter = patientName.trim().toLowerCase()

  return medicalRecords.value.filter((record) => {
    const recordDate = new Date(record.enteredAt)

    if (!Number.isNaN(recordDate.getTime())) {
      if (from && recordDate < from) {
        return false
      }

      if (to && recordDate > to) {
        return false
      }
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
    return 'No medical records found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const filteredCount = filteredMedicalRecords.value.length

  return `Showing ${filteredCount} of ${pagination.total} records (records ${start}-${end}).`
})

const resolveDateValue = (value: unknown): Date | null => {
  if (!value || typeof value !== 'object' || typeof (value as DateValue).toDate !== 'function') {
    return null
  }

  return (value as DateValue).toDate(timeZone)
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
    recordsPage.value = pagination.page
    recordsPageSize.value = pagination.limit
  } catch (error) {
    medicalRecords.value = []
    medicalRecordsPagination.value = null
    console.error(error)
    toast.error('Unable to load received patients.')
  } finally {
    medicalRecordsLoading.value = false
  }
}

const handleSearchRecords = async () => {
  clearRecordErrors()

  const fromDate = resolveDateValue(recordsFromRaw.value)
  const toDate = resolveDateValue(recordsToRaw.value)

  if (fromDate && toDate && fromDate > toDate) {
    setRecordError('Start date cannot be after end date.')
    return
  }

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

const handleBirthDateUpdate = (value: DateValue | undefined) => {
  birthDateModel.value = value
}

const handleRecordsFromUpdate = (value: DateValue | undefined) => {
  recordsFromModel.value = value
}

const handleRecordsToUpdate = (value: DateValue | undefined) => {
  recordsToModel.value = value
}

const handleResetRecordFilters = async () => {
  clearRecordErrors()

  const todayFrom = today(timeZone)
  const todayTo = today(timeZone)
  const baseDate = todayFrom.toDate(timeZone)

  recordFilters.patientCode = ''
  recordFilters.patientName = ''
  recordFilters.status = 'all'
  recordFilters.roomId = null
  recordsFromRaw.value = todayFrom
  recordsToRaw.value = todayTo
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

const requestDeletePatient = (record: MedicalRecordSummary) => {
  if (isDeletingPatient.value || medicalRecordsLoading.value) {
    return
  }

  pendingDeleteRecord.value = record
  deleteDialogOpen.value = true
}

const confirmDeletePatient = async () => {
  if (!pendingDeleteRecord.value || isDeletingPatient.value) {
    return
  }

  const target = pendingDeleteRecord.value
  deletingPatientId.value = target.patient.id
  let shouldCloseDialog = false
  try {
    await deletePatient(target.patient.id)
    toast.success('Patient deleted successfully.')
    pendingDeleteRecord.value = null
    shouldCloseDialog = true
    await loadMedicalRecords()
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Unable to delete patient, please try again.'
    toast.error(message)
  } finally {
    deletingPatientId.value = null
    if (shouldCloseDialog) {
      deleteDialogOpen.value = false
    }
  }
}

const handleDeleteDialogOpenChange = (open: boolean) => {
  if (isDeletingPatient.value) {
    deleteDialogOpen.value = true
    return
  }

  deleteDialogOpen.value = open
  if (!open) {
    pendingDeleteRecord.value = null
  }
}

const setFormError = (message: string, focusId?: string) => {
  formErrors.value = [message]
  if (focusId) {
    focusField(focusId)
  }
}

const clearFormErrors = () => {
  formErrors.value = []
}

const setRecordError = (message: string) => {
  recordErrors.value = [message]
}

const clearRecordErrors = () => {
  recordErrors.value = []
}

const resetForm = () => {
  activeTab.value = 'intake'
  form.code = null
  form.fullName = ''
  form.gender = undefined
  form.occupationId = null
  form.cityId = null
  form.wardId = null
  form.phone = ''
  form.relativeName = ''
  form.relativePhone = ''
  form.reason = ''
  form.roomId = storedRoom.value?.id ?? null
  birthDateRaw.value = undefined
  clearFormErrors()
}

const handleNewEntry = () => {
  if (isSubmitting.value) {
    return
  }

  resetForm()
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

  form.occupationId = ensureOptionRetained(occupationOptions.value, form.occupationId)
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
    handleLoadError('Unable to load occupations.')
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

onBeforeUnmount(() => {
  if (occupationSearchTimeout) {
    clearTimeout(occupationSearchTimeout)
    occupationSearchTimeout = null
  }
})

const loadCities = async () => {
  loadingCities.value = true
  try {
    const { cities } = await getCities({ limit: FETCH_LIMIT })
    const options = cities.map((city) => ({
      value: city.id,
      label: city.name,
    }))
    cityOptions.value = options
    form.cityId = ensureOptionRetained(options, form.cityId)
  } catch (error) {
    handleLoadError('Unable to load cities.')
    console.error(error)
  } finally {
    loadingCities.value = false
  }
}

const loadWards = async (cityId: number) => {
  loadingWards.value = true
  try {
    const { provinces } = await getProvinces({ cityId, limit: FETCH_LIMIT })
    const options = provinces.map((province) => ({
      value: province.id,
      label: province.name,
    }))
    wardOptions.value = options
    form.wardId = ensureOptionRetained(options, form.wardId)
  } catch (error) {
    handleLoadError('Unable to load wards.')
    console.error(error)
  } finally {
    loadingWards.value = false
  }
}

const loadRooms = async () => {
  loadingRooms.value = true
  try {
    const { rooms } = await getRooms({ limit: FETCH_LIMIT })
    const options = rooms.map((room) => ({
      value: room.id,
      label: `${room.name} · ${room.departmentName}`,
    }))
    roomOptions.value = options

    const storedRoomId = storedRoom.value?.id ?? null
    const preferredRoomId = form.roomId ?? storedRoomId
    const resolvedRoomId = ensureOptionRetained(options, preferredRoomId)
    form.roomId = resolvedRoomId
    recordFilters.roomId = ensureOptionRetained(options, recordFilters.roomId)
    appliedRecordFilters.value.roomId = ensureOptionRetained(
      options,
      appliedRecordFilters.value.roomId,
    )
  } catch (error) {
    handleLoadError('Unable to load clinic rooms.')
    console.error(error)
  } finally {
    loadingRooms.value = false
  }
}

const resolveBirthDate = (): Date | null => {
  const value = birthDateRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return null
  }

  return value.toDate(timeZone)
}

const handleSave = async () => {
  if (isSubmitting.value) {
    return
  }

  clearFormErrors()

  const staffId = authStore.user?.id ?? null
  if (!staffId) {
    setFormError('You need to sign in before performing this action.')
    return
  }

  const trimmedName = form.fullName.trim()
  const trimmedReason = form.reason.trim()
  const birthDate = resolveBirthDate()

  if (!trimmedName) {
    setFormError('Please enter patient full name.', 'patient-name')
    return
  }

  if (!birthDate) {
    setFormError('Please select birth date.', 'patient-birthdate')
    return
  }

  if (!form.gender) {
    setFormError('Please select gender.', 'patient-gender')
    return
  }

  if (!form.occupationId) {
    setFormError('Please select occupation.', 'patient-occupation')
    return
  }

  if (!form.wardId) {
    setFormError('Please select ward/commune.', 'patient-ward')
    return
  }

  if (!trimmedReason) {
    setFormError('Please enter admission reason.', 'reason')
    return
  }

  isSubmitting.value = true

  try {
    const patient = await createPatient({
      hoTen: trimmedName,
      ngaySinh: birthDate.toISOString(),
      gioiTinh: genderValueMap[form.gender],
      ngheNghiepId: form.occupationId,
      xaPhuongId: form.wardId,
      ...(form.phone.trim() ? { sdt: form.phone.trim() } : {}),
      ...(form.relativeName.trim() ? { hoTenNguoiNha: form.relativeName.trim() } : {}),
      ...(form.relativePhone.trim() ? { sdtNguoiNha: form.relativePhone.trim() } : {}),
    })

    const medicalRecord = await createMedicalRecord({
      benhNhanId: patient.id,
      nvTiepNhanId: staffId,
      thoiGianVao: new Date(),
      lyDoKhamBenh: trimmedReason,
      ...(form.roomId !== null ? { phongId: form.roomId } : {}),
    })

    toast.success(
      `Patient saved successfully. Patient code: ${patient.code}, medical record: ${medicalRecord.code}.`,
    )
    recordsPage.value = 1
    await loadMedicalRecords()
    resetForm()
  } catch (error) {
    const message =
      error instanceof ApiError
        ? (extractValidationMessage(error.details) ?? error.message)
        : 'Failed to save patient, please try again.'

    setFormError(message)
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => form.cityId,
  (cityId) => {
    form.wardId = null
    wardOptions.value = []

    if (cityId) {
      void loadWards(cityId)
    }
  },
)

onMounted(() => {
  form.roomId = storedRoom.value?.id ?? null
  const todayFrom = today(timeZone)
  const todayTo = today(timeZone)
  const baseDate = todayFrom.toDate(timeZone)
  recordsFromRaw.value = todayFrom
  recordsToRaw.value = todayTo
  appliedRecordFilters.value = {
    patientCode: '',
    patientName: '',
    status: 'all',
    roomId: null,
    from: startOfDay(baseDate),
    to: endOfDay(baseDate),
  }
  recordsPage.value = 1
  void loadOccupations({ reset: true })
  void loadCities()
  void loadRooms()
  void loadMedicalRecords()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <Card>
        <CardHeader class="space-y-2">
          <CardTitle>Patient Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs v-model="activeTab" class="w-full">
            <TabsList class="grid w-full grid-cols-2 gap-2">
              <TabsTrigger value="intake" class="w-full">Intake</TabsTrigger>
              <TabsTrigger value="history" class="w-full">Received Patients</TabsTrigger>
            </TabsList>

            <TabsContent value="intake" class="mt-6">
              <PatientIntakeForm
                :form="form"
                :form-errors="formErrors"
                :birth-date="birthDateModel"
                :max-birth-date="maxBirthDate"
                :has-birth-date="hasBirthDate"
                :birth-date-label="birthDateLabel"
                :age-display="ageDisplay"
                :gender-options="genderOptions"
                :occupation-options="occupationOptions"
                :city-options="cityOptions"
                :ward-options="wardOptions"
                :room-options="roomOptions"
                :loading-occupations="loadingOccupations"
                :loading-more-occupations="loadingMoreOccupations"
                :occupation-has-more="occupationHasMore"
                :loading-cities="loadingCities"
                :loading-wards="loadingWards"
                :loading-rooms="loadingRooms"
                :is-submitting="isSubmitting"
                @update:birth-date="handleBirthDateUpdate"
                @occupation-search="handleOccupationSearch"
                @occupation-load-more="handleOccupationLoadMore"
                @occupation-open-change="handleOccupationOpenChange"
                @new-entry="handleNewEntry"
                @save="handleSave"
              />
            </TabsContent>

            <TabsContent value="history" class="mt-6">
              <div class="space-y-6">
                <Alert v-if="recordErrors.length" variant="destructive" class="mb-2">
                  <AlertCircle class="mr-2 h-5 w-5" />
                  <AlertTitle>Unable to apply filters</AlertTitle>
                  <AlertDescription>
                    <ul class="list-disc space-y-1 pl-5">
                      <li v-for="message in recordErrors" :key="`record-error-${message}`">
                        {{ message }}
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <MedicalRecordsFilters
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
                  @search="handleSearchRecords"
                  @reset="handleResetRecordFilters"
                />

                <MedicalRecordsTable
                  :filtered-records="filteredMedicalRecords"
                  :is-loading="medicalRecordsLoading"
                  :pagination="medicalRecordsPagination"
                  :current-page="recordsPage"
                  :deleting-patient-id="deletingPatientId"
                  :action-disabled="isDeletingPatient || medicalRecordsLoading"
                  :records-summary="recordsSummary"
                  :format-date="formatDate"
                  :format-date-time="formatDateTime"
                  :get-gender-label="getGenderLabel"
                  :get-status-label="getStatusLabel"
                  :get-status-class="getStatusClass"
                  @page-change="handleRecordsPageChange"
                  @delete="requestDeletePatient"
                />
              </div>
              <DeletePatientDialog
                :open="deleteDialogOpen"
                :patient-display="pendingDeletePatientDisplay"
                :is-deleting="isDeletingPatient"
                :can-confirm="Boolean(pendingDeleteRecord)"
                @update:open="handleDeleteDialogOpenChange"
                @confirm="confirmDeletePatient"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
