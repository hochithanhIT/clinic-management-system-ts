<script setup lang="ts">
definePage({
  alias: '/catalog/department-room/',
  meta: {
    requiresAuth: true,
  },
})

import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, PlusIcon, RotateCcw, SearchIcon } from 'lucide-vue-next'

import { ApiError } from '@/services/http'
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  type DepartmentSummary,
  restoreDepartment,
  updateDepartment,
} from '@/services/department'
import {
  createRoom,
  deleteRoom,
  getRooms,
  type RoomSummary,
  restoreRoom,
  updateRoom,
} from '@/services/room'
import type { PaginationMeta } from '@/services/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import ComboBox from '@/components/ComboBox.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
type DepartmentStatus = 'active' | 'inactive'
const DEFAULT_DEPARTMENT_STATUS: DepartmentStatus = 'active'
const DEPARTMENT_STATUS_OPTIONS: ReadonlyArray<{
  label: string
  value: DepartmentStatus
}> = [
  { label: 'Active', value: 'active' },
  { label: 'Deleted', value: 'inactive' },
]

type RoomStatus = 'active' | 'inactive'
const DEFAULT_ROOM_STATUS: RoomStatus = 'active'
const ROOM_STATUS_OPTIONS: ReadonlyArray<{
  label: string
  value: RoomStatus
}> = [
  { label: 'Active', value: 'active' },
  { label: 'Deleted', value: 'inactive' },
]

const ROOM_DEPARTMENT_ALL = 'all' as const

const activeTab = ref<'department' | 'room'>('department')

const departmentFilters = reactive<{ name: string; status: DepartmentStatus }>({
  name: '',
  status: DEFAULT_DEPARTMENT_STATUS,
})

const appliedDepartmentFilters = reactive<{ name: string; status: DepartmentStatus }>({
  name: '',
  status: DEFAULT_DEPARTMENT_STATUS,
})

const departmentPage = ref(1)
const departmentPageSize = ref(PAGE_SIZE_OPTIONS[0])

const departments = ref<DepartmentSummary[]>([])
const departmentsPagination = ref<PaginationMeta | null>(null)
const departmentsLoading = ref(false)
const departmentsError = ref<string | null>(null)
const departmentUpdateLoading = ref(false)
const departmentDeleteLoading = ref(false)
const departmentRestoreLoading = ref(false)
const deleteDialogOpen = ref(false)

const selectedDepartmentId = ref<number | null>(null)
const lastSelectedDepartmentId = ref<number | null>(null)
const isCreatingDepartment = ref(false)
const departmentCreateLoading = ref(false)

const departmentForm = reactive({
  id: '',
  name: '',
  roomCount: '',
  isActive: true,
})

const resetDepartmentForm = () => {
  departmentForm.id = ''
  departmentForm.name = ''
  departmentForm.roomCount = '0'
  departmentForm.isActive = true
}

const setDepartmentForm = (department: DepartmentSummary | null) => {
  if (department) {
    departmentForm.id = String(department.id)
    departmentForm.name = department.name
    departmentForm.roomCount = String(department.roomCount)
    departmentForm.isActive = department.isActive
  } else {
    resetDepartmentForm()
  }
  isCreatingDepartment.value = false
  deleteDialogOpen.value = false
}

const roomFilters = reactive<{ name: string; status: RoomStatus; departmentId: string }>({
  name: '',
  status: DEFAULT_ROOM_STATUS,
  departmentId: ROOM_DEPARTMENT_ALL,
})

const appliedRoomFilters = reactive<{ name: string; status: RoomStatus; departmentId: string }>({
  name: '',
  status: DEFAULT_ROOM_STATUS,
  departmentId: ROOM_DEPARTMENT_ALL,
})

const roomPage = ref(1)
const roomPageSize = ref(PAGE_SIZE_OPTIONS[0])

const rooms = ref<RoomSummary[]>([])
const roomsPagination = ref<PaginationMeta | null>(null)
const roomsLoading = ref(false)
const roomsError = ref<string | null>(null)
const roomUpdateLoading = ref(false)
const roomDeleteLoading = ref(false)
const roomRestoreLoading = ref(false)
const roomDeleteDialogOpen = ref(false)

const selectedRoomId = ref<number | null>(null)
const lastSelectedRoomId = ref<number | null>(null)
const isCreatingRoom = ref(false)

const roomDepartmentOptions = ref<Array<{ value: string; label: string }>>([])
const roomDepartmentOptionsLoading = ref(false)
const roomCreateLoading = ref(false)

const roomForm = reactive({
  id: '',
  name: '',
  departmentId: null as string | null,
  isActive: true,
})

const resetRoomForm = () => {
  roomForm.id = ''
  roomForm.name = ''
  roomForm.departmentId = null
  roomForm.isActive = true
}

const ensureRoomDepartmentOption = (departmentId: number, departmentName: string) => {
  const value = String(departmentId)
  if (!roomDepartmentOptions.value.some((option) => option.value === value)) {
    roomDepartmentOptions.value = [...roomDepartmentOptions.value, { value, label: departmentName }]
  }
}

const setRoomForm = (room: RoomSummary | null) => {
  if (room) {
    roomForm.id = String(room.id)
    roomForm.name = room.name
    roomForm.departmentId = String(room.departmentId)
    roomForm.isActive = room.isActive
    ensureRoomDepartmentOption(room.departmentId, room.departmentName)
  } else {
    resetRoomForm()
  }
  isCreatingRoom.value = false
  roomDeleteDialogOpen.value = false
}

const roomDepartmentFilterOptions = computed(() => [
  { value: ROOM_DEPARTMENT_ALL, label: 'All departments' },
  ...roomDepartmentOptions.value.map((option) => ({ ...option })),
])

const roomRecordsSummary = computed(() => {
  const pagination = roomsPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No rooms found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const visible = rooms.value.length

  const statusLabel = appliedRoomFilters.status === 'inactive' ? 'deleted rooms' : 'rooms'

  return `Showing ${visible} of ${pagination.total} ${statusLabel} (records ${start}-${end}).`
})

const roomRecordsPerPage = computed({
  get: () => String(roomPageSize.value),
  set: (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === roomPageSize.value) {
      return
    }

    roomPageSize.value = parsed
    roomPage.value = 1
    void loadRooms({ preserveSelection: true })
  },
})

const departmentRecordsSummary = computed(() => {
  const pagination = departmentsPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No departments found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const visible = departments.value.length

  const statusLabel =
    appliedDepartmentFilters.status === 'inactive' ? 'deleted departments' : 'departments'

  return `Showing ${visible} of ${pagination.total} ${statusLabel} (records ${start}-${end}).`
})

const departmentRecordsPerPage = computed({
  get: () => String(departmentPageSize.value),
  set: (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === departmentPageSize.value) {
      return
    }

    departmentPageSize.value = parsed
    departmentPage.value = 1
    void loadDepartments({ preserveSelection: true })
  },
})

const applyRoomSelection = (list: RoomSummary[], preserveSelection: boolean) => {
  if (list.length === 0) {
    selectedRoomId.value = null
    setRoomForm(null)
    return
  }

  const currentId = selectedRoomId.value
  const matched = currentId !== null ? list.find((item) => item.id === currentId) : undefined

  if (preserveSelection && currentId !== null) {
    if (matched) {
      selectedRoomId.value = matched.id
      setRoomForm(matched)
    }
    return
  }

  const target = matched ?? list[0] ?? null
  selectedRoomId.value = target?.id ?? null
  setRoomForm(target)
}

const loadRoomDepartmentOptions = async () => {
  if (roomDepartmentOptionsLoading.value) {
    return
  }

  roomDepartmentOptionsLoading.value = true

  try {
    const limit = 100
    let pageNumber = 1
    const collected: Array<{ value: string; label: string }> = []

    while (true) {
      const { departments: items, pagination } = await getDepartments({
        page: pageNumber,
        limit,
        status: 'active',
      })

      collected.push(
        ...items.map((department) => ({
          value: String(department.id),
          label: department.name,
        })),
      )

      if (pagination.totalPages === 0 || pageNumber >= pagination.totalPages) {
        break
      }

      pageNumber += 1
    }

    const merged = [...collected]
    for (const option of roomDepartmentOptions.value) {
      if (!merged.some((item) => item.value === option.value)) {
        merged.push(option)
      }
    }

    roomDepartmentOptions.value = merged
  } catch (error) {
    console.error(error)
  } finally {
    roomDepartmentOptionsLoading.value = false
  }
}

const loadRooms = async (options: { preserveSelection?: boolean } = {}) => {
  const { preserveSelection = false } = options
  roomsLoading.value = true
  roomsError.value = null

  try {
    const searchTerm = appliedRoomFilters.name.trim() || undefined

    let departmentIdValue: number | undefined
    if (appliedRoomFilters.departmentId !== ROOM_DEPARTMENT_ALL) {
      const parsedId = Number(appliedRoomFilters.departmentId)
      if (Number.isFinite(parsedId) && parsedId > 0) {
        departmentIdValue = parsedId
      }
    }

    const { rooms: items, pagination } = await getRooms({
      page: roomPage.value,
      limit: roomPageSize.value,
      search: searchTerm,
      departmentId: departmentIdValue,
      status: appliedRoomFilters.status,
    })

    rooms.value = items
    roomsPagination.value = pagination
    roomPage.value = pagination.page
    roomPageSize.value = pagination.limit

    items.forEach((item) => {
      ensureRoomDepartmentOption(item.departmentId, item.departmentName)
    })

    applyRoomSelection(items, preserveSelection)
  } catch (error) {
    console.error(error)
    rooms.value = []
    roomsPagination.value = null
    roomsError.value =
      error instanceof Error ? error.message : 'Unable to load rooms. Please try again.'
    applyRoomSelection([], preserveSelection)
  } finally {
    roomsLoading.value = false
  }
}

const handleRoomCreate = async () => {
  if (!isCreatingRoom.value) {
    lastSelectedRoomId.value = selectedRoomId.value
    const previous =
      selectedRoomId.value !== null
        ? (rooms.value.find((room) => room.id === selectedRoomId.value) ?? null)
        : null

    selectedRoomId.value = null
    resetRoomForm()
    if (previous) {
      roomForm.departmentId = String(previous.departmentId)
    }
    isCreatingRoom.value = true
    return
  }

  if (roomCreateLoading.value) {
    return
  }

  const trimmedName = roomForm.name.trim()

  if (!trimmedName) {
    toast.error('Room name cannot be empty.')
    return
  }

  const departmentIdValue = roomForm.departmentId === null ? NaN : Number(roomForm.departmentId)

  if (!Number.isFinite(departmentIdValue) || departmentIdValue <= 0) {
    toast.error('Please select a department for the new room.')
    return
  }

  try {
    roomCreateLoading.value = true

    const created = await createRoom({ name: trimmedName, departmentId: departmentIdValue })

    toast.success('Room created successfully.')

    ensureRoomDepartmentOption(created.departmentId, created.departmentName)

    selectedRoomId.value = created.id
    isCreatingRoom.value = false
    lastSelectedRoomId.value = null

    await loadRooms({ preserveSelection: true })

    const match = rooms.value.find((room) => room.id === created.id) ?? null
    setRoomForm(match)
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to create room. Please try again.'
    toast.error(message)
  } finally {
    roomCreateLoading.value = false
  }
}

const handleRoomCancel = () => {
  if (isCreatingRoom.value) {
    isCreatingRoom.value = false

    const previousId = lastSelectedRoomId.value
    lastSelectedRoomId.value = null

    if (previousId !== null) {
      const previous = rooms.value.find((room) => room.id === previousId) ?? null
      selectedRoomId.value = previous ? previous.id : null
      setRoomForm(previous)
      return
    }

    const fallback = rooms.value[0] ?? null
    selectedRoomId.value = fallback ? fallback.id : null
    setRoomForm(fallback)
    return
  }

  const currentId = selectedRoomId.value
  if (currentId !== null) {
    const current = rooms.value.find((room) => room.id === currentId) ?? null
    setRoomForm(current)
  } else {
    setRoomForm(null)
  }
}

const handleRoomSearch = async () => {
  appliedRoomFilters.name = roomFilters.name.trim()
  appliedRoomFilters.status = roomFilters.status
  appliedRoomFilters.departmentId = roomFilters.departmentId
  roomPage.value = 1
  await loadRooms()
}

const handleRoomReset = async () => {
  roomFilters.name = ''
  roomFilters.status = DEFAULT_ROOM_STATUS
  roomFilters.departmentId = ROOM_DEPARTMENT_ALL
  appliedRoomFilters.name = ''
  appliedRoomFilters.status = DEFAULT_ROOM_STATUS
  appliedRoomFilters.departmentId = ROOM_DEPARTMENT_ALL
  roomPage.value = 1
  await loadRooms()
}

const handleRoomPageChange = async (page: number) => {
  if (roomsLoading.value || page === roomPage.value) {
    return
  }

  roomPage.value = page
  await loadRooms({ preserveSelection: true })
}

const handleRoomSelect = (room: RoomSummary) => {
  selectedRoomId.value = room.id
  setRoomForm(room)
}

const closeRoomDeleteDialog = () => {
  roomDeleteDialogOpen.value = false
}

const handleRoomUpdate = async () => {
  if (roomUpdateLoading.value) {
    return
  }

  if (selectedRoomId.value === null) {
    toast.error('Please select a room to update.')
    return
  }

  if (!roomForm.isActive) {
    toast.error('Cannot update a deleted room.')
    return
  }

  const trimmedName = roomForm.name.trim()

  if (!trimmedName) {
    toast.error('Room name cannot be empty.')
    return
  }

  const departmentIdValue = roomForm.departmentId === null ? NaN : Number(roomForm.departmentId)

  if (!Number.isFinite(departmentIdValue) || departmentIdValue <= 0) {
    toast.error('Please select a department for the room.')
    return
  }

  const currentRoom = rooms.value.find((room) => room.id === selectedRoomId.value)

  if (!currentRoom) {
    toast.error('Selected room is no longer available. Please refresh.')
    return
  }

  const payload: { name?: string; departmentId?: number } = {}

  if (trimmedName !== currentRoom.name) {
    payload.name = trimmedName
  }

  if (departmentIdValue !== currentRoom.departmentId) {
    payload.departmentId = departmentIdValue
  }

  if (Object.keys(payload).length === 0) {
    toast.info('No changes to update.')
    return
  }

  try {
    roomUpdateLoading.value = true
    roomForm.name = trimmedName

    await updateRoom(selectedRoomId.value, payload)

    toast.success('Room updated successfully.')
    await loadRooms({ preserveSelection: true })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to update room. Please try again.'
    toast.error(message)
  } finally {
    roomUpdateLoading.value = false
  }
}

const handleRoomDelete = async () => {
  if (roomDeleteLoading.value) {
    return
  }

  if (selectedRoomId.value === null) {
    toast.error('Please select a room to delete.')
    return
  }

  try {
    roomDeleteLoading.value = true

    await deleteRoom(selectedRoomId.value)

    toast.success('Room deleted successfully.')

    if (rooms.value.length === 1 && roomPage.value > 1) {
      roomPage.value -= 1
    }

    selectedRoomId.value = null
    setRoomForm(null)

    closeRoomDeleteDialog()
    await loadRooms()
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to delete room. Please try again.'
    toast.error(message)
    closeRoomDeleteDialog()
  } finally {
    roomDeleteLoading.value = false
  }
}

const handleRoomRestore = async () => {
  if (roomRestoreLoading.value) {
    return
  }

  if (selectedRoomId.value === null) {
    toast.error('Please select a room to restore.')
    return
  }

  try {
    roomRestoreLoading.value = true

    await restoreRoom(selectedRoomId.value)

    toast.success('Room restored successfully.')

    if (rooms.value.length === 1 && roomPage.value > 1) {
      roomPage.value -= 1
    }

    selectedRoomId.value = null
    setRoomForm(null)

    await loadRooms()
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to restore room. Please try again.'
    toast.error(message)
  } finally {
    roomRestoreLoading.value = false
  }
}

const applyDepartmentSelection = (list: DepartmentSummary[], preserveSelection: boolean) => {
  if (list.length === 0) {
    selectedDepartmentId.value = null
    setDepartmentForm(null)
    return
  }

  const currentId = selectedDepartmentId.value
  const matched = currentId !== null ? list.find((item) => item.id === currentId) : undefined

  if (preserveSelection && currentId !== null) {
    if (matched) {
      selectedDepartmentId.value = matched.id
      setDepartmentForm(matched)
    }
    return
  }

  const target = matched ?? list[0] ?? null
  selectedDepartmentId.value = target?.id ?? null
  setDepartmentForm(target)
}

const loadDepartments = async (options: { preserveSelection?: boolean } = {}) => {
  const { preserveSelection = false } = options
  departmentsLoading.value = true
  departmentsError.value = null

  try {
    const searchTerm = appliedDepartmentFilters.name.trim() || undefined
    const { departments: items, pagination } = await getDepartments({
      page: departmentPage.value,
      limit: departmentPageSize.value,
      search: searchTerm,
      status: appliedDepartmentFilters.status,
    })

    departments.value = items
    departmentsPagination.value = pagination
    departmentPage.value = pagination.page
    departmentPageSize.value = pagination.limit

    applyDepartmentSelection(items, preserveSelection)
  } catch (error) {
    console.error(error)
    departments.value = []
    departmentsPagination.value = null
    departmentsError.value =
      error instanceof Error ? error.message : 'Unable to load departments. Please try again.'
    applyDepartmentSelection([], preserveSelection)
  } finally {
    departmentsLoading.value = false
  }
}

const handleDepartmentCreate = async () => {
  if (!isCreatingDepartment.value) {
    lastSelectedDepartmentId.value = selectedDepartmentId.value
    selectedDepartmentId.value = null
    resetDepartmentForm()
    isCreatingDepartment.value = true
    return
  }

  if (departmentCreateLoading.value) {
    return
  }

  const trimmedName = departmentForm.name.trim()

  if (!trimmedName) {
    toast.error('Department name cannot be empty.')
    return
  }

  try {
    departmentCreateLoading.value = true

    const created = await createDepartment({ name: trimmedName })

    toast.success('Department created successfully.')

    ensureRoomDepartmentOption(created.id, created.name)

    selectedDepartmentId.value = created.id
    isCreatingDepartment.value = false
    lastSelectedDepartmentId.value = null

    await loadDepartments({ preserveSelection: true })

    const match = departments.value.find((department) => department.id === created.id) ?? null
    setDepartmentForm(match)
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to create department. Please try again.'
    toast.error(message)
  } finally {
    departmentCreateLoading.value = false
  }
}

const handleDepartmentCancel = () => {
  if (isCreatingDepartment.value) {
    isCreatingDepartment.value = false

    const previousId = lastSelectedDepartmentId.value
    lastSelectedDepartmentId.value = null

    if (previousId !== null) {
      const previous = departments.value.find((department) => department.id === previousId) ?? null
      selectedDepartmentId.value = previous ? previous.id : null
      setDepartmentForm(previous)
      return
    }

    const fallback = departments.value[0] ?? null
    selectedDepartmentId.value = fallback ? fallback.id : null
    setDepartmentForm(fallback)
    return
  }

  const currentId = selectedDepartmentId.value
  if (currentId !== null) {
    const current = departments.value.find((department) => department.id === currentId) ?? null
    setDepartmentForm(current)
  } else {
    setDepartmentForm(null)
  }
}

const handleDepartmentSearch = async () => {
  appliedDepartmentFilters.name = departmentFilters.name.trim()
  appliedDepartmentFilters.status = departmentFilters.status
  departmentPage.value = 1
  await loadDepartments()
}

const handleDepartmentReset = async () => {
  departmentFilters.name = ''
  departmentFilters.status = DEFAULT_DEPARTMENT_STATUS
  appliedDepartmentFilters.name = ''
  appliedDepartmentFilters.status = DEFAULT_DEPARTMENT_STATUS
  departmentPage.value = 1
  await loadDepartments()
}

const handleDepartmentPageChange = async (page: number) => {
  if (departmentsLoading.value || page === departmentPage.value) {
    return
  }

  departmentPage.value = page
  await loadDepartments({ preserveSelection: true })
}

const handleDepartmentSelect = (department: DepartmentSummary) => {
  selectedDepartmentId.value = department.id
  setDepartmentForm(department)
}

const closeDeleteDialog = () => {
  deleteDialogOpen.value = false
}

const handleDepartmentUpdate = async () => {
  if (departmentUpdateLoading.value) {
    return
  }

  if (selectedDepartmentId.value === null) {
    toast.error('Please select a department to update.')
    return
  }

  if (!departmentForm.isActive) {
    toast.error('Cannot update a deleted department.')
    return
  }

  const trimmedName = departmentForm.name.trim()

  if (!trimmedName) {
    toast.error('Department name cannot be empty.')
    return
  }

  try {
    departmentUpdateLoading.value = true
    departmentForm.name = trimmedName

    await updateDepartment(selectedDepartmentId.value, { name: trimmedName })

    toast.success('Department updated successfully.')
    await loadDepartments({ preserveSelection: true })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to update department. Please try again.'
    toast.error(message)
  } finally {
    departmentUpdateLoading.value = false
  }
}

const handleDepartmentDelete = async () => {
  if (departmentDeleteLoading.value) {
    return
  }

  if (selectedDepartmentId.value === null) {
    toast.error('Please select a department to delete.')
    return
  }

  try {
    departmentDeleteLoading.value = true

    await deleteDepartment(selectedDepartmentId.value)

    toast.success('Department deleted successfully.')

    if (departments.value.length === 1 && departmentPage.value > 1) {
      departmentPage.value -= 1
    }

    selectedDepartmentId.value = null
    setDepartmentForm(null)

    closeDeleteDialog()
    await loadDepartments()
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to delete department. Please try again.'
    toast.error(message)
    closeDeleteDialog()
  } finally {
    departmentDeleteLoading.value = false
  }
}

const handleDepartmentRestore = async () => {
  if (departmentRestoreLoading.value) {
    return
  }

  if (selectedDepartmentId.value === null) {
    toast.error('Please select a department to restore.')
    return
  }

  try {
    departmentRestoreLoading.value = true

    await restoreDepartment(selectedDepartmentId.value)

    toast.success('Department restored successfully.')

    if (departments.value.length === 1 && departmentPage.value > 1) {
      departmentPage.value -= 1
    }

    selectedDepartmentId.value = null
    setDepartmentForm(null)

    await loadDepartments()
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError ? error.message : 'Unable to restore department. Please try again.'
    toast.error(message)
  } finally {
    departmentRestoreLoading.value = false
  }
}

onMounted(() => {
  void loadRoomDepartmentOptions()
  void loadDepartments()
  void loadRooms()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <Card>
        <CardHeader>
          <CardTitle>Department &amp; Room Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs v-model="activeTab" class="w-full">
            <TabsList class="grid w-full grid-cols-2 gap-2">
              <TabsTrigger value="department">Department</TabsTrigger>
              <TabsTrigger value="room">Room</TabsTrigger>
            </TabsList>

            <TabsContent value="department" class="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Department Details</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div
                    v-if="
                      !isCreatingDepartment && selectedDepartmentId === null && !departmentsLoading
                    "
                    class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground"
                  >
                    Select a department from the list or add a new department to get started.
                  </div>

                  <div v-else class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-3">
                      <Field class="md:col-span-2">
                        <FieldLabel for="department-name">Department Name</FieldLabel>
                        <Input
                          id="department-name"
                          v-model="departmentForm.name"
                          placeholder="Enter department name"
                          :disabled="
                            (!isCreatingDepartment &&
                              (selectedDepartmentId === null || !departmentForm.isActive)) ||
                            departmentCreateLoading ||
                            departmentUpdateLoading ||
                            departmentDeleteLoading ||
                            departmentRestoreLoading ||
                            departmentsLoading
                          "
                        />
                      </Field>

                      <Field>
                        <FieldLabel for="department-room-count">Room Count</FieldLabel>
                        <Input
                          id="department-room-count"
                          v-model="departmentForm.roomCount"
                          disabled
                        />
                      </Field>
                    </div>

                    <div class="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        class="flex items-center"
                        :disabled="
                          departmentsLoading ||
                          departmentUpdateLoading ||
                          departmentDeleteLoading ||
                          departmentRestoreLoading ||
                          departmentCreateLoading
                        "
                        @click="handleDepartmentCreate"
                      >
                        <Loader2 v-if="departmentCreateLoading" class="mr-2 h-4 w-4 animate-spin" />
                        <PlusIcon v-else class="mr-2 h-4 w-4" />
                        {{
                          isCreatingDepartment
                            ? departmentCreateLoading
                              ? 'Adding…'
                              : 'Add Department'
                            : 'New Department'
                        }}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="
                          departmentCreateLoading ||
                          departmentUpdateLoading ||
                          departmentDeleteLoading ||
                          departmentRestoreLoading
                        "
                        @click="handleDepartmentCancel"
                      >
                        Cancel
                      </Button>

                      <template v-if="!isCreatingDepartment">
                        <template v-if="departmentForm.isActive">
                          <AlertDialog v-model:open="deleteDialogOpen">
                            <AlertDialogTrigger as-child>
                              <Button
                                type="button"
                                variant="destructive"
                                :disabled="
                                  departmentsLoading ||
                                  departmentUpdateLoading ||
                                  departmentDeleteLoading ||
                                  departmentRestoreLoading ||
                                  departmentCreateLoading ||
                                  selectedDepartmentId === null
                                "
                              >
                                <Loader2
                                  v-if="departmentDeleteLoading"
                                  class="mr-2 h-4 w-4 animate-spin"
                                />
                                Delete Department
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete department?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. The department and its rooms will be
                                  deactivated.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel :disabled="departmentDeleteLoading">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  :disabled="departmentDeleteLoading"
                                  @click="handleDepartmentDelete"
                                >
                                  <Loader2
                                    v-if="departmentDeleteLoading"
                                    class="mr-2 h-4 w-4 animate-spin"
                                  />
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            type="button"
                            :disabled="
                              departmentsLoading ||
                              departmentUpdateLoading ||
                              departmentDeleteLoading ||
                              departmentRestoreLoading ||
                              departmentCreateLoading ||
                              selectedDepartmentId === null
                            "
                            @click="handleDepartmentUpdate"
                          >
                            <Loader2
                              v-if="departmentUpdateLoading"
                              class="mr-2 h-4 w-4 animate-spin"
                            />
                            Update Department
                          </Button>
                        </template>
                        <template v-else>
                          <Button
                            type="button"
                            variant="outline"
                            :disabled="
                              departmentsLoading ||
                              departmentDeleteLoading ||
                              departmentUpdateLoading ||
                              departmentRestoreLoading ||
                              departmentCreateLoading ||
                              selectedDepartmentId === null
                            "
                            @click="handleDepartmentRestore"
                          >
                            <Loader2
                              v-if="departmentRestoreLoading"
                              class="mr-2 h-4 w-4 animate-spin"
                            />
                            Restore Department
                          </Button>
                        </template>
                      </template>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Department List</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
                    <Field>
                      <FieldLabel for="department-search-name">Department Name</FieldLabel>
                      <Input
                        id="department-search-name"
                        v-model="departmentFilters.name"
                        placeholder="Search by name"
                      />
                    </Field>

                    <Field>
                      <FieldLabel for="department-status-filter">Status</FieldLabel>
                      <NativeSelect
                        id="department-status-filter"
                        v-model="departmentFilters.status"
                        :disabled="departmentsLoading"
                      >
                        <option
                          v-for="option in DEPARTMENT_STATUS_OPTIONS"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </NativeSelect>
                    </Field>

                    <Field>
                      <FieldLabel for="department-page-size">Records per page</FieldLabel>
                      <NativeSelect
                        id="department-page-size"
                        v-model="departmentRecordsPerPage"
                        :disabled="departmentsLoading"
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
                        :disabled="departmentsLoading"
                        @click="handleDepartmentSearch"
                      >
                        <SearchIcon class="mr-2 h-4 w-4" />
                        Search
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="departmentsLoading"
                        @click="handleDepartmentReset"
                      >
                        <RotateCcw class="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  <p v-if="departmentsError" class="text-sm text-destructive">
                    {{ departmentsError }}
                  </p>

                  <div class="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead class="w-32">Status</TableHead>
                          <TableHead class="w-40 text-right">Rooms</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="departmentsLoading">
                          <TableCell colspan="3">
                            <div
                              class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                            >
                              <Loader2 class="h-4 w-4 animate-spin" />
                              Loading departments…
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow v-else-if="departments.length === 0">
                          <TableCell colspan="3">
                            <div class="py-6 text-center text-sm text-muted-foreground">
                              No departments match the current filters.
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="department in departments"
                          v-else
                          :key="department.id"
                          :class="[
                            'cursor-pointer transition-colors',
                            department.id === selectedDepartmentId
                              ? 'bg-muted'
                              : 'hover:bg-muted/60',
                          ]"
                          @click="handleDepartmentSelect(department)"
                        >
                          <TableCell>{{ department.name }}</TableCell>
                          <TableCell class="w-32">
                            <span
                              :class="
                                department.isActive ? 'text-muted-foreground' : 'text-destructive'
                              "
                            >
                              {{ department.isActive ? 'Active' : 'Deleted' }}
                            </span>
                          </TableCell>
                          <TableCell class="text-right">{{ department.roomCount }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div
                    class="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
                  >
                    <span>{{ departmentRecordsSummary }}</span>
                    <div v-if="departmentsPagination" class="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="departmentsLoading || departmentPage <= 1"
                        @click="handleDepartmentPageChange(Math.max(1, departmentPage - 1))"
                      >
                        Previous
                      </Button>
                      <span class="min-w-32 text-center">
                        Page {{ departmentPage }} / {{ departmentsPagination.totalPages }}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="
                          departmentsLoading || departmentPage >= departmentsPagination.totalPages
                        "
                        @click="
                          handleDepartmentPageChange(
                            Math.min(departmentsPagination.totalPages, departmentPage + 1),
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

            <TabsContent value="room" class="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Room Details</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div
                    v-if="!isCreatingRoom && selectedRoomId === null && !roomsLoading"
                    class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground"
                  >
                    Select a room from the list or add a new room to get started.
                  </div>

                  <div v-else class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-3">
                      <Field class="md:col-span-2">
                        <FieldLabel for="room-name">Room Name</FieldLabel>
                        <Input
                          id="room-name"
                          v-model="roomForm.name"
                          placeholder="Enter room name"
                          :disabled="
                            (!isCreatingRoom && (selectedRoomId === null || !roomForm.isActive)) ||
                            roomCreateLoading ||
                            roomUpdateLoading ||
                            roomDeleteLoading ||
                            roomRestoreLoading ||
                            roomsLoading
                          "
                        />
                      </Field>

                      <Field>
                        <FieldLabel for="room-department">Department</FieldLabel>
                        <ComboBox
                          id="room-department"
                          v-model="roomForm.departmentId"
                          :options="roomDepartmentOptions"
                          placeholder="Select department"
                          search-placeholder="Search department"
                          empty-message="No departments found."
                          :loading="roomDepartmentOptionsLoading"
                          :disabled="
                            (!isCreatingRoom && (selectedRoomId === null || !roomForm.isActive)) ||
                            roomCreateLoading ||
                            roomUpdateLoading ||
                            roomDeleteLoading ||
                            roomRestoreLoading ||
                            roomDepartmentOptionsLoading
                          "
                        />
                      </Field>
                    </div>

                    <p
                      v-if="
                        isCreatingRoom &&
                        roomDepartmentOptions.length === 0 &&
                        !roomDepartmentOptionsLoading
                      "
                      class="text-sm text-muted-foreground"
                    >
                      Create a department before adding rooms.
                    </p>

                    <div class="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        class="flex items-center"
                        :disabled="
                          roomsLoading ||
                          roomUpdateLoading ||
                          roomDeleteLoading ||
                          roomRestoreLoading ||
                          roomCreateLoading
                        "
                        @click="handleRoomCreate"
                      >
                        <Loader2 v-if="roomCreateLoading" class="mr-2 h-4 w-4 animate-spin" />
                        <PlusIcon v-else class="mr-2 h-4 w-4" />
                        {{
                          isCreatingRoom ? (roomCreateLoading ? 'Adding…' : 'Add Room') : 'New Room'
                        }}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="
                          roomCreateLoading ||
                          roomUpdateLoading ||
                          roomDeleteLoading ||
                          roomRestoreLoading
                        "
                        @click="handleRoomCancel"
                      >
                        Cancel
                      </Button>

                      <template v-if="!isCreatingRoom">
                        <template v-if="roomForm.isActive">
                          <AlertDialog v-model:open="roomDeleteDialogOpen">
                            <AlertDialogTrigger as-child>
                              <Button
                                type="button"
                                variant="destructive"
                                :disabled="
                                  roomsLoading ||
                                  roomUpdateLoading ||
                                  roomDeleteLoading ||
                                  roomRestoreLoading ||
                                  roomCreateLoading ||
                                  selectedRoomId === null
                                "
                              >
                                <Loader2
                                  v-if="roomDeleteLoading"
                                  class="mr-2 h-4 w-4 animate-spin"
                                />
                                Delete Room
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete room?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. The room will be deactivated.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel :disabled="roomDeleteLoading">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  :disabled="roomDeleteLoading"
                                  @click="handleRoomDelete"
                                >
                                  <Loader2
                                    v-if="roomDeleteLoading"
                                    class="mr-2 h-4 w-4 animate-spin"
                                  />
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            type="button"
                            :disabled="
                              roomsLoading ||
                              roomUpdateLoading ||
                              roomDeleteLoading ||
                              roomRestoreLoading ||
                              roomCreateLoading ||
                              selectedRoomId === null
                            "
                            @click="handleRoomUpdate"
                          >
                            <Loader2 v-if="roomUpdateLoading" class="mr-2 h-4 w-4 animate-spin" />
                            Update Room
                          </Button>
                        </template>
                        <template v-else>
                          <Button
                            type="button"
                            variant="outline"
                            :disabled="
                              roomsLoading ||
                              roomDeleteLoading ||
                              roomUpdateLoading ||
                              roomRestoreLoading ||
                              roomCreateLoading ||
                              selectedRoomId === null
                            "
                            @click="handleRoomRestore"
                          >
                            <Loader2 v-if="roomRestoreLoading" class="mr-2 h-4 w-4 animate-spin" />
                            Restore Room
                          </Button>
                        </template>
                      </template>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Room List</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div
                    class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] md:items-end"
                  >
                    <Field>
                      <FieldLabel for="room-search-name">Room Name</FieldLabel>
                      <Input
                        id="room-search-name"
                        v-model="roomFilters.name"
                        placeholder="Search by name"
                      />
                    </Field>

                    <Field>
                      <FieldLabel for="room-status-filter">Status</FieldLabel>
                      <NativeSelect
                        id="room-status-filter"
                        v-model="roomFilters.status"
                        :disabled="roomsLoading"
                      >
                        <option
                          v-for="option in ROOM_STATUS_OPTIONS"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </NativeSelect>
                    </Field>

                    <Field>
                      <FieldLabel for="room-department-filter">Department</FieldLabel>
                      <NativeSelect
                        id="room-department-filter"
                        v-model="roomFilters.departmentId"
                        :disabled="roomsLoading"
                      >
                        <option
                          v-for="option in roomDepartmentFilterOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </NativeSelect>
                    </Field>

                    <Field>
                      <FieldLabel for="room-page-size">Records per page</FieldLabel>
                      <NativeSelect
                        id="room-page-size"
                        v-model="roomRecordsPerPage"
                        :disabled="roomsLoading"
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
                      <Button type="button" :disabled="roomsLoading" @click="handleRoomSearch">
                        <SearchIcon class="mr-2 h-4 w-4" />
                        Search
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="roomsLoading"
                        @click="handleRoomReset"
                      >
                        <RotateCcw class="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  <p v-if="roomsError" class="text-sm text-destructive">
                    {{ roomsError }}
                  </p>

                  <div class="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead class="w-48">Department</TableHead>
                          <TableHead class="w-32">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="roomsLoading">
                          <TableCell colspan="3">
                            <div
                              class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                            >
                              <Loader2 class="h-4 w-4 animate-spin" />
                              Loading rooms…
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow v-else-if="rooms.length === 0">
                          <TableCell colspan="3">
                            <div class="py-6 text-center text-sm text-muted-foreground">
                              No rooms match the current filters.
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="room in rooms"
                          v-else
                          :key="room.id"
                          :class="[
                            'cursor-pointer transition-colors',
                            room.id === selectedRoomId ? 'bg-muted' : 'hover:bg-muted/60',
                          ]"
                          @click="handleRoomSelect(room)"
                        >
                          <TableCell>{{ room.name }}</TableCell>
                          <TableCell>{{ room.departmentName }}</TableCell>
                          <TableCell>
                            <span
                              :class="room.isActive ? 'text-muted-foreground' : 'text-destructive'"
                            >
                              {{ room.isActive ? 'Active' : 'Deleted' }}
                            </span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div
                    class="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
                  >
                    <span>{{ roomRecordsSummary }}</span>
                    <div v-if="roomsPagination" class="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="roomsLoading || roomPage <= 1"
                        @click="handleRoomPageChange(Math.max(1, roomPage - 1))"
                      >
                        Previous
                      </Button>
                      <span class="min-w-32 text-center">
                        Page {{ roomPage }} / {{ roomsPagination.totalPages }}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="roomsLoading || roomPage >= roomsPagination.totalPages"
                        @click="
                          handleRoomPageChange(Math.min(roomsPagination.totalPages, roomPage + 1))
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
