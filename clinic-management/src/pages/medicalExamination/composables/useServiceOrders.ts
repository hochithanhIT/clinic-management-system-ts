import { computed, ref, watch, type ComputedRef } from 'vue'
import { toast } from 'vue-sonner'

import { ApiError } from '@/services/http'
import {
  getServiceOrders,
  getServiceOrderDetails,
  updateServiceOrder,
  deleteServiceOrder,
} from '@/services/serviceOrder'
import { getResults } from '@/services/result'
import type { MedicalRecordSummary, MedicalStaffSummary } from '@/services/medicalRecord'

import {
  type DiagnosticOrderSummaryRow,
  type DiagnosticResultRow,
  type DiagnosticServiceRow,
  type ServiceOrderCategory,
  type ServicesDialogInitialOrder,
  type ServicesDialogMode,
} from './serviceOrderTypes'

interface UseServiceOrdersOptions {
  selectedRecord: ComputedRef<MedicalRecordSummary | null>
  defaultOrderingStaffLabel: ComputedRef<string>
  formatStaffLabel: (
    staff: MedicalStaffSummary | null | undefined,
    emptyLabel?: string,
  ) => string
  resolveServiceOrderCategory: (
    typeName: string | null | undefined,
  ) => ServiceOrderCategory | null
}

const ORDER_EXECUTION_BLOCK_MESSAGE =
  'The service order has already been received or completed and cannot be updated or recalled.'

export const useServiceOrders = ({
  selectedRecord,
  defaultOrderingStaffLabel,
  formatStaffLabel,
  resolveServiceOrderCategory,
}: UseServiceOrdersOptions) => {
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

  const servicesDialogOpen = ref(false)
  const servicesDialogMode = ref<ServicesDialogMode>('create')
  const servicesDialogInitialOrder = ref<ServicesDialogInitialOrder | null>(null)
  const servicesDialogOrderId = ref<number | null>(null)
  const servicesDialogOrderCategory = ref<ServiceOrderCategory | null>(null)
  const serviceOrderActionLoadingId = ref<number | null>(null)

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
      servicesDialogMode.value = 'create'
      servicesDialogInitialOrder.value = null
      servicesDialogOrderId.value = null
      servicesDialogOrderCategory.value = null
    }
  })

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
              serviceTypeName,
              quantity,
              amount: totalAmount,
              unitPrice,
              executionRoomId: detail.service.executionRoom?.id ?? null,
              requireResult: detail.requireResult,
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
              serviceTypeName,
              quantity,
              amount: totalAmount,
              unitPrice,
              executionRoomId: detail.service.executionRoom?.id ?? null,
              requireResult: detail.requireResult,
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
            serviceTypeName,
            quantity,
            amount: totalAmount,
            unitPrice,
            executionRoomId: detail.service.executionRoom?.id ?? null,
            requireResult: detail.requireResult,
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
        selectedLaboratoryOrderId.value !== null && labSummaryMap.has(selectedLaboratoryOrderId.value),
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
        error instanceof ApiError
          ? error.message
          : 'Unable to load service orders. Please try again.'

      resetServiceOrderRows()
      setServiceOrderErrors(message)
      toast.error(message)
    } finally {
      if (requestId === serviceOrdersLoadToken.value) {
        setServiceOrdersLoading(false)
      }
    }
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
    return status === 0
  }

  const canDeleteServiceOrder = (status: number): boolean => {
    return status < 2
  }

  const isServiceOrderExecuting = (status: number): boolean => {
    return status >= 2
  }

  const resetServicesDialogContext = () => {
    servicesDialogMode.value = 'create'
    servicesDialogInitialOrder.value = null
    servicesDialogOrderId.value = null
    servicesDialogOrderCategory.value = null
  }

  const openServicesDialog = () => {
    resetServicesDialogContext()
    servicesDialogOpen.value = true
  }

  const openServicesDialogForOrder = (
    orderId: number,
    category: ServiceOrderCategory,
  ) => {
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
        serviceTypeName: detail.serviceTypeName,
        price: detail.unitPrice,
        quantity: detail.quantity,
        executionRoomId: detail.executionRoomId,
        requireResult: detail.requireResult,
        hasResult: detail.hasResult,
      })),
    }

    servicesDialogOpen.value = true
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
    await handleServiceOrderStatusChange(
      orderId,
      1,
      'Service order has been sent and is awaiting reception.',
    )
  }

  const handleCancelServiceOrder = async (orderId: number) => {
    await handleServiceOrderStatusChange(
      orderId,
      0,
      'Service order has been moved back to the pending state.',
    )
  }

  const deleteServiceOrderById = async (orderId: number): Promise<boolean> => {
    serviceOrderActionLoadingId.value = orderId

    try {
      await deleteServiceOrder(orderId)
      toast.success('Service order deleted.')
      await loadServiceOrders()
      return true
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message
            ? error.message
            : 'Unable to delete the service order. Please try again.'
      toast.error(message)
      return false
    } finally {
      serviceOrderActionLoadingId.value = null
    }
  }

  const requestCancelServiceOrder = (order: DiagnosticOrderSummaryRow) => {
    if (isServiceOrderExecuting(order.status)) {
      toast.error(ORDER_EXECUTION_BLOCK_MESSAGE)
      return
    }

    if (!canCancelServiceOrder(order.status)) {
      if (order.status === 0) {
        toast.info('The service order has not been sent yet, so there is nothing to recall.')
      } else {
        toast.info('The service order is no longer pending and cannot be recalled.')
      }
      return
    }

    void handleCancelServiceOrder(order.id)
  }

  const requestUpdateServiceOrder = (
    order: DiagnosticOrderSummaryRow,
    category: ServiceOrderCategory,
  ) => {
    if (isServiceOrderExecuting(order.status)) {
      toast.error(ORDER_EXECUTION_BLOCK_MESSAGE)
      return
    }

    if (!canUpdateServiceOrder(order.status)) {
      toast.info('Service orders can only be updated before they are sent.')
      return
    }

    openServicesDialogForOrder(order.id, category)
  }

  return {
    // state
    laboratoryOrderSummaries,
    laboratoryOrderDetailsByOrder,
    selectedLaboratoryOrderId,
    imagingOrderSummaries,
    imagingOrderDetailsByOrder,
    selectedImagingOrderId,
    procedureOrderSummaries,
    procedureOrderDetailsByOrder,
    selectedProcedureOrderId,
    laboratoryResultsByOrder,
    laboratoryResultsError,
    laboratoryResultsLoadingOrderId,
    imagingResultsByOrder,
    imagingResultsError,
    imagingResultsLoadingOrderId,
    procedureResultsByOrder,
    procedureResultsError,
    procedureResultsLoadingOrderId,
    serviceOrdersLoading,
    serviceOrderError,
    servicesDialogOpen,
    servicesDialogMode,
    servicesDialogInitialOrder,
    servicesDialogOrderId,
    servicesDialogOrderCategory,
    serviceOrderActionLoadingId,
    // computed
    laboratoryOrdersLoading,
    laboratoryOrdersError,
    imagingOrdersLoading,
    imagingOrdersError,
    procedureOrdersLoading,
    procedureOrdersError,
    selectedLaboratoryOrder,
    selectedLaboratoryOrderServices,
    selectedLaboratoryOrderResults,
    isLaboratoryResultsLoading,
    selectedImagingOrder,
    selectedImagingOrderServices,
    selectedImagingOrderResults,
    isImagingResultsLoading,
    selectedProcedureOrder,
    selectedProcedureOrderServices,
    selectedProcedureOrderResults,
    isProcedureResultsLoading,
    // actions
    resetServiceOrderRows,
    loadServiceOrders,
    openServicesDialog,
    openServicesDialogForOrder,
    requestCancelServiceOrder,
    requestUpdateServiceOrder,
    handleSendServiceOrder,
    handleCancelServiceOrder,
    handleServiceOrderStatusChange,
    isOrderActionInProgress,
    canSendServiceOrder,
    canCancelServiceOrder,
    canUpdateServiceOrder,
    canDeleteServiceOrder,
    isServiceOrderExecuting,
    deleteServiceOrderById,
  }
}
