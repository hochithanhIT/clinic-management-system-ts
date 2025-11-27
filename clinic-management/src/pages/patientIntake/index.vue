<script setup lang="ts">
definePage({
  alias: '/patient-intake/',
  meta: {
    requiresAuth: true,
  },
})

import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'
import { AlertCircle, CalendarIcon, SearchIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import BaseCombobox from '@/components/UtilsComboBox.vue'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

import { ApiError } from '@/services/http'
import { getOccupations } from '@/services/occupation'
import { getCities, getProvinces } from '@/services/location'
import { getRooms } from '@/services/room'
import { createPatient } from '@/services/patient'
import { createMedicalRecord, getMedicalRecords } from '@/services/medicalRecord'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import type { PaginationMeta } from '@/services/types'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

type ComboboxOption = {
  value: number
  label: string
}

type GenderValue = 'male' | 'female'

interface PatientFormState {
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

const medicalRecordStatusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: '0', label: 'Chờ khám' },
  { value: '1', label: 'Đang khám' },
  { value: '2', label: 'Kết thúc khám' },
] as const

const medicalRecordStatusLabelMap: Record<number, string> = {
  0: 'Chờ khám',
  1: 'Đang khám',
  2: 'Kết thúc khám',
}

const medicalRecordStatusClassMap: Record<number, string> = {
  0: 'bg-amber-100 text-amber-800',
  1: 'bg-sky-100 text-sky-800',
  2: 'bg-emerald-100 text-emerald-800',
}

type MedicalRecordStatusFilterValue = (typeof medicalRecordStatusOptions)[number]['value']

const medicalRecords = ref<MedicalRecordSummary[]>([])
const medicalRecordsLoading = ref(false)
const medicalRecordsPagination = ref<PaginationMeta | null>(null)
const recordsPage = ref(1)
const recordsPageSize = ref(DEFAULT_MEDICAL_RECORD_PAGE_SIZE)

const recordFilters = reactive({
  status: 'all' as MedicalRecordStatusFilterValue,
  roomId: null as number | null,
})

const recordErrors = ref<string[]>([])

const appliedRecordFilters = ref<{
  status: MedicalRecordStatusFilterValue
  roomId: number | null
  from: Date | null
  to: Date | null
}>({
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

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const recordsFromLabel = computed(() => {
  const value = recordsFromRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Chọn ngày'
  }

  return dateFormatter.format(value.toDate(timeZone))
})

const recordsToLabel = computed(() => {
  const value = recordsToRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Chọn ngày'
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
  return medicalRecordStatusLabelMap[status] ?? 'Không xác định'
}

const getStatusClass = (status: number): string => {
  return medicalRecordStatusClassMap[status] ?? 'bg-muted text-muted-foreground'
}

const getGenderLabel = (value: number): string => {
  if (value === 1) {
    return 'Nam'
  }

  if (value === 0) {
    return 'Nữ'
  }

  return 'Khác'
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
  const { status, roomId, from, to } = appliedRecordFilters.value

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

    if (roomId !== null) {
      return record.clinicRoom?.id === roomId
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

const recordsFromPopoverOpen = ref(false)
const recordsToPopoverOpen = ref(false)

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
    const { medicalRecords: records, pagination } = await getMedicalRecords({
      page: recordsPage.value,
      limit: recordsPageSize.value,
      status: statusFilter,
      roomId: appliedRecordFilters.value.roomId ?? undefined,
      enteredFrom: appliedRecordFilters.value.from ?? undefined,
      enteredTo: appliedRecordFilters.value.to ?? undefined,
    })
    medicalRecords.value = records
    medicalRecordsPagination.value = pagination
    recordsPage.value = pagination.page
    recordsPageSize.value = pagination.limit
  } catch (error) {
    medicalRecords.value = []
    medicalRecordsPagination.value = null
    console.error(error)
    toast.error('Không thể tải danh sách bệnh nhân đã tiếp nhận.')
  } finally {
    medicalRecordsLoading.value = false
  }
}

const handleSearchRecords = async () => {
  clearRecordErrors()

  const fromDate = resolveDateValue(recordsFromRaw.value)
  const toDate = resolveDateValue(recordsToRaw.value)

  if (fromDate && toDate && fromDate > toDate) {
    setRecordError('Ngày bắt đầu không thể sau ngày kết thúc.')
    return
  }

  appliedRecordFilters.value = {
    status: recordFilters.status,
    roomId: recordFilters.roomId,
    from: fromDate ? startOfDay(fromDate) : null,
    to: toDate ? endOfDay(toDate) : null,
  }

  recordsFromPopoverOpen.value = false
  recordsToPopoverOpen.value = false

  recordsPage.value = 1
  await loadMedicalRecords()
}

const handleResetRecordFilters = async () => {
  clearRecordErrors()

  const todayFrom = today(timeZone)
  const todayTo = today(timeZone)
  const baseDate = todayFrom.toDate(timeZone)

  recordFilters.status = 'all'
  recordFilters.roomId = null
  recordsFromRaw.value = todayFrom
  recordsToRaw.value = todayTo
  appliedRecordFilters.value = {
    status: 'all',
    roomId: null,
    from: startOfDay(baseDate),
    to: endOfDay(baseDate),
  }

  recordsFromPopoverOpen.value = false
  recordsToPopoverOpen.value = false

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

const handleRecordsPageSizeChange = async (value: string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed === recordsPageSize.value) {
    return
  }

  recordsPageSize.value = parsed
  recordsPage.value = 1
  await loadMedicalRecords()
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
              <Alert v-if="formErrors.length" variant="destructive" class="mb-6">
                <AlertCircle class="mr-2 h-5 w-5" />
                <AlertTitle>Failed to save patient</AlertTitle>
                <AlertDescription>
                  <ul class="list-disc space-y-1 pl-5">
                    <li v-for="message in formErrors" :key="message">
                      {{ message }}
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <form class="grid gap-6">
                <FieldGroup class="grid gap-6 md:grid-cols-2">
                  <Field>
                    <FieldLabel for="patient-code">Patient ID</FieldLabel>
                    <Input id="patient-code" :model-value="form.code ?? 'Patient ID'" disabled />
                  </Field>

                  <Field>
                    <FieldLabel for="patient-name">
                      Full Name <span class="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="patient-name"
                      v-model="form.fullName"
                      type="text"
                      autocomplete="name"
                      placeholder="Enter patient full name"
                    />
                  </Field>

                  <Field>
                    <FieldLabel> Birth Date <span class="text-destructive">*</span> </FieldLabel>
                    <Popover>
                      <PopoverTrigger as-child>
                        <Button
                          id="patient-birthdate"
                          variant="outline"
                          class="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon class="mr-2 h-4 w-4" />
                          <span :class="!hasBirthDate ? 'text-muted-foreground' : ''">
                            {{ birthDateLabel }}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-auto p-0" align="start">
                        <Calendar
                          v-model="birthDateModel"
                          :max-value="maxBirthDate"
                          layout="month-and-year"
                          initial-focus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>

                  <Field>
                    <FieldLabel for="patient-age">Age</FieldLabel>
                    <Input id="patient-age" :model-value="ageDisplay" readonly disabled />
                  </Field>

                  <Field>
                    <FieldLabel> Gender <span class="text-destructive">*</span> </FieldLabel>
                    <Select v-model="form.gender">
                      <SelectTrigger id="patient-gender" class="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="option in genderOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel> Occupation <span class="text-destructive">*</span> </FieldLabel>
                    <BaseCombobox
                      v-model="form.occupationId"
                      :options="occupationOptions"
                      id="patient-occupation"
                      placeholder="Select occupation"
                      search-placeholder="Search occupation..."
                      :loading="loadingOccupations"
                      :loading-more="loadingMoreOccupations"
                      :has-more="occupationHasMore"
                      @search="handleOccupationSearch"
                      @load-more="handleOccupationLoadMore"
                      @open-change="handleOccupationOpenChange"
                    />
                  </Field>

                  <Field>
                    <FieldLabel> City/Province <span class="text-destructive">*</span> </FieldLabel>
                    <BaseCombobox
                      v-model="form.cityId"
                      :options="cityOptions"
                      id="patient-city"
                      placeholder="Select city/province"
                      search-placeholder="Search city/province..."
                      :loading="loadingCities"
                    />
                  </Field>

                  <Field>
                    <FieldLabel> Ward/Commune <span class="text-destructive">*</span> </FieldLabel>
                    <BaseCombobox
                      v-model="form.wardId"
                      :options="wardOptions"
                      id="patient-ward"
                      placeholder="Select ward/commune"
                      search-placeholder="Search ward/commune..."
                      :loading="loadingWards"
                      :disabled="!form.cityId || loadingCities"
                    />
                  </Field>

                  <Field>
                    <FieldLabel for="patient-phone">Phone Number</FieldLabel>
                    <Input
                      id="patient-phone"
                      v-model="form.phone"
                      type="tel"
                      autocomplete="tel"
                      placeholder="Enter contact phone number"
                    />
                  </Field>

                  <Field>
                    <FieldLabel for="relative-name">Relative Name</FieldLabel>
                    <Input
                      id="relative-name"
                      v-model="form.relativeName"
                      type="text"
                      placeholder="Enter relative name"
                    />
                  </Field>

                  <Field>
                    <FieldLabel for="relative-phone">Relative Phone Number</FieldLabel>
                    <Input
                      id="relative-phone"
                      v-model="form.relativePhone"
                      type="tel"
                      autocomplete="tel"
                      placeholder="Enter relative phone number"
                    />
                  </Field>

                  <Field class="md:col-span-2">
                    <FieldLabel for="reason">
                      Admission Reason <span class="text-destructive">*</span>
                    </FieldLabel>
                    <Textarea
                      id="reason"
                      v-model="form.reason"
                      placeholder="Enter admission reason"
                      rows="3"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Clinic Room</FieldLabel>
                    <BaseCombobox
                      v-model="form.roomId"
                      :options="roomOptions"
                      placeholder="Select clinic room"
                      search-placeholder="Search clinic room..."
                      :loading="loadingRooms"
                    />
                  </Field>
                </FieldGroup>

                <div class="flex flex-wrap justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    class="cursor-pointer hover:text-primary-foreground"
                    :disabled="isSubmitting"
                    @click="handleNewEntry"
                    >New Entry</Button
                  >
                  <Button
                    type="button"
                    class="cursor-pointer"
                    :disabled="isSubmitting"
                    @click="handleSave"
                    >Save</Button
                  >
                </div>
              </form>
            </TabsContent>

            <TabsContent value="history" class="mt-6">
              <div class="space-y-6">
                <Alert v-if="recordErrors.length" variant="destructive" class="mb-2">
                  <AlertCircle class="mr-2 h-5 w-5" />
                  <AlertTitle>Không thể áp dụng bộ lọc</AlertTitle>
                  <AlertDescription>
                    <ul class="list-disc space-y-1 pl-5">
                      <li v-for="message in recordErrors" :key="`record-error-${message}`">
                        {{ message }}
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div
                  class="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
                >
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select v-model="recordFilters.status">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="option in medicalRecordStatusOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Clinic Room</FieldLabel>
                    <BaseCombobox
                      v-model="recordFilters.roomId"
                      :options="roomOptions"
                      placeholder="Select clinic room"
                      search-placeholder="Search clinic room..."
                      :loading="loadingRooms"
                      :allow-clear="true"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>From Date</FieldLabel>
                    <Popover v-model:open="recordsFromPopoverOpen">
                      <PopoverTrigger as-child>
                        <Button
                          variant="outline"
                          class="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon class="mr-2 h-4 w-4" />
                          <span :class="!recordsHasFromDate ? 'text-muted-foreground' : ''">
                            {{ recordsFromLabel }}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-auto p-0" align="start">
                        <Calendar
                          v-model="recordsFromModel"
                          :max-value="recordsToModel"
                          layout="month-and-year"
                          initial-focus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>

                  <Field>
                    <FieldLabel>To Date</FieldLabel>
                    <Popover v-model:open="recordsToPopoverOpen">
                      <PopoverTrigger as-child>
                        <Button
                          variant="outline"
                          class="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon class="mr-2 h-4 w-4" />
                          <span :class="!recordsHasToDate ? 'text-muted-foreground' : ''">
                            {{ recordsToLabel }}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-auto p-0" align="start">
                        <Calendar
                          v-model="recordsToModel"
                          :min-value="recordsFromModel"
                          layout="month-and-year"
                          initial-focus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>

                  <Field>
                    <FieldLabel>Records per page</FieldLabel>
                    <Select
                      :model-value="String(recordsPageSize)"
                      @update:model-value="handleRecordsPageSizeChange"
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select page size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="option in MEDICAL_RECORD_PAGE_SIZE_OPTIONS"
                          :key="option"
                          :value="String(option)"
                        >
                          {{ option }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <div class="flex flex-wrap items-end gap-3">
                    <Button
                      type="button"
                      class="flex items-center"
                      :disabled="medicalRecordsLoading"
                      @click="handleSearchRecords"
                    >
                      <SearchIcon class="mr-2 h-4 w-4" />
                      Search
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      :disabled="medicalRecordsLoading"
                      @click="handleResetRecordFilters"
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                <div class="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead class="w-36">Medical Record</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead class="min-w-40">Details</TableHead>
                        <TableHead class="w-40">Clinic Room</TableHead>
                        <TableHead class="w-44">Receiver</TableHead>
                        <TableHead class="w-48">Received At</TableHead>
                        <TableHead class="w-36">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <template v-if="medicalRecordsLoading">
                        <TableEmpty :colspan="7">Loading records...</TableEmpty>
                      </template>
                      <template v-else-if="filteredMedicalRecords.length === 0">
                        <TableEmpty :colspan="7"
                          >No patients found for the selected filters.</TableEmpty
                        >
                      </template>
                      <template v-else>
                        <TableRow v-for="record in filteredMedicalRecords" :key="record.id">
                          <TableCell class="font-medium">
                            <div class="flex flex-col">
                              <span>{{ record.code }}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div class="flex flex-col gap-1">
                              <span class="font-medium">{{ record.patient.fullName }}</span>
                              <span class="text-xs text-muted-foreground">
                                ID: {{ record.patient.code }}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div class="flex flex-col gap-1 text-sm">
                              <span>{{ getGenderLabel(record.patient.gender) }}</span>
                              <span>Birth: {{ formatDate(record.patient.birthDate) }}</span>
                              <span>Phone: {{ record.patient.phone ?? '—' }}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div class="flex flex-col text-sm">
                              <span class="font-medium">{{ record.clinicRoom?.name ?? '—' }}</span>
                              <span
                                v-if="record.clinicRoom?.department"
                                class="text-xs text-muted-foreground"
                              >
                                {{ record.clinicRoom.department?.name }}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div class="flex flex-col text-sm">
                              <span>{{ record.receiver?.name ?? '—' }}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div class="flex flex-col text-sm">
                              <span>{{ formatDateTime(record.enteredAt) }}</span>
                              <span v-if="record.completedAt" class="text-xs text-muted-foreground">
                                Completed: {{ formatDateTime(record.completedAt) }}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                              :class="getStatusClass(record.status)"
                            >
                              {{ getStatusLabel(record.status) }}
                            </span>
                          </TableCell>
                        </TableRow>
                      </template>
                    </TableBody>
                  </Table>
                </div>

                <Pagination
                  v-if="medicalRecordsPagination && medicalRecordsPagination.total > 0"
                  :page="recordsPage"
                  :items-per-page="medicalRecordsPagination.limit"
                  :total="medicalRecordsPagination.total"
                  @update:page="handleRecordsPageChange"
                >
                  <PaginationContent v-slot="{ items }">
                    <PaginationPrevious />
                    <template
                      v-for="(item, index) in items"
                      :key="item.type === 'page' ? `page-${item.value}` : `ellipsis-${index}`"
                    >
                      <PaginationItem
                        v-if="item.type === 'page'"
                        :value="item.value"
                        :is-active="item.value === recordsPage"
                      >
                        {{ item.value }}
                      </PaginationItem>
                      <PaginationEllipsis v-else />
                    </template>
                    <PaginationNext />
                  </PaginationContent>
                </Pagination>

                <p v-if="recordsSummary" class="text-sm text-muted-foreground">
                  {{ recordsSummary }}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
