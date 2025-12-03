<script setup lang="ts">
definePage({
  alias: '/medical-examination/',
  meta: {
    requiresAuth: true,
  },
})

import type { AcceptableValue } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import MedicalExaminationDetailCard from '@/components/medicalExamination/MedicalExaminationDetailCard.vue'
import MedicalExaminationFilters from '@/components/medicalExamination/MedicalExaminationFilters.vue'
import MedicalExaminationPatientTable from '@/components/medicalExamination/MedicalExaminationPatientTable.vue'
import MedicalExaminationDialog, {
  type MedicalExaminationDialogSavePayload,
} from '@/components/medicalExamination/MedicalExaminationDialog.vue'
import MedicalExaminationServicesDialog, {
  type MedicalExaminationServicesSavePayload,
} from '@/components/medicalExamination/MedicalExaminationServicesDialog.vue'
import type {
  GetMedicalRecordsParams,
  MedicalRecordSummary,
  MedicalStaffSummary,
} from '@/services/medicalRecord'
import { getMedicalRecords, updateMedicalRecord } from '@/services/medicalRecord'
import {
  createMedicalExamination,
  getMedicalExaminationByMedicalRecord,
  updateMedicalExamination,
  updateMedicalExaminationDiagnoses,
  type MedicalExaminationDetail,
} from '@/services/medicalExamination'
import { ApiError } from '@/services/http'
import {
  createServiceOrder,
  createServiceOrderDetail,
  deleteServiceOrderDetail,
  getServiceOrderDetails,
  getServiceOrders,
  updateServiceOrder,
  updateServiceOrderDetail,
} from '@/services/serviceOrder'
import { getResults } from '@/services/result'
import { getPatient, type PatientSummary } from '@/services/patient'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'

const activeTab = ref('patients')

const EXAM_SERVICE_CODE =
  (import.meta.env.VITE_EXAM_SERVICE_CODE as string | undefined)?.trim().toUpperCase() ||
  'CK-KB-001'

const workspaceStore = useWorkspaceStore()
const { department: selectedDepartment, room: selectedRoom } = storeToRefs(workspaceStore)
const { user: authUser } = storeToRefs(useAuthStore())

const records = ref<MedicalRecordSummary[]>([])
const recordsLoading = ref(false)
const recordsError = ref<string | null>(null)
const selectedRecordId = ref<number | null>(null)
const startExamLoading = ref(false)
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const pageSize = ref<PageSizeOption>(PAGE_SIZE_OPTIONS[0])
const pageSizeOptions = [...PAGE_SIZE_OPTIONS]
const currentPage = ref(1)

interface DiagnosticOrderSummaryRow {
  id: number
  code: string
  createdAt: string
  orderedBy: string
  status: number
}

interface DiagnosticServiceRow {
  id: number
  serviceId: number
  serviceCode: string
  serviceName: string
  quantity: number
  amount: number
  unitPrice: number
  executionRoomId: number | null
  hasResult: boolean
}

interface DiagnosticResultRow {
  id: number
  serviceCode: string
  serviceName: string
  receivedAt: string
  performedAt: string
  deliveredAt: string
  result: string
  conclusion: string
  note: string | null
  url: string | null
}

interface ServicesDialogInitialOrder {
  id: number
  createdAt: string
  services: Array<{
    detailId: number
    serviceId: number
    code: string
    name: string
    price: number
    quantity: number
    executionRoomId: number | null
    hasResult: boolean
  }>
}

const laboratoryOrderSummaries = ref<DiagnosticOrderSummaryRow[]>([])
const laboratoryOrderDetailsByOrder = ref<Record<number, DiagnosticServiceRow[]>>({})
const selectedLaboratoryOrderId = ref<number | null>(null)

const imagingOrderSummaries = ref<DiagnosticOrderSummaryRow[]>([])
const imagingOrderDetailsByOrder = ref<Record<number, DiagnosticServiceRow[]>>({})
const selectedImagingOrderId = ref<number | null>(null)

const procedureOrderSummaries = ref<DiagnosticOrderSummaryRow[]>([])
const procedureOrderDetailsByOrder = ref<Record<number, DiagnosticServiceRow[]>>({})
const selectedProcedureOrderId = ref<number | null>(null)

const laboratoryResultsByOrder = ref<Record<number, DiagnosticResultRow[]>>({})
const laboratoryResultsError = ref<string | null>(null)
const laboratoryResultsLoadingOrderId = ref<number | null>(null)
const laboratoryResultsLoadToken = ref(0)

const imagingResultsByOrder = ref<Record<number, DiagnosticResultRow[]>>({})
const imagingResultsError = ref<string | null>(null)
const imagingResultsLoadingOrderId = ref<number | null>(null)
const imagingResultsLoadToken = ref(0)

const procedureResultsByOrder = ref<Record<number, DiagnosticResultRow[]>>({})
const procedureResultsError = ref<string | null>(null)
const procedureResultsLoadingOrderId = ref<number | null>(null)
const procedureResultsLoadToken = ref(0)

const serviceOrdersLoadToken = ref(0)
const serviceOrdersLoading = ref(false)
const serviceOrderError = ref<string | null>(null)

const setServiceOrdersLoading = (isLoading: boolean) => {
  serviceOrdersLoading.value = isLoading
}

const setServiceOrderErrors = (message: string | null) => {
  serviceOrderError.value = message
}

const laboratoryOrdersLoading = computed(() => serviceOrdersLoading.value)
const laboratoryOrdersError = computed(() => serviceOrderError.value)
const imagingOrdersLoading = computed(() => serviceOrdersLoading.value)
const imagingOrdersError = computed(() => serviceOrderError.value)
const procedureOrdersLoading = computed(() => serviceOrdersLoading.value)
const procedureOrdersError = computed(() => serviceOrderError.value)

const selectedLaboratoryOrder = computed(() => {
  const orderId = selectedLaboratoryOrderId.value
  if (orderId === null) {
    return null
  }

  return laboratoryOrderSummaries.value.find((order) => order.id === orderId) ?? null
})

const selectedLaboratoryOrderServices = computed(() => {
  const orderId = selectedLaboratoryOrderId.value
  if (orderId === null) {
    return []
  }

  return laboratoryOrderDetailsByOrder.value[orderId] ?? []
})

const selectedLaboratoryOrderResults = computed(() => {
  const orderId = selectedLaboratoryOrderId.value
  if (orderId === null) {
    return []
  }

  return laboratoryResultsByOrder.value[orderId] ?? []
})

const isLaboratoryResultsLoading = computed(() => {
  if (laboratoryResultsLoadingOrderId.value === null) {
    return false
  }

  if (selectedLaboratoryOrderId.value === null) {
    return true
  }

  return laboratoryResultsLoadingOrderId.value === selectedLaboratoryOrderId.value
})

const selectedImagingOrder = computed(() => {
  const orderId = selectedImagingOrderId.value
  if (orderId === null) {
    return null
  }

  return imagingOrderSummaries.value.find((order) => order.id === orderId) ?? null
})

const selectedImagingOrderServices = computed(() => {
  const orderId = selectedImagingOrderId.value
  if (orderId === null) {
    return []
  }

  return imagingOrderDetailsByOrder.value[orderId] ?? []
})

const selectedImagingOrderResults = computed(() => {
  const orderId = selectedImagingOrderId.value
  if (orderId === null) {
    return []
  }

  return imagingResultsByOrder.value[orderId] ?? []
})

const isImagingResultsLoading = computed(() => {
  if (imagingResultsLoadingOrderId.value === null) {
    return false
  }

  if (selectedImagingOrderId.value === null) {
    return true
  }

  return imagingResultsLoadingOrderId.value === selectedImagingOrderId.value
})

const selectedProcedureOrder = computed(() => {
  const orderId = selectedProcedureOrderId.value
  if (orderId === null) {
    return null
  }

  return procedureOrderSummaries.value.find((order) => order.id === orderId) ?? null
})

const selectedProcedureOrderServices = computed(() => {
  const orderId = selectedProcedureOrderId.value
  if (orderId === null) {
    return []
  }

  return procedureOrderDetailsByOrder.value[orderId] ?? []
})

const selectedProcedureOrderResults = computed(() => {
  const orderId = selectedProcedureOrderId.value
  if (orderId === null) {
    return []
  }

  return procedureResultsByOrder.value[orderId] ?? []
})

const isProcedureResultsLoading = computed(() => {
  if (procedureResultsLoadingOrderId.value === null) {
    return false
  }

  if (selectedProcedureOrderId.value === null) {
    return true
  }

  return procedureResultsLoadingOrderId.value === selectedProcedureOrderId.value
})

const resetServiceOrderRows = () => {
  laboratoryOrderSummaries.value = []
  laboratoryOrderDetailsByOrder.value = {}
  selectedLaboratoryOrderId.value = null
  laboratoryResultsByOrder.value = {}
  laboratoryResultsError.value = null
  laboratoryResultsLoadingOrderId.value = null
  laboratoryResultsLoadToken.value = 0
  imagingOrderSummaries.value = []
  imagingOrderDetailsByOrder.value = {}
  selectedImagingOrderId.value = null
  imagingResultsByOrder.value = {}
  imagingResultsError.value = null
  imagingResultsLoadingOrderId.value = null
  imagingResultsLoadToken.value = 0
  procedureOrderSummaries.value = []
  procedureOrderDetailsByOrder.value = {}
  selectedProcedureOrderId.value = null
  procedureResultsByOrder.value = {}
  procedureResultsError.value = null
  procedureResultsLoadingOrderId.value = null
  procedureResultsLoadToken.value = 0
}

const isPageSizeOption = (value: number): value is PageSizeOption => {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption)
}

const hasWorkspaceSelection = computed(() =>
  Boolean(selectedRoom.value || selectedDepartment.value),
)

const statusLabelMap: Record<number, string> = {
  0: 'Pending',
  1: 'In progress',
  2: 'Completed',
}

const statusClassMap: Record<number, string> = {
  0: 'bg-amber-100 text-amber-800',
  1: 'bg-sky-100 text-sky-800',
  2: 'bg-emerald-100 text-emerald-800',
}

type ServiceOrderCategory = 'lab' | 'imaging' | 'procedure'

const serviceTypeCategoryMap: Record<string, ServiceOrderCategory> = {
  'xét nghiệm': 'lab',
  'chẩn đoán hình ảnh và thăm dò chức năng': 'imaging',
  'phẫu thuật - thủ thuật': 'procedure',
}

const resolveServiceOrderCategory = (
  typeName: string | null | undefined,
): ServiceOrderCategory | null => {
  if (!typeName) {
    return null
  }

  const normalized = typeName.trim().toLowerCase()
  return serviceTypeCategoryMap[normalized] ?? null
}

const formatStaffLabel = (
  staff: MedicalStaffSummary | null | undefined,
  emptyLabel = '—',
): string => {
  if (!staff) {
    return emptyLabel
  }

  const department = staff.department?.name
  return department ? `${staff.name} · ${department}` : staff.name
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const getStatusLabel = (value: number): string => {
  return statusLabelMap[value] ?? 'Unknown'
}

const getStatusClass = (value: number): string => {
  return statusClassMap[value] ?? 'bg-muted text-muted-foreground'
}

const formatCurrency = (value: number | string): string => {
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (!Number.isFinite(numericValue)) {
    return '—'
  }

  return currencyFormatter.format(numericValue)
}

const formatBirthYear = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return String(date.getFullYear())
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

const formatExamTimeRange = (record: MedicalRecordSummary | null): string => {
  if (!record) {
    return '—'
  }

  const start = formatDateTime(record.enteredAt)
  if (start === '—') {
    return '—'
  }

  const end = record.completedAt ? formatDateTime(record.completedAt) : 'In Progress'
  return `${start} - ${end}`
}

const getDispositionLabel = (record: MedicalRecordSummary): string => {
  return record.completedAt ? 'Updated' : 'Not updated'
}

const formatInputDate = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultFromDate = (): string => {
  return formatInputDate(new Date())
}

const parseDateInput = (value: string): Date | null => {
  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function startOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(23, 59, 59, 999)
  return result
}

interface AppliedFiltersState {
  from: Date | null
  to: Date | null
  code: string
  name: string
}

const filters = reactive({
  from: getDefaultFromDate(),
  to: getDefaultFromDate(),
  code: '',
  name: '',
})

const appliedFilters = ref<AppliedFiltersState>({
  from: startOfDay(new Date()),
  to: endOfDay(new Date()),
  code: '',
  name: '',
})

const filteredRecords = computed(() => {
  const codeTerm = appliedFilters.value.code.trim().toLowerCase()
  const nameTerm = appliedFilters.value.name.trim().toLowerCase()
  const { from, to } = appliedFilters.value

  return records.value.filter((record) => {
    const enteredAt = new Date(record.enteredAt)

    if (from && !Number.isNaN(enteredAt.getTime()) && enteredAt < from) {
      return false
    }

    if (to && !Number.isNaN(enteredAt.getTime()) && enteredAt > to) {
      return false
    }

    if (codeTerm && !(record.code ?? '').toLowerCase().includes(codeTerm)) {
      return false
    }

    if (nameTerm && !(record.patient.fullName ?? '').toLowerCase().includes(nameTerm)) {
      return false
    }

    return true
  })
})

const totalFilteredRecords = computed(() => filteredRecords.value.length)

const paginatedRecords = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  return filteredRecords.value.slice(startIndex, startIndex + pageSize.value)
})

const selectedRecord = computed(() => {
  if (selectedRecordId.value === null) {
    return null
  }

  return filteredRecords.value.find((record) => record.id === selectedRecordId.value) ?? null
})

const startExamDisabled = computed(() => {
  if (startExamLoading.value) {
    return true
  }

  if (!selectedRecord.value) {
    return true
  }

  return selectedRecord.value.status !== 0
})

const secondaryActionsDisabled = computed(() => {
  if (!selectedRecord.value) {
    return true
  }

  return selectedRecord.value.status === 0
})

const selectedDoctorDisplay = computed(() => {
  return formatStaffLabel(selectedRecord.value?.doctor, 'Not assigned')
})

const defaultOrderingStaffLabel = computed(() => {
  return formatStaffLabel(selectedRecord.value?.doctor)
})

const selectedPatientAddress = computed(() => {
  const wardName = selectedRecord.value?.patient.ward?.name ?? ''
  const cityName = selectedRecord.value?.patient.city?.name ?? ''
  const parts = [wardName, cityName].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
})

const selectedPatientBirthDate = computed(() => {
  return formatDate(selectedRecord.value?.patient.birthDate)
})

const selectedPatientPhone = computed(() => {
  return selectedRecord.value?.patient.phone ?? '—'
})

const selectedExamTimeRange = computed(() => {
  return formatExamTimeRange(selectedRecord.value)
})

const examinationDialogOpen = ref(false)
const examinationSaving = ref(false)
const servicesDialogOpen = ref(false)
const servicesSaving = ref(false)

type ServicesDialogMode = 'create' | 'edit'
const servicesDialogMode = ref<ServicesDialogMode>('create')
const servicesDialogInitialOrder = ref<ServicesDialogInitialOrder | null>(null)
const servicesDialogOrderId = ref<number | null>(null)
const servicesDialogOrderCategory = ref<ServiceOrderCategory | null>(null)
const serviceOrderActionLoadingId = ref<number | null>(null)

const medicalRecordDetailLoading = ref(false)
const medicalRecordPatientDetail = ref<PatientSummary | null>(null)
const medicalRecordExamination = ref<MedicalExaminationDetail | null>(null)
const medicalRecordLoadToken = ref(0)

const medicalRecordPatientCode = computed(() => {
  return selectedRecord.value?.patient.code ?? '—'
})

const medicalRecordPatientName = computed(() => {
  return medicalRecordPatientDetail.value?.fullName ?? selectedRecord.value?.patient.fullName ?? '—'
})

const medicalRecordPatientBirthDate = computed(() => {
  const birthDate =
    medicalRecordPatientDetail.value?.birthDate ?? selectedRecord.value?.patient.birthDate ?? null
  return formatDate(birthDate)
})

const medicalRecordPatientGenderLabel = computed(() => {
  const genderValue =
    medicalRecordPatientDetail.value?.gender ?? selectedRecord.value?.patient.gender ?? null

  if (genderValue === 1) {
    return 'Male'
  }

  if (genderValue === 0) {
    return 'Female'
  }

  return '—'
})

const medicalRecordPatientOccupation = computed(() => {
  return medicalRecordPatientDetail.value?.occupation?.name ?? '—'
})

const medicalRecordPatientAddress = computed(() => {
  const wardName = medicalRecordPatientDetail.value?.ward?.name ?? ''
  const cityName = medicalRecordPatientDetail.value?.ward?.city?.name ?? ''
  const parts = [wardName, cityName].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
})

const medicalRecordPatientPhone = computed(() => {
  return medicalRecordPatientDetail.value?.phone ?? selectedRecord.value?.patient.phone ?? '—'
})

const medicalRecordReason = computed(() => {
  const reason = selectedRecord.value?.reason?.trim()
  return reason && reason.length ? reason : '—'
})

const medicalRecordExamTime = computed(() => {
  const value = medicalRecordExamination.value?.examTime ?? null
  return formatDateTime(value)
})

type ExamServicePaymentStatus = 'paid' | 'unpaid' | 'error'

const checkExamServicePaymentStatus = async (
  medicalRecordId: number,
): Promise<ExamServicePaymentStatus> => {
  try {
    const { serviceOrders } = await getServiceOrders({ medicalRecordId, limit: 30 })

    if (!serviceOrders.length) {
      return 'paid'
    }

    for (const order of serviceOrders) {
      // Skip paid orders early when possible
      if (order.status !== 0) {
        continue
      }

      const { serviceOrderDetails } = await getServiceOrderDetails(order.id)
      const hasUnpaidExamDetail = serviceOrderDetails.some((detail) => {
        const detailCode = detail.service.code.trim().toUpperCase()
        return detailCode === EXAM_SERVICE_CODE && !detail.isPaid
      })

      if (hasUnpaidExamDetail) {
        return 'unpaid'
      }
    }

    return 'paid'
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to verify payment status. Please try again.'
    toast.error(message)
    return 'error'
  }
}

const openExaminationDialog = () => {
  if (!selectedRecord.value) {
    return
  }

  examinationDialogOpen.value = true
}

const openServicesDialog = () => {
  if (secondaryActionsDisabled.value) {
    return
  }

  resetServicesDialogContext()
  servicesDialogOpen.value = true
}

const isOrderActionInProgress = (orderId: number): boolean => {
  return serviceOrderActionLoadingId.value === orderId
}

const canSendServiceOrder = (status: number): boolean => {
  return status === 0
}

const canCancelServiceOrder = (status: number): boolean => {
  return status === 1
}

const canUpdateServiceOrder = (status: number): boolean => {
  return status !== 2
}

const handleServiceOrderStatusChange = async (
  orderId: number,
  nextStatus: number,
  successMessage: string,
) => {
  serviceOrderActionLoadingId.value = orderId

  try {
    await updateServiceOrder(orderId, { status: nextStatus })
    toast.success(successMessage)
    await loadServiceOrders()
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : 'Unable to update service order status. Please try again.'
    toast.error(message)
  } finally {
    serviceOrderActionLoadingId.value = null
  }
}

const handleSendServiceOrder = async (orderId: number) => {
  await handleServiceOrderStatusChange(orderId, 1, 'Service order sent.')
}

const handleCancelServiceOrder = async (orderId: number) => {
  await handleServiceOrderStatusChange(orderId, 0, 'Service order reverted to pending.')
}

const resetServicesDialogContext = () => {
  servicesDialogMode.value = 'create'
  servicesDialogInitialOrder.value = null
  servicesDialogOrderId.value = null
  servicesDialogOrderCategory.value = null
}

const openServicesDialogForOrder = (orderId: number, category: ServiceOrderCategory) => {
  let summaries: DiagnosticOrderSummaryRow[] = []
  let detailsMap: Record<number, DiagnosticServiceRow[]> = {}

  if (category === 'lab') {
    summaries = laboratoryOrderSummaries.value
    detailsMap = laboratoryOrderDetailsByOrder.value
  } else if (category === 'imaging') {
    summaries = imagingOrderSummaries.value
    detailsMap = imagingOrderDetailsByOrder.value
  } else {
    summaries = procedureOrderSummaries.value
    detailsMap = procedureOrderDetailsByOrder.value
  }

  const summary = summaries.find((order) => order.id === orderId)
  if (!summary) {
    toast.error('Unable to locate the selected service order.')
    return
  }

  const details = detailsMap[orderId] ?? []

  servicesDialogMode.value = 'edit'
  servicesDialogOrderId.value = orderId
  servicesDialogOrderCategory.value = category
  servicesDialogInitialOrder.value = {
    id: summary.id,
    createdAt: summary.createdAt,
    services: details.map((detail) => ({
      detailId: detail.id,
      serviceId: detail.serviceId,
      code: detail.serviceCode,
      name: detail.serviceName,
      price: detail.unitPrice,
      quantity: detail.quantity,
      executionRoomId: detail.executionRoomId,
      hasResult: detail.hasResult,
    })),
  }

  servicesDialogOpen.value = true
}

const toNullableString = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const toNullableNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const parseBloodPressure = (
  value: string,
): { systolic: number | null; diastolic: number | null } => {
  const trimmed = value.trim()
  if (!trimmed) {
    return { systolic: null, diastolic: null }
  }

  const normalized = trimmed.replace(/\s+/g, '')
  const match = normalized.match(/^(\d{1,3})(?:\/|\-)(\d{1,3})$/)

  if (!match) {
    return { systolic: null, diastolic: null }
  }

  const systolic = Number(match[1])
  const diastolic = Number(match[2])

  return {
    systolic: Number.isFinite(systolic) ? systolic : null,
    diastolic: Number.isFinite(diastolic) ? diastolic : null,
  }
}

const generateServiceOrderCode = (): string => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `SO-${datePart}-${timePart}`
}

const loadSelectedRecordDetail = async () => {
  const record = selectedRecord.value

  medicalRecordLoadToken.value += 1
  const requestId = medicalRecordLoadToken.value

  if (!record) {
    medicalRecordDetailLoading.value = false
    medicalRecordPatientDetail.value = null
    medicalRecordExamination.value = null
    return
  }

  const shouldReset = medicalRecordPatientDetail.value?.id !== record.patient.id

  if (shouldReset) {
    medicalRecordPatientDetail.value = null
    medicalRecordExamination.value = null
  }

  medicalRecordDetailLoading.value = true

  try {
    const [patient, examination] = await Promise.all([
      getPatient(record.patient.id),
      getMedicalExaminationByMedicalRecord(record.id),
    ])

    if (requestId !== medicalRecordLoadToken.value) {
      return
    }

    medicalRecordPatientDetail.value = patient
    medicalRecordExamination.value = examination
  } catch (error) {
    if (requestId !== medicalRecordLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load medical record details. Please try again.'
    toast.error(message)
    medicalRecordPatientDetail.value = null
    medicalRecordExamination.value = null
  } finally {
    if (requestId === medicalRecordLoadToken.value) {
      medicalRecordDetailLoading.value = false
    }
  }
}

const loadServiceOrders = async () => {
  serviceOrdersLoadToken.value += 1
  const requestId = serviceOrdersLoadToken.value
  const record = selectedRecord.value

  if (!record) {
    resetServiceOrderRows()
    setServiceOrderErrors(null)
    setServiceOrdersLoading(false)
    return
  }

  setServiceOrdersLoading(true)
  setServiceOrderErrors(null)
  laboratoryResultsError.value = null
  imagingResultsError.value = null
  procedureResultsError.value = null

  try {
    const { serviceOrders } = await getServiceOrders({ medicalRecordId: record.id, limit: 50 })

    if (requestId !== serviceOrdersLoadToken.value) {
      return
    }

    if (!serviceOrders.length) {
      resetServiceOrderRows()
      return
    }

    const ordersWithDetails = await Promise.all(
      serviceOrders.map(async (order) => {
        const { serviceOrderDetails } = await getServiceOrderDetails(order.id)
        return { order, details: serviceOrderDetails }
      }),
    )

    if (requestId !== serviceOrdersLoadToken.value) {
      return
    }

    const labSummaryMap = new Map<number, DiagnosticOrderSummaryRow>()
    const labDetailsMap: Record<number, DiagnosticServiceRow[]> = {}
    const imagingSummaryMap = new Map<number, DiagnosticOrderSummaryRow>()
    const imagingDetailsMap: Record<number, DiagnosticServiceRow[]> = {}
    const procedureSummaryMap = new Map<number, DiagnosticOrderSummaryRow>()
    const procedureDetailsMap: Record<number, DiagnosticServiceRow[]> = {}

    for (const { order, details } of ordersWithDetails) {
      if (!details.length) {
        continue
      }

      const orderingStaffLabel = order.orderingStaff
        ? formatStaffLabel(order.orderingStaff)
        : defaultOrderingStaffLabel.value

      for (const detail of details) {
        const serviceTypeName =
          detail.service.type?.name ?? detail.service.group?.type?.name ?? null
        const category = resolveServiceOrderCategory(serviceTypeName)

        if (!category) {
          continue
        }

        if (category === 'lab') {
          if (!labSummaryMap.has(order.id)) {
            labSummaryMap.set(order.id, {
              id: order.id,
              code: order.code,
              createdAt: order.createdAt,
              orderedBy: orderingStaffLabel,
              status: order.status,
            })
          }

          const bucket = labDetailsMap[order.id] ?? []
          const quantity = Number(detail.quantity)
          const totalAmount = Number(detail.amount)
          const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount
          bucket.push({
            id: detail.id,
            serviceId: detail.service.id,
            serviceCode: detail.service.code,
            serviceName: detail.service.name,
            quantity,
            amount: totalAmount,
            unitPrice,
            executionRoomId: detail.service.executionRoom?.id ?? null,
            hasResult: detail.hasResult,
          })
          labDetailsMap[order.id] = bucket
          continue
        }

        if (category === 'imaging') {
          if (!imagingSummaryMap.has(order.id)) {
            imagingSummaryMap.set(order.id, {
              id: order.id,
              code: order.code,
              createdAt: order.createdAt,
              orderedBy: orderingStaffLabel,
              status: order.status,
            })
          }

          const bucket = imagingDetailsMap[order.id] ?? []
          const quantity = Number(detail.quantity)
          const totalAmount = Number(detail.amount)
          const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount
          bucket.push({
            id: detail.id,
            serviceId: detail.service.id,
            serviceCode: detail.service.code,
            serviceName: detail.service.name,
            quantity,
            amount: totalAmount,
            unitPrice,
            executionRoomId: detail.service.executionRoom?.id ?? null,
            hasResult: detail.hasResult,
          })
          imagingDetailsMap[order.id] = bucket
          continue
        }

        if (!procedureSummaryMap.has(order.id)) {
          procedureSummaryMap.set(order.id, {
            id: order.id,
            code: order.code,
            createdAt: order.createdAt,
            orderedBy: orderingStaffLabel,
            status: order.status,
          })
        }

        const bucket = procedureDetailsMap[order.id] ?? []
        const quantity = Number(detail.quantity)
        const totalAmount = Number(detail.amount)
        const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount
        bucket.push({
          id: detail.id,
          serviceId: detail.service.id,
          serviceCode: detail.service.code,
          serviceName: detail.service.name,
          quantity,
          amount: totalAmount,
          unitPrice,
          executionRoomId: detail.service.executionRoom?.id ?? null,
          hasResult: detail.hasResult,
        })
        procedureDetailsMap[order.id] = bucket
      }
    }

    const labSummaries = Array.from(labSummaryMap.values()).sort((a, b) => {
      const first = new Date(a.createdAt).getTime()
      const second = new Date(b.createdAt).getTime()
      return Number.isNaN(second) || Number.isNaN(first) ? 0 : second - first
    })

    const imagingSummaries = Array.from(imagingSummaryMap.values()).sort((a, b) => {
      const first = new Date(a.createdAt).getTime()
      const second = new Date(b.createdAt).getTime()
      return Number.isNaN(second) || Number.isNaN(first) ? 0 : second - first
    })

    const procedureSummaries = Array.from(procedureSummaryMap.values()).sort((a, b) => {
      const first = new Date(a.createdAt).getTime()
      const second = new Date(b.createdAt).getTime()
      return Number.isNaN(second) || Number.isNaN(first) ? 0 : second - first
    })

    Object.values(labDetailsMap).forEach((detailRows) => {
      detailRows.sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    })

    Object.values(imagingDetailsMap).forEach((detailRows) => {
      detailRows.sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    })

    Object.values(procedureDetailsMap).forEach((detailRows) => {
      detailRows.sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    })

    const hasExistingLabSelection = Boolean(
      selectedLaboratoryOrderId.value !== null &&
        labSummaryMap.has(selectedLaboratoryOrderId.value),
    )

    const hasExistingImagingSelection = Boolean(
      selectedImagingOrderId.value !== null && imagingSummaryMap.has(selectedImagingOrderId.value),
    )

    const hasExistingProcedureSelection = Boolean(
      selectedProcedureOrderId.value !== null &&
        procedureSummaryMap.has(selectedProcedureOrderId.value),
    )

    laboratoryOrderSummaries.value = labSummaries
    laboratoryOrderDetailsByOrder.value = labDetailsMap
    imagingOrderSummaries.value = imagingSummaries
    imagingOrderDetailsByOrder.value = imagingDetailsMap
    procedureOrderSummaries.value = procedureSummaries
    procedureOrderDetailsByOrder.value = procedureDetailsMap

    const nextLabSelection = hasExistingLabSelection
      ? selectedLaboratoryOrderId.value
      : (labSummaries[0]?.id ?? null)

    const nextImagingSelection = hasExistingImagingSelection
      ? selectedImagingOrderId.value
      : (imagingSummaries[0]?.id ?? null)

    const nextProcedureSelection = hasExistingProcedureSelection
      ? selectedProcedureOrderId.value
      : (procedureSummaries[0]?.id ?? null)

    selectedLaboratoryOrderId.value = nextLabSelection
    selectedImagingOrderId.value = nextImagingSelection
    selectedProcedureOrderId.value = nextProcedureSelection

    const preservedLabResults: Record<number, DiagnosticResultRow[]> = {}
    for (const summary of labSummaries) {
      const existingResults = laboratoryResultsByOrder.value[summary.id]
      if (existingResults) {
        preservedLabResults[summary.id] = existingResults
      }
    }

    const preservedImagingResults: Record<number, DiagnosticResultRow[]> = {}
    for (const summary of imagingSummaries) {
      const existingResults = imagingResultsByOrder.value[summary.id]
      if (existingResults) {
        preservedImagingResults[summary.id] = existingResults
      }
    }

    const preservedProcedureResults: Record<number, DiagnosticResultRow[]> = {}
    for (const summary of procedureSummaries) {
      const existingResults = procedureResultsByOrder.value[summary.id]
      if (existingResults) {
        preservedProcedureResults[summary.id] = existingResults
      }
    }

    laboratoryResultsByOrder.value = preservedLabResults
    imagingResultsByOrder.value = preservedImagingResults
    procedureResultsByOrder.value = preservedProcedureResults

    if (selectedLaboratoryOrderId.value === null) {
      laboratoryResultsLoadingOrderId.value = null
    }

    if (selectedImagingOrderId.value === null) {
      imagingResultsLoadingOrderId.value = null
    }

    if (selectedProcedureOrderId.value === null) {
      procedureResultsLoadingOrderId.value = null
    }
  } catch (error) {
    if (requestId !== serviceOrdersLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError ? error.message : 'Unable to load service orders. Please try again.'

    resetServiceOrderRows()
    setServiceOrderErrors(message)
    toast.error(message)
  } finally {
    if (requestId === serviceOrdersLoadToken.value) {
      setServiceOrdersLoading(false)
    }
  }
}

const loadLaboratoryResults = async (orderId: number) => {
  laboratoryResultsLoadToken.value += 1
  const requestId = laboratoryResultsLoadToken.value

  laboratoryResultsLoadingOrderId.value = orderId
  laboratoryResultsError.value = null

  try {
    const { results } = await getResults({ serviceOrderId: orderId, limit: 100 })

    if (requestId !== laboratoryResultsLoadToken.value) {
      return
    }

    const mappedResults: DiagnosticResultRow[] = results.map((result) => ({
      id: result.id,
      serviceCode: result.serviceOrderDetail.service.code,
      serviceName: result.serviceOrderDetail.service.name,
      receivedAt: result.receivedAt,
      performedAt: result.performedAt,
      deliveredAt: result.deliveredAt,
      result: result.result,
      conclusion: result.conclusion,
      note: result.note,
      url: result.url,
    }))

    const nextResults = {
      ...laboratoryResultsByOrder.value,
      [orderId]: mappedResults,
    }

    laboratoryResultsByOrder.value = nextResults
  } catch (error) {
    if (requestId !== laboratoryResultsLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load laboratory results. Please try again.'

    laboratoryResultsError.value = message
    toast.error(message)
  } finally {
    if (requestId === laboratoryResultsLoadToken.value) {
      laboratoryResultsLoadingOrderId.value = null
    }
  }
}

const loadImagingResults = async (orderId: number) => {
  imagingResultsLoadToken.value += 1
  const requestId = imagingResultsLoadToken.value

  imagingResultsLoadingOrderId.value = orderId
  imagingResultsError.value = null

  try {
    const { results } = await getResults({ serviceOrderId: orderId, limit: 100 })

    if (requestId !== imagingResultsLoadToken.value) {
      return
    }

    const mappedResults: DiagnosticResultRow[] = results.map((result) => ({
      id: result.id,
      serviceCode: result.serviceOrderDetail.service.code,
      serviceName: result.serviceOrderDetail.service.name,
      receivedAt: result.receivedAt,
      performedAt: result.performedAt,
      deliveredAt: result.deliveredAt,
      result: result.result,
      conclusion: result.conclusion,
      note: result.note,
      url: result.url,
    }))

    const nextResults = {
      ...imagingResultsByOrder.value,
      [orderId]: mappedResults,
    }

    imagingResultsByOrder.value = nextResults
  } catch (error) {
    if (requestId !== imagingResultsLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load imaging results. Please try again.'

    imagingResultsError.value = message
    toast.error(message)
  } finally {
    if (requestId === imagingResultsLoadToken.value) {
      imagingResultsLoadingOrderId.value = null
    }
  }
}

const loadProcedureResults = async (orderId: number) => {
  procedureResultsLoadToken.value += 1
  const requestId = procedureResultsLoadToken.value

  procedureResultsLoadingOrderId.value = orderId
  procedureResultsError.value = null

  try {
    const { results } = await getResults({ serviceOrderId: orderId, limit: 100 })

    if (requestId !== procedureResultsLoadToken.value) {
      return
    }

    const mappedResults: DiagnosticResultRow[] = results.map((result) => ({
      id: result.id,
      serviceCode: result.serviceOrderDetail.service.code,
      serviceName: result.serviceOrderDetail.service.name,
      receivedAt: result.receivedAt,
      performedAt: result.performedAt,
      deliveredAt: result.deliveredAt,
      result: result.result,
      conclusion: result.conclusion,
      note: result.note,
      url: result.url,
    }))

    const nextResults = {
      ...procedureResultsByOrder.value,
      [orderId]: mappedResults,
    }

    procedureResultsByOrder.value = nextResults
  } catch (error) {
    if (requestId !== procedureResultsLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load procedure results. Please try again.'

    procedureResultsError.value = message
    toast.error(message)
  } finally {
    if (requestId === procedureResultsLoadToken.value) {
      procedureResultsLoadingOrderId.value = null
    }
  }
}

const toDisplayNumber = (value: number | null | undefined, fractionDigits?: number) => {
  if (value === null || value === undefined) {
    return null
  }

  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return null
  }

  return fractionDigits !== undefined ? numeric.toFixed(fractionDigits) : String(numeric)
}

const medicalRecordExamBloodPressure = computed(() => {
  const examination = medicalRecordExamination.value

  if (!examination) {
    return '—'
  }

  const systolic = examination.systolicBloodPressure
  const diastolic = examination.diastolicBloodPressure

  if (systolic === null && diastolic === null) {
    return '—'
  }

  if (systolic !== null && diastolic !== null) {
    return `${systolic}/${diastolic} mmHg`
  }

  if (systolic !== null) {
    return `${systolic} mmHg`
  }

  return `${diastolic} mmHg`
})

const medicalRecordExamWeight = computed(() => {
  const display = toDisplayNumber(medicalRecordExamination.value?.weight, 1)
  return display ? `${display} kg` : '—'
})

const medicalRecordExamHeight = computed(() => {
  const display = toDisplayNumber(medicalRecordExamination.value?.height, 1)
  return display ? `${display} cm` : '—'
})

const medicalRecordExamBmi = computed(() => {
  const display = toDisplayNumber(medicalRecordExamination.value?.bmi, 1)
  return display ?? '—'
})

const medicalRecordExamPulse = computed(() => {
  const display = toDisplayNumber(medicalRecordExamination.value?.pulse)
  return display ? `${display} bpm` : '—'
})

const medicalRecordExamTemperature = computed(() => {
  const display = toDisplayNumber(medicalRecordExamination.value?.temperature, 1)
  return display ? `${display} °C` : '—'
})

const medicalRecordExamRespiratoryRate = computed(() => {
  const display = toDisplayNumber(medicalRecordExamination.value?.respiratoryRate)
  return display ? `${display} breaths/min` : '—'
})

const handleSaveExamination = async (payload: MedicalExaminationDialogSavePayload) => {
  if (!selectedRecord.value) {
    return
  }

  examinationSaving.value = true

  try {
    const { form, secondaryDiseaseIds, medicalRecordId } = payload
    const reason = form.reasonForAdmission.trim()

    const doctorId = authUser.value?.id ?? null
    const hasAssignedDoctor = Boolean(selectedRecord.value?.doctor)
    const updatePayload: { lyDoKhamBenh: string; nvKhamId?: number } = {
      lyDoKhamBenh: reason,
    }

    if (!hasAssignedDoctor && typeof doctorId === 'number' && Number.isFinite(doctorId)) {
      updatePayload.nvKhamId = doctorId
    }

    const updatedRecord = await updateMedicalRecord(medicalRecordId, updatePayload)

    records.value = records.value.map((record) => {
      return record.id === updatedRecord.id ? updatedRecord : record
    })

    selectedRecordId.value = updatedRecord.id

    const weight = Number(form.weight)
    const height = Number(form.height)
    const bmi = toNullableNumber(form.bmi)
    const { systolic, diastolic } = parseBloodPressure(form.bloodPressure)

    const examinationPayload = {
      quaTrinhBenhLy: form.medicalHistory.trim(),
      tienSuBanThan: toNullableString(form.personalHistory),
      tienSuGiaDinh: toNullableString(form.familyHistory),
      khamToanThan: toNullableString(form.generalAssessment),
      khamBoPhan: toNullableString(form.systemAssessment),
      mach: toNullableNumber(form.pulse),
      nhietDo: toNullableNumber(form.temperature),
      nhipTho: toNullableNumber(form.heartRate),
      canNang: Number.isFinite(weight) ? weight : null,
      chieuCao: Number.isFinite(height) ? height : null,
      bmi,
      huyetApTThu: systolic,
      huyetApTTr: diastolic,
      chanDoanBanDau: form.initialDiagnosis.trim(),
    }

    let examinationId = payload.examinationId ?? null

    if (examinationId) {
      await updateMedicalExamination(examinationId, examinationPayload)
    } else {
      const created = await createMedicalExamination({
        benhAnId: medicalRecordId,
        thoiGianKham: new Date(),
        ...examinationPayload,
      })
      examinationId = created.id
    }

    const primaryDiseaseId = form.primaryDiseaseId

    if (examinationId === null || primaryDiseaseId === null) {
      throw new Error('Missing examination or primary disease information.')
    }

    const diagnosesPayload = [
      {
        diseaseId: primaryDiseaseId,
        isPrimary: true,
      },
      ...secondaryDiseaseIds.map((id) => ({ diseaseId: id, isPrimary: false })),
    ]

    await updateMedicalExaminationDiagnoses(examinationId, {
      diagnoses: diagnosesPayload,
    })

    await loadSelectedRecordDetail()

    toast.success('Examination details saved.')
    examinationDialogOpen.value = false
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : 'Unable to save examination details. Please try again.'
    toast.error(message)
  } finally {
    examinationSaving.value = false
  }
}

const handleSaveServices = async (payload: MedicalExaminationServicesSavePayload) => {
  if (!selectedRecord.value) {
    return
  }

  if (!payload.services.length) {
    toast.error('Please add at least one service before saving.')
    return
  }

  if (
    servicesDialogMode.value === 'edit' &&
    servicesDialogOrderId.value !== null &&
    servicesDialogOrderCategory.value !== null
  ) {
    await submitServiceOrderUpdate(payload)
    return
  }

  await submitServiceOrderCreate(payload)
}

const submitServiceOrderCreate = async (payload: MedicalExaminationServicesSavePayload) => {
  servicesSaving.value = true

  try {
    const orderCode = generateServiceOrderCode()
    const orderingStaffId =
      typeof authUser.value?.id === 'number' && Number.isFinite(authUser.value.id)
        ? authUser.value.id
        : undefined

    const serviceOrder = await createServiceOrder({
      code: orderCode,
      medicalRecordId: payload.medicalRecordId,
      createdAt: payload.orderTime,
      status: 0,
      assignedStaffId: orderingStaffId,
    })

    for (const item of payload.services) {
      await createServiceOrderDetail({
        serviceOrderId: serviceOrder.id,
        serviceId: item.serviceId,
        quantity: item.quantity,
        amount: item.price * item.quantity,
        requireResult: false,
        isPaid: false,
      })
    }

    toast.success('Service order saved.')
    await loadServiceOrders()
    servicesDialogOpen.value = false
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : 'Unable to save service order. Please try again.'
    toast.error(message)
  } finally {
    servicesSaving.value = false
  }
}

const submitServiceOrderUpdate = async (payload: MedicalExaminationServicesSavePayload) => {
  const orderId = servicesDialogOrderId.value ?? payload.serviceOrderId ?? null
  const category = servicesDialogOrderCategory.value

  if (orderId === null || !category) {
    toast.error('Unable to determine which service order to update.')
    return
  }

  servicesSaving.value = true

  try {
    await updateServiceOrder(orderId, { createdAt: payload.orderTime })

    let existingDetails: DiagnosticServiceRow[] = []

    if (category === 'lab') {
      existingDetails = laboratoryOrderDetailsByOrder.value[orderId] ?? []
    } else if (category === 'imaging') {
      existingDetails = imagingOrderDetailsByOrder.value[orderId] ?? []
    } else {
      existingDetails = procedureOrderDetailsByOrder.value[orderId] ?? []
    }

    const retainedDetailIds = new Set<number>()
    const existingDetailIds = new Set(existingDetails.map((detail) => detail.id))

    for (const item of payload.services) {
      const totalAmount = item.price * item.quantity

      if (
        item.detailId !== null &&
        item.detailId !== undefined &&
        existingDetailIds.has(item.detailId)
      ) {
        await updateServiceOrderDetail(item.detailId, {
          quantity: item.quantity,
          amount: totalAmount,
        })
        retainedDetailIds.add(item.detailId)
      } else {
        await createServiceOrderDetail({
          serviceOrderId: orderId,
          serviceId: item.serviceId,
          quantity: item.quantity,
          amount: totalAmount,
          requireResult: false,
          isPaid: false,
        })
      }
    }

    const detailsMarkedForRemoval = existingDetails.filter(
      (detail) => !retainedDetailIds.has(detail.id),
    )

    const removableDetailIds = detailsMarkedForRemoval
      .filter((detail) => !detail.hasResult)
      .map((detail) => detail.id)

    const nonRemovableDetails = detailsMarkedForRemoval.filter((detail) => detail.hasResult)

    if (removableDetailIds.length) {
      await Promise.all(removableDetailIds.map((detailId) => deleteServiceOrderDetail(detailId)))
    }

    if (nonRemovableDetails.length) {
      toast.warning('Some services were kept because results have already been recorded.')
    }

    toast.success('Service order updated.')
    await loadServiceOrders()

    if (category === 'lab') {
      selectedLaboratoryOrderId.value = orderId
    } else if (category === 'imaging') {
      selectedImagingOrderId.value = orderId
    } else {
      selectedProcedureOrderId.value = orderId
    }

    servicesDialogOpen.value = false
    resetServicesDialogContext()
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : 'Unable to update service order. Please try again.'
    toast.error(message)
  } finally {
    servicesSaving.value = false
  }
}

let fetchToken = 0

const loadRecords = async () => {
  if (!hasWorkspaceSelection.value) {
    records.value = []
    recordsError.value = null
    return
  }

  const departmentId = selectedRoom.value?.departmentId ?? selectedDepartment.value?.id ?? null
  const roomId = selectedRoom.value?.id ?? null
  const requestId = ++fetchToken

  recordsLoading.value = true
  recordsError.value = null

  try {
    const baseParams: GetMedicalRecordsParams = {
      page: 1,
      limit: 100,
      enteredFrom: appliedFilters.value.from ?? undefined,
      enteredTo: appliedFilters.value.to ?? undefined,
      roomId: roomId ?? undefined,
    }

    let medicalRecords: MedicalRecordSummary[] = []

    if (departmentId !== null && !roomId) {
      const primary = await getMedicalRecords({
        ...baseParams,
        departmentId: departmentId ?? undefined,
      })
      medicalRecords = primary.medicalRecords

      if (!medicalRecords.length) {
        const fallback = await getMedicalRecords({
          ...baseParams,
          departmentId: undefined,
        })
        medicalRecords = fallback.medicalRecords
      }
    } else {
      const response = await getMedicalRecords({
        ...baseParams,
        departmentId: roomId ? undefined : (departmentId ?? undefined),
      })
      medicalRecords = response.medicalRecords
    }

    if (requestId !== fetchToken) {
      return
    }

    let workspaceFiltered = medicalRecords

    if (roomId) {
      workspaceFiltered = medicalRecords.filter((record) => record.clinicRoom?.id === roomId)
    } else if (departmentId) {
      workspaceFiltered = medicalRecords.filter((record) => {
        const doctorDepartmentId = record.doctor?.department?.id ?? null
        const roomDepartmentId = record.clinicRoom?.department?.id ?? null
        return doctorDepartmentId === departmentId || roomDepartmentId === departmentId
      })
    }

    records.value = workspaceFiltered

    if (
      selectedRecordId.value !== null &&
      !workspaceFiltered.some((record) => record.id === selectedRecordId.value)
    ) {
      selectedRecordId.value = null
    }
  } catch (error) {
    if (requestId !== fetchToken) {
      return
    }

    const message =
      error instanceof ApiError ? error.message : 'Unable to load patients. Please try again.'
    records.value = []
    recordsError.value = message
    toast.error(message)
  } finally {
    if (requestId === fetchToken) {
      recordsLoading.value = false
    }
  }
}

const handleRowSelect = (record: MedicalRecordSummary) => {
  selectedRecordId.value = record.id
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handlePageSizeChange = (value: AcceptableValue) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !isPageSizeOption(parsed)) {
    return
  }

  pageSize.value = parsed
  currentPage.value = 1
}

const handleStartExamination = async () => {
  if (!selectedRecord.value || selectedRecord.value.status !== 0) {
    return
  }

  startExamLoading.value = true

  try {
    const paymentStatus = await checkExamServicePaymentStatus(selectedRecord.value.id)

    if (paymentStatus === 'unpaid') {
      toast.error(
        'The patient has not paid the examination fee. Please collect payment before starting the exam.',
      )
      return
    }

    if (paymentStatus === 'error') {
      return
    }

    const updated = await updateMedicalRecord(selectedRecord.value.id, {
      trangThai: 1,
    })

    records.value = records.value.map((record) => {
      return record.id === updated.id ? updated : record
    })

    selectedRecordId.value = updated.id
    toast.success('Patient marked as In Progress.')
    openExaminationDialog()
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to update patient status. Please try again.'
    toast.error(message)
  } finally {
    startExamLoading.value = false
  }
}

const applyFilters = async () => {
  const fromDateRaw = parseDateInput(filters.from)
  const toDateRaw = parseDateInput(filters.to)

  if (fromDateRaw && toDateRaw && fromDateRaw > toDateRaw) {
    toast.error('The start date must be before or equal to the end date.')
    return
  }

  appliedFilters.value = {
    from: fromDateRaw ? startOfDay(fromDateRaw) : null,
    to: toDateRaw ? endOfDay(toDateRaw) : null,
    code: filters.code.trim(),
    name: filters.name.trim(),
  }

  selectedRecordId.value = null
  currentPage.value = 1

  await loadRecords()
}

const handleApplyFilters = async () => {
  await applyFilters()
}

const handleResetFilters = async () => {
  filters.from = getDefaultFromDate()
  filters.to = getDefaultFromDate()
  filters.code = ''
  filters.name = ''
  await applyFilters()
}

watch(
  () => [selectedDepartment.value?.id ?? null, selectedRoom.value?.id ?? null],
  () => {
    selectedRecordId.value = null
    currentPage.value = 1
    void loadRecords()
  },
  { immediate: true },
)

watch(
  () => selectedRecord.value?.id ?? null,
  () => {
    void loadSelectedRecordDetail()
    void loadServiceOrders()
  },
  { immediate: true },
)

watch(selectedLaboratoryOrderId, (orderId) => {
  if (orderId === null) {
    laboratoryResultsError.value = null
    laboratoryResultsLoadingOrderId.value = null
    return
  }

  const details = laboratoryOrderDetailsByOrder.value[orderId] ?? []

  if (!details.length) {
    laboratoryResultsError.value = null
    laboratoryResultsLoadingOrderId.value = null
    laboratoryResultsByOrder.value = {
      ...laboratoryResultsByOrder.value,
      [orderId]: [],
    }
    return
  }

  if (!laboratoryResultsByOrder.value[orderId]) {
    void loadLaboratoryResults(orderId)
  }
})

watch(selectedImagingOrderId, (orderId) => {
  if (orderId === null) {
    imagingResultsError.value = null
    imagingResultsLoadingOrderId.value = null
    return
  }

  const details = imagingOrderDetailsByOrder.value[orderId] ?? []

  if (!details.length) {
    imagingResultsError.value = null
    imagingResultsLoadingOrderId.value = null
    imagingResultsByOrder.value = {
      ...imagingResultsByOrder.value,
      [orderId]: [],
    }
    return
  }

  if (!imagingResultsByOrder.value[orderId]) {
    void loadImagingResults(orderId)
  }
})

watch(selectedProcedureOrderId, (orderId) => {
  if (orderId === null) {
    procedureResultsError.value = null
    procedureResultsLoadingOrderId.value = null
    return
  }

  const details = procedureOrderDetailsByOrder.value[orderId] ?? []

  if (!details.length) {
    procedureResultsError.value = null
    procedureResultsLoadingOrderId.value = null
    procedureResultsByOrder.value = {
      ...procedureResultsByOrder.value,
      [orderId]: [],
    }
    return
  }

  if (!procedureResultsByOrder.value[orderId]) {
    void loadProcedureResults(orderId)
  }
})

watch(servicesDialogOpen, (isOpen) => {
  if (!isOpen) {
    resetServicesDialogContext()
  }
})

watch(
  () => [totalFilteredRecords.value, pageSize.value] as const,
  ([count]) => {
    if (count === 0) {
      currentPage.value = 1
      return
    }

    const totalPages = Math.max(1, Math.ceil(count / pageSize.value))
    if (currentPage.value > totalPages) {
      currentPage.value = totalPages
    }
  },
)

watch(filteredRecords, (list) => {
  if (
    selectedRecordId.value !== null &&
    !list.some((record) => record.id === selectedRecordId.value)
  ) {
    selectedRecordId.value = null
  }
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-7xl px-4">
      <div class="flex flex-wrap gap-3">
        <Button :disabled="startExamDisabled" @click="handleStartExamination">
          <Loader2 v-if="startExamLoading" class="mr-2 h-4 w-4 animate-spin" />
          Start
        </Button>
        <Button
          variant="outline"
          :disabled="secondaryActionsDisabled"
          class="hover:text-primary-foreground"
          type="button"
          @click="openExaminationDialog"
        >
          Examination
        </Button>
        <Button
          variant="outline"
          :disabled="secondaryActionsDisabled"
          class="hover:text-primary-foreground"
          type="button"
          @click="openServicesDialog"
          >Services</Button
        >
        <Button
          variant="outline"
          :disabled="secondaryActionsDisabled"
          class="hover:text-primary-foreground"
          >Disposition</Button
        >
      </div>

      <Card class="mt-6 border-none shadow-sm">
        <CardContent class="p-0">
          <Tabs v-model="activeTab" class="w-full px-6">
            <TabsList class="grid w-full grid-cols-1 gap-2 border-b sm:grid-cols-3 lg:grid-cols-5">
              <TabsTrigger value="patients">Patient List</TabsTrigger>
              <TabsTrigger value="medical-record">Medical Record</TabsTrigger>
              <TabsTrigger value="lab">Laboratory</TabsTrigger>
              <TabsTrigger value="imaging">Imaging</TabsTrigger>
              <TabsTrigger value="procedure">Procedures</TabsTrigger>
            </TabsList>

            <TabsContent value="patients" class="space-y-4 py-6">
              <Alert v-if="!hasWorkspaceSelection">
                <AlertCircle class="mr-2 h-5 w-5" />
                <AlertTitle>Workspace not configured</AlertTitle>
                <AlertDescription>
                  Please select a department and clinic room to view the patient queue.
                </AlertDescription>
              </Alert>

              <Alert v-else-if="recordsError" variant="destructive">
                <AlertCircle class="mr-2 h-5 w-5" />
                <AlertTitle>Unable to load data</AlertTitle>
                <AlertDescription>
                  {{ recordsError }}
                </AlertDescription>
              </Alert>

              <div v-else class="space-y-4">
                <MedicalExaminationFilters
                  v-model:code="filters.code"
                  v-model:name="filters.name"
                  v-model:from="filters.from"
                  v-model:to="filters.to"
                  :loading="recordsLoading"
                  :records-page-size="pageSize"
                  :page-size-options="pageSizeOptions"
                  @update:page-size="handlePageSizeChange"
                  @search="handleApplyFilters"
                  @reset="handleResetFilters"
                />

                <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <MedicalExaminationPatientTable
                    :records="paginatedRecords"
                    :total-count="records.length"
                    :filtered-count="totalFilteredRecords"
                    :loading="recordsLoading"
                    :selected-record-id="selectedRecordId"
                    :page="currentPage"
                    :page-size="pageSize"
                    :get-status-label="getStatusLabel"
                    :get-status-class="getStatusClass"
                    :format-birth-year="formatBirthYear"
                    :get-disposition-label="getDispositionLabel"
                    :format-date-time="formatDateTime"
                    @select="handleRowSelect"
                    @page-change="handlePageChange"
                  />

                  <MedicalExaminationDetailCard
                    :record="selectedRecord"
                    :doctor-display="selectedDoctorDisplay"
                    :patient-birth-date="selectedPatientBirthDate"
                    :patient-address="selectedPatientAddress"
                    :patient-phone="selectedPatientPhone"
                    :exam-time-range="selectedExamTimeRange"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="medical-record" class="space-y-4 px-6 py-6">
              <div v-if="!selectedRecord" class="py-12 text-center text-sm text-muted-foreground">
                Select a patient to view medical record details.
              </div>

              <div v-else class="space-y-6">
                <div
                  v-if="medicalRecordDetailLoading"
                  class="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Loader2 class="h-4 w-4 animate-spin" />
                  Loading medical record details...
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Patient Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Patient ID
                        </p>
                        <p class="text-sm font-semibold text-foreground">
                          {{ medicalRecordPatientCode }}
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Full Name
                        </p>
                        <p class="text-sm font-semibold text-foreground">
                          {{ medicalRecordPatientName }}
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Birth Date
                        </p>
                        <p class="text-sm text-foreground">{{ medicalRecordPatientBirthDate }}</p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Gender
                        </p>
                        <p class="text-sm text-foreground">{{ medicalRecordPatientGenderLabel }}</p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Occupation
                        </p>
                        <p class="text-sm text-foreground">{{ medicalRecordPatientOccupation }}</p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Address
                        </p>
                        <p class="text-sm text-foreground">{{ medicalRecordPatientAddress }}</p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Phone Number
                        </p>
                        <p class="text-sm text-foreground">{{ medicalRecordPatientPhone }}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Admission Overview</CardTitle>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Reason for Admission
                        </p>
                        <p class="whitespace-pre-line text-sm text-foreground">
                          {{ medicalRecordReason }}
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Exam timeframe
                        </p>
                        <p class="text-sm text-foreground">{{ selectedExamTimeRange }}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Examination Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div v-if="medicalRecordExamination" class="space-y-6">
                      <div class="grid gap-4 md:grid-cols-2">
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            General Examination
                          </p>
                          <p class="whitespace-pre-line text-sm text-foreground">
                            {{ medicalRecordExamination.generalAssessment ?? '—' }}
                          </p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            System Examination
                          </p>
                          <p class="whitespace-pre-line text-sm text-foreground">
                            {{ medicalRecordExamination.systemAssessment ?? '—' }}
                          </p>
                        </div>
                      </div>

                      <div class="grid gap-4 md:grid-cols-2">
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Initial Diagnosis
                          </p>
                          <p class="whitespace-pre-line text-sm text-foreground">
                            {{ medicalRecordExamination.initialDiagnosis ?? '—' }}
                          </p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Medical History
                          </p>
                          <p class="whitespace-pre-line text-sm text-foreground">
                            {{ medicalRecordExamination.diseaseProgression ?? '—' }}
                          </p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Personal History
                          </p>
                          <p class="whitespace-pre-line text-sm text-foreground">
                            {{ medicalRecordExamination.personalHistory ?? '—' }}
                          </p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Family History
                          </p>
                          <p class="whitespace-pre-line text-sm text-foreground">
                            {{ medicalRecordExamination.familyHistory ?? '—' }}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p
                          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Diagnoses
                        </p>
                        <div
                          v-if="medicalRecordExamination.diagnoses.length"
                          class="mt-1 space-y-1 text-sm"
                        >
                          <div
                            v-for="diagnosis in medicalRecordExamination.diagnoses"
                            :key="`${diagnosis.diseaseId}-${diagnosis.isPrimary}`"
                            class="flex flex-wrap items-center gap-2"
                          >
                            <span
                              class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                            >
                              {{ diagnosis.isPrimary ? 'Primary' : 'Secondary' }}
                            </span>
                            <span class="font-medium text-foreground">
                              {{ diagnosis.disease?.code ?? '—' }}
                            </span>
                            <span class="text-muted-foreground">
                              {{ diagnosis.disease?.name ?? '—' }}
                            </span>
                          </div>
                        </div>
                        <p v-else class="mt-1 text-sm text-muted-foreground">
                          No diagnoses recorded.
                        </p>
                      </div>

                      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Exam Time
                          </p>
                          <p class="text-sm text-foreground">{{ medicalRecordExamTime }}</p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Weight
                          </p>
                          <p class="text-sm text-foreground">{{ medicalRecordExamWeight }}</p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Height
                          </p>
                          <p class="text-sm text-foreground">{{ medicalRecordExamHeight }}</p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            BMI
                          </p>
                          <p class="text-sm text-foreground">{{ medicalRecordExamBmi }}</p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Pulse
                          </p>
                          <p class="text-sm text-foreground">{{ medicalRecordExamPulse }}</p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Temperature
                          </p>
                          <p class="text-sm text-foreground">{{ medicalRecordExamTemperature }}</p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Respiratory Rate
                          </p>
                          <p class="text-sm text-foreground">
                            {{ medicalRecordExamRespiratoryRate }}
                          </p>
                        </div>
                        <div>
                          <p
                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Blood Pressure
                          </p>
                          <p class="text-sm text-foreground">
                            {{ medicalRecordExamBloodPressure }}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p v-else class="py-8 text-center text-sm text-muted-foreground">
                      No examination has been recorded for this medical record yet.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="lab" class="space-y-6 px-6 py-6">
              <div v-if="!selectedRecord" class="py-12 text-center text-sm text-muted-foreground">
                Select a patient to view laboratory orders.
              </div>
              <div v-else class="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Laboratory Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="laboratoryOrdersLoading"
                      class="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Loading laboratory orders...
                    </div>
                    <Alert v-else-if="laboratoryOrdersError" variant="destructive">
                      <AlertCircle class="mr-2 h-5 w-5" />
                      <AlertTitle>Unable to load laboratory orders</AlertTitle>
                      <AlertDescription>
                        {{ laboratoryOrdersError }}
                      </AlertDescription>
                    </Alert>
                    <div
                      v-else-if="!laboratoryOrderSummaries.length"
                      class="py-8 text-center text-sm text-muted-foreground"
                    >
                      No laboratory orders available for this patient.
                    </div>
                    <div v-else class="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="whitespace-nowrap">Status</TableHead>
                            <TableHead class="whitespace-nowrap">Order Code</TableHead>
                            <TableHead class="whitespace-nowrap">Ordered At</TableHead>
                            <TableHead>Ordering Staff</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <ContextMenu
                            v-for="order in laboratoryOrderSummaries"
                            :key="order.id"
                            :modal="false"
                          >
                            <ContextMenuTrigger as-child>
                              <TableRow
                                class="cursor-pointer"
                                :class="[
                                  'hover:bg-muted/60',
                                  order.id === selectedLaboratoryOrderId ? 'bg-muted/80' : '',
                                ]"
                                @click="selectedLaboratoryOrderId = order.id"
                              >
                                <TableCell>
                                  <span
                                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                    :class="getStatusClass(order.status)"
                                  >
                                    {{ getStatusLabel(order.status) }}
                                  </span>
                                </TableCell>
                                <TableCell class="font-semibold text-foreground">
                                  {{ order.code }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(order.createdAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ order.orderedBy }}
                                </TableCell>
                              </TableRow>
                            </ContextMenuTrigger>
                            <ContextMenuContent class="w-56">
                              <ContextMenuItem
                                :disabled="
                                  !canSendServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="handleSendServiceOrder(order.id)"
                              >
                                Send order
                              </ContextMenuItem>
                              <ContextMenuItem
                                :disabled="
                                  !canCancelServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="handleCancelServiceOrder(order.id)"
                              >
                                Cancel send
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                :disabled="
                                  !canUpdateServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="openServicesDialogForOrder(order.id, 'lab')"
                              >
                                Update order
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Laboratory Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="!selectedLaboratoryOrder"
                      class="py-8 text-center text-sm text-muted-foreground"
                    >
                      Select an order above to view its services and results.
                    </div>
                    <Tabs v-else default-value="services" class="space-y-4">
                      <TabsList>
                        <TabsTrigger value="services">Ordered Services</TabsTrigger>
                        <TabsTrigger value="results">Results</TabsTrigger>
                      </TabsList>

                      <TabsContent value="services" class="space-y-4">
                        <div
                          v-if="laboratoryOrdersLoading"
                          class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading ordered services...
                        </div>
                        <div
                          v-else-if="!selectedLaboratoryOrderServices.length"
                          class="py-8 text-center text-sm text-muted-foreground"
                        >
                          No services recorded for this order.
                        </div>
                        <div v-else class="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="whitespace-nowrap">Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                                <TableHead class="w-24 text-right">Quantity</TableHead>
                                <TableHead class="w-32 text-right">Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="service in selectedLaboratoryOrderServices"
                                :key="service.id"
                              >
                                <TableCell class="text-sm font-medium text-foreground">
                                  {{ service.serviceCode }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ service.serviceName }}
                                </TableCell>
                                <TableCell class="text-right text-sm text-foreground">
                                  {{ service.quantity }}
                                </TableCell>
                                <TableCell class="text-right text-sm font-semibold text-foreground">
                                  {{ formatCurrency(service.amount) }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="results" class="space-y-4">
                        <div
                          v-if="isLaboratoryResultsLoading"
                          class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading laboratory results...
                        </div>
                        <Alert v-else-if="laboratoryResultsError" variant="destructive">
                          <AlertCircle class="mr-2 h-5 w-5" />
                          <AlertTitle>Unable to load results</AlertTitle>
                          <AlertDescription>
                            {{ laboratoryResultsError }}
                          </AlertDescription>
                        </Alert>
                        <div
                          v-else-if="!selectedLaboratoryOrderResults.length"
                          class="py-8 text-center text-sm text-muted-foreground"
                        >
                          No results available for this order.
                        </div>
                        <div v-else class="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="whitespace-nowrap">Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                                <TableHead class="whitespace-nowrap">Received At</TableHead>
                                <TableHead class="whitespace-nowrap">Performed At</TableHead>
                                <TableHead class="whitespace-nowrap">Delivered At</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Conclusion</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="result in selectedLaboratoryOrderResults"
                                :key="result.id"
                              >
                                <TableCell class="text-sm font-medium text-foreground">
                                  {{ result.serviceCode }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ result.serviceName }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.receivedAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.performedAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.deliveredAt) }}
                                </TableCell>
                                <TableCell class="whitespace-pre-line text-sm text-foreground">
                                  {{ result.result || '—' }}
                                </TableCell>
                                <TableCell class="whitespace-pre-line text-sm text-foreground">
                                  {{ result.conclusion || '—' }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="imaging" class="space-y-6 px-6 py-6">
              <div v-if="!selectedRecord" class="py-12 text-center text-sm text-muted-foreground">
                Select a patient to view imaging orders.
              </div>
              <div v-else class="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Imaging Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="imagingOrdersLoading"
                      class="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Loading imaging orders...
                    </div>
                    <Alert v-else-if="imagingOrdersError" variant="destructive">
                      <AlertCircle class="mr-2 h-5 w-5" />
                      <AlertTitle>Unable to load imaging orders</AlertTitle>
                      <AlertDescription>
                        {{ imagingOrdersError }}
                      </AlertDescription>
                    </Alert>
                    <div
                      v-else-if="!imagingOrderSummaries.length"
                      class="py-8 text-center text-sm text-muted-foreground"
                    >
                      No imaging orders available for this patient.
                    </div>
                    <div v-else class="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="whitespace-nowrap">Status</TableHead>
                            <TableHead class="whitespace-nowrap">Order Code</TableHead>
                            <TableHead class="whitespace-nowrap">Ordered At</TableHead>
                            <TableHead>Ordering Staff</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <ContextMenu
                            v-for="order in imagingOrderSummaries"
                            :key="order.id"
                            :modal="false"
                          >
                            <ContextMenuTrigger as-child>
                              <TableRow
                                class="cursor-pointer"
                                :class="[
                                  'hover:bg-muted/60',
                                  order.id === selectedImagingOrderId ? 'bg-muted/80' : '',
                                ]"
                                @click="selectedImagingOrderId = order.id"
                              >
                                <TableCell>
                                  <span
                                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                    :class="getStatusClass(order.status)"
                                  >
                                    {{ getStatusLabel(order.status) }}
                                  </span>
                                </TableCell>
                                <TableCell class="font-semibold text-foreground">
                                  {{ order.code }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(order.createdAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ order.orderedBy }}
                                </TableCell>
                              </TableRow>
                            </ContextMenuTrigger>
                            <ContextMenuContent class="w-56">
                              <ContextMenuItem
                                :disabled="
                                  !canSendServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="handleSendServiceOrder(order.id)"
                              >
                                Send order
                              </ContextMenuItem>
                              <ContextMenuItem
                                :disabled="
                                  !canCancelServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="handleCancelServiceOrder(order.id)"
                              >
                                Cancel send
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                :disabled="
                                  !canUpdateServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="openServicesDialogForOrder(order.id, 'imaging')"
                              >
                                Update order
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Imaging Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="!selectedImagingOrder"
                      class="py-8 text-center text-sm text-muted-foreground"
                    >
                      Select an order above to view its services and results.
                    </div>
                    <Tabs v-else default-value="services" class="space-y-4">
                      <TabsList>
                        <TabsTrigger value="services">Ordered Services</TabsTrigger>
                        <TabsTrigger value="results">Results</TabsTrigger>
                      </TabsList>

                      <TabsContent value="services" class="space-y-4">
                        <div
                          v-if="imagingOrdersLoading"
                          class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading ordered services...
                        </div>
                        <div
                          v-else-if="!selectedImagingOrderServices.length"
                          class="py-8 text-center text-sm text-muted-foreground"
                        >
                          No services recorded for this order.
                        </div>
                        <div v-else class="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="whitespace-nowrap">Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                                <TableHead class="w-24 text-right">Quantity</TableHead>
                                <TableHead class="w-32 text-right">Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="service in selectedImagingOrderServices"
                                :key="service.id"
                              >
                                <TableCell class="text-sm font-medium text-foreground">
                                  {{ service.serviceCode }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ service.serviceName }}
                                </TableCell>
                                <TableCell class="text-right text-sm text-foreground">
                                  {{ service.quantity }}
                                </TableCell>
                                <TableCell class="text-right text-sm font-semibold text-foreground">
                                  {{ formatCurrency(service.amount) }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="results" class="space-y-4">
                        <div
                          v-if="isImagingResultsLoading"
                          class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading imaging results...
                        </div>
                        <Alert v-else-if="imagingResultsError" variant="destructive">
                          <AlertCircle class="mr-2 h-5 w-5" />
                          <AlertTitle>Unable to load results</AlertTitle>
                          <AlertDescription>
                            {{ imagingResultsError }}
                          </AlertDescription>
                        </Alert>
                        <div
                          v-else-if="!selectedImagingOrderResults.length"
                          class="py-8 text-center text-sm text-muted-foreground"
                        >
                          No results available for this order.
                        </div>
                        <div v-else class="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="whitespace-nowrap">Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                                <TableHead class="whitespace-nowrap">Received At</TableHead>
                                <TableHead class="whitespace-nowrap">Performed At</TableHead>
                                <TableHead class="whitespace-nowrap">Delivered At</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Conclusion</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="result in selectedImagingOrderResults"
                                :key="result.id"
                              >
                                <TableCell class="text-sm font-medium text-foreground">
                                  {{ result.serviceCode }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ result.serviceName }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.receivedAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.performedAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.deliveredAt) }}
                                </TableCell>
                                <TableCell class="whitespace-pre-line text-sm text-foreground">
                                  {{ result.result || '—' }}
                                </TableCell>
                                <TableCell class="whitespace-pre-line text-sm text-foreground">
                                  {{ result.conclusion || '—' }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="procedure" class="space-y-6 px-6 py-6">
              <div v-if="!selectedRecord" class="py-12 text-center text-sm text-muted-foreground">
                Select a patient to view procedure orders.
              </div>
              <div v-else class="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Procedure Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="procedureOrdersLoading"
                      class="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Loading procedure orders...
                    </div>
                    <Alert v-else-if="procedureOrdersError" variant="destructive">
                      <AlertCircle class="mr-2 h-5 w-5" />
                      <AlertTitle>Unable to load procedure orders</AlertTitle>
                      <AlertDescription>
                        {{ procedureOrdersError }}
                      </AlertDescription>
                    </Alert>
                    <div
                      v-else-if="!procedureOrderSummaries.length"
                      class="py-8 text-center text-sm text-muted-foreground"
                    >
                      No procedure orders available for this patient.
                    </div>
                    <div v-else class="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="whitespace-nowrap">Status</TableHead>
                            <TableHead class="whitespace-nowrap">Order Code</TableHead>
                            <TableHead class="whitespace-nowrap">Ordered At</TableHead>
                            <TableHead>Ordering Staff</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <ContextMenu
                            v-for="order in procedureOrderSummaries"
                            :key="order.id"
                            :modal="false"
                          >
                            <ContextMenuTrigger as-child>
                              <TableRow
                                class="cursor-pointer"
                                :class="[
                                  'hover:bg-muted/60',
                                  order.id === selectedProcedureOrderId ? 'bg-muted/80' : '',
                                ]"
                                @click="selectedProcedureOrderId = order.id"
                              >
                                <TableCell>
                                  <span
                                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                    :class="getStatusClass(order.status)"
                                  >
                                    {{ getStatusLabel(order.status) }}
                                  </span>
                                </TableCell>
                                <TableCell class="font-semibold text-foreground">
                                  {{ order.code }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(order.createdAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ order.orderedBy }}
                                </TableCell>
                              </TableRow>
                            </ContextMenuTrigger>
                            <ContextMenuContent class="w-56">
                              <ContextMenuItem
                                :disabled="
                                  !canSendServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="handleSendServiceOrder(order.id)"
                              >
                                Send order
                              </ContextMenuItem>
                              <ContextMenuItem
                                :disabled="
                                  !canCancelServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="handleCancelServiceOrder(order.id)"
                              >
                                Cancel send
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                :disabled="
                                  !canUpdateServiceOrder(order.status) ||
                                  isOrderActionInProgress(order.id) ||
                                  servicesSaving
                                "
                                @select="openServicesDialogForOrder(order.id, 'procedure')"
                              >
                                Update order
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Procedure Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="!selectedProcedureOrder"
                      class="py-8 text-center text-sm text-muted-foreground"
                    >
                      Select an order above to view its services and results.
                    </div>
                    <Tabs v-else default-value="services" class="space-y-4">
                      <TabsList>
                        <TabsTrigger value="services">Ordered Services</TabsTrigger>
                        <TabsTrigger value="results">Results</TabsTrigger>
                      </TabsList>

                      <TabsContent value="services" class="space-y-4">
                        <div
                          v-if="procedureOrdersLoading"
                          class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading ordered services...
                        </div>
                        <div
                          v-else-if="!selectedProcedureOrderServices.length"
                          class="py-8 text-center text-sm text-muted-foreground"
                        >
                          No services recorded for this order.
                        </div>
                        <div v-else class="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="whitespace-nowrap">Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                                <TableHead class="w-24 text-right">Quantity</TableHead>
                                <TableHead class="w-32 text-right">Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="service in selectedProcedureOrderServices"
                                :key="service.id"
                              >
                                <TableCell class="text-sm font-medium text-foreground">
                                  {{ service.serviceCode }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ service.serviceName }}
                                </TableCell>
                                <TableCell class="text-right text-sm text-foreground">
                                  {{ service.quantity }}
                                </TableCell>
                                <TableCell class="text-right text-sm font-semibold text-foreground">
                                  {{ formatCurrency(service.amount) }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="results" class="space-y-4">
                        <div
                          v-if="isProcedureResultsLoading"
                          class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading procedure results...
                        </div>
                        <Alert v-else-if="procedureResultsError" variant="destructive">
                          <AlertCircle class="mr-2 h-5 w-5" />
                          <AlertTitle>Unable to load results</AlertTitle>
                          <AlertDescription>
                            {{ procedureResultsError }}
                          </AlertDescription>
                        </Alert>
                        <div
                          v-else-if="!selectedProcedureOrderResults.length"
                          class="py-8 text-center text-sm text-muted-foreground"
                        >
                          No results available for this order.
                        </div>
                        <div v-else class="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead class="whitespace-nowrap">Service Code</TableHead>
                                <TableHead>Service Name</TableHead>
                                <TableHead class="whitespace-nowrap">Received At</TableHead>
                                <TableHead class="whitespace-nowrap">Performed At</TableHead>
                                <TableHead class="whitespace-nowrap">Delivered At</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Conclusion</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow
                                v-for="result in selectedProcedureOrderResults"
                                :key="result.id"
                              >
                                <TableCell class="text-sm font-medium text-foreground">
                                  {{ result.serviceCode }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ result.serviceName }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.receivedAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.performedAt) }}
                                </TableCell>
                                <TableCell class="text-sm text-foreground">
                                  {{ formatDateTime(result.deliveredAt) }}
                                </TableCell>
                                <TableCell class="whitespace-pre-line text-sm text-foreground">
                                  {{ result.result || '—' }}
                                </TableCell>
                                <TableCell class="whitespace-pre-line text-sm text-foreground">
                                  {{ result.conclusion || '—' }}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <MedicalExaminationDialog
        v-model:open="examinationDialogOpen"
        :selected-record="selectedRecord"
        :saving="examinationSaving"
        @save="handleSaveExamination"
      />
      <MedicalExaminationServicesDialog
        v-model:open="servicesDialogOpen"
        :selected-record="selectedRecord"
        :patient-detail="medicalRecordPatientDetail"
        :examination-detail="medicalRecordExamination"
        :loading-details="medicalRecordDetailLoading"
        :saving="servicesSaving"
        :mode="servicesDialogMode"
        :initial-order="servicesDialogInitialOrder"
        @save="handleSaveServices"
      />
    </div>
  </section>
</template>
