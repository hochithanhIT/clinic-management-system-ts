<script setup lang="ts">
definePage({
  alias: '/billing/',
  meta: {
    requiresAuth: true,
  },
})

import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone } from '@internationalized/date'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import BillingFilters from '@/components/billing/BillingFilters.vue'
import BillingInvoicesTable from '@/components/billing/BillingInvoicesTable.vue'
import BillingTable from '@/components/billing/BillingTable.vue'
import type {
  BillingInvoice,
  BillingRecord,
  PaymentStatusFilterValue,
} from '@/components/billing/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError } from '@/services/http'
import { getMedicalRecords } from '@/services/medicalRecord'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import { getServiceOrderDetails, getServiceOrders } from '@/services/serviceOrder'
import {
  INVOICE_STATUS,
  cancelInvoice,
  getInvoiceDetails,
  getInvoices,
  settleInvoice,
} from '@/services/invoice'
import type { InvoiceDetailItem, InvoiceSummary } from '@/services/invoice'
import type { PaginationMeta } from '@/services/types'
import type { AcceptableValue } from 'reka-ui'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/stores/auth'

const timeZone = getLocalTimeZone()

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

const filters = reactive({
  medicalRecordCode: '',
  patientCode: '',
  paymentStatus: 'all' as PaymentStatusFilterValue,
})

const appliedFilters = ref({
  medicalRecordCode: '',
  patientCode: '',
  paymentStatus: 'all' as PaymentStatusFilterValue,
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

const setRecordsFrom = (value: DateValue | undefined) => {
  recordsFromModel.value = value
}

const setRecordsTo = (value: DateValue | undefined) => {
  recordsToModel.value = value
}

const billingRecords = ref<BillingRecord[]>([])
const recordsLoading = ref(false)
const billingPage = ref(1)
const billingPagination = ref<PaginationMeta | null>(null)
const billingPageSize = ref(20)
const billingPageSizeOptions = [10, 20, 50, 100]

const selectedRecordId = ref<number | null>(null)

const billingInvoices = ref<BillingInvoice[]>([])
const billingInvoicesLoading = ref(false)
const billingInvoicesPagination = ref<PaginationMeta | null>(null)
const billingInvoicesPage = ref(1)
const billingInvoicesPageSize = 10

const activeInvoiceRequestId = ref(0)

const cancelInvoiceDialogOpen = ref(false)
const cancelInvoiceDialogSubmitting = ref(false)
const cancelInvoiceDialogInvoice = ref<BillingInvoice | null>(null)

const paymentDialogOpen = ref(false)
const paymentDialogLoading = ref(false)
const paymentDialogSubmitting = ref(false)
const paymentDialogRecord = ref<BillingRecord | null>(null)
const paymentDialogServices = ref<OutstandingServiceItem[]>([])
const paymentDialogForm = reactive({
  invoiceDate: '',
  creatorName: user.value?.hoTen ?? '',
  amountReceived: '',
})
const activeOutstandingRequestId = ref(0)

const invoiceDetailDialogOpen = ref(false)
const invoiceDetailDialogLoading = ref(false)
const invoiceDetailDialogInvoice = ref<BillingInvoice | null>(null)
const invoiceDetailDialogDetails = ref<InvoiceDetailItem[]>([])
const invoiceDetailDialogRecord = ref<BillingRecord | null>(null)
const invoiceDetailDialogRecordId = ref<number | null>(null)
const activeInvoiceDetailRequestId = ref(0)

const activeRequestId = ref(0)

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

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
  if (!value || typeof value !== 'object') {
    return null
  }

  const dateValue = value as DateValue
  if (typeof dateValue.toDate !== 'function') {
    return null
  }

  const result = dateValue.toDate(timeZone)
  return Number.isNaN(result.getTime()) ? null : result
}

const SERVICE_ORDER_FETCH_LIMIT = 100

type OutstandingServiceItem = {
  id: number
  serviceName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  serviceOrderCode: string
}

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
})

const invoiceDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const formatCurrency = (value: number): string => {
  return currencyFormatter.format(value)
}

const formatInvoiceDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return invoiceDateTimeFormatter.format(date)
}

const toAmount = (value: number | string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatDateTimeLocal = (value: Date): string => {
  const pad = (input: number): string => input.toString().padStart(2, '0')
  const year = value.getFullYear()
  const month = pad(value.getMonth() + 1)
  const day = pad(value.getDate())
  const hours = pad(value.getHours())
  const minutes = pad(value.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const normalizeAmountInput = (raw: string): string => {
  if (!raw) {
    return ''
  }

  return raw.replace(/[^0-9]/g, '')
}

const formatAmountInputValue = (raw: string): string => {
  const digitsOnly = normalizeAmountInput(raw)
  if (!digitsOnly) {
    return ''
  }

  return numberFormatter.format(Number(digitsOnly))
}

const parseAmountInput = (raw: string): number => {
  const digitsOnly = normalizeAmountInput(raw)
  if (!digitsOnly) {
    return 0
  }

  const parsed = Number(digitsOnly)
  return Number.isFinite(parsed) ? parsed : 0
}

const mapToBillingRecords = async (records: MedicalRecordSummary[]): Promise<BillingRecord[]> => {
  const results: BillingRecord[] = []

  for (const record of records) {
    let paymentStatus: BillingRecord['paymentStatus'] = 'paid'
    let totalServiceOrders = 0
    let totalServiceDetails = 0
    let unpaidServiceDetails = 0

    try {
      const { serviceOrders } = await getServiceOrders({
        medicalRecordId: record.id,
        limit: SERVICE_ORDER_FETCH_LIMIT,
      })

      totalServiceOrders = serviceOrders.length

      for (const order of serviceOrders) {
        const { serviceOrderDetails } = await getServiceOrderDetails(order.id)
        totalServiceDetails += serviceOrderDetails.length
        const unpaidCount = serviceOrderDetails.reduce((count, detail) => {
          return count + (detail.isPaid ? 0 : 1)
        }, 0)

        unpaidServiceDetails += unpaidCount

        if (unpaidCount > 0) {
          paymentStatus = 'unpaid'
        }
      }
    } catch (error) {
      console.error('Unable to resolve payment status for record', record.id, error)
      paymentStatus = 'unpaid'
    }

    results.push({
      id: record.id,
      medicalRecordCode: record.code,
      patientCode: record.patient.code ?? '',
      patientName: record.patient.fullName ?? '',
      wardName: record.patient.ward?.name ?? null,
      cityName: record.patient.city?.name ?? null,
      paymentStatus,
      totalServiceOrders,
      totalServiceDetails,
      unpaidServiceDetails,
    })
  }

  return results
}

const mapInvoiceSummaryToBillingInvoice = (invoice: InvoiceSummary): BillingInvoice => ({
  id: invoice.id,
  code: invoice.code,
  amount: invoice.amount,
  paidAt: invoice.paidAt,
  collectorName: invoice.collector?.name ?? '',
  collectorCode: invoice.collector?.code ?? '',
  isCancelled: invoice.status === INVOICE_STATUS.cancelled,
  status: invoice.status,
  medicalRecordId: invoice.medicalRecordId,
  medicalRecordCode: invoice.medicalRecordCode,
})

const getInvoiceCollectorDisplay = (invoice: BillingInvoice | null): string => {
  if (!invoice) {
    return '—'
  }

  if (!invoice.collectorName && !invoice.collectorCode) {
    return '—'
  }

  if (invoice.collectorName && invoice.collectorCode) {
    return `${invoice.collectorName} (${invoice.collectorCode})`
  }

  return invoice.collectorName || invoice.collectorCode || '—'
}

const resolveInvoiceStatusLabel = (invoice: BillingInvoice | null): string => {
  if (!invoice) {
    return 'Unknown'
  }

  return invoice.isCancelled ? 'Cancelled' : 'Paid'
}

const loadBillingRecords = async () => {
  const requestId = activeRequestId.value + 1
  activeRequestId.value = requestId
  recordsLoading.value = true

  try {
    const { medicalRecordCode, patientCode, from, to } = appliedFilters.value
    const searchTerm = medicalRecordCode.trim() || patientCode.trim() || undefined

    const { medicalRecords, pagination } = await getMedicalRecords({
      page: billingPage.value,
      limit: billingPageSize.value,
      enteredFrom: from ?? undefined,
      enteredTo: to ?? undefined,
      search: searchTerm,
    })

    if (activeRequestId.value !== requestId) {
      return
    }

    billingPagination.value = pagination

    const mapped = await mapToBillingRecords(medicalRecords)

    if (activeRequestId.value !== requestId) {
      return
    }

    billingRecords.value = mapped
  } catch (error) {
    if (activeRequestId.value !== requestId) {
      return
    }

    const message = error instanceof ApiError ? error.message : 'Unable to load billing records.'
    toast.error(message)
    billingRecords.value = []
    billingPagination.value = null
  } finally {
    if (activeRequestId.value === requestId) {
      recordsLoading.value = false
    }
  }
}

const filteredRecords = computed(() => {
  const { medicalRecordCode, patientCode, paymentStatus } = appliedFilters.value
  const medicalRecordFilter = medicalRecordCode.trim().toLowerCase()
  const patientCodeFilter = patientCode.trim().toLowerCase()

  return billingRecords.value.filter((record) => {
    if (
      medicalRecordFilter &&
      !record.medicalRecordCode.toLowerCase().includes(medicalRecordFilter)
    ) {
      return false
    }

    if (patientCodeFilter && !record.patientCode.toLowerCase().includes(patientCodeFilter)) {
      return false
    }

    if (paymentStatus === 'paid' && record.paymentStatus !== 'paid') {
      return false
    }

    if (paymentStatus === 'unpaid' && record.paymentStatus !== 'unpaid') {
      return false
    }

    return true
  })
})

const selectedRecord = computed(() => {
  const recordId = selectedRecordId.value

  if (!recordId) {
    return null
  }

  return filteredRecords.value.find((record) => record.id === recordId) ?? null
})

const resetInvoicesState = () => {
  billingInvoices.value = []
  billingInvoicesPagination.value = null
}

watch(
  filteredRecords,
  (records) => {
    if (records.length === 0) {
      if (selectedRecordId.value !== null) {
        selectedRecordId.value = null
      }
      billingInvoicesPage.value = 1
      resetInvoicesState()
      billingInvoicesLoading.value = false
      if (paymentDialogOpen.value) {
        handlePaymentDialogOpenChange(false)
      }
      return
    }

    const exists = records.some((record) => record.id === selectedRecordId.value)
    const firstRecord = records[0]

    if (!exists && firstRecord) {
      billingInvoicesPage.value = 1
      selectedRecordId.value = firstRecord.id
    }
  },
  { immediate: true },
)

const loadInvoices = async () => {
  const recordId = selectedRecordId.value

  if (!recordId) {
    billingInvoicesLoading.value = false
    resetInvoicesState()
    return
  }

  const requestId = activeInvoiceRequestId.value + 1
  activeInvoiceRequestId.value = requestId
  billingInvoicesLoading.value = true

  try {
    const { invoices, pagination } = await getInvoices({
      page: billingInvoicesPage.value,
      limit: billingInvoicesPageSize,
      medicalRecordId: recordId,
    })

    if (activeInvoiceRequestId.value !== requestId) {
      return
    }

    billingInvoicesPagination.value = pagination
    billingInvoices.value = invoices.map(mapInvoiceSummaryToBillingInvoice)
  } catch (error) {
    if (activeInvoiceRequestId.value !== requestId) {
      return
    }

    const message = error instanceof ApiError ? error.message : 'Unable to load invoices.'
    toast.error(message)
    resetInvoicesState()
  } finally {
    if (activeInvoiceRequestId.value === requestId) {
      billingInvoicesLoading.value = false
    }
  }
}

watch(
  () => ({ recordId: selectedRecordId.value, page: billingInvoicesPage.value }),
  async ({ recordId }) => {
    if (!recordId) {
      billingInvoicesLoading.value = false
      resetInvoicesState()
      return
    }

    await loadInvoices()
  },
)

watch(selectedRecord, (record) => {
  if (!record) {
    if (paymentDialogOpen.value) {
      handlePaymentDialogOpenChange(false)
    }
    if (invoiceDetailDialogOpen.value) {
      handleInvoiceDialogOpenChange(false)
    }
    if (cancelInvoiceDialogOpen.value) {
      handleCancelInvoiceDialogOpenChange(false)
    }
    return
  }

  if (paymentDialogRecord.value && paymentDialogRecord.value.id === record.id) {
    paymentDialogRecord.value = record
  }

  if (invoiceDetailDialogOpen.value) {
    if (
      invoiceDetailDialogRecordId.value !== null &&
      invoiceDetailDialogRecordId.value !== record.id
    ) {
      handleInvoiceDialogOpenChange(false)
      return
    }

    if (invoiceDetailDialogRecord.value && invoiceDetailDialogRecord.value.id === record.id) {
      invoiceDetailDialogRecord.value = record
    }
  }

  if (cancelInvoiceDialogOpen.value) {
    const targetInvoice = cancelInvoiceDialogInvoice.value
    if (!targetInvoice || targetInvoice.medicalRecordId !== record.id) {
      handleCancelInvoiceDialogOpenChange(false)
    }
  }
})

watch(user, (account) => {
  if (paymentDialogOpen.value) {
    return
  }

  paymentDialogForm.creatorName = account?.hoTen ?? ''
})

watch(
  () => paymentDialogForm.amountReceived,
  (value) => {
    const formatted = formatAmountInputValue(value)
    if (formatted !== value) {
      paymentDialogForm.amountReceived = formatted
    }
  },
)

const handleRecordSelect = (recordId: number) => {
  if (recordsLoading.value) {
    return
  }

  if (selectedRecordId.value === recordId) {
    return
  }

  billingInvoicesPage.value = 1
  selectedRecordId.value = recordId
}

const handleInvoicePageChange = (page: number) => {
  if (billingInvoicesLoading.value || page === billingInvoicesPage.value) {
    return
  }

  billingInvoicesPage.value = page
}

const nextOutstandingRequestId = () => {
  activeOutstandingRequestId.value += 1
  return activeOutstandingRequestId.value
}

const nextInvoiceDetailRequestId = () => {
  activeInvoiceDetailRequestId.value += 1
  return activeInvoiceDetailRequestId.value
}

const loadOutstandingServices = async (recordId: number) => {
  const requestId = nextOutstandingRequestId()
  paymentDialogLoading.value = true
  paymentDialogServices.value = []

  try {
    const { serviceOrders } = await getServiceOrders({
      medicalRecordId: recordId,
      limit: SERVICE_ORDER_FETCH_LIMIT,
    })

    if (activeOutstandingRequestId.value !== requestId) {
      return
    }

    const detailResults = await Promise.all(
      serviceOrders.map(async (order) => {
        try {
          const { serviceOrderDetails } = await getServiceOrderDetails(order.id)

          return serviceOrderDetails
            .filter((detail) => !detail.isPaid)
            .map<OutstandingServiceItem>((detail) => {
              const totalAmount = toAmount(detail.amount)
              const quantity = detail.quantity
              const divisor = quantity > 0 ? quantity : 1
              const unitPrice = divisor > 0 ? totalAmount / divisor : totalAmount

              return {
                id: detail.id,
                serviceName: detail.service.name,
                quantity,
                unitPrice,
                totalAmount,
                serviceOrderCode: detail.serviceOrderCode,
              }
            })
        } catch (error) {
          console.error('Unable to load service order details', order.id, error)
          return [] as OutstandingServiceItem[]
        }
      }),
    )

    if (activeOutstandingRequestId.value !== requestId) {
      return
    }

    const unpaidServices = detailResults.flat()
    unpaidServices.sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    paymentDialogServices.value = unpaidServices
  } catch (error) {
    if (activeOutstandingRequestId.value !== requestId) {
      return
    }

    const message = error instanceof ApiError ? error.message : 'Unable to load unpaid services.'
    toast.error(message)
    paymentDialogServices.value = []
  } finally {
    if (activeOutstandingRequestId.value === requestId) {
      paymentDialogLoading.value = false
    }
  }
}

const initializePaymentDialog = (record: BillingRecord) => {
  paymentDialogRecord.value = record
  paymentDialogForm.invoiceDate = formatDateTimeLocal(new Date())
  paymentDialogForm.creatorName = user.value?.hoTen ?? ''
  paymentDialogForm.amountReceived = ''
  paymentDialogServices.value = []
  paymentDialogLoading.value = true
  paymentDialogSubmitting.value = false
}

const loadInvoiceDetails = async (invoiceId: number) => {
  const requestId = nextInvoiceDetailRequestId()
  invoiceDetailDialogLoading.value = true
  invoiceDetailDialogDetails.value = []

  try {
    const { invoice, details } = await getInvoiceDetails(invoiceId)

    if (activeInvoiceDetailRequestId.value !== requestId) {
      return
    }

    invoiceDetailDialogInvoice.value = mapInvoiceSummaryToBillingInvoice(invoice)
    invoiceDetailDialogDetails.value = details
  } catch (error) {
    if (activeInvoiceDetailRequestId.value !== requestId) {
      return
    }

    const message = error instanceof ApiError ? error.message : 'Unable to load invoice details.'
    toast.error(message)
    invoiceDetailDialogDetails.value = []
  } finally {
    if (activeInvoiceDetailRequestId.value === requestId) {
      invoiceDetailDialogLoading.value = false
    }
  }
}

const openInvoiceDetailDialog = async (invoice: BillingInvoice) => {
  const record = selectedRecord.value
  invoiceDetailDialogRecord.value = record
  invoiceDetailDialogRecordId.value = record?.id ?? null
  invoiceDetailDialogInvoice.value = invoice
  invoiceDetailDialogDetails.value = []
  invoiceDetailDialogLoading.value = true
  invoiceDetailDialogOpen.value = true
  await loadInvoiceDetails(invoice.id)
}

const handleInvoiceDialogOpenChange = (value: boolean) => {
  invoiceDetailDialogOpen.value = value

  if (!value) {
    nextInvoiceDetailRequestId()
    invoiceDetailDialogLoading.value = false
    invoiceDetailDialogInvoice.value = null
    invoiceDetailDialogDetails.value = []
    invoiceDetailDialogRecord.value = null
    invoiceDetailDialogRecordId.value = null
  }
}

const handleInvoiceDialogCancel = () => {
  handleInvoiceDialogOpenChange(false)
}

const handleCancelInvoiceDialogOpenChange = (value: boolean) => {
  cancelInvoiceDialogOpen.value = value

  if (!value) {
    cancelInvoiceDialogInvoice.value = null
    cancelInvoiceDialogSubmitting.value = false
  }
}

const handleRequestCancelInvoice = (invoice: BillingInvoice) => {
  if (billingInvoicesLoading.value || invoice.isCancelled) {
    return
  }

  cancelInvoiceDialogInvoice.value = invoice
  cancelInvoiceDialogOpen.value = true
}

const handleConfirmCancelInvoice = async () => {
  if (cancelInvoiceDialogSubmitting.value) {
    return
  }

  const invoice = cancelInvoiceDialogInvoice.value

  if (!invoice) {
    toast.error('No invoice selected to cancel.')
    return
  }

  cancelInvoiceDialogSubmitting.value = true

  try {
    const updatedInvoice = await cancelInvoice(invoice.id)
    const targetRecordId = updatedInvoice.medicalRecordId

    toast.success(`Invoice ${updatedInvoice.code} cancelled successfully.`)

    handleCancelInvoiceDialogOpenChange(false)

    await loadBillingRecords()

    if (targetRecordId) {
      selectedRecordId.value = targetRecordId
    }

    await loadInvoices()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Unable to cancel the invoice.'
    toast.error(message)
  } finally {
    cancelInvoiceDialogSubmitting.value = false
  }
}

const handlePaymentDialogOpenChange = (value: boolean) => {
  paymentDialogOpen.value = value

  if (!value) {
    nextOutstandingRequestId()
    paymentDialogRecord.value = null
    paymentDialogServices.value = []
    paymentDialogLoading.value = false
    paymentDialogSubmitting.value = false
    paymentDialogForm.invoiceDate = ''
    paymentDialogForm.creatorName = user.value?.hoTen ?? ''
    paymentDialogForm.amountReceived = ''
  }
}

const handlePaymentDialogCancel = () => {
  handlePaymentDialogOpenChange(false)
}

const handlePaymentDialogConfirm = async () => {
  if (paymentDialogLoading.value || paymentDialogSubmitting.value) {
    return
  }

  const record = paymentDialogRecord.value

  if (!record) {
    toast.error('No medical record selected for payment.')
    return
  }

  if (!user.value) {
    toast.error('You must be signed in to record a payment.')
    return
  }

  if (paymentDialogServices.value.length === 0) {
    toast.error('No unpaid services available to settle.')
    return
  }

  const invoiceDateRaw = paymentDialogForm.invoiceDate.trim()

  if (!invoiceDateRaw) {
    toast.error('Invoice date is required.')
    return
  }

  const invoiceDate = new Date(invoiceDateRaw)

  if (Number.isNaN(invoiceDate.getTime())) {
    toast.error('Invoice date is invalid.')
    return
  }

  const serviceDetailIds = paymentDialogServices.value.map((service) => service.id)

  if (serviceDetailIds.length === 0) {
    toast.error('No unpaid services available to settle.')
    return
  }

  const summary = paymentSummary.value
  const totalAmount = summary.total
  const receivedAmount = summary.received

  if (receivedAmount < totalAmount) {
    toast.error('Received amount is not enough to cover the total.')
    return
  }

  paymentDialogSubmitting.value = true

  try {
    const { payment } = await settleInvoice({
      medicalRecordId: record.id,
      employeeId: user.value.id,
      invoiceDate: invoiceDate.toISOString(),
      amountReceived: receivedAmount,
      serviceDetailIds,
    })

    const successMessage =
      payment.change > 0
        ? `Payment recorded successfully. Change due: ${formatCurrency(payment.change)}.`
        : 'Payment recorded successfully.'

    toast.success(successMessage)

    handlePaymentDialogOpenChange(false)

    await loadBillingRecords()

    if (selectedRecordId.value !== record.id) {
      selectedRecordId.value = record.id
    }

    await loadInvoices()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Unable to complete the payment.'
    toast.error(message)
  } finally {
    paymentDialogSubmitting.value = false
  }
}

const openPaymentDialogForRecord = async (record: BillingRecord) => {
  initializePaymentDialog(record)
  paymentDialogOpen.value = true
  await loadOutstandingServices(record.id)
}

const handleRecordDoubleClick = async (record: BillingRecord) => {
  if (recordsLoading.value) {
    return
  }

  handleRecordSelect(record.id)
  await openPaymentDialogForRecord(record)
}

const handleInvoiceDoubleClick = async (invoice: BillingInvoice) => {
  if (billingInvoicesLoading.value) {
    return
  }

  await openInvoiceDetailDialog(invoice)
}

const recordsSummary = computed(() => {
  if (recordsLoading.value) {
    return ''
  }

  const pagination = billingPagination.value

  if (!pagination) {
    const filtered = filteredRecords.value.length
    if (filtered === 0) {
      return 'No billing records found.'
    }

    return `Showing ${filtered} billing records.`
  }

  if (pagination.total === 0) {
    return 'No billing records found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const filtered = filteredRecords.value.length

  if (filtered === 0) {
    return `No billing records match the selected filters on this page (records ${start}-${end} of ${pagination.total}).`
  }

  return `Showing ${filtered} of ${pagination.total} billing records (records ${start}-${end}).`
})

const invoicesSummary = computed(() => {
  if (billingInvoicesLoading.value || !selectedRecordId.value) {
    return ''
  }

  const pagination = billingInvoicesPagination.value

  if (!pagination) {
    const total = billingInvoices.value.length
    if (total === 0) {
      return 'No invoices available for the selected medical record.'
    }

    return `Showing ${total} invoices.`
  }

  if (pagination.total === 0) {
    return 'No invoices available for the selected medical record.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const totalOnPage = billingInvoices.value.length

  if (totalOnPage === 0) {
    return `No invoices match the selected filters on this page (invoices ${start}-${end} of ${pagination.total}).`
  }

  return `Showing ${totalOnPage} of ${pagination.total} invoices (invoices ${start}-${end}).`
})

const paymentSummary = computed(() => {
  const total = paymentDialogServices.value.reduce((sum, service) => {
    return sum + service.totalAmount
  }, 0)
  const received = parseAmountInput(paymentDialogForm.amountReceived)
  const difference = received - total

  return {
    total,
    received,
    change: difference > 0 ? difference : 0,
    shortfall: difference < 0 ? Math.abs(difference) : 0,
  }
})

const invoiceDetailTotals = computed(() => {
  const invoiceTotal = invoiceDetailDialogInvoice.value?.amount ?? 0
  const detailsTotal = invoiceDetailDialogDetails.value.reduce((sum, detail) => {
    return sum + detail.totalAmount
  }, 0)

  return {
    invoiceTotal,
    detailsTotal,
    difference: invoiceTotal - detailsTotal,
  }
})

const canConfirmPayment = computed(() => {
  if (paymentDialogLoading.value || paymentDialogSubmitting.value) {
    return false
  }

  if (!paymentDialogRecord.value) {
    return false
  }

  if (paymentDialogServices.value.length === 0) {
    return false
  }

  if (paymentSummary.value.total <= 0) {
    return false
  }

  if (paymentSummary.value.shortfall > 0) {
    return false
  }

  return true
})

const applyFilters = async () => {
  const fromDate = resolveDateValue(recordsFromRaw.value)
  const toDate = resolveDateValue(recordsToRaw.value)

  appliedFilters.value = {
    medicalRecordCode: filters.medicalRecordCode.trim(),
    patientCode: filters.patientCode.trim(),
    paymentStatus: filters.paymentStatus,
    from: fromDate ? startOfDay(fromDate) : null,
    to: toDate ? endOfDay(toDate) : null,
  }
  billingPage.value = 1
  await loadBillingRecords()
}

const handleFiltersSearch = async () => {
  await applyFilters()
}

const handleFiltersReset = async () => {
  filters.medicalRecordCode = ''
  filters.patientCode = ''
  filters.paymentStatus = 'all'
  recordsFromRaw.value = undefined
  recordsToRaw.value = undefined

  appliedFilters.value = {
    medicalRecordCode: '',
    patientCode: '',
    paymentStatus: 'all',
    from: null,
    to: null,
  }
  billingPage.value = 1
  await loadBillingRecords()
}

const handlePageChange = async (page: number) => {
  if (recordsLoading.value || page === billingPage.value) {
    return
  }

  billingPage.value = page
  await loadBillingRecords()
}

const handlePageSizeChange = async (value: AcceptableValue) => {
  if (value === null || typeof value === 'boolean') {
    return
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed === billingPageSize.value) {
    return
  }

  billingPageSize.value = parsed
  billingPage.value = 1
  await loadBillingRecords()
}

onMounted(async () => {
  await loadBillingRecords()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="space-y-6 mx-auto max-w-7xl px-4">
      <Card>
        <CardContent>
          <BillingFilters
            :medical-record-code="filters.medicalRecordCode"
            :patient-code="filters.patientCode"
            :payment-status="filters.paymentStatus"
            :is-loading="recordsLoading"
            :from-date="recordsFromModel"
            :to-date="recordsToModel"
            :from-label="recordsFromLabel"
            :to-label="recordsToLabel"
            :has-from-date="recordsHasFromDate"
            :has-to-date="recordsHasToDate"
            :records-page-size="billingPageSize"
            :page-size-options="billingPageSizeOptions"
            @update:medical-record-code="filters.medicalRecordCode = $event"
            @update:patient-code="filters.patientCode = $event"
            @update:payment-status="filters.paymentStatus = $event"
            @update:from="setRecordsFrom($event as DateValue | undefined)"
            @update:to="setRecordsTo($event as DateValue | undefined)"
            @update:page-size="handlePageSizeChange"
            @search="handleFiltersSearch"
            @reset="handleFiltersReset"
          />
        </CardContent>
      </Card>
      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patients List</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <BillingTable
              :records="filteredRecords"
              :is-loading="recordsLoading"
              :pagination="billingPagination"
              :current-page="billingPage"
              :records-summary="recordsSummary"
              :selected-record-id="selectedRecordId"
              @page-change="handlePageChange"
              @select="handleRecordSelect"
              @row-dblclick="handleRecordDoubleClick"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Paid Invoices
              <span v-if="selectedRecord" class="ml-2 text-sm font-normal text-muted-foreground">
                · {{ selectedRecord.medicalRecordCode }}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BillingInvoicesTable
              :invoices="billingInvoices"
              :is-loading="billingInvoicesLoading"
              :pagination="billingInvoicesPagination"
              :current-page="billingInvoicesPage"
              :summary="invoicesSummary"
              :has-selection="Boolean(selectedRecord)"
              @page-change="handleInvoicePageChange"
              @row-dblclick="handleInvoiceDoubleClick"
              @cancel="handleRequestCancelInvoice"
            />
          </CardContent>
        </Card>
      </div>
    </div>

    <Dialog :open="paymentDialogOpen" @update:open="handlePaymentDialogOpenChange">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Outstanding Services</DialogTitle>
          <DialogDescription v-if="paymentDialogRecord">
            Review unpaid services for {{ paymentDialogRecord.patientName }} (Record
            {{ paymentDialogRecord.medicalRecordCode }}).
          </DialogDescription>
          <DialogDescription v-else>No medical record selected.</DialogDescription>
        </DialogHeader>

        <div class="space-y-6">
          <div class="space-y-1 text-sm">
            <p class="font-semibold">
              {{ paymentDialogRecord?.patientName ?? 'Unknown patient' }}
            </p>
            <p v-if="paymentDialogRecord" class="text-muted-foreground">
              Patient ID {{ paymentDialogRecord.patientCode }} · Record
              {{ paymentDialogRecord.medicalRecordCode }}
            </p>
          </div>

          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-64">Service</TableHead>
                  <TableHead class="w-24 text-right">Quantity</TableHead>
                  <TableHead class="w-32 text-right">Unit Price</TableHead>
                  <TableHead class="w-32 text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="paymentDialogLoading">
                  <TableEmpty :colspan="4">Loading unpaid services...</TableEmpty>
                </template>
                <template v-else-if="paymentDialogServices.length === 0">
                  <TableEmpty :colspan="4">No unpaid services for this medical record.</TableEmpty>
                </template>
                <template v-else>
                  <TableRow v-for="service in paymentDialogServices" :key="service.id">
                    <TableCell>
                      <div class="flex flex-col">
                        <span class="font-medium">{{ service.serviceName }}</span>
                        <span class="text-xs text-muted-foreground">
                          Order {{ service.serviceOrderCode }}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell class="text-right">
                      {{ service.quantity }}
                    </TableCell>
                    <TableCell class="text-right">
                      {{ formatCurrency(service.unitPrice) }}
                    </TableCell>
                    <TableCell class="text-right">
                      {{ formatCurrency(service.totalAmount) }}
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="billing-invoice-date">Invoice Date</Label>
              <Input
                id="billing-invoice-date"
                type="datetime-local"
                v-model="paymentDialogForm.invoiceDate"
                disabled
              />
            </div>
            <div class="space-y-2">
              <Label for="billing-invoice-author">Issued By</Label>
              <Input id="billing-invoice-author" v-model="paymentDialogForm.creatorName" disabled />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Total Amount</span>
              <p class="text-lg font-semibold">{{ formatCurrency(paymentSummary.total) }}</p>
            </div>
            <div class="space-y-2">
              <Label for="billing-amount-received">Amount Received</Label>
              <Input
                id="billing-amount-received"
                type="text"
                inputmode="numeric"
                v-model="paymentDialogForm.amountReceived"
                placeholder="0"
              />
              <p v-if="paymentSummary.shortfall > 0" class="text-sm font-medium text-destructive">
                Remaining balance: {{ formatCurrency(paymentSummary.shortfall) }}
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Change</span>
              <p
                class="text-lg font-semibold"
                :class="paymentSummary.change > 0 ? 'text-emerald-600' : 'text-muted-foreground'"
              >
                {{ formatCurrency(paymentSummary.change) }}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="handlePaymentDialogCancel"
            class="hover:text-primary-foreground"
            >Cancel</Button
          >
          <Button :disabled="!canConfirmPayment" @click="handlePaymentDialogConfirm">
            {{ paymentDialogSubmitting ? 'Processing...' : 'Pay' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="invoiceDetailDialogOpen" @update:open="handleInvoiceDialogOpenChange">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
          <DialogDescription v-if="invoiceDetailDialogInvoice">
            Review services billed on invoice {{ invoiceDetailDialogInvoice.code }}.
          </DialogDescription>
          <DialogDescription v-else>Invoice information is not available.</DialogDescription>
        </DialogHeader>

        <div class="space-y-6">
          <div class="space-y-1 text-sm">
            <p class="font-semibold">
              {{ invoiceDetailDialogRecord?.patientName ?? 'Unknown patient' }}
            </p>
            <p v-if="invoiceDetailDialogRecord" class="text-muted-foreground">
              Patient ID {{ invoiceDetailDialogRecord.patientCode }} · Record
              {{ invoiceDetailDialogRecord.medicalRecordCode }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Invoice Code</span>
              <p class="text-base font-semibold">
                {{ invoiceDetailDialogInvoice?.code ?? '—' }}
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Status</span>
              <p
                class="text-base font-semibold"
                :class="
                  invoiceDetailDialogInvoice?.isCancelled ? 'text-destructive' : 'text-emerald-600'
                "
              >
                {{ resolveInvoiceStatusLabel(invoiceDetailDialogInvoice) }}
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Issued On</span>
              <p class="text-base">
                {{
                  invoiceDetailDialogInvoice
                    ? formatInvoiceDateTime(invoiceDetailDialogInvoice.paidAt)
                    : '—'
                }}
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Collector</span>
              <p class="text-base">
                {{ getInvoiceCollectorDisplay(invoiceDetailDialogInvoice) }}
              </p>
            </div>
          </div>

          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-64">Service</TableHead>
                  <TableHead class="w-24 text-right">Quantity</TableHead>
                  <TableHead class="w-32 text-right">Unit Price</TableHead>
                  <TableHead class="w-32 text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="invoiceDetailDialogLoading">
                  <TableEmpty :colspan="4">Loading invoice details...</TableEmpty>
                </template>
                <template v-else-if="invoiceDetailDialogDetails.length === 0">
                  <TableEmpty :colspan="4">No services recorded for this invoice.</TableEmpty>
                </template>
                <template v-else>
                  <TableRow v-for="detail in invoiceDetailDialogDetails" :key="detail.id">
                    <TableCell>
                      <div class="flex flex-col">
                        <span class="font-medium">{{ detail.serviceName }}</span>
                        <span class="text-xs text-muted-foreground">
                          {{ detail.serviceCode }}
                          <template v-if="detail.serviceOrderCode">
                            · Order {{ detail.serviceOrderCode }}
                          </template>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell class="text-right">
                      {{ detail.quantity }}
                    </TableCell>
                    <TableCell class="text-right">
                      {{ formatCurrency(detail.unitPrice) }}
                    </TableCell>
                    <TableCell class="text-right">
                      {{ formatCurrency(detail.totalAmount) }}
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Invoice Total</span>
              <p class="text-lg font-semibold">
                {{ formatCurrency(invoiceDetailTotals.invoiceTotal) }}
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Details Sum</span>
              <p class="text-lg font-semibold">
                {{ formatCurrency(invoiceDetailTotals.detailsTotal) }}
              </p>
            </div>
            <div v-if="Math.abs(invoiceDetailTotals.difference) >= 1" class="space-y-1">
              <span class="text-sm font-medium text-muted-foreground">Difference</span>
              <p class="text-lg font-semibold text-destructive">
                {{ formatCurrency(invoiceDetailTotals.difference) }}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="handleInvoiceDialogCancel">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="cancelInvoiceDialogOpen" @update:open="handleCancelInvoiceDialogOpenChange">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark all services on
            <span class="font-medium">{{
              cancelInvoiceDialogInvoice?.code ?? 'this invoice'
            }}</span>
            as unpaid and revert related orders to pending payment status.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="cancelInvoiceDialogSubmitting"
            class="hover:text-primary-foreground"
          >
            Keep invoice
          </AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="cancelInvoiceDialogSubmitting"
            @click="handleConfirmCancelInvoice"
          >
            {{ cancelInvoiceDialogSubmitting ? 'Cancelling...' : 'Cancel invoice' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
