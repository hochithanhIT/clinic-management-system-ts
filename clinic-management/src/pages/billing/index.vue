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
import { INVOICE_STATUS, getInvoices } from '@/services/invoice'
import type { PaginationMeta } from '@/services/types'
import type { AcceptableValue } from 'reka-ui'

const timeZone = getLocalTimeZone()

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
    billingInvoices.value = invoices.map((invoice) => ({
      id: invoice.id,
      code: invoice.code,
      amount: invoice.amount,
      paidAt: invoice.paidAt,
      collectorName: invoice.collector?.name ?? '',
      collectorCode: invoice.collector?.code ?? '',
      isCancelled: invoice.status === INVOICE_STATUS.cancelled,
    }))
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
            />
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>
