<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { DateValue } from 'reka-ui'
import { parseDate } from '@internationalized/date'
import { CalendarIcon, Loader2, SearchIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Table,
  TableBody,
  TableCell,
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
import { useFormatting } from '@/pages/medicalExamination/composables/useFormatting'
import { useStatusHelpers } from '@/pages/medicalExamination/composables/useStatusHelpers'
import {
  getServiceOrderDetails,
  getServiceOrders,
  updateServiceOrder,
  type ServiceOrderDetailSummary,
  type ServiceOrderSummary,
} from '@/services/serviceOrder'
import { getMedicalRecords, type MedicalRecordSummary } from '@/services/medicalRecord'
import { getResults, type ResultSummary } from '@/services/result'

type StatusFilter = 'active' | 'completed'

interface LaboratoryOrderRow {
  id: number
  code: string
  status: number
  medicalRecordId: number
  medicalRecordCode: string
  patientCode: string
  patientName: string
  patientBirthDate: string | null
  patientDepartment: string
  patientRoom: string
  orderedAt: string
  orderedBy: string
}

interface LaboratoryDetailRow {
  id: number
  serviceId: number
  serviceCode: string
  serviceName: string
  referenceValue: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

const { formatDate, formatDateTime, getDefaultFromDate, parseDateInput, startOfDay, endOfDay } =
  useFormatting()

const { getServiceOrderStatusClass, getServiceOrderStatusLabel } = useStatusHelpers()

const today = getDefaultFromDate()

const filters = reactive({
  from: today,
  to: today,
  status: 'active' as StatusFilter,
  page: 1,
  limit: PAGE_SIZE_OPTIONS[0] as PageSizeOption,
})

const appliedFilters = reactive({
  // Tracks the filter values used for data fetching; updated explicitly via search/reset actions.
  from: filters.from,
  to: filters.to,
  status: filters.status,
  page: filters.page,
  limit: filters.limit,
})

const fromDatePopoverOpen = ref(false)
const toDatePopoverOpen = ref(false)
const fromCalendarValue = ref<DateValue | undefined>(undefined)
const toCalendarValue = ref<DateValue | undefined>(undefined)

const orders = ref<LaboratoryOrderRow[]>([])
const ordersLoading = ref(false)
const ordersError = ref<string | null>(null)
const ordersTotalPages = ref(1)
const ordersTotalItems = ref(0)
const ordersLoadToken = ref(0)

const orderDetailsCache = ref<Record<number, LaboratoryDetailRow[]>>({})
const orderDetailResultsCache = ref<Record<number, Record<number, string>>>({})

const medicalRecordCache = ref<Record<number, MedicalRecordSummary>>({})

const selectedOrderId = ref<number | null>(null)
const resultsLoading = ref(false)
const resultsError = ref<string | null>(null)
const resultDrafts = ref<Record<number, string>>({})
const statusUpdating = ref(false)

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
]

const isPageSizeOption = (value: number): value is PageSizeOption => {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption)
}

const pageSizeModel = computed({
  get: () => String(filters.limit),
  set: (value: string | number | boolean) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || !isPageSizeOption(parsed)) {
      return
    }

    if (filters.limit !== parsed) {
      filters.limit = parsed
      filters.page = 1
      appliedFilters.limit = parsed
      appliedFilters.page = 1
    }
  },
})

const fromDateLabel = computed(() => {
  return filters.from ? formatDate(filters.from) : 'Select date'
})

const toDateLabel = computed(() => {
  return filters.to ? formatDate(filters.to) : 'Select date'
})

const toCalendarValueFromString = (value: string | null | undefined): DateValue | undefined => {
  if (!value) {
    return undefined
  }

  try {
    return parseDate(value) as unknown as DateValue
  } catch {
    return undefined
  }
}

const fromCalendarBinding = computed<DateValue | undefined>(() => {
  const value = fromCalendarValue.value
  return value ? (value as unknown as DateValue) : undefined
})

const toCalendarBinding = computed<DateValue | undefined>(() => {
  const value = toCalendarValue.value
  return value ? (value as unknown as DateValue) : undefined
})

const handleFromDateSelect = (value: DateValue | undefined) => {
  if (!value) {
    fromCalendarValue.value = undefined
    return
  }

  fromCalendarValue.value = value
  filters.from = value.toString()
  fromDatePopoverOpen.value = false
}

const handleToDateSelect = (value: DateValue | undefined) => {
  if (!value) {
    toCalendarValue.value = undefined
    return
  }

  toCalendarValue.value = value
  filters.to = value.toString()
  toDatePopoverOpen.value = false
}

watch(
  () => filters.from,
  (next) => {
    fromCalendarValue.value = toCalendarValueFromString(next)
  },
  { immediate: true },
)

watch(
  () => filters.to,
  (next) => {
    toCalendarValue.value = toCalendarValueFromString(next)
  },
  { immediate: true },
)

const selectedOrder = computed(() => {
  return orders.value.find((order) => order.id === selectedOrderId.value) ?? null
})

const selectedOrderDetails = computed(() => {
  if (!selectedOrderId.value) {
    return [] as LaboratoryDetailRow[]
  }

  return orderDetailsCache.value[selectedOrderId.value] ?? []
})

const selectedOrderStatusLabel = computed(() => {
  if (!selectedOrder.value) {
    return null
  }

  return {
    label: getServiceOrderStatusLabel(selectedOrder.value.status),
    class: getServiceOrderStatusClass(selectedOrder.value.status),
  }
})

const isReceiveDisabled = computed(() => {
  if (statusUpdating.value) {
    return true
  }

  return !selectedOrder.value || selectedOrder.value.status !== 1
})

const shouldShowCancelReceive = computed(() => {
  return selectedOrder.value?.status === 2
})

const isCancelReceiveDisabled = computed(() => {
  if (statusUpdating.value) {
    return true
  }

  return selectedOrder.value?.status !== 2
})

const normalizeDateRange = () => {
  const fromDate = parseDateInput(filters.from)
  const toDate = parseDateInput(filters.to)

  if (!fromDate && toDate) {
    filters.from = filters.to
    return
  }

  if (fromDate && !toDate) {
    filters.to = filters.from
    return
  }

  if (fromDate && toDate && fromDate > toDate) {
    filters.to = filters.from
  }
}

const matchesStatusFilter = (status: number, filter: StatusFilter): boolean => {
  switch (filter) {
    case 'completed':
      return status === 3
    case 'active':
    default:
      return status === 1 || status === 2
  }
}

const evaluateOrderAgainstFilters = (
  order: ServiceOrderSummary,
  rangeStart: Date | null,
  rangeEnd: Date | null,
  statusFilter: StatusFilter,
): { matches: boolean; beforeRange: boolean } => {
  const createdAt = new Date(order.createdAt)
  if (Number.isNaN(createdAt.getTime())) {
    return { matches: false, beforeRange: false }
  }

  if (rangeEnd && createdAt > rangeEnd) {
    return { matches: false, beforeRange: false }
  }

  if (rangeStart && createdAt < rangeStart) {
    return { matches: false, beforeRange: true }
  }

  if (!matchesStatusFilter(order.status, statusFilter)) {
    return { matches: false, beforeRange: false }
  }

  return { matches: true, beforeRange: false }
}

const ensureMedicalRecord = async (
  medicalRecordId: number,
  medicalRecordCode: string,
): Promise<MedicalRecordSummary | null> => {
  if (medicalRecordCache.value[medicalRecordId]) {
    return medicalRecordCache.value[medicalRecordId]
  }

  try {
    const { medicalRecords } = await getMedicalRecords({
      page: 1,
      limit: 1,
      search: medicalRecordCode,
    })

    const record =
      medicalRecords.find((item) => item.id === medicalRecordId) ?? medicalRecords[0] ?? null

    if (record) {
      medicalRecordCache.value[medicalRecordId] = record
    }

    return record ?? null
  } catch (error) {
    console.error('Failed to load medical record summary', error)
    return null
  }
}

const SERVICE_TYPE_CONSULTATION = 'công khám'
const SERVICE_TYPE_LABORATORY = 'xét nghiệm'

const getServiceTypeName = (detail: ServiceOrderDetailSummary): string => {
  const typeName =
    detail.service.type?.name ??
    detail.service.group?.type?.name ??
    detail.service.group?.name ??
    ''

  return typeName.trim().toLowerCase()
}

const isConsultationService = (detail: ServiceOrderDetailSummary): boolean => {
  return getServiceTypeName(detail) === SERVICE_TYPE_CONSULTATION
}

const isLaboratoryService = (detail: ServiceOrderDetailSummary): boolean => {
  return getServiceTypeName(detail) === SERVICE_TYPE_LABORATORY
}

const mapDetailRows = (details: ServiceOrderDetailSummary[]): LaboratoryDetailRow[] => {
  return details
    .filter((detail) => isLaboratoryService(detail))
    .map((detail) => ({
      id: detail.id,
      serviceId: detail.service.id,
      serviceCode: detail.service.code,
      serviceName: detail.service.name,
      referenceValue: null,
    }))
}

const shouldSkipServiceOrder = (details: ServiceOrderDetailSummary[]): boolean => {
  if (!details.length) {
    return false
  }

  return details.every((detail) => isConsultationService(detail))
}

const loadOrders = async () => {
  ordersLoadToken.value += 1
  const requestId = ordersLoadToken.value

  ordersLoading.value = true
  ordersError.value = null

  const pageSize = Math.max(appliedFilters.limit || PAGE_SIZE_OPTIONS[0], 1)
  const targetPage = Math.max(appliedFilters.page, 1)
  const targetStartIndex = (targetPage - 1) * pageSize
  const targetEndIndex = targetStartIndex + pageSize

  const fromDate = parseDateInput(appliedFilters.from)
  const toDate = parseDateInput(appliedFilters.to)
  const rangeStart = fromDate ? startOfDay(fromDate) : null
  const rangeEnd = toDate ? endOfDay(toDate) : null
  const statusFilter = appliedFilters.status

  const pageOrders: LaboratoryOrderRow[] = []
  const pageDetails: Record<number, LaboratoryDetailRow[]> = {}

  let matchedCount = 0
  let apiPage = 1
  let totalApiPages = 1
  const apiPageSize = Math.max(pageSize, 25)
  let stopDueToRange = false

  try {
    while (!stopDueToRange && apiPage <= totalApiPages) {
      const { serviceOrders, pagination } = await getServiceOrders({
        page: apiPage,
        limit: apiPageSize,
      })

      if (requestId !== ordersLoadToken.value) {
        return
      }

      totalApiPages = pagination.totalPages ?? totalApiPages

      if (!serviceOrders.length) {
        break
      }

      for (const order of serviceOrders) {
        const { matches, beforeRange } = evaluateOrderAgainstFilters(
          order,
          rangeStart,
          rangeEnd,
          statusFilter,
        )

        if (beforeRange) {
          stopDueToRange = true
          break
        }

        if (!matches) {
          continue
        }

        const { serviceOrderDetails } = await getServiceOrderDetails(order.id)
        if (requestId !== ordersLoadToken.value) {
          return
        }

        if (shouldSkipServiceOrder(serviceOrderDetails)) {
          continue
        }

        const detailRows = mapDetailRows(serviceOrderDetails)

        const currentIndex = matchedCount
        matchedCount += 1

        if (currentIndex >= targetStartIndex && currentIndex < targetEndIndex) {
          const medicalRecord = await ensureMedicalRecord(
            order.medicalRecordId,
            order.medicalRecordCode,
          )

          if (requestId !== ordersLoadToken.value) {
            return
          }

          const clinicRoom = medicalRecord?.clinicRoom
          const departmentName =
            clinicRoom?.department?.name ?? order.orderingStaff?.department?.name ?? '—'
          const roomName = clinicRoom?.name ?? '—'

          pageOrders.push({
            id: order.id,
            code: order.code,
            status: order.status,
            medicalRecordId: order.medicalRecordId,
            medicalRecordCode: order.medicalRecordCode,
            patientCode: medicalRecord?.patient.code ?? '—',
            patientName: medicalRecord?.patient.fullName ?? '—',
            patientBirthDate: medicalRecord?.patient.birthDate ?? null,
            patientDepartment: departmentName,
            patientRoom: roomName,
            orderedAt: order.createdAt,
            orderedBy: order.orderingStaff?.name ?? '—',
          })

          pageDetails[order.id] = detailRows
        }
      }

      apiPage += 1
    }

    if (requestId !== ordersLoadToken.value) {
      return
    }

    const totalPages = matchedCount > 0 ? Math.ceil(matchedCount / pageSize) : 1
    ordersTotalItems.value = matchedCount
    ordersTotalPages.value = Math.max(totalPages, 1)

    if (matchedCount > 0 && pageOrders.length === 0 && targetPage > ordersTotalPages.value) {
      appliedFilters.page = ordersTotalPages.value
      filters.page = ordersTotalPages.value
      return
    }

    if (matchedCount === 0 && appliedFilters.page !== 1) {
      appliedFilters.page = 1
    }

    pageOrders.sort((a, b) => {
      const first = new Date(b.orderedAt).getTime()
      const second = new Date(a.orderedAt).getTime()
      if (Number.isNaN(first) || Number.isNaN(second)) {
        return 0
      }
      return first - second
    })

    orders.value = pageOrders
    orderDetailsCache.value = pageDetails
    filters.page = Math.min(targetPage, ordersTotalPages.value)

    if (
      !selectedOrderId.value ||
      !orders.value.some((order) => order.id === selectedOrderId.value)
    ) {
      selectedOrderId.value = orders.value[0]?.id ?? null
    }
  } catch (error) {
    console.error('Failed to load laboratory orders', error)
    if (requestId === ordersLoadToken.value) {
      ordersError.value = 'Unable to load service orders. Please try again.'
      orders.value = []
      orderDetailsCache.value = {}
      ordersTotalItems.value = 0
      ordersTotalPages.value = 1
      selectedOrderId.value = null
    }
  } finally {
    if (requestId === ordersLoadToken.value) {
      ordersLoading.value = false
    }
  }
}

const loadResultsForOrder = async (orderId: number) => {
  resultsLoading.value = true
  resultsError.value = null
  resultDrafts.value = {}

  try {
    const { results } = await getResults({ serviceOrderId: orderId, limit: 100 })
    const resultMap: Record<number, ResultSummary> = {}
    for (const result of results) {
      resultMap[result.serviceOrderDetail.id] = result
    }

    const detailResults: Record<number, string> = {}

    for (const detail of selectedOrderDetails.value) {
      detailResults[detail.id] = resultMap[detail.id]?.result ?? ''
    }

    orderDetailResultsCache.value[orderId] = detailResults
    resultDrafts.value = { ...detailResults }
  } catch (error) {
    console.error('Failed to load laboratory results', error)
    resultsError.value = 'Unable to load laboratory results. Please try again.'
    orderDetailResultsCache.value[orderId] = {}
    resultDrafts.value = {}
  } finally {
    resultsLoading.value = false
  }
}

const applyOrderStatusUpdate = (orderId: number, status: number) => {
  orders.value = orders.value.map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
        }
      : order,
  )
}

const handlePageChange = (page: number) => {
  if (!Number.isFinite(page)) {
    return
  }

  const nextPage = Math.min(Math.max(Math.trunc(page), 1), ordersTotalPages.value)
  if (nextPage !== appliedFilters.page) {
    appliedFilters.page = nextPage
  }
  filters.page = nextPage
}

const handleSelectOrder = (orderId: number) => {
  selectedOrderId.value = orderId
}

const handleReceive = async () => {
  if (!selectedOrder.value || isReceiveDisabled.value) {
    return
  }

  statusUpdating.value = true

  try {
    const updated = await updateServiceOrder(selectedOrder.value.id, { status: 2 })
    applyOrderStatusUpdate(updated.id, updated.status)
    toast.success('Service order marked as In progress.')
  } catch (error) {
    console.error('Failed to update service order status', error)
    toast.error('Unable to mark the service order as In progress. Please try again.')
  } finally {
    statusUpdating.value = false
  }
}

const handleCancelReceive = async () => {
  if (!selectedOrder.value || isCancelReceiveDisabled.value) {
    return
  }

  statusUpdating.value = true

  try {
    const updated = await updateServiceOrder(selectedOrder.value.id, { status: 1 })
    applyOrderStatusUpdate(updated.id, updated.status)
    toast.success('Service order reverted to Pending.')
  } catch (error) {
    console.error('Failed to revert service order status', error)
    toast.error('Unable to revert the service order to Pending. Please try again.')
  } finally {
    statusUpdating.value = false
  }
}

const handleSearch = () => {
  normalizeDateRange()
  filters.page = 1
  appliedFilters.from = filters.from
  appliedFilters.to = filters.to
  appliedFilters.status = filters.status
  appliedFilters.limit = filters.limit
  appliedFilters.page = filters.page
}

const handleResetFilters = () => {
  const resetDate = getDefaultFromDate()
  filters.from = resetDate
  filters.to = resetDate
  filters.status = 'active'
  filters.limit = PAGE_SIZE_OPTIONS[0]
  filters.page = 1
  normalizeDateRange()
  appliedFilters.from = filters.from
  appliedFilters.to = filters.to
  appliedFilters.status = filters.status
  appliedFilters.limit = filters.limit
  appliedFilters.page = filters.page
}

watch(
  () => [filters.from, filters.to],
  () => {
    normalizeDateRange()
    filters.page = 1
  },
)

watch(
  () => [filters.status, filters.limit],
  () => {
    filters.page = 1
  },
)

watch(
  () => [
    appliedFilters.from,
    appliedFilters.to,
    appliedFilters.status,
    appliedFilters.page,
    appliedFilters.limit,
  ],
  () => {
    void loadOrders()
  },
  { immediate: true },
)

watch(selectedOrderId, (orderId) => {
  if (!orderId) {
    resultDrafts.value = {}
    resultsError.value = null
    return
  }

  const cached = orderDetailResultsCache.value[orderId]
  if (cached) {
    resultDrafts.value = { ...cached }
    return
  }

  void loadResultsForOrder(orderId)
})

onMounted(() => {
  normalizeDateRange()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="space-y-6 mx-auto max-w-7xl px-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Service Order Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <Field>
              <FieldLabel for="filter-from">From date</FieldLabel>
              <Popover v-model:open="fromDatePopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    id="filter-from"
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span :class="!filters.from ? 'text-muted-foreground' : ''">
                      {{ fromDateLabel }}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="fromCalendarBinding"
                    :max-value="toCalendarBinding"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="handleFromDateSelect"
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel for="filter-to">To date</FieldLabel>
              <Popover v-model:open="toDatePopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    id="filter-to"
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span :class="!filters.to ? 'text-muted-foreground' : ''">
                      {{ toDateLabel }}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="toCalendarBinding"
                    :min-value="fromCalendarBinding"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="handleToDateSelect"
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel>Status</FieldLabel>
              <RadioGroup v-model="filters.status" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <div
                  v-for="option in statusOptions"
                  :key="option.value"
                  class="flex items-center gap-2"
                >
                  <RadioGroupItem :id="`status-${option.value}`" :value="option.value" />
                  <Label :for="`status-${option.value}`" class="font-normal">
                    {{ option.label }}
                  </Label>
                </div>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel for="filter-page-size">Records per page</FieldLabel>
              <NativeSelect id="filter-page-size" v-model="pageSizeModel" class="w-full">
                <option v-for="option in PAGE_SIZE_OPTIONS" :key="option" :value="option">
                  {{ option }}
                </option>
              </NativeSelect>
            </Field>

            <div
              class="flex flex-wrap items-center justify-end gap-3 self-end sm:col-span-2 lg:col-span-2 xl:col-span-1"
            >
              <Button type="button" class="flex items-center" @click="handleSearch">
                <SearchIcon class="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button type="button" variant="outline" @click="handleResetFilters">Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
          <CardTitle class="text-base">Service Orders</CardTitle>
          <div v-if="selectedOrderStatusLabel" class="text-sm">
            <span class="text-muted-foreground mr-2">Selected status:</span>
            <span :class="selectedOrderStatusLabel.class">{{
              selectedOrderStatusLabel.label
            }}</span>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-if="ordersLoading"
            class="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading service orders…
          </div>
          <p v-else-if="ordersError" class="text-sm text-destructive">{{ ordersError }}</p>
          <p v-else-if="!orders.length" class="text-sm text-muted-foreground">
            No service orders match the current filters.
          </p>

          <div v-else class="space-y-4">
            <div class="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Order Code</TableHead>
                    <TableHead>Patient Code</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Birth Date</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Ordered At</TableHead>
                    <TableHead>Ordered By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="order in orders"
                    :key="order.id"
                    :class="[
                      'cursor-pointer hover:bg-muted/40',
                      selectedOrderId === order.id ? 'bg-muted/60' : '',
                    ]"
                    @click="handleSelectOrder(order.id)"
                  >
                    <TableCell>
                      <span :class="getServiceOrderStatusClass(order.status)">
                        {{ getServiceOrderStatusLabel(order.status) }}
                      </span>
                    </TableCell>
                    <TableCell class="font-medium">{{ order.code }}</TableCell>
                    <TableCell>{{ order.patientCode }}</TableCell>
                    <TableCell>{{ order.patientName }}</TableCell>
                    <TableCell>{{ formatDate(order.patientBirthDate) }}</TableCell>
                    <TableCell>{{ order.patientDepartment }}</TableCell>
                    <TableCell>{{ order.patientRoom }}</TableCell>
                    <TableCell>{{ formatDateTime(order.orderedAt) }}</TableCell>
                    <TableCell>{{ order.orderedBy }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Pagination
              :page="filters.page"
              :items-per-page="filters.limit"
              :total="ordersTotalItems"
              @update:page="handlePageChange"
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
                    :is-active="item.value === filters.page"
                  >
                    {{ item.value }}
                  </PaginationItem>
                  <PaginationEllipsis v-else />
                </template>
                <PaginationNext />
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Order Results</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-if="resultsLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading order results…
          </div>
          <p v-else-if="resultsError" class="text-sm text-destructive">{{ resultsError }}</p>
          <p v-else-if="!selectedOrder" class="text-sm text-muted-foreground">
            Select a service order above to view and enter results.
          </p>
          <p v-else-if="!selectedOrderDetails.length" class="text-sm text-muted-foreground">
            This service order does not contain any laboratory services.
          </p>
          <div v-else class="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Code</TableHead>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="detail in selectedOrderDetails" :key="detail.id">
                  <TableCell class="font-medium">{{ detail.serviceCode }}</TableCell>
                  <TableCell>{{ detail.serviceName }}</TableCell>
                  <TableCell class="w-60">
                    <Input
                      type="text"
                      :model-value="resultDrafts[detail.id] ?? ''"
                      placeholder="Enter result"
                      @update:model-value="(value) => (resultDrafts[detail.id] = String(value))"
                    />
                  </TableCell>
                  <TableCell>{{ detail.referenceValue ?? '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end gap-3">
        <Button
          v-if="shouldShowCancelReceive"
          type="button"
          variant="outline"
          :disabled="isCancelReceiveDisabled"
          @click="handleCancelReceive"
        >
          Cancel Receive
        </Button>
        <Button type="button" :disabled="isReceiveDisabled" @click="handleReceive">
          Receive
        </Button>
      </div>
    </div>
  </section>
</template>
