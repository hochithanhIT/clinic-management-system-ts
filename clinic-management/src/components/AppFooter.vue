<script setup lang="ts">
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const { user } = storeToRefs(authStore)
const { department, room } = storeToRefs(workspaceStore)

const userDisplayName = computed(() => {
  const account = user.value
  if (!account) {
    return 'Guest'
  }

  const fullName = account.hoTen?.trim()
  const username = account.tenDangNhap.toUpperCase()

  if (fullName) {
    return `${fullName} - ${username}`
  }

  return username
})

const hasRoomSelection = computed(() => room.value !== null)
const departmentDisplay = computed(() => room.value?.departmentName ?? department.value?.name ?? '')
const roomDisplay = computed(() => room.value?.name ?? '')

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 30_000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const nowText = computed(() =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(now.value),
)
</script>

<template>
  <footer class="border-t bg-primary text-primary-foreground">
    <div
      class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm"
    >
      <!-- Left: user -->
      <div class="flex items-center gap-2">
        <span class="font-bold">{{ userDisplayName }}</span>
      </div>

      <!-- Middle: dept/room -->
      <div v-if="hasRoomSelection" class="flex items-center gap-2 font-medium">
        <span>{{ departmentDisplay }}</span>
        <span>•</span>
        <span>{{ roomDisplay }}</span>
      </div>

      <!-- Right: time -->
      <div class="font-medium">
        {{ nowText }}
      </div>
    </div>
  </footer>
</template>
