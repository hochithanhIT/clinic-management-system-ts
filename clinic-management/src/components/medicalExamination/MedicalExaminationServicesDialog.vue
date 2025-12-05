<script setup lang="ts">
import type { CalendarDate, DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { CalendarIcon, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import ComboBox from '@/components/ComboBox.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Calendar } from '@/components/ui/calendar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import type { PatientSummary } from '@/services/patient'
import type { MedicalExaminationDetail } from '@/services/medicalExamination'
import { ApiError } from '@/services/http'
import {
  getServiceTypes,
  getServices,
  type ServiceExecutionRoomSummary,
  type ServiceSummary,
  type ServiceTypeSummary,
} from '@/services/serviceCatalog'
import { getRooms } from '@/services/room'

export interface MedicalExaminationServicesSavePayload {
  medicalRecordId: number
  orderTime: Date
  serviceOrderId?: number | null
  services: Array<{
    detailId: number | null
    serviceId: number
    quantity: number
    price: number
    executionRoomId: number | null
    requireResult: boolean
  }>
}

interface SelectedServiceEntry {
  detailId: number | null
  serviceId: number
  code: string
  name: string
  unit: string | null
  price: number
  quantity: number
  executionRoomId: number | null
  serviceTypeName: string | null
  requireResult: boolean
  hasResult: boolean
}

interface ServiceGroupBucket {
  groupId: number
  groupName: string
  services: ServiceSummary[]
}

interface ComboOption {
  value: number
  label: string
}

type ServicesDialogMode = 'create' | 'edit'

interface InitialOrderPayload {
  id: number
  createdAt: string
  services: Array<{
    detailId: number
    serviceId: number
    code: string
    name: string
    serviceTypeName: string | null
    price: number
    quantity: number
    executionRoomId: number | null
    requireResult: boolean
    hasResult: boolean
  }>
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
})

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const timeZone = getLocalTimeZone()

const props = defineProps<{
  open: boolean
  saving: boolean
  selectedRecord: MedicalRecordSummary | null
  examinationDetail: MedicalExaminationDetail | null
  patientDetail: PatientSummary | null
  loadingDetails: boolean
  mode: ServicesDialogMode
  initialOrder: InitialOrderPayload | null
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'save', payload: MedicalExaminationServicesSavePayload): void
}>()

const isEditMode = computed(() => props.mode === 'edit' && props.initialOrder !== null)

const dialogTitle = computed(() => (isEditMode.value ? 'Update Service Order' : 'Assign Services'))

const dialogDescription = computed(() =>
  isEditMode.value
    ? 'Review and update the existing service order for the current medical record.'
    : 'Select and configure services before submitting the order for the current medical record.',
)

const saveButtonLabel = computed(() => (isEditMode.value ? 'Update' : 'Save'))

const serviceTypes = ref<ServiceTypeSummary[]>([])
const serviceTypesLoading = ref(false)
const serviceTypesError = ref<string | null>(null)
const activeServiceTypeId = ref<number | null>(null)
const servicesByType = reactive<Record<number, ServiceSummary[]>>({})
const servicesLoading = ref(false)
const servicesError = ref<string | null>(null)
const servicesLoadToken = ref(0)
const selectedServiceIds = ref<number[]>([])
const selectedServices = ref<SelectedServiceEntry[]>([])
const serviceSearchTerm = ref('')
const roomOptions = ref<ComboOption[]>([])
const roomsLoading = ref(false)
const lastDialogScrollTop = ref(0)
const dialogContentRef = ref<HTMLDivElement | null>(null)
const orderDatePopoverOpen = ref(false)
const orderDateValue = ref<CalendarDate | undefined>(undefined)
const orderTimeValue = ref('')

const normalizeServiceTypeName = (value: string | null | undefined): string => {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('vi-VN') : ''
}

const isConsultationServiceType = (value: string | null | undefined): boolean => {
  return normalizeServiceTypeName(value) === 'công khám'
}

const shouldRequireResultForType = (value: string | null | undefined): boolean => {
  return !isConsultationServiceType(value)
}

const processServiceTypes = (types: ServiceTypeSummary[]): ServiceTypeSummary[] => {
  return types.filter((type) => !isConsultationServiceType(type.name))
}

const activeServiceTab = computed({
  get: () => (activeServiceTypeId.value !== null ? String(activeServiceTypeId.value) : ''),
  set: (value: string) => {
    const parsed = Number(value)
    activeServiceTypeId.value = Number.isFinite(parsed) ? parsed : null
  },
})

const hasSelection = computed(() => selectedServiceIds.value.length > 0)
const hasSelectedServices = computed(() => selectedServices.value.length > 0)

const selectedServicesTotal = computed(() => {
  return selectedServices.value.reduce((total, entry) => total + entry.price * entry.quantity, 0)
})

const hasOrderDate = computed(() => Boolean(orderDateValue.value))

const orderDateLabel = computed(() => {
  const value = orderDateValue.value
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  const date = value.toDate(timeZone)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Select date'
  }

  return dateFormatter.format(date)
})

const orderDateValueForCalendar = computed<DateValue | undefined>(() => {
  return orderDateValue.value as unknown as DateValue | undefined
})

const patientName = computed(() => {
  return props.patientDetail?.fullName ?? props.selectedRecord?.patient.fullName ?? '—'
})

const patientBirthDateValue = computed(() => {
  return props.patientDetail?.birthDate ?? props.selectedRecord?.patient.birthDate ?? null
})

const patientBirthDate = computed(() => formatDate(patientBirthDateValue.value))

const patientAge = computed(() => {
  const value = patientBirthDateValue.value
  if (!value) {
    return '—'
  }

  const birthDate = new Date(value)
  if (Number.isNaN(birthDate.getTime())) {
    return '—'
  }

  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age >= 0 ? `${age}` : '—'
})

const patientAddress = computed(() => {
  const wardName = props.patientDetail?.ward?.name ?? props.selectedRecord?.patient.ward?.name ?? ''
  const cityName =
    props.patientDetail?.ward?.city?.name ?? props.selectedRecord?.patient.city?.name ?? ''
  const parts = [wardName, cityName].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
})

const isServiceInSelection = (serviceId: number): boolean => {
  return selectedServices.value.some((entry) => entry.serviceId === serviceId)
}

const isServiceChecked = (serviceId: number): boolean => {
  return selectedServiceIds.value.includes(serviceId) || isServiceInSelection(serviceId)
}

const isServiceCheckboxDisabled = (serviceId: number): boolean => {
  const entry = selectedServices.value.find((service) => service.serviceId === serviceId)
  return entry?.hasResult ?? false
}

const primaryDiagnosisLabel = computed(() => {
  const entry = props.examinationDetail?.diagnoses.find(
    (diagnosis) => diagnosis.isPrimary && diagnosis.disease,
  )

  if (!entry || !entry.disease) {
    return '—'
  }

  return `${entry.disease.code} · ${entry.disease.name}`
})

const secondaryDiagnosesLabels = computed(() => {
  const diagnoses = props.examinationDetail?.diagnoses ?? []
  const secondary = diagnoses.filter((diagnosis) => !diagnosis.isPrimary && diagnosis.disease)
  if (!secondary.length) {
    return []
  }

  return secondary.map((diagnosis) => {
    if (!diagnosis.disease) {
      return ''
    }
    return `${diagnosis.disease.code} · ${diagnosis.disease.name}`
  })
})

const toDateTimeLocalString = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const parseTimeValue = (value: string): { hours: number; minutes: number } | null => {
  if (!value) {
    return null
  }

  const [hoursRaw, minutesRaw] = value.split(':')
  if (hoursRaw === undefined || minutesRaw === undefined) {
    return null
  }

  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return { hours, minutes }
}

const resolveOrderDateTime = (): Date | null => {
  const value = orderDateValue.value
  const time = parseTimeValue(orderTimeValue.value)

  if (!value || !time || typeof value.toDate !== 'function') {
    return null
  }

  const date = value.toDate(timeZone)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null
  }

  const result = new Date(date)
  result.setHours(time.hours, time.minutes, 0, 0)
  return result
}

const setOrderDateTimeFromDate = (value: Date) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    orderDateValue.value = undefined
    orderTimeValue.value = ''
    return
  }

  const iso = toDateTimeLocalString(value)
  const [datePart, timePart] = iso.split('T')

  try {
    orderDateValue.value = datePart ? (parseDate(datePart) as CalendarDate) : undefined
  } catch {
    orderDateValue.value = undefined
  }

  orderTimeValue.value = timePart ?? ''
}

const handleOrderDateUpdate = (value: DateValue | undefined) => {
  if (value && typeof value.toDate === 'function') {
    orderDateValue.value = value as CalendarDate
  } else {
    orderDateValue.value = undefined
  }
  orderDatePopoverOpen.value = false
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

const formatCurrency = (value: number): string => {
  return currencyFormatter.format(value)
}

const ensureServiceTypesLoaded = async () => {
  if (serviceTypes.value.length) {
    const filteredExisting = processServiceTypes(serviceTypes.value)
    serviceTypes.value = filteredExisting

    const firstExistingType = filteredExisting[0] ?? null

    if (!firstExistingType) {
      activeServiceTypeId.value = null
    } else if (
      activeServiceTypeId.value === null ||
      !filteredExisting.some((type) => type.id === activeServiceTypeId.value)
    ) {
      activeServiceTypeId.value = firstExistingType.id
    }

    return
  }

  serviceTypesLoading.value = true
  serviceTypesError.value = null

  try {
    const types = await getServiceTypes()
    const filteredTypes = processServiceTypes(types)
    serviceTypes.value = filteredTypes

    const firstType = filteredTypes[0] ?? null

    if (!firstType) {
      activeServiceTypeId.value = null
    } else {
      activeServiceTypeId.value = firstType.id
    }
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Unable to load service types. Please try again.'
    serviceTypesError.value = message
    toast.error(message)
  } finally {
    serviceTypesLoading.value = false
  }
}

const ensureRoomsLoaded = async () => {
  if (roomOptions.value.length) {
    return
  }

  roomsLoading.value = true

  try {
    const limit = 100
    let page = 1
    let hasMore = true
    const aggregated: ComboOption[] = []

    while (hasMore) {
      const { rooms, pagination } = await getRooms({ page, limit })

      aggregated.push(
        ...rooms.map((room) => ({
          value: room.id,
          label: room.departmentName ? `${room.name} · ${room.departmentName}` : room.name,
        })),
      )

      if (!pagination || page >= pagination.totalPages || rooms.length < limit) {
        hasMore = false
      } else {
        page += 1
      }
    }

    roomOptions.value = aggregated
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Unable to load rooms. Please try again.'
    toast.error(message)
  } finally {
    roomsLoading.value = false
  }
}

const ensureRoomOptionPresent = (room: ServiceExecutionRoomSummary | null) => {
  if (!room) {
    return
  }

  const exists = roomOptions.value.some((option) => option.value === room.id)
  if (exists) {
    return
  }

  const label = room.department ? `${room.name} · ${room.department.name}` : room.name
  roomOptions.value = [...roomOptions.value, { value: room.id, label }]
}

const loadServicesForType = async (typeId: number | null, options: { force?: boolean } = {}) => {
  if (typeId === null) {
    return
  }

  if (!options.force && Array.isArray(servicesByType[typeId])) {
    return
  }

  servicesLoading.value = true
  servicesError.value = null
  servicesLoadToken.value += 1
  const requestId = servicesLoadToken.value

  try {
    const limit = 100
    let page = 1
    let hasMore = true
    const aggregated: ServiceSummary[] = []

    while (hasMore) {
      const { services, pagination } = await getServices({ serviceTypeId: typeId, limit, page })
      aggregated.push(...services)

      if (!pagination || page >= pagination.totalPages || services.length < limit) {
        hasMore = false
      } else {
        page += 1
      }
    }

    if (requestId !== servicesLoadToken.value) {
      return
    }

    servicesByType[typeId] = aggregated

    for (const service of aggregated) {
      ensureRoomOptionPresent(service.executionRoom)
    }
  } catch (error) {
    if (requestId !== servicesLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError ? error.message : 'Unable to load services. Please try again.'
    servicesError.value = message
    toast.error(message)
  } finally {
    if (requestId === servicesLoadToken.value) {
      servicesLoading.value = false
    }
  }
}

const getFilteredServicesForType = (typeId: number): ServiceSummary[] => {
  const services = servicesByType[typeId] ?? []
  const query = serviceSearchTerm.value.trim().toLowerCase()

  if (!query) {
    return services
  }

  return services.filter((service) => {
    return service.code.toLowerCase().includes(query) || service.name.toLowerCase().includes(query)
  })
}

const getGroupedServicesForType = (typeId: number): ServiceGroupBucket[] => {
  const services = getFilteredServicesForType(typeId)

  if (!services.length) {
    return []
  }

  const buckets = new Map<number, ServiceGroupBucket>()

  for (const service of services) {
    const groupId = service.serviceGroup.id
    const groupName = service.serviceGroup.name

    if (!buckets.has(groupId)) {
      buckets.set(groupId, {
        groupId,
        groupName,
        services: [],
      })
    }

    buckets.get(groupId)!.services.push(service)
  }

  return Array.from(buckets.values()).sort((a, b) => a.groupName.localeCompare(b.groupName))
}

const toggleServiceSelection = (serviceId: number) => {
  if (isServiceInSelection(serviceId) || isServiceCheckboxDisabled(serviceId)) {
    return
  }

  if (selectedServiceIds.value.includes(serviceId)) {
    selectedServiceIds.value = selectedServiceIds.value.filter((id) => id !== serviceId)
  } else {
    selectedServiceIds.value = [...selectedServiceIds.value, serviceId]
  }
}

const handleServiceRowClick = (serviceId: number) => {
  if (isServiceInSelection(serviceId) || isServiceCheckboxDisabled(serviceId)) {
    return
  }

  toggleServiceSelection(serviceId)
}

const addSelectedServices = () => {
  const typeId = activeServiceTypeId.value
  if (typeId === null || !selectedServiceIds.value.length) {
    return
  }

  const services = servicesByType[typeId] ?? []
  if (!services.length) {
    return
  }

  const serviceMap = new Map<number, ServiceSummary>(
    services.map((service) => [service.id, service]),
  )
  let addedCount = 0

  for (const serviceId of selectedServiceIds.value) {
    const service = serviceMap.get(serviceId)
    if (!service) {
      continue
    }

    const existing = selectedServices.value.find((entry) => entry.serviceId === serviceId)

    if (existing) {
      existing.quantity = Math.max(existing.quantity + 1, 1)
      existing.requireResult = shouldRequireResultForType(existing.serviceTypeName)
    } else {
      const serviceTypeName = service.serviceGroup?.serviceType?.name ?? null
      const requireResult = shouldRequireResultForType(serviceTypeName)
      selectedServices.value.push({
        detailId: null,
        serviceId: service.id,
        code: service.code,
        name: service.name,
        unit: service.unit,
        price: service.price,
        quantity: 1,
        executionRoomId: service.executionRoom?.id ?? null,
        serviceTypeName,
        requireResult,
        hasResult: false,
      })
      ensureRoomOptionPresent(service.executionRoom)
    }

    addedCount += 1
  }

  selectedServiceIds.value = []

  if (addedCount) {
    toast.success('Services added to the request list.')
  }
}

const removeSelectedService = (index: number) => {
  if (index < 0 || index >= selectedServices.value.length) {
    return
  }

  const entry = selectedServices.value[index]
  if (entry?.hasResult) {
    toast.warning('Services with recorded results cannot be removed.')
    return
  }

  const updated = [...selectedServices.value]
  const [removed] = updated.splice(index, 1)
  selectedServices.value = updated

  if (removed) {
    selectedServiceIds.value = selectedServiceIds.value.filter((id) => id !== removed.serviceId)
  }
}

const handleQuantityChange = (serviceId: number, value: string | number) => {
  const entry = selectedServices.value.find((service) => service.serviceId === serviceId)
  if (!entry) {
    return
  }

  const parsed = Number(value)
  entry.quantity = Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

const handleExecutionRoomChange = (serviceId: number, value: string | number | null) => {
  const entry = selectedServices.value.find((service) => service.serviceId === serviceId)
  if (!entry) {
    return
  }

  if (value === null || value === undefined || value === '') {
    entry.executionRoomId = null
    return
  }

  const parsed = Number(value)
  entry.executionRoomId = Number.isFinite(parsed) ? parsed : null
}

const handleSave = () => {
  if (!props.selectedRecord) {
    toast.error('Please select a patient first.')
    return
  }

  if (!selectedServices.value.length) {
    toast.error('Please add at least one service before saving.')
    return
  }

  const resolvedOrderTime = resolveOrderDateTime()
  if (!resolvedOrderTime) {
    toast.error('Please provide a valid order time.')
    return
  }

  emit('save', {
    medicalRecordId: props.selectedRecord.id,
    orderTime: resolvedOrderTime,
    serviceOrderId: props.initialOrder?.id ?? null,
    services: selectedServices.value.map((service) => {
      const requireResult = shouldRequireResultForType(service.serviceTypeName)
      if (service.requireResult !== requireResult) {
        service.requireResult = requireResult
      }

      return {
        detailId: service.detailId,
        serviceId: service.serviceId,
        quantity: service.quantity,
        price: service.price,
        executionRoomId: service.executionRoomId,
        requireResult,
      }
    }),
  })
}

const resetState = () => {
  selectedServiceIds.value = []
  selectedServices.value = []
  servicesError.value = null
  serviceSearchTerm.value = ''
  lastDialogScrollTop.value = 0
  orderDateValue.value = undefined
  orderTimeValue.value = ''
  orderDatePopoverOpen.value = false

  if (dialogContentRef.value) {
    dialogContentRef.value.scrollTop = 0
  }
}

const initializeDialog = async () => {
  selectedServiceIds.value = []
  selectedServices.value = []
  await ensureServiceTypesLoaded()
  await ensureRoomsLoaded()

  if (isEditMode.value && props.initialOrder) {
    applyInitialOrder(props.initialOrder)
  } else {
    setDefaultOrderTime()
  }

  if (activeServiceTypeId.value !== null) {
    await loadServicesForType(activeServiceTypeId.value)
  }
}

const setDefaultOrderTime = () => {
  orderDatePopoverOpen.value = false
  setOrderDateTimeFromDate(new Date())
}

const applyInitialOrder = (order: InitialOrderPayload) => {
  const createdAt = new Date(order.createdAt)
  if (Number.isNaN(createdAt.getTime())) {
    setDefaultOrderTime()
  } else {
    setOrderDateTimeFromDate(createdAt)
  }

  orderDatePopoverOpen.value = false

  selectedServices.value = order.services.map((service) => {
    const serviceTypeName = service.serviceTypeName ?? null
    const requireResult = shouldRequireResultForType(serviceTypeName)
    return {
      detailId: service.detailId,
      serviceId: service.serviceId,
      code: service.code,
      name: service.name,
      unit: null,
      price: service.price,
      quantity: service.quantity,
      executionRoomId: service.executionRoomId,
      serviceTypeName,
      requireResult,
      hasResult: service.hasResult,
    }
  })
  selectedServiceIds.value = []
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void initializeDialog()
    } else {
      resetState()
    }
  },
)

watch(
  () => props.initialOrder,
  (order) => {
    if (props.open && isEditMode.value && order) {
      applyInitialOrder(order)
    }
  },
)

watch(activeServiceTypeId, async (typeId, previous) => {
  if (typeId === previous) {
    return
  }

  const scrollContainer = dialogContentRef.value
  if (scrollContainer) {
    lastDialogScrollTop.value = scrollContainer.scrollTop
  }

  serviceSearchTerm.value = ''
  selectedServiceIds.value = []
  if (typeId !== null) {
    await loadServicesForType(typeId)
  }

  await nextTick()

  if (typeId !== activeServiceTypeId.value) {
    return
  }

  const updatedContainer = dialogContentRef.value
  if (updatedContainer) {
    const targetScroll = lastDialogScrollTop.value
    updatedContainer.scrollTop = targetScroll
    requestAnimationFrame(() => {
      if (dialogContentRef.value === updatedContainer) {
        updatedContainer.scrollTop = targetScroll
      }
    })
  }
})

watch(
  () => props.selectedRecord?.id ?? null,
  () => {
    selectedServiceIds.value = []
    selectedServices.value = []
    if (props.open) {
      setDefaultOrderTime()
    }
  },
)
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-[95vw] lg:max-w-[90vw]">
      <div ref="dialogContentRef" class="grid gap-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ dialogTitle }}</DialogTitle>
          <DialogDescription>
            {{ dialogDescription }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="!props.selectedRecord" class="py-8 text-sm text-muted-foreground">
          A patient needs to be selected before assigning services.
        </div>

        <div v-else class="space-y-6">
          <div class="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-base">Patient Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1 text-sm">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Full Name</p>
                    <p class="font-semibold text-foreground">{{ patientName }}</p>
                  </div>
                  <div class="space-y-1 text-sm">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Birth Date</p>
                    <p class="text-foreground">{{ patientBirthDate }}</p>
                  </div>
                  <div class="space-y-1 text-sm">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Age</p>
                    <p class="text-foreground">{{ patientAge }}</p>
                  </div>
                  <div class="space-y-1 text-sm">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Address</p>
                    <p class="text-foreground">{{ patientAddress }}</p>
                  </div>
                </div>
                <div
                  v-if="props.loadingDetails"
                  class="mt-4 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
                >
                  <Loader2 class="h-4 w-4 animate-spin" />
                  Loading additional patient details…
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-base">Clinical Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="space-y-3 text-sm">
                  <div>
                    <p class="text-xs font-medium uppercase text-muted-foreground">
                      Primary Disease
                    </p>
                    <p class="text-foreground">{{ primaryDiagnosisLabel }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-medium uppercase text-muted-foreground">
                      Secondary Diseases
                    </p>
                    <template v-if="secondaryDiagnosesLabels.length">
                      <ul class="mt-1 list-disc space-y-1 pl-4 text-foreground">
                        <li v-for="diagnosis in secondaryDiagnosesLabels" :key="diagnosis">
                          {{ diagnosis }}
                        </li>
                      </ul>
                    </template>
                    <p v-else class="text-foreground">—</p>
                  </div>
                  <div>
                    <p class="text-xs font-medium uppercase text-muted-foreground">Order Time</p>
                    <div class="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                      <Popover v-model:open="orderDatePopoverOpen">
                        <PopoverTrigger as-child>
                          <Button
                            variant="outline"
                            class="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon class="mr-2 h-4 w-4" />
                            <span :class="!hasOrderDate ? 'text-muted-foreground' : ''">
                              {{ orderDateLabel }}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-auto p-0" align="start">
                          <Calendar
                            :model-value="orderDateValueForCalendar"
                            layout="month-and-year"
                            initial-focus
                            @update:model-value="handleOrderDateUpdate"
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        v-model="orderTimeValue"
                        type="time"
                        step="60"
                        class="w-full"
                        placeholder="HH:MM"
                        aria-label="Service order time"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card class="min-w-0">
              <CardHeader class="pb-2">
                <CardTitle class="text-base">Available Services</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4 min-w-0">
                <div
                  v-if="serviceTypesLoading"
                  class="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Loader2 class="h-4 w-4 animate-spin" />
                  Loading service categories…
                </div>
                <p v-else-if="serviceTypesError" class="text-sm text-destructive">
                  {{ serviceTypesError }}
                </p>
                <p v-else-if="!serviceTypes.length" class="text-sm text-muted-foreground">
                  No service categories available.
                </p>

                <div v-else class="space-y-4">
                  <Tabs v-model="activeServiceTab">
                    <TabsList class="flex flex-wrap gap-2 w-full">
                      <TabsTrigger
                        v-for="type in serviceTypes"
                        :key="type.id"
                        :value="String(type.id)"
                      >
                        {{ type.name }}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      v-for="type in serviceTypes"
                      :key="`content-${type.id}`"
                      :value="String(type.id)"
                      class="space-y-4"
                    >
                      <Input
                        v-model="serviceSearchTerm"
                        placeholder="Search services by code or name"
                        class="w-full"
                      />

                      <div class="rounded-lg border min-h-[360px]">
                        <div
                          v-if="servicesLoading && activeServiceTypeId === type.id"
                          class="flex items-center gap-2 p-4 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading services…
                        </div>
                        <p
                          v-else-if="servicesError && activeServiceTypeId === type.id"
                          class="p-4 text-sm text-destructive"
                        >
                          {{ servicesError }}
                        </p>
                        <p
                          v-else-if="!getFilteredServicesForType(type.id).length"
                          class="p-4 text-sm text-muted-foreground"
                        >
                          No services match the current filters.
                        </p>
                        <div v-else class="max-h-[360px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="w-14"></TableHead>
                                <TableHead>Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <template
                                v-for="bucket in getGroupedServicesForType(type.id)"
                                :key="bucket.groupId"
                              >
                                <TableRow class="bg-muted/40">
                                  <TableCell colspan="3" class="text-sm font-semibold">
                                    {{ bucket.groupName }}
                                  </TableCell>
                                </TableRow>
                                <TableRow
                                  v-for="service in bucket.services"
                                  :key="service.id"
                                  :class="[
                                    isServiceInSelection(service.id)
                                      ? 'cursor-not-allowed opacity-90'
                                      : 'cursor-pointer hover:bg-muted/60',
                                  ]"
                                  @click="handleServiceRowClick(service.id)"
                                >
                                  <TableCell>
                                    <input
                                      :checked="isServiceChecked(service.id)"
                                      :class="[
                                        'h-4 w-4',
                                        isServiceCheckboxDisabled(service.id)
                                          ? 'cursor-not-allowed'
                                          : 'cursor-pointer',
                                      ]"
                                      type="checkbox"
                                      :disabled="isServiceCheckboxDisabled(service.id)"
                                      @change.stop="toggleServiceSelection(service.id)"
                                    />
                                  </TableCell>
                                  <TableCell class="text-sm font-medium">{{
                                    service.code
                                  }}</TableCell>
                                  <TableCell class="text-sm text-muted-foreground">{{
                                    service.name
                                  }}</TableCell>
                                </TableRow>
                              </template>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>

            <Card class="min-w-0">
              <CardHeader class="pb-2">
                <CardTitle class="text-base">Selected Services</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4 min-w-0">
                <div class="rounded-lg border">
                  <div class="max-h-[360px] min-h-[360px] overflow-y-auto">
                    <template v-if="hasSelectedServices">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service</TableHead>
                            <TableHead class="w-24">Quantity</TableHead>
                            <TableHead class="w-24">Unit Price</TableHead>
                            <TableHead class="w-32">Execution Room</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <ContextMenu
                            v-for="(entry, index) in selectedServices"
                            :key="entry.detailId ?? `${entry.serviceId}-${index}`"
                          >
                            <ContextMenuTrigger as-child>
                              <TableRow>
                                <TableCell>
                                  <div class="flex flex-col text-sm">
                                    <span class="font-semibold text-foreground">{{
                                      entry.code
                                    }}</span>
                                    <span class="text-muted-foreground">{{ entry.name }}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    :model-value="String(entry.quantity)"
                                    type="number"
                                    min="1"
                                    class="w-20"
                                    @update:model-value="
                                      (value) => handleQuantityChange(entry.serviceId, value)
                                    "
                                  />
                                </TableCell>
                                <TableCell class="text-sm font-medium">
                                  {{ formatCurrency(entry.price) }}
                                </TableCell>
                                <TableCell>
                                  <ComboBox
                                    :model-value="entry.executionRoomId"
                                    :options="roomOptions"
                                    placeholder="Select room"
                                    :loading="roomsLoading"
                                    @update:model-value="
                                      (value) => handleExecutionRoomChange(entry.serviceId, value)
                                    "
                                  />
                                </TableCell>
                              </TableRow>
                            </ContextMenuTrigger>
                            <ContextMenuContent class="w-48">
                              <ContextMenuItem
                                v-if="entry.detailId === null || !entry.hasResult"
                                @select="removeSelectedService(index)"
                              >
                                Remove service
                              </ContextMenuItem>
                              <ContextMenuItem v-else disabled>
                                Services with results cannot be removed
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </TableBody>
                      </Table>
                    </template>
                    <div
                      v-else
                      class="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground"
                    >
                      Selected services will appear here. Use the Add button to include items from
                      the left.
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-4 text-sm">
                  <span class="text-muted-foreground">Total estimate:</span>
                  <span class="font-semibold text-foreground">{{
                    formatCurrency(hasSelectedServices ? selectedServicesTotal : 0)
                  }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="emit('update:open', false)"> Cancel </Button>
          <Button variant="secondary" :disabled="!hasSelection" @click="addSelectedServices">
            Add
          </Button>
          <Button :disabled="props.saving" @click="handleSave">
            <Loader2 v-if="props.saving" class="mr-2 h-4 w-4 animate-spin" />
            {{ saveButtonLabel }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
