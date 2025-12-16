<script setup lang="ts">
definePage({
  alias: '/catalog/service/',
  meta: {
    requiresAuth: true,
  },
})

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, PlusIcon, RotateCcw, SearchIcon } from 'lucide-vue-next'

import { ApiError } from '@/services/http'
import {
  getServiceTypes,
  getServiceGroups,
  getServices,
  createServiceType,
  createServiceGroup,
  createService,
  type ServiceTypeSummary,
  type ServiceGroupSummary,
  type ServiceSummary,
  updateServiceType,
  updateServiceGroup,
  updateService,
} from '@/services/serviceCatalog'
import { getRooms, type RoomSummary } from '@/services/room'
import type { PaginationMeta } from '@/services/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import ComboBox from '@/components/ComboBox.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const SERVICE_TYPE_OPTION_ALL = 'all' as const
const SERVICE_GROUP_OPTION_ALL = 'all' as const

const activeTab = ref<'serviceType' | 'serviceGroup' | 'service'>('serviceType')

const serviceTypes = ref<ServiceTypeSummary[]>([])
const serviceTypesLoading = ref(false)
const serviceTypesError = ref<string | null>(null)

const serviceTypeSearch = ref('')
const selectedServiceTypeId = ref<number | null>(null)
const isCreatingServiceType = ref(false)
const serviceTypeCreateLoading = ref(false)
const serviceTypeFormError = ref<string | null>(null)
const pendingServiceTypeId = ref<number | null>(null)
const previousSelectedServiceTypeId = ref<number | null>(null)
const serviceTypeUpdateLoading = ref(false)

const serviceTypeForm = reactive({
  id: '',
  name: '',
})

const serviceGroupFilters = reactive<{ search: string; serviceTypeId: string }>({
  search: '',
  serviceTypeId: SERVICE_TYPE_OPTION_ALL,
})

const appliedServiceGroupFilters = reactive<{ search: string; serviceTypeId: string }>({
  search: '',
  serviceTypeId: SERVICE_TYPE_OPTION_ALL,
})

const serviceGroups = ref<ServiceGroupSummary[]>([])
const serviceGroupsPagination = ref<PaginationMeta | null>(null)
const serviceGroupsLoading = ref(false)
const serviceGroupsError = ref<string | null>(null)
const serviceGroupPage = ref(1)
const serviceGroupPageSize = ref(PAGE_SIZE_OPTIONS[0])
const serviceGroupUpdateLoading = ref(false)
const selectedServiceGroupId = ref<number | null>(null)
const isCreatingServiceGroup = ref(false)
const serviceGroupCreateLoading = ref(false)
const serviceGroupFormError = ref<string | null>(null)
const pendingServiceGroupId = ref<number | null>(null)
const previousSelectedServiceGroupId = ref<number | null>(null)

const serviceGroupForm = reactive({
  id: '',
  name: '',
  serviceTypeId: null as string | null,
})

const serviceFilters = reactive<{ search: string; serviceTypeId: string; serviceGroupId: string }>({
  search: '',
  serviceTypeId: SERVICE_TYPE_OPTION_ALL,
  serviceGroupId: SERVICE_GROUP_OPTION_ALL,
})

const appliedServiceFilters = reactive<{
  search: string
  serviceTypeId: string
  serviceGroupId: string
}>({
  search: '',
  serviceTypeId: SERVICE_TYPE_OPTION_ALL,
  serviceGroupId: SERVICE_GROUP_OPTION_ALL,
})

const services = ref<ServiceSummary[]>([])
const servicesPagination = ref<PaginationMeta | null>(null)
const servicesLoading = ref(false)
const servicesError = ref<string | null>(null)
const servicePage = ref(1)
const servicePageSize = ref(PAGE_SIZE_OPTIONS[0])
const serviceUpdateLoading = ref(false)
const selectedServiceId = ref<number | null>(null)
const isCreatingService = ref(false)
const serviceCreateLoading = ref(false)
const serviceFormErrors = ref<string[]>([])
const pendingServiceId = ref<number | null>(null)
const previousSelectedServiceId = ref<number | null>(null)

const serviceForm = reactive({
  id: '',
  code: '',
  name: '',
  unit: '',
  price: '',
  referenceMin: '',
  referenceMax: '',
  serviceGroupId: null as string | null,
  executionRoomId: null as string | null,
})

const serviceGroupOptions = ref<Array<{ value: string; label: string; serviceTypeId: number }>>([])
const serviceGroupOptionsLoading = ref(false)

const executionRoomOptions = ref<Array<{ value: string; label: string }>>([])
const executionRoomOptionsLoading = ref(false)

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

const ensureServiceGroupOption = (group: ServiceGroupSummary) => {
  const value = String(group.id)
  if (!serviceGroupOptions.value.some((option) => option.value === value)) {
    serviceGroupOptions.value = [
      ...serviceGroupOptions.value,
      { value, label: group.name, serviceTypeId: group.serviceType.id },
    ]
  }
}

const ensureExecutionRoomOption = (
  room:
    | RoomSummary
    | {
        id: number
        name: string
        department?: { name?: string | null } | null
        departmentName?: string | null
      },
) => {
  const value = String(room.id)
  if (!executionRoomOptions.value.some((option) => option.value === value)) {
    const departmentLabel =
      'departmentName' in room ? (room.departmentName ?? '') : (room.department?.name ?? '')
    const suffix = departmentLabel ? ` (${departmentLabel})` : ''
    executionRoomOptions.value = [
      ...executionRoomOptions.value,
      { value, label: `${room.name}${suffix}` },
    ]
  }
}

const serviceTypeOptions = computed(() => [
  { value: SERVICE_TYPE_OPTION_ALL, label: 'All service types' },
  ...serviceTypes.value.map((item) => ({ value: String(item.id), label: item.name })),
])

const serviceGroupFilterOptions = computed(() => {
  const filteredGroups =
    serviceFilters.serviceTypeId === SERVICE_TYPE_OPTION_ALL
      ? serviceGroupOptions.value
      : serviceGroupOptions.value.filter(
          (option) => option.serviceTypeId === Number(serviceFilters.serviceTypeId),
        )

  return [
    { value: SERVICE_GROUP_OPTION_ALL, label: 'All service groups' },
    ...filteredGroups.map((option) => ({ value: option.value, label: option.label })),
  ]
})

const serviceDetailGroupOptions = computed(() => {
  return serviceGroupOptions.value.map((option) => ({ value: option.value, label: option.label }))
})

const serviceTypeRecords = computed(() => {
  const keyword = serviceTypeSearch.value.trim().toLowerCase()
  if (!keyword) {
    return serviceTypes.value
  }
  return serviceTypes.value.filter((item) => item.name.toLowerCase().includes(keyword))
})

const serviceGroupRecordsSummary = computed(() => {
  const pagination = serviceGroupsPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No service groups found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  return `Showing ${serviceGroups.value.length} of ${pagination.total} service groups (records ${start}-${end}).`
})

const serviceRecordsSummary = computed(() => {
  const pagination = servicesPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No services found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  return `Showing ${services.value.length} of ${pagination.total} services (records ${start}-${end}).`
})

const serviceGroupRecordsPerPage = computed({
  get: () => String(serviceGroupPageSize.value),
  set: (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === serviceGroupPageSize.value) {
      return
    }

    serviceGroupPageSize.value = parsed
    serviceGroupPage.value = 1
    void loadServiceGroups({ preserveSelection: true })
  },
})

const serviceRecordsPerPage = computed({
  get: () => String(servicePageSize.value),
  set: (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === servicePageSize.value) {
      return
    }

    servicePageSize.value = parsed
    servicePage.value = 1
    void loadServices({ preserveSelection: true })
  },
})

const setServiceTypeForm = (item: ServiceTypeSummary | null) => {
  if (item) {
    serviceTypeForm.id = String(item.id)
    serviceTypeForm.name = item.name
  } else {
    serviceTypeForm.id = ''
    serviceTypeForm.name = ''
  }
}

const setServiceGroupForm = (group: ServiceGroupSummary | null) => {
  if (group) {
    serviceGroupForm.id = String(group.id)
    serviceGroupForm.name = group.name
    serviceGroupForm.serviceTypeId = String(group.serviceType.id)
    ensureServiceGroupOption(group)
  } else {
    serviceGroupForm.id = ''
    serviceGroupForm.name = ''
    serviceGroupForm.serviceTypeId = null
  }
}

const setServiceForm = (service: ServiceSummary | null) => {
  if (service) {
    serviceForm.id = String(service.id)
    serviceForm.code = service.code
    serviceForm.name = service.name
    serviceForm.unit = service.unit ?? ''
    serviceForm.price = service.price ? String(service.price) : ''
    serviceForm.referenceMin = service.referenceMin ?? ''
    serviceForm.referenceMax = service.referenceMax ?? ''
    serviceForm.serviceGroupId = String(service.serviceGroup.id)
    serviceForm.executionRoomId = service.executionRoom ? String(service.executionRoom.id) : null
    ensureServiceGroupOption(service.serviceGroup)
    if (service.executionRoom) {
      ensureExecutionRoomOption({
        id: service.executionRoom.id,
        name: service.executionRoom.name,
        department: service.executionRoom.department,
      })
    }
  } else {
    serviceForm.id = ''
    serviceForm.code = ''
    serviceForm.name = ''
    serviceForm.unit = ''
    serviceForm.price = ''
    serviceForm.referenceMin = ''
    serviceForm.referenceMax = ''
    serviceForm.serviceGroupId = null
    serviceForm.executionRoomId = null
  }
}

const applyServiceTypeSelection = () => {
  if (!serviceTypeRecords.value.length) {
    if (!isCreatingServiceType.value) {
      selectedServiceTypeId.value = null
      setServiceTypeForm(null)
    }
    pendingServiceTypeId.value = null
    return
  }

  if (isCreatingServiceType.value) {
    return
  }

  const pendingId = pendingServiceTypeId.value
  if (pendingId !== null) {
    const pendingItem = serviceTypeRecords.value.find((item) => item.id === pendingId)
    if (pendingItem) {
      selectedServiceTypeId.value = pendingItem.id
      setServiceTypeForm(pendingItem)
      pendingServiceTypeId.value = null
      return
    }
  }

  const currentId = selectedServiceTypeId.value
  const match =
    currentId !== null
      ? serviceTypeRecords.value.find((item) => item.id === currentId)
      : serviceTypeRecords.value[0]

  if (match) {
    selectedServiceTypeId.value = match.id
    setServiceTypeForm(match)
  } else {
    selectedServiceTypeId.value = null
    setServiceTypeForm(null)
  }
}

const applyServiceGroupSelection = (list: ServiceGroupSummary[], preserveSelection: boolean) => {
  if (list.length === 0) {
    if (!isCreatingServiceGroup.value) {
      selectedServiceGroupId.value = null
      setServiceGroupForm(null)
    }
    pendingServiceGroupId.value = null
    return
  }

  if (isCreatingServiceGroup.value) {
    return
  }

  const pendingId = pendingServiceGroupId.value
  if (pendingId !== null) {
    const pendingItem = list.find((item) => item.id === pendingId)
    if (pendingItem) {
      selectedServiceGroupId.value = pendingItem.id
      setServiceGroupForm(pendingItem)
      pendingServiceGroupId.value = null
      return
    }
  }

  const currentId = selectedServiceGroupId.value
  const matched = currentId !== null ? list.find((item) => item.id === currentId) : undefined

  if (preserveSelection && currentId !== null) {
    if (matched) {
      selectedServiceGroupId.value = matched.id
      setServiceGroupForm(matched)
    }
    return
  }

  const target = matched ?? list[0] ?? null
  selectedServiceGroupId.value = target?.id ?? null
  setServiceGroupForm(target)
}

const applyServiceSelection = (list: ServiceSummary[], preserveSelection: boolean) => {
  if (list.length === 0) {
    if (!isCreatingService.value) {
      selectedServiceId.value = null
      setServiceForm(null)
    }
    pendingServiceId.value = null
    return
  }

  if (isCreatingService.value) {
    return
  }

  const pendingId = pendingServiceId.value
  if (pendingId !== null) {
    const pendingItem = list.find((item) => item.id === pendingId)
    if (pendingItem) {
      selectedServiceId.value = pendingItem.id
      setServiceForm(pendingItem)
      pendingServiceId.value = null
      return
    }
  }

  const currentId = selectedServiceId.value
  const matched = currentId !== null ? list.find((item) => item.id === currentId) : undefined

  if (preserveSelection && currentId !== null) {
    if (matched) {
      selectedServiceId.value = matched.id
      setServiceForm(matched)
    }
    return
  }

  const target = matched ?? list[0] ?? null
  selectedServiceId.value = target?.id ?? null
  setServiceForm(target)
}

const loadServiceTypes = async () => {
  serviceTypesLoading.value = true
  serviceTypesError.value = null

  try {
    const items = await getServiceTypes()
    serviceTypes.value = items
    applyServiceTypeSelection()
  } catch (error) {
    console.error(error)
    serviceTypesError.value =
      error instanceof Error ? error.message : 'Unable to load service types. Please try again.'
    serviceTypes.value = []
    selectedServiceTypeId.value = null
    setServiceTypeForm(null)
  } finally {
    serviceTypesLoading.value = false
  }
}

const loadServiceGroupOptions = async () => {
  if (serviceGroupOptionsLoading.value) {
    return
  }

  serviceGroupOptionsLoading.value = true

  try {
    const limit = 100
    let pageNumber = 1
    const collected: Array<{ value: string; label: string; serviceTypeId: number }> = []

    while (true) {
      const { serviceGroups: list, pagination } = await getServiceGroups({
        page: pageNumber,
        limit,
      })

      collected.push(
        ...list.map((group) => ({
          value: String(group.id),
          label: group.name,
          serviceTypeId: group.serviceType.id,
        })),
      )

      if (pagination.totalPages === 0 || pageNumber >= pagination.totalPages) {
        break
      }

      pageNumber += 1
    }

    const merged = new Map<string, { value: string; label: string; serviceTypeId: number }>()
    collected.forEach((option) => merged.set(option.value, option))
    serviceGroupOptions.value.forEach((option) => {
      if (!merged.has(option.value)) {
        merged.set(option.value, option)
      }
    })

    serviceGroupOptions.value = Array.from(merged.values())
  } catch (error) {
    console.error(error)
  } finally {
    serviceGroupOptionsLoading.value = false
  }
}

const loadExecutionRooms = async () => {
  if (executionRoomOptionsLoading.value) {
    return
  }

  executionRoomOptionsLoading.value = true

  try {
    const limit = 100
    let pageNumber = 1
    const collected: Array<{ value: string; label: string }> = []

    while (true) {
      const { rooms: list, pagination } = await getRooms({
        page: pageNumber,
        limit,
        status: 'active',
      })

      collected.push(
        ...list.map((room) => {
          const departmentLabel = room.departmentName ? ` (${room.departmentName})` : ''
          return { value: String(room.id), label: `${room.name}${departmentLabel}` }
        }),
      )

      if (pagination.totalPages === 0 || pageNumber >= pagination.totalPages) {
        break
      }

      pageNumber += 1
    }

    const merged = new Map<string, { value: string; label: string }>()
    collected.forEach((option) => merged.set(option.value, option))
    executionRoomOptions.value.forEach((option) => {
      if (!merged.has(option.value)) {
        merged.set(option.value, option)
      }
    })

    executionRoomOptions.value = Array.from(merged.values())
  } catch (error) {
    console.error(error)
  } finally {
    executionRoomOptionsLoading.value = false
  }
}

const loadServiceGroups = async (options: { preserveSelection?: boolean } = {}) => {
  const { preserveSelection = false } = options
  serviceGroupsLoading.value = true
  serviceGroupsError.value = null

  try {
    const searchTerm = appliedServiceGroupFilters.search.trim() || undefined
    const serviceTypeIdValue =
      appliedServiceGroupFilters.serviceTypeId === SERVICE_TYPE_OPTION_ALL
        ? undefined
        : Number(appliedServiceGroupFilters.serviceTypeId)

    const { serviceGroups: items, pagination } = await getServiceGroups({
      page: serviceGroupPage.value,
      limit: serviceGroupPageSize.value,
      search: searchTerm,
      serviceTypeId: serviceTypeIdValue,
    })

    serviceGroups.value = items
    serviceGroupsPagination.value = pagination
    serviceGroupPage.value = pagination.page
    serviceGroupPageSize.value = pagination.limit

    items.forEach(ensureServiceGroupOption)

    applyServiceGroupSelection(items, preserveSelection)
  } catch (error) {
    console.error(error)
    serviceGroups.value = []
    serviceGroupsPagination.value = null
    serviceGroupsError.value =
      error instanceof Error ? error.message : 'Unable to load service groups. Please try again.'
    applyServiceGroupSelection([], preserveSelection)
  } finally {
    serviceGroupsLoading.value = false
  }
}

const loadServices = async (options: { preserveSelection?: boolean } = {}) => {
  const { preserveSelection = false } = options
  servicesLoading.value = true
  servicesError.value = null

  try {
    const searchTerm = appliedServiceFilters.search.trim() || undefined
    const serviceTypeIdValue =
      appliedServiceFilters.serviceTypeId === SERVICE_TYPE_OPTION_ALL
        ? undefined
        : Number(appliedServiceFilters.serviceTypeId)
    const serviceGroupIdValue =
      appliedServiceFilters.serviceGroupId === SERVICE_GROUP_OPTION_ALL
        ? undefined
        : Number(appliedServiceFilters.serviceGroupId)

    const { services: items, pagination } = await getServices({
      page: servicePage.value,
      limit: servicePageSize.value,
      search: searchTerm,
      serviceTypeId: serviceTypeIdValue,
      serviceGroupId: serviceGroupIdValue,
    })

    services.value = items
    servicesPagination.value = pagination
    servicePage.value = pagination.page
    servicePageSize.value = pagination.limit

    items.forEach((service) => {
      ensureServiceGroupOption(service.serviceGroup)
      if (service.executionRoom) {
        ensureExecutionRoomOption({
          id: service.executionRoom.id,
          name: service.executionRoom.name,
          department: service.executionRoom.department,
        })
      }
    })

    applyServiceSelection(items, preserveSelection)
  } catch (error) {
    console.error(error)
    services.value = []
    servicesPagination.value = null
    servicesError.value =
      error instanceof Error ? error.message : 'Unable to load services. Please try again.'
    applyServiceSelection([], preserveSelection)
  } finally {
    servicesLoading.value = false
  }
}

const handleServiceTypeSelect = (item: ServiceTypeSummary) => {
  if (isCreatingServiceType.value) {
    isCreatingServiceType.value = false
    serviceTypeFormError.value = null
    pendingServiceTypeId.value = null
    previousSelectedServiceTypeId.value = null
  }
  selectedServiceTypeId.value = item.id
  setServiceTypeForm(item)
}

const handleServiceGroupSelect = (group: ServiceGroupSummary) => {
  if (isCreatingServiceGroup.value) {
    isCreatingServiceGroup.value = false
    serviceGroupFormError.value = null
    pendingServiceGroupId.value = null
    previousSelectedServiceGroupId.value = null
  }
  selectedServiceGroupId.value = group.id
  setServiceGroupForm(group)
}

const handleServiceSelect = (service: ServiceSummary) => {
  if (isCreatingService.value) {
    isCreatingService.value = false
    serviceFormErrors.value = []
    pendingServiceId.value = null
    previousSelectedServiceId.value = null
  }
  selectedServiceId.value = service.id
  setServiceForm(service)
}

const handleServiceTypeCancel = () => {
  if (!isCreatingServiceType.value) {
    if (selectedServiceTypeId.value !== null) {
      const current = serviceTypes.value.find((item) => item.id === selectedServiceTypeId.value)
      setServiceTypeForm(current ?? null)
    }
    return
  }

  isCreatingServiceType.value = false
  serviceTypeCreateLoading.value = false
  serviceTypeFormError.value = null

  const previousId = previousSelectedServiceTypeId.value
  previousSelectedServiceTypeId.value = null

  if (previousId !== null) {
    const previousItem = serviceTypes.value.find((item) => item.id === previousId) ?? null
    selectedServiceTypeId.value = previousItem?.id ?? null
    setServiceTypeForm(previousItem)
  } else {
    selectedServiceTypeId.value = null
    setServiceTypeForm(null)
  }

  pendingServiceTypeId.value = null
}

const handleServiceTypeCreate = async () => {
  if (serviceTypeCreateLoading.value) {
    return
  }

  if (!isCreatingServiceType.value) {
    previousSelectedServiceTypeId.value = selectedServiceTypeId.value
    selectedServiceTypeId.value = null
    setServiceTypeForm(null)
    serviceTypeFormError.value = null
    isCreatingServiceType.value = true
    return
  }

  const trimmedName = serviceTypeForm.name.trim()

  if (!trimmedName) {
    serviceTypeFormError.value = 'Service type name cannot be empty.'
    toast.error('Service type name cannot be empty.')
    return
  }

  try {
    serviceTypeCreateLoading.value = true
    const created = await createServiceType({ name: trimmedName })
    toast.success('Service type created successfully.')
    isCreatingServiceType.value = false
    serviceTypeFormError.value = null
    pendingServiceTypeId.value = created.id
    previousSelectedServiceTypeId.value = null
    selectedServiceTypeId.value = created.id
    setServiceTypeForm(created)
    await Promise.all([
      loadServiceTypes(),
      loadServiceGroupOptions(),
      loadServiceGroups({ preserveSelection: true }),
      loadServices({ preserveSelection: true }),
    ])
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to create service type. Please try again.'
    serviceTypeFormError.value = message
    toast.error(message)
  } finally {
    serviceTypeCreateLoading.value = false
  }
}

const handleServiceTypeUpdate = async () => {
  if (serviceTypeUpdateLoading.value) {
    return
  }

  if (selectedServiceTypeId.value === null) {
    toast.error('Please select a service type to update.')
    return
  }

  const trimmedName = serviceTypeForm.name.trim()

  if (!trimmedName) {
    toast.error('Service type name cannot be empty.')
    return
  }

  try {
    serviceTypeUpdateLoading.value = true
    await updateServiceType(selectedServiceTypeId.value, { name: trimmedName })
    toast.success('Service type updated successfully.')
    await Promise.all([
      loadServiceTypes(),
      loadServiceGroupOptions(),
      loadServiceGroups(),
      loadServices(),
    ])
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to update service type. Please try again.'
    toast.error(message)
  } finally {
    serviceTypeUpdateLoading.value = false
  }
}

const handleServiceGroupSearch = async () => {
  appliedServiceGroupFilters.search = serviceGroupFilters.search.trim()
  appliedServiceGroupFilters.serviceTypeId = serviceGroupFilters.serviceTypeId
  serviceGroupPage.value = 1
  await loadServiceGroups()
}

const handleServiceGroupReset = async () => {
  serviceGroupFilters.search = ''
  serviceGroupFilters.serviceTypeId = SERVICE_TYPE_OPTION_ALL
  appliedServiceGroupFilters.search = ''
  appliedServiceGroupFilters.serviceTypeId = SERVICE_TYPE_OPTION_ALL
  serviceGroupPage.value = 1
  await loadServiceGroups()
}

const handleServiceGroupPageChange = async (page: number) => {
  if (serviceGroupsLoading.value || page === serviceGroupPage.value) {
    return
  }

  serviceGroupPage.value = page
  await loadServiceGroups({ preserveSelection: true })
}

const handleServiceGroupCancel = () => {
  if (!isCreatingServiceGroup.value) {
    if (selectedServiceGroupId.value !== null) {
      const current = serviceGroups.value.find((group) => group.id === selectedServiceGroupId.value)
      setServiceGroupForm(current ?? null)
    }
    return
  }

  isCreatingServiceGroup.value = false
  serviceGroupCreateLoading.value = false
  serviceGroupFormError.value = null

  const previousId = previousSelectedServiceGroupId.value
  previousSelectedServiceGroupId.value = null

  if (previousId !== null) {
    const previousGroup = serviceGroups.value.find((group) => group.id === previousId) ?? null
    selectedServiceGroupId.value = previousGroup?.id ?? null
    setServiceGroupForm(previousGroup)
  } else {
    selectedServiceGroupId.value = null
    setServiceGroupForm(null)
  }

  pendingServiceGroupId.value = null
}

const handleServiceGroupCreate = async () => {
  if (serviceGroupCreateLoading.value || serviceTypesLoading.value) {
    return
  }

  if (!isCreatingServiceGroup.value) {
    previousSelectedServiceGroupId.value = selectedServiceGroupId.value
    selectedServiceGroupId.value = null
    setServiceGroupForm(null)
    serviceGroupFormError.value = null

    if (appliedServiceGroupFilters.serviceTypeId !== SERVICE_TYPE_OPTION_ALL) {
      serviceGroupForm.serviceTypeId = appliedServiceGroupFilters.serviceTypeId
    }

    isCreatingServiceGroup.value = true
    return
  }

  const errors: string[] = []
  const trimmedName = serviceGroupForm.name.trim()

  if (!trimmedName) {
    errors.push('Service group name cannot be empty.')
  }

  const typeIdValue = serviceGroupForm.serviceTypeId
  const parsedTypeId = typeIdValue !== null ? Number(typeIdValue) : NaN

  if (!Number.isFinite(parsedTypeId) || parsedTypeId <= 0) {
    errors.push('Please select a valid service type.')
  }

  if (errors.length > 0) {
    serviceGroupFormError.value = errors.join(' ')
    toast.error(errors[0])
    return
  }

  try {
    serviceGroupCreateLoading.value = true
    const created = await createServiceGroup({ name: trimmedName, serviceTypeId: parsedTypeId })
    toast.success('Service group created successfully.')
    isCreatingServiceGroup.value = false
    serviceGroupFormError.value = null
    pendingServiceGroupId.value = created.id
    previousSelectedServiceGroupId.value = null
    selectedServiceGroupId.value = created.id
    setServiceGroupForm(created)

    await loadServiceGroups({ preserveSelection: true })

    const exists = serviceGroups.value.some((group) => group.id === created.id)
    const totalPages = serviceGroupsPagination.value?.totalPages ?? null

    if (!exists && totalPages && totalPages !== serviceGroupPage.value) {
      serviceGroupPage.value = totalPages
      await loadServiceGroups({ preserveSelection: true })
    }

    await Promise.all([loadServiceGroupOptions(), loadServices({ preserveSelection: true })])
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to create service group. Please try again.'
    serviceGroupFormError.value = message
    toast.error(message)
  } finally {
    serviceGroupCreateLoading.value = false
  }
}

const handleServiceGroupUpdate = async () => {
  if (serviceGroupUpdateLoading.value) {
    return
  }

  if (selectedServiceGroupId.value === null) {
    toast.error('Please select a service group to update.')
    return
  }

  const currentGroup = serviceGroups.value.find(
    (group) => group.id === selectedServiceGroupId.value,
  )

  if (!currentGroup) {
    toast.error('Selected service group is no longer available. Please refresh.')
    return
  }

  const trimmedName = serviceGroupForm.name.trim()
  if (!trimmedName) {
    toast.error('Service group name cannot be empty.')
    return
  }

  const payload: { name?: string; serviceTypeId?: number } = {}

  if (trimmedName !== currentGroup.name) {
    payload.name = trimmedName
  }

  if (serviceGroupForm.serviceTypeId !== null) {
    const parsedTypeId = Number(serviceGroupForm.serviceTypeId)
    if (
      Number.isFinite(parsedTypeId) &&
      parsedTypeId > 0 &&
      parsedTypeId !== currentGroup.serviceType.id
    ) {
      payload.serviceTypeId = parsedTypeId
    }
  }

  if (Object.keys(payload).length === 0) {
    toast.info('No changes to update.')
    return
  }

  try {
    serviceGroupUpdateLoading.value = true
    await updateServiceGroup(selectedServiceGroupId.value, payload)
    toast.success('Service group updated successfully.')
    await Promise.all([
      loadServiceGroups({ preserveSelection: true }),
      loadServiceGroupOptions(),
      loadServices(),
    ])
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to update service group. Please try again.'
    toast.error(message)
  } finally {
    serviceGroupUpdateLoading.value = false
  }
}

const handleServiceSearch = async () => {
  appliedServiceFilters.search = serviceFilters.search.trim()
  appliedServiceFilters.serviceTypeId = serviceFilters.serviceTypeId
  appliedServiceFilters.serviceGroupId = serviceFilters.serviceGroupId
  servicePage.value = 1
  await loadServices()
}

const handleServiceReset = async () => {
  serviceFilters.search = ''
  serviceFilters.serviceTypeId = SERVICE_TYPE_OPTION_ALL
  serviceFilters.serviceGroupId = SERVICE_GROUP_OPTION_ALL
  appliedServiceFilters.search = ''
  appliedServiceFilters.serviceTypeId = SERVICE_TYPE_OPTION_ALL
  appliedServiceFilters.serviceGroupId = SERVICE_GROUP_OPTION_ALL
  servicePage.value = 1
  await loadServices()
}

const handleServicePageChange = async (page: number) => {
  if (servicesLoading.value || page === servicePage.value) {
    return
  }

  servicePage.value = page
  await loadServices({ preserveSelection: true })
}

const handleServiceCancel = () => {
  if (!isCreatingService.value) {
    if (selectedServiceId.value !== null) {
      const current = services.value.find((service) => service.id === selectedServiceId.value)
      setServiceForm(current ?? null)
    }
    return
  }

  isCreatingService.value = false
  serviceCreateLoading.value = false
  serviceFormErrors.value = []

  const previousId = previousSelectedServiceId.value
  previousSelectedServiceId.value = null

  if (previousId !== null) {
    const previousService = services.value.find((item) => item.id === previousId) ?? null
    selectedServiceId.value = previousService?.id ?? null
    setServiceForm(previousService)
  } else {
    selectedServiceId.value = null
    setServiceForm(null)
  }

  pendingServiceId.value = null
}

const handleServiceCreate = async () => {
  if (
    serviceCreateLoading.value ||
    serviceGroupOptionsLoading.value ||
    executionRoomOptionsLoading.value
  ) {
    return
  }

  if (!isCreatingService.value) {
    previousSelectedServiceId.value = selectedServiceId.value
    selectedServiceId.value = null
    setServiceForm(null)
    serviceFormErrors.value = []

    if (appliedServiceFilters.serviceGroupId !== SERVICE_GROUP_OPTION_ALL) {
      serviceForm.serviceGroupId = appliedServiceFilters.serviceGroupId
    } else if (appliedServiceFilters.serviceTypeId !== SERVICE_TYPE_OPTION_ALL) {
      const preferredGroup = serviceGroupOptions.value.find(
        (option) => option.serviceTypeId === Number(appliedServiceFilters.serviceTypeId),
      )
      if (preferredGroup) {
        serviceForm.serviceGroupId = preferredGroup.value
      }
    }

    isCreatingService.value = true
    return
  }

  const errors: string[] = []
  const trimmedCode = serviceForm.code.trim()
  const trimmedName = serviceForm.name.trim()
  const unitValue = serviceForm.unit.trim()
  const priceValue = serviceForm.price.trim()
  const referenceMinValue = serviceForm.referenceMin.trim()
  const referenceMaxValue = serviceForm.referenceMax.trim()

  if (!trimmedCode) {
    errors.push('Service code is required.')
  }

  if (!trimmedName) {
    errors.push('Service name is required.')
  }

  if (!priceValue) {
    errors.push('Service price is required.')
  }

  const parsedPrice = Number(priceValue)

  if (priceValue && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
    errors.push('Service price must be a valid number.')
  }

  const groupValue = serviceForm.serviceGroupId
  const parsedGroupId = groupValue !== null ? Number(groupValue) : NaN

  if (!Number.isFinite(parsedGroupId) || parsedGroupId <= 0) {
    errors.push('Please select a valid service group.')
  }

  let parsedRoomId: number | null = null
  if (serviceForm.executionRoomId !== null && serviceForm.executionRoomId !== '') {
    const parsedValue = Number(serviceForm.executionRoomId)
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      errors.push('Please select a valid execution room.')
    } else {
      parsedRoomId = parsedValue
    }
  }

  if (errors.length > 0) {
    serviceFormErrors.value = errors
    toast.error(errors[0])
    return
  }

  try {
    serviceCreateLoading.value = true
    const created = await createService({
      code: trimmedCode,
      name: trimmedName,
      unit: unitValue ? unitValue : null,
      price: parsedPrice,
      referenceMin: referenceMinValue ? referenceMinValue : null,
      referenceMax: referenceMaxValue ? referenceMaxValue : null,
      serviceGroupId: parsedGroupId,
      executionRoomId: parsedRoomId,
    })

    toast.success('Service created successfully.')
    isCreatingService.value = false
    serviceFormErrors.value = []
    pendingServiceId.value = created.id
    previousSelectedServiceId.value = null
    selectedServiceId.value = created.id
    setServiceForm(created)

    await loadServices({ preserveSelection: true })

    const exists = services.value.some((item) => item.id === created.id)
    const totalPages = servicesPagination.value?.totalPages ?? null

    if (!exists && totalPages && totalPages !== servicePage.value) {
      servicePage.value = totalPages
      await loadServices({ preserveSelection: true })
    }

    await loadServiceGroupOptions()
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to create service. Please try again.'
    serviceFormErrors.value = [message]
    toast.error(message)
  } finally {
    serviceCreateLoading.value = false
  }
}

const handleServiceUpdate = async () => {
  if (serviceUpdateLoading.value) {
    return
  }

  if (selectedServiceId.value === null) {
    toast.error('Please select a service to update.')
    return
  }

  const currentService = services.value.find((service) => service.id === selectedServiceId.value)

  if (!currentService) {
    toast.error('Selected service is no longer available. Please refresh.')
    return
  }

  const trimmedCode = serviceForm.code.trim()
  const trimmedName = serviceForm.name.trim()

  if (!trimmedCode || !trimmedName) {
    toast.error('Service code and name cannot be empty.')
    return
  }

  const priceValue = serviceForm.price.trim()

  if (!priceValue) {
    toast.error('Service price is required.')
    return
  }

  const payload: {
    code?: string
    name?: string
    unit?: string | null
    price?: number
    referenceMin?: string | null
    referenceMax?: string | null
    serviceGroupId?: number
    executionRoomId?: number | null
  } = {}

  if (trimmedCode !== currentService.code) {
    payload.code = trimmedCode
  }

  if (trimmedName !== currentService.name) {
    payload.name = trimmedName
  }

  const unitValue = serviceForm.unit.trim()
  if (unitValue !== (currentService.unit ?? '')) {
    payload.unit = unitValue || null
  }

  const parsedPrice = Number(priceValue)
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    toast.error('Service price must be a valid number.')
    return
  }

  if (parsedPrice !== currentService.price) {
    payload.price = parsedPrice
  }

  const referenceMinValue = serviceForm.referenceMin.trim()
  if (referenceMinValue !== (currentService.referenceMin ?? '')) {
    payload.referenceMin = referenceMinValue || null
  }

  const referenceMaxValue = serviceForm.referenceMax.trim()
  if (referenceMaxValue !== (currentService.referenceMax ?? '')) {
    payload.referenceMax = referenceMaxValue || null
  }

  if (serviceForm.serviceGroupId !== null) {
    const parsedGroupId = Number(serviceForm.serviceGroupId)
    if (!Number.isFinite(parsedGroupId) || parsedGroupId <= 0) {
      toast.error('Please select a valid service group.')
      return
    }

    if (parsedGroupId !== currentService.serviceGroup.id) {
      payload.serviceGroupId = parsedGroupId
    }
  }

  if (serviceForm.executionRoomId !== null) {
    const parsedRoomId = Number(serviceForm.executionRoomId)
    if (!Number.isFinite(parsedRoomId) || parsedRoomId <= 0) {
      toast.error('Please select a valid execution room.')
      return
    }

    if (!currentService.executionRoom || parsedRoomId !== currentService.executionRoom.id) {
      payload.executionRoomId = parsedRoomId
    }
  } else if (currentService.executionRoom) {
    payload.executionRoomId = null
  }

  if (Object.keys(payload).length === 0) {
    toast.info('No changes to update.')
    return
  }

  try {
    serviceUpdateLoading.value = true
    await updateService(selectedServiceId.value, payload)
    toast.success('Service updated successfully.')
    await loadServices({ preserveSelection: true })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to update service. Please try again.'
    toast.error(message)
  } finally {
    serviceUpdateLoading.value = false
  }
}

watch(serviceTypeSearch, () => {
  applyServiceTypeSelection()
})

watch(
  () => serviceFilters.serviceTypeId,
  () => {
    const available = serviceGroupFilterOptions.value.map((option) => option.value)
    if (!available.includes(serviceFilters.serviceGroupId)) {
      serviceFilters.serviceGroupId = SERVICE_GROUP_OPTION_ALL
    }
  },
)

watch(serviceGroupOptions, () => {
  const available = serviceGroupFilterOptions.value.map((option) => option.value)
  if (!available.includes(serviceFilters.serviceGroupId)) {
    serviceFilters.serviceGroupId = SERVICE_GROUP_OPTION_ALL
  }
})

onMounted(() => {
  void Promise.all([loadServiceTypes(), loadServiceGroupOptions(), loadExecutionRooms()])
  void loadServiceGroups()
  void loadServices()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <Card>
        <CardHeader>
          <CardTitle>Service Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs v-model="activeTab" class="w-full">
            <TabsList class="grid w-full grid-cols-3 gap-2">
              <TabsTrigger value="serviceType">Service Types</TabsTrigger>
              <TabsTrigger value="serviceGroup">Service Groups</TabsTrigger>
              <TabsTrigger value="service">Services</TabsTrigger>
            </TabsList>

            <TabsContent value="serviceType" class="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Type Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid gap-4 md:grid-cols-2">
                    <Field class="md:col-span-2">
                      <FieldLabel for="service-type-name">Service Type Name</FieldLabel>
                      <Input
                        id="service-type-name"
                        v-model="serviceTypeForm.name"
                        placeholder="Enter service type name"
                        :disabled="!isCreatingServiceType && selectedServiceTypeId === null"
                      />
                      <p v-if="serviceTypeFormError" class="mt-1 text-sm text-destructive">
                        {{ serviceTypeFormError }}
                      </p>
                    </Field>
                  </div>
                  <div class="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      v-if="isCreatingServiceType"
                      type="button"
                      variant="outline"
                      :disabled="serviceTypeCreateLoading"
                      @click="handleServiceTypeCancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      :disabled="serviceTypeCreateLoading"
                      @click="handleServiceTypeCreate"
                    >
                      <Loader2 v-if="serviceTypeCreateLoading" class="mr-2 h-4 w-4 animate-spin" />
                      <PlusIcon v-else-if="!isCreatingServiceType" class="mr-2 h-4 w-4" />
                      {{ isCreatingServiceType ? 'Add Service Type' : 'New Service Type' }}
                    </Button>
                    <Button
                      type="button"
                      :disabled="
                        serviceTypeUpdateLoading ||
                        selectedServiceTypeId === null ||
                        isCreatingServiceType
                      "
                      @click="handleServiceTypeUpdate"
                    >
                      <Loader2 v-if="serviceTypeUpdateLoading" class="mr-2 h-4 w-4 animate-spin" />
                      Update Service Type
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Type List</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div class="flex flex-col gap-4 md:flex-row md:items-end">
                    <Field class="md:w-80">
                      <FieldLabel for="service-type-search">Search</FieldLabel>
                      <Input
                        id="service-type-search"
                        v-model="serviceTypeSearch"
                        placeholder="Filter by name"
                      />
                    </Field>
                  </div>

                  <p v-if="serviceTypesError" class="text-sm text-destructive">
                    {{ serviceTypesError }}
                  </p>

                  <div class="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="serviceTypesLoading">
                          <TableCell>
                            <div
                              class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                            >
                              <Loader2 class="h-4 w-4 animate-spin" />
                              Loading service types…
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow v-else-if="serviceTypeRecords.length === 0">
                          <TableCell>
                            <div class="py-6 text-center text-sm text-muted-foreground">
                              No service types match the current filters.
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="item in serviceTypeRecords"
                          v-else
                          :key="item.id"
                          :class="[
                            'cursor-pointer transition-colors',
                            item.id === selectedServiceTypeId ? 'bg-muted' : 'hover:bg-muted/60',
                          ]"
                          @click="handleServiceTypeSelect(item)"
                        >
                          <TableCell>{{ item.name }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="serviceGroup" class="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Group Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel for="service-group-name">Group Name</FieldLabel>
                      <Input
                        id="service-group-name"
                        v-model="serviceGroupForm.name"
                        placeholder="Enter group name"
                        :disabled="!isCreatingServiceGroup && selectedServiceGroupId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-group-type">Service Type</FieldLabel>
                      <ComboBox
                        id="service-group-type"
                        v-model="serviceGroupForm.serviceTypeId"
                        :options="serviceTypeOptions.slice(1)"
                        placeholder="Select service type"
                        search-placeholder="Search service type"
                        empty-message="No service types found."
                        :disabled="
                          (!isCreatingServiceGroup && selectedServiceGroupId === null) ||
                          serviceTypesLoading
                        "
                        :loading="serviceTypesLoading"
                      />
                    </Field>
                  </div>
                  <p v-if="serviceGroupFormError" class="mt-1 text-sm text-destructive">
                    {{ serviceGroupFormError }}
                  </p>
                  <div class="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      v-if="isCreatingServiceGroup"
                      type="button"
                      variant="outline"
                      :disabled="serviceGroupCreateLoading"
                      @click="handleServiceGroupCancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      :disabled="serviceGroupCreateLoading || serviceTypesLoading"
                      @click="handleServiceGroupCreate"
                    >
                      <Loader2 v-if="serviceGroupCreateLoading" class="mr-2 h-4 w-4 animate-spin" />
                      <PlusIcon v-else-if="!isCreatingServiceGroup" class="mr-2 h-4 w-4" />
                      {{ isCreatingServiceGroup ? 'Add Service Group' : 'New Service Group' }}
                    </Button>
                    <Button
                      type="button"
                      :disabled="
                        serviceGroupUpdateLoading ||
                        selectedServiceGroupId === null ||
                        serviceTypesLoading ||
                        isCreatingServiceGroup
                      "
                      @click="handleServiceGroupUpdate"
                    >
                      <Loader2 v-if="serviceGroupUpdateLoading" class="mr-2 h-4 w-4 animate-spin" />
                      Update Service Group
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Group List</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                    <Field>
                      <FieldLabel for="service-group-search">Group Name</FieldLabel>
                      <Input
                        id="service-group-search"
                        v-model="serviceGroupFilters.search"
                        placeholder="Search by name"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-group-filter-type">Service Type</FieldLabel>
                      <NativeSelect
                        id="service-group-filter-type"
                        v-model="serviceGroupFilters.serviceTypeId"
                        :disabled="serviceGroupsLoading || serviceTypesLoading"
                      >
                        <option
                          v-for="option in serviceTypeOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel for="service-group-page-size">Records per page</FieldLabel>
                      <NativeSelect
                        id="service-group-page-size"
                        v-model="serviceGroupRecordsPerPage"
                        :disabled="serviceGroupsLoading"
                      >
                        <option
                          v-for="option in PAGE_SIZE_OPTIONS"
                          :key="option"
                          :value="String(option)"
                        >
                          {{ option }}
                        </option>
                      </NativeSelect>
                    </Field>
                    <div class="flex gap-2">
                      <Button
                        type="button"
                        :disabled="serviceGroupsLoading"
                        @click="handleServiceGroupSearch"
                      >
                        <SearchIcon class="mr-2 h-4 w-4" />
                        Search
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="serviceGroupsLoading"
                        @click="handleServiceGroupReset"
                      >
                        <RotateCcw class="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  <p v-if="serviceGroupsError" class="text-sm text-destructive">
                    {{ serviceGroupsError }}
                  </p>

                  <div class="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group Name</TableHead>
                          <TableHead class="w-48">Service Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="serviceGroupsLoading">
                          <TableCell colspan="2">
                            <div
                              class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                            >
                              <Loader2 class="h-4 w-4 animate-spin" />
                              Loading service groups…
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow v-else-if="serviceGroups.length === 0">
                          <TableCell colspan="2">
                            <div class="py-6 text-center text-sm text-muted-foreground">
                              No service groups match the current filters.
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="group in serviceGroups"
                          v-else
                          :key="group.id"
                          :class="[
                            'cursor-pointer transition-colors',
                            group.id === selectedServiceGroupId ? 'bg-muted' : 'hover:bg-muted/60',
                          ]"
                          @click="handleServiceGroupSelect(group)"
                        >
                          <TableCell>{{ group.name }}</TableCell>
                          <TableCell>{{ group.serviceType.name }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div
                    class="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
                  >
                    <span>{{ serviceGroupRecordsSummary }}</span>
                    <div v-if="serviceGroupsPagination" class="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="serviceGroupsLoading || serviceGroupPage <= 1"
                        @click="handleServiceGroupPageChange(Math.max(1, serviceGroupPage - 1))"
                      >
                        Previous
                      </Button>
                      <span class="min-w-32 text-center">
                        Page {{ serviceGroupPage }} / {{ serviceGroupsPagination.totalPages }}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="
                          serviceGroupsLoading ||
                          serviceGroupPage >= serviceGroupsPagination.totalPages
                        "
                        @click="
                          handleServiceGroupPageChange(
                            Math.min(serviceGroupsPagination.totalPages, serviceGroupPage + 1),
                          )
                        "
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="service" class="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel for="service-code">Service Code</FieldLabel>
                      <Input
                        id="service-code"
                        v-model="serviceForm.code"
                        placeholder="Enter service code"
                        :disabled="!isCreatingService && selectedServiceId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-name">Service Name</FieldLabel>
                      <Input
                        id="service-name"
                        v-model="serviceForm.name"
                        placeholder="Enter service name"
                        :disabled="!isCreatingService && selectedServiceId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-unit">Unit</FieldLabel>
                      <Input
                        id="service-unit"
                        v-model="serviceForm.unit"
                        placeholder="Enter unit"
                        :disabled="!isCreatingService && selectedServiceId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-price">Price</FieldLabel>
                      <Input
                        id="service-price"
                        v-model="serviceForm.price"
                        placeholder="Enter price"
                        :disabled="!isCreatingService && selectedServiceId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-ref-min">Reference Min</FieldLabel>
                      <Input
                        id="service-ref-min"
                        v-model="serviceForm.referenceMin"
                        placeholder="Enter reference minimum"
                        :disabled="!isCreatingService && selectedServiceId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-ref-max">Reference Max</FieldLabel>
                      <Input
                        id="service-ref-max"
                        v-model="serviceForm.referenceMax"
                        placeholder="Enter reference maximum"
                        :disabled="!isCreatingService && selectedServiceId === null"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-group">Service Group</FieldLabel>
                      <ComboBox
                        id="service-group"
                        v-model="serviceForm.serviceGroupId"
                        :options="serviceDetailGroupOptions"
                        placeholder="Select service group"
                        search-placeholder="Search service group"
                        empty-message="No service groups found."
                        :disabled="
                          (!isCreatingService && selectedServiceId === null) ||
                          serviceGroupOptionsLoading
                        "
                        :loading="serviceGroupOptionsLoading"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-room">Execution Room</FieldLabel>
                      <ComboBox
                        id="service-room"
                        v-model="serviceForm.executionRoomId"
                        :options="executionRoomOptions"
                        placeholder="Select execution room"
                        search-placeholder="Search room"
                        empty-message="No rooms found."
                        :disabled="
                          (!isCreatingService && selectedServiceId === null) ||
                          executionRoomOptionsLoading
                        "
                        :loading="executionRoomOptionsLoading"
                        allow-clear
                      />
                    </Field>
                  </div>
                  <ul
                    v-if="serviceFormErrors.length"
                    class="mt-2 space-y-1 text-sm text-destructive"
                  >
                    <li v-for="error in serviceFormErrors" :key="error">
                      {{ error }}
                    </li>
                  </ul>
                  <div class="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      v-if="isCreatingService"
                      type="button"
                      variant="outline"
                      :disabled="serviceCreateLoading"
                      @click="handleServiceCancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      :disabled="
                        serviceCreateLoading ||
                        serviceGroupOptionsLoading ||
                        executionRoomOptionsLoading
                      "
                      @click="handleServiceCreate"
                    >
                      <Loader2 v-if="serviceCreateLoading" class="mr-2 h-4 w-4 animate-spin" />
                      <PlusIcon v-else-if="!isCreatingService" class="mr-2 h-4 w-4" />
                      {{ isCreatingService ? 'Add Service' : 'New Service' }}
                    </Button>
                    <Button
                      type="button"
                      :disabled="
                        serviceUpdateLoading ||
                        selectedServiceId === null ||
                        serviceGroupOptionsLoading ||
                        executionRoomOptionsLoading ||
                        isCreatingService
                      "
                      @click="handleServiceUpdate"
                    >
                      <Loader2 v-if="serviceUpdateLoading" class="mr-2 h-4 w-4 animate-spin" />
                      Update Service
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service List</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
                    <Field>
                      <FieldLabel for="service-search">Search</FieldLabel>
                      <Input
                        id="service-search"
                        v-model="serviceFilters.search"
                        placeholder="Search by code or name"
                      />
                    </Field>
                    <Field>
                      <FieldLabel for="service-filter-type">Service Type</FieldLabel>
                      <NativeSelect
                        id="service-filter-type"
                        v-model="serviceFilters.serviceTypeId"
                        :disabled="servicesLoading || serviceTypesLoading"
                      >
                        <option
                          v-for="option in serviceTypeOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel for="service-filter-group">Service Group</FieldLabel>
                      <NativeSelect
                        id="service-filter-group"
                        v-model="serviceFilters.serviceGroupId"
                        :disabled="servicesLoading"
                      >
                        <option
                          v-for="option in serviceGroupFilterOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel for="service-page-size">Records per page</FieldLabel>
                      <NativeSelect
                        id="service-page-size"
                        v-model="serviceRecordsPerPage"
                        :disabled="servicesLoading"
                      >
                        <option
                          v-for="option in PAGE_SIZE_OPTIONS"
                          :key="option"
                          :value="String(option)"
                        >
                          {{ option }}
                        </option>
                      </NativeSelect>
                    </Field>
                    <div class="flex gap-2">
                      <Button
                        type="button"
                        :disabled="servicesLoading"
                        @click="handleServiceSearch"
                      >
                        <SearchIcon class="mr-2 h-4 w-4" />
                        Search
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="servicesLoading"
                        @click="handleServiceReset"
                      >
                        <RotateCcw class="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  <p v-if="servicesError" class="text-sm text-destructive">
                    {{ servicesError }}
                  </p>

                  <div class="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead class="w-28">Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead class="w-48">Group</TableHead>
                          <TableHead class="w-48">Type</TableHead>
                          <TableHead class="w-32 text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="servicesLoading">
                          <TableCell colspan="5">
                            <div
                              class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                            >
                              <Loader2 class="h-4 w-4 animate-spin" />
                              Loading services…
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow v-else-if="services.length === 0">
                          <TableCell colspan="5">
                            <div class="py-6 text-center text-sm text-muted-foreground">
                              No services match the current filters.
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="service in services"
                          v-else
                          :key="service.id"
                          :class="[
                            'cursor-pointer transition-colors',
                            service.id === selectedServiceId ? 'bg-muted' : 'hover:bg-muted/60',
                          ]"
                          @click="handleServiceSelect(service)"
                        >
                          <TableCell class="font-mono text-sm">{{ service.code }}</TableCell>
                          <TableCell>{{ service.name }}</TableCell>
                          <TableCell>{{ service.serviceGroup.name }}</TableCell>
                          <TableCell>{{ service.serviceGroup.serviceType.name }}</TableCell>
                          <TableCell class="text-right">
                            {{ currencyFormatter.format(service.price) }}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div
                    class="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
                  >
                    <span>{{ serviceRecordsSummary }}</span>
                    <div v-if="servicesPagination" class="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="servicesLoading || servicePage <= 1"
                        @click="handleServicePageChange(Math.max(1, servicePage - 1))"
                      >
                        Previous
                      </Button>
                      <span class="min-w-32 text-center">
                        Page {{ servicePage }} / {{ servicesPagination.totalPages }}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="servicesLoading || servicePage >= servicesPagination.totalPages"
                        @click="
                          handleServicePageChange(
                            Math.min(servicesPagination.totalPages, servicePage + 1),
                          )
                        "
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
