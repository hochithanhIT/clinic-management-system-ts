import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { DateValue } from 'reka-ui'
import { parseDate } from '@internationalized/date'
import { toast } from 'vue-sonner'

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
import { ApiError } from '@/services/http'
import { createResult, getResults, updateResult, type ResultSummary } from '@/services/result'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

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
  hasUnpaidServices: boolean
}

interface LaboratoryDetailRow {
  id: number
  serviceId: number
  serviceCode: string
  serviceName: string
  referenceValue: string | null
  isPaid: boolean
}

interface ResultDraft {
  resultId: number | null
  description: string
  conclusion: string
  note: string
  receivedAt: string
  performedAt: string
  deliveredAt: string
}

const SERVICE_TYPE_LABORATORY = 'xét nghiệm'

export const useLaboratoryPage = () => {
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
  const orderDetailResultsCache = ref<Record<number, Record<number, ResultDraft>>>({})

  const medicalRecordCache = ref<Record<number, MedicalRecordSummary>>({})

  const selectedOrderId = ref<number | null>(null)
  const resultsLoading = ref(false)
  const resultsError = ref<string | null>(null)
  const resultDrafts = ref<Record<number, ResultDraft>>({})
  const statusUpdating = ref(false)

  const resultDetailDialogOpen = ref(false)
  const resultDetailDialogTarget = ref<LaboratoryDetailRow | null>(null)
  const resultDetailForm = reactive({
    description: '',
    conclusion: '',
    note: '',
    receivedAt: '',
    performedAt: '',
    deliveredAt: '',
  })
  const resultDetailSaving = ref(false)

  const createTimestampDefaults = () => {
    const now = new Date().toISOString()
    return {
      receivedAt: now,
      performedAt: now,
      deliveredAt: now,
    }
  }

  const toDateTimeLocalInput = (value: string | null | undefined): string => {
    if (!value) {
      return ''
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return ''
    }

    const pad = (input: number) => input.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())

    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const fromDateTimeLocalInput = (value: string): string | null => {
    if (!value) {
      return null
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return null
    }

    return date.toISOString()
  }

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'active', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
  ]

  const createEmptyResultDraft = (): ResultDraft => ({
    resultId: null,
    description: '',
    conclusion: '',
    note: '',
    ...createTimestampDefaults(),
  })

  const cloneResultDraft = (draft: ResultDraft | undefined): ResultDraft => {
    const defaults = createTimestampDefaults()
    return {
      resultId: draft?.resultId ?? null,
      description: draft?.description ?? '',
      conclusion: draft?.conclusion ?? '',
      note: draft?.note ?? '',
      receivedAt: draft?.receivedAt ?? defaults.receivedAt,
      performedAt: draft?.performedAt ?? defaults.performedAt,
      deliveredAt: draft?.deliveredAt ?? defaults.deliveredAt,
    }
  }

  const cloneResultDraftMap = (input: Record<number, ResultDraft>): Record<number, ResultDraft> => {
    const clone: Record<number, ResultDraft> = {}
    for (const [key, value] of Object.entries(input)) {
      clone[Number(key)] = cloneResultDraft(value)
    }
    return clone
  }

  const updateCachedDraftForCurrentOrder = (detailId: number, draft: ResultDraft) => {
    const orderId = selectedOrderId.value
    if (orderId === null) {
      return
    }

    const existing = orderDetailResultsCache.value[orderId] ?? {}
    orderDetailResultsCache.value[orderId] = {
      ...existing,
      [detailId]: cloneResultDraft(draft),
    }
  }

  const setResultDraftForDetail = (detailId: number, draft: ResultDraft) => {
    resultDrafts.value[detailId] = cloneResultDraft(draft)
    updateCachedDraftForCurrentOrder(detailId, draft)
  }

  const updateResultDraftPartial = (detailId: number, partial: Partial<ResultDraft>) => {
    const base = resultDrafts.value[detailId] ?? createEmptyResultDraft()
    const next = { ...base, ...partial }
    setResultDraftForDetail(detailId, next)
  }

  const resetResultDetailForm = () => {
    resultDetailForm.description = ''
    resultDetailForm.conclusion = ''
    resultDetailForm.note = ''
    resultDetailForm.receivedAt = ''
    resultDetailForm.performedAt = ''
    resultDetailForm.deliveredAt = ''
  }

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

  const performerName = computed(() => selectedOrder.value?.orderedBy ?? '')

  const isReceiveDisabled = computed(() => {
    if (statusUpdating.value) {
      return true
    }

    return !selectedOrder.value || selectedOrder.value.status !== 1
  })

  const shouldShowCancelReceive = computed(() => {
    return selectedOrder.value?.status === 2
  })

  const hasSavedResultsForSelectedOrder = computed(() => {
    const drafts = resultDrafts.value
    return Object.values(drafts).some((draft) => draft?.resultId != null)
  })

  const isSelectedOrderCompleted = computed(() => {
    return selectedOrder.value?.status === 3
  })

  const areAllResultsCompletedForSelectedOrder = computed(() => {
    if (!selectedOrderDetails.value.length) {
      return false
    }

    return selectedOrderDetails.value.every((detail) => {
      const draft = resultDrafts.value[detail.id]
      return draft?.resultId != null
    })
  })

  const isCancelReceiveDisabled = computed(() => {
    if (statusUpdating.value) {
      return true
    }

    if (selectedOrder.value?.status !== 2) {
      return true
    }

    return hasSavedResultsForSelectedOrder.value
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

  const getServiceTypeName = (detail: ServiceOrderDetailSummary): string => {
    const typeName =
      detail.service.type?.name ??
      detail.service.group?.type?.name ??
      detail.service.group?.name ??
      ''

    return typeName.trim().toLowerCase()
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
        isPaid: detail.isPaid,
      }))
  }

  const shouldSkipServiceOrder = (details: ServiceOrderDetailSummary[]): boolean => {
    if (!details.length) {
      return true
    }

    const hasLaboratoryService = details.some((detail) => isLaboratoryService(detail))

    return !hasLaboratoryService
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
          const hasUnpaidServices = serviceOrderDetails.some(
            (detail) => isLaboratoryService(detail) && !detail.isPaid,
          )

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
              hasUnpaidServices,
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

      const detailDrafts: Record<number, ResultDraft> = {}

      for (const detail of selectedOrderDetails.value) {
        const existing = resultMap[detail.id]
        const defaults = createTimestampDefaults()
        detailDrafts[detail.id] = {
          resultId: existing?.id ?? null,
          description: existing?.result ?? '',
          conclusion: existing?.conclusion ?? '',
          note: existing?.note ?? '',
          receivedAt: existing?.receivedAt ?? defaults.receivedAt,
          performedAt: existing?.performedAt ?? defaults.performedAt,
          deliveredAt: existing?.deliveredAt ?? defaults.deliveredAt,
        }
      }

      orderDetailResultsCache.value[orderId] = cloneResultDraftMap(detailDrafts)
      resultDrafts.value = cloneResultDraftMap(detailDrafts)
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

    if (orderId === selectedOrderId.value && status === 3) {
      resultDetailDialogOpen.value = false
    }
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

  const handleResultDetailDoubleClick = (detail: LaboratoryDetailRow, event?: MouseEvent) => {
    if (!selectedOrder.value || selectedOrder.value.status === 1) {
      toast.warning('Please receive this service order before entering results.')
      return
    }

    if (selectedOrder.value.status === 3) {
      toast.warning('This service order is completed. Results are read-only.')
      return
    }

    if (event) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, button')) {
        return
      }
    }

    const draft = resultDrafts.value[detail.id] ?? createEmptyResultDraft()
    resultDetailDialogTarget.value = detail
    resultDetailForm.description = draft.description
    resultDetailForm.conclusion = draft.conclusion
    resultDetailForm.note = draft.note
    resultDetailForm.receivedAt = toDateTimeLocalInput(draft.receivedAt)
    resultDetailForm.performedAt = toDateTimeLocalInput(draft.performedAt)
    resultDetailForm.deliveredAt = toDateTimeLocalInput(draft.deliveredAt)

    if (!resultDetailDialogOpen.value) {
      resultDetailDialogOpen.value = true
    }
  }

  const handleResultDetailSave = async () => {
    if (!resultDetailDialogTarget.value) {
      resultDetailDialogOpen.value = false
      return
    }

    if (selectedOrder.value?.status === 3) {
      toast.warning('This service order is completed. Results cannot be modified.')
      resultDetailDialogOpen.value = false
      return
    }

    const detailId = resultDetailDialogTarget.value.id
    const description = resultDetailForm.description.trim()
    const conclusion = resultDetailForm.conclusion.trim()
    const note = resultDetailForm.note.trim()
    const receivedAtIso = fromDateTimeLocalInput(resultDetailForm.receivedAt)
    const performedAtIso = fromDateTimeLocalInput(resultDetailForm.performedAt)
    const deliveredAtIso = fromDateTimeLocalInput(resultDetailForm.deliveredAt)

    if (!description) {
      toast.error('Result description is required.')
      return
    }

    if (!conclusion) {
      toast.error('Conclusion is required.')
      return
    }

    if (!receivedAtIso) {
      toast.error('Received time is required.')
      return
    }

    if (!performedAtIso) {
      toast.error('Performed time is required.')
      return
    }

    if (!deliveredAtIso) {
      toast.error('Delivered time is required.')
      return
    }

    if (new Date(performedAtIso).getTime() < new Date(receivedAtIso).getTime()) {
      toast.error('Performed time cannot be earlier than received time.')
      return
    }

    if (new Date(deliveredAtIso).getTime() < new Date(performedAtIso).getTime()) {
      toast.error('Delivered time cannot be earlier than performed time.')
      return
    }

    if (resultDetailSaving.value) {
      return
    }

    const draft = resultDrafts.value[detailId] ?? createEmptyResultDraft()

    resultDetailSaving.value = true

    try {
      let saved: ResultSummary

      if (draft.resultId) {
        saved = await updateResult(draft.resultId, {
          result: description,
          conclusion,
          note,
          receivedAt: receivedAtIso,
          performedAt: performedAtIso,
          deliveredAt: deliveredAtIso,
        })
        toast.success('Result updated successfully.')
      } else {
        saved = await createResult({
          serviceOrderDetailId: detailId,
          receivedAt: receivedAtIso,
          performedAt: performedAtIso,
          deliveredAt: deliveredAtIso,
          result: description,
          conclusion,
          note,
        })
        toast.success('Result created successfully.')
      }

      const syncedDraft: ResultDraft = {
        resultId: saved.id,
        description: saved.result,
        conclusion: saved.conclusion,
        note: saved.note ?? '',
        receivedAt: saved.receivedAt,
        performedAt: saved.performedAt,
        deliveredAt: saved.deliveredAt,
      }

      setResultDraftForDetail(detailId, syncedDraft)

      resultDetailForm.description = syncedDraft.description
      resultDetailForm.conclusion = syncedDraft.conclusion
      resultDetailForm.note = syncedDraft.note
      resultDetailForm.receivedAt = toDateTimeLocalInput(syncedDraft.receivedAt)
      resultDetailForm.performedAt = toDateTimeLocalInput(syncedDraft.performedAt)
      resultDetailForm.deliveredAt = toDateTimeLocalInput(syncedDraft.deliveredAt)
      resultDetailDialogOpen.value = false
    } catch (error) {
      console.error('Failed to save laboratory result', error)
      const message =
        error instanceof ApiError ? error.message : 'Unable to save result. Please try again.'
      toast.error(message)
    } finally {
      resultDetailSaving.value = false
    }
  }

  const handleResultDetailCancel = () => {
    if (resultDetailSaving.value) {
      return
    }
    resultDetailDialogOpen.value = false
  }

  const handleReceive = async () => {
    if (!selectedOrder.value || isReceiveDisabled.value) {
      return
    }

    if (selectedOrder.value.hasUnpaidServices) {
      toast.warning(
        'This service order contains unpaid laboratory services. Please complete payment before receiving.',
      )
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
    if (!selectedOrder.value) {
      return
    }

    if (hasSavedResultsForSelectedOrder.value) {
      toast.warning('Results have already been recorded. Cancel receive is not allowed.')
      return
    }

    if (isCancelReceiveDisabled.value) {
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

  const shouldShowDeliverResults = computed(() => {
    return selectedOrder.value?.status === 2 && selectedOrderDetails.value.length > 0
  })

  const isDeliverResultsDisabled = computed(() => {
    if (statusUpdating.value) {
      return true
    }

    if (selectedOrder.value?.status !== 2) {
      return true
    }

    return !areAllResultsCompletedForSelectedOrder.value
  })

  const handleDeliverResults = async () => {
    if (!selectedOrder.value) {
      return
    }

    if (!areAllResultsCompletedForSelectedOrder.value) {
      toast.warning('Please complete all results before delivering.')
      return
    }

    if (isDeliverResultsDisabled.value) {
      return
    }

    statusUpdating.value = true

    try {
      const updated = await updateServiceOrder(selectedOrder.value.id, { status: 3 })
      applyOrderStatusUpdate(updated.id, updated.status)
      toast.success('Service order marked as Completed.')
    } catch (error) {
      console.error('Failed to mark service order as completed', error)
      toast.error('Unable to deliver results. Please try again.')
    } finally {
      statusUpdating.value = false
    }
  }

  const shouldShowCancelResults = computed(() => {
    return selectedOrder.value?.status === 3
  })

  const isCancelResultsDisabled = computed(() => {
    if (statusUpdating.value) {
      return true
    }

    return selectedOrder.value?.status !== 3
  })

  const handleCancelResults = async () => {
    if (!selectedOrder.value) {
      return
    }

    if (selectedOrder.value.status !== 3) {
      return
    }

    if (isCancelResultsDisabled.value) {
      return
    }

    statusUpdating.value = true

    try {
      const updated = await updateServiceOrder(selectedOrder.value.id, { status: 2 })
      applyOrderStatusUpdate(updated.id, updated.status)
      toast.success('Service order reverted to In progress.')
    } catch (error) {
      console.error('Failed to revert service order to In progress', error)
      toast.error('Unable to cancel delivered results. Please try again.')
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
    resultDetailDialogOpen.value = false
    resultDetailDialogTarget.value = null
    resetResultDetailForm()

    if (!orderId) {
      resultDrafts.value = {}
      resultsError.value = null
      return
    }

    const cached = orderDetailResultsCache.value[orderId]
    if (cached) {
      resultDrafts.value = cloneResultDraftMap(cached)
      return
    }

    void loadResultsForOrder(orderId)
  })

  watch(resultDetailDialogOpen, (isOpen) => {
    if (!isOpen) {
      resultDetailDialogTarget.value = null
      resetResultDetailForm()
      resultDetailSaving.value = false
    }
  })

  onMounted(() => {
    normalizeDateRange()
  })

  return {
    // state
    filters,
    fromDatePopoverOpen,
    toDatePopoverOpen,
    fromCalendarBinding,
    toCalendarBinding,
    fromDateLabel,
    toDateLabel,
    statusOptions,
    pageSizeModel,
    ordersLoading,
    ordersError,
    orders,
    ordersTotalItems,
    selectedOrderId,
    selectedOrder,
    selectedOrderDetails,
    selectedOrderStatusLabel,
    resultsLoading,
    resultsError,
    resultDrafts,
    resultDetailDialogOpen,
    resultDetailDialogTarget,
    resultDetailForm,
    resultDetailSaving,
    shouldShowCancelReceive,
    isCancelReceiveDisabled,
    isReceiveDisabled,
    shouldShowDeliverResults,
    isDeliverResultsDisabled,
    shouldShowCancelResults,
    isCancelResultsDisabled,
    hasSavedResultsForSelectedOrder,
    isSelectedOrderCompleted,
    areAllResultsCompletedForSelectedOrder,
    performerName,
    // helpers
    formatDate,
    formatDateTime,
    getServiceOrderStatusClass,
    getServiceOrderStatusLabel,
    updateResultDraftPartial,
    // handlers
    handleFromDateSelect,
    handleToDateSelect,
    handleSearch,
    handleResetFilters,
    handlePageChange,
    handleSelectOrder,
    handleResultDetailDoubleClick,
    handleResultDetailSave,
    handleResultDetailCancel,
    handleReceive,
    handleCancelReceive,
    handleDeliverResults,
    handleCancelResults,
  }
}
