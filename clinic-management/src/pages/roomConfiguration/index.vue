<script setup lang="ts">
import { toast } from 'vue-sonner'
import { ApiError } from '@/services/http'
import { getDepartments } from '@/services/department'
import type { DepartmentSummary } from '@/services/department'
import { getRooms } from '@/services/room'
import type { RoomSummary } from '@/services/room'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import ComboBox from '@/components/ComboBox.vue'
import { normalizeText } from '@/lib/utils'
import { resolveRoleKey } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

definePage({
  alias: '/room-configuration/',
  meta: {
    requiresAuth: true,
  },
})

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const { department: storedDepartment, room: storedRoom } = storeToRefs(workspaceStore)
const router = useRouter()

const roleKey = computed(() => resolveRoleKey(authStore.user?.role?.name))
const isAccountant = computed(() => roleKey.value === 'accountant')
const isDoctor = computed(() => roleKey.value === 'doctor')
const isNurse = computed(() => roleKey.value === 'nurse')
const isTechnician = computed(() => roleKey.value === 'technician')
const hideRestrictedDepartments = computed(() => isDoctor.value || isNurse.value)

const financeDepartmentLabel = 'Phòng Tài Chính'
const financeDepartmentKey = normalizeText(financeDepartmentLabel)
const restrictedDepartmentLabels = [
  'Khoa Chẩn Đoán Hình Ảnh',
  'Khoa Xét Nghiệm',
  'Khoa Dược',
  financeDepartmentLabel,
]
const restrictedDepartmentKeys = restrictedDepartmentLabels.map((label) => normalizeText(label))
const technicianAllowedDepartmentLabels = ['Khoa Chẩn Đoán Hình Ảnh', 'Khoa Xét Nghiệm']
const technicianAllowedDepartmentKeys = technicianAllowedDepartmentLabels.map((label) =>
  normalizeText(label),
)

const departments = ref<DepartmentSummary[]>([])
const rooms = ref<RoomSummary[]>([])

const selectedDepartmentId = ref<number | null>(storedDepartment.value?.id ?? null)
const selectedRoomId = ref<number | null>(storedRoom.value?.id ?? null)

const loadingDepartments = ref(false)
const loadingRooms = ref(false)

const departmentOptions = computed(() =>
  departments.value.map((department) => ({
    value: department.id,
    label: department.name,
  })),
)

const roomOptions = computed(() =>
  rooms.value.map((room) => ({
    value: room.id,
    label: room.name,
  })),
)

const submitDisabled = computed(
  () =>
    !selectedDepartmentId.value ||
    !selectedRoomId.value ||
    loadingDepartments.value ||
    loadingRooms.value,
)

const showErrorToast = (error: unknown, fallback: string) => {
  const message = error instanceof ApiError ? error.message : fallback
  toast.error(message)
}

const fetchAllDepartments = async (): Promise<DepartmentSummary[]> => {
  const collected: DepartmentSummary[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const { departments: chunk, pagination } = await getDepartments({ page, limit: 100 })

    if (!chunk.length) {
      break
    }

    collected.push(...chunk)
    totalPages = Math.max(1, pagination.totalPages)
    page += 1
  }

  return collected
}

const loadDepartments = async () => {
  loadingDepartments.value = true
  try {
    const previousDepartmentId = selectedDepartmentId.value
    const allDepartments = await fetchAllDepartments()

    let availableDepartments = allDepartments

    if (isAccountant.value) {
      availableDepartments = availableDepartments.filter(
        (department) => normalizeText(department.name) === financeDepartmentKey,
      )
    } else if (isTechnician.value) {
      availableDepartments = availableDepartments.filter((department) =>
        technicianAllowedDepartmentKeys.includes(normalizeText(department.name)),
      )
    } else if (hideRestrictedDepartments.value) {
      availableDepartments = availableDepartments.filter(
        (department) => !restrictedDepartmentKeys.includes(normalizeText(department.name)),
      )
    }

    departments.value = availableDepartments

    if (isAccountant.value && availableDepartments.length === 0) {
      selectedDepartmentId.value = null
      rooms.value = []
      workspaceStore.clear()
      toast.error(`Finance department (${financeDepartmentLabel}) is not available.`)
      return
    }

    if (isTechnician.value && availableDepartments.length === 0) {
      selectedDepartmentId.value = null
      rooms.value = []
      workspaceStore.clear()
      toast.error('No diagnostic departments are available for your role.')
      return
    }

    if (hideRestrictedDepartments.value && availableDepartments.length === 0) {
      selectedDepartmentId.value = null
      rooms.value = []
      workspaceStore.clear()
      toast.error('No departments available for your role.')
      return
    }

    const storedDepartmentId = storedDepartment.value?.id
    const matchedStoredDepartment = storedDepartmentId
      ? availableDepartments.find((department) => department.id === storedDepartmentId)
      : null

    if (storedDepartmentId && !matchedStoredDepartment) {
      workspaceStore.clear()
    }

    if (matchedStoredDepartment) {
      selectedDepartmentId.value = matchedStoredDepartment.id
    }

    if (!selectedDepartmentId.value && availableDepartments.length) {
      const firstDepartment = availableDepartments[0]
      selectedDepartmentId.value = firstDepartment ? firstDepartment.id : null
    }

    const currentDepartmentId = selectedDepartmentId.value
    if (currentDepartmentId !== null && currentDepartmentId === previousDepartmentId) {
      await loadRooms(currentDepartmentId)
    }
  } catch (error) {
    showErrorToast(error, 'Failed to load departments.')
  } finally {
    loadingDepartments.value = false
  }
}

const loadRooms = async (departmentId: number) => {
  loadingRooms.value = true
  try {
    const result = await getRooms({ departmentId, limit: 100 })
    rooms.value = result.rooms

    const storedRoomSelection = storedRoom.value
    const matchedStoredRoom =
      storedRoomSelection?.departmentId === departmentId
        ? result.rooms.find((room) => room.id === storedRoomSelection.id)
        : null

    if (
      storedRoomSelection &&
      storedRoomSelection.departmentId === departmentId &&
      !matchedStoredRoom
    ) {
      workspaceStore.clear()
    }

    if (matchedStoredRoom) {
      selectedRoomId.value = matchedStoredRoom.id
    }

    if (!selectedRoomId.value) {
      const firstRoom = result.rooms[0]
      selectedRoomId.value = firstRoom ? firstRoom.id : null
    }
  } catch (error) {
    showErrorToast(error, 'Failed to load rooms.')
  } finally {
    loadingRooms.value = false
  }
}

const handleSubmit = async () => {
  if (!selectedDepartmentId.value || !selectedRoomId.value) {
    toast.error('Please select both department and room before saving.')
    return
  }

  const department = departments.value.find((item) => item.id === selectedDepartmentId.value)
  const room = rooms.value.find((item) => item.id === selectedRoomId.value)

  if (!department || !room) {
    toast.error('Selected department or room is no longer available.')
    return
  }

  workspaceStore.setRoom({
    id: room.id,
    name: room.name,
    departmentId: room.departmentId,
    departmentName: room.departmentName,
  })

  toast.success('Room configuration saved.')
  await router.replace({ path: '/' })
}

onMounted(() => {
  void loadDepartments()
})

watch(selectedDepartmentId, (departmentId) => {
  selectedRoomId.value = null
  rooms.value = []

  if (departmentId === null) {
    return
  }

  void loadRooms(departmentId)
})
</script>

<template>
  <div>
    <div class="mx-auto flex h-full max-w-full items-center justify-center bg-primary-foreground">
      <Card class="w-full max-w-xl">
        <CardHeader class="text-center">
          <CardTitle>Room Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="room-config-form" class="grid w-full gap-8" @submit.prevent="handleSubmit">
            <div class="flex flex-col space-y-1.5">
              <Label for="department">Department</Label>
              <ComboBox
                id="department"
                v-model="selectedDepartmentId"
                :options="departmentOptions"
                placeholder="Select department..."
                search-placeholder="Search department..."
                empty-message="No departments found."
                :loading="loadingDepartments"
                :disabled="isAccountant"
              />
            </div>
            <div class="flex flex-col space-y-1.5">
              <Label for="room">Room</Label>
              <ComboBox
                id="room"
                v-model="selectedRoomId"
                :options="roomOptions"
                placeholder="Select room..."
                search-placeholder="Search room..."
                empty-message="No rooms found."
                :loading="loadingRooms"
                :disabled="!selectedDepartmentId || loadingDepartments"
              />
            </div>
          </form>
        </CardContent>
        <CardFooter class="flex flex-col gap-2">
          <Button type="submit" form="room-config-form" class="w-full" :disabled="submitDisabled">
            OK
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
