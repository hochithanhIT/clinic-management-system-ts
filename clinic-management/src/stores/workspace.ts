import { computed, ref } from "vue"
import { defineStore } from "pinia"

export interface SelectedDepartment {
  id: number
  name: string
}

export interface SelectedRoom {
  id: number
  name: string
  departmentId: number
  departmentName: string
}

interface WorkspaceState {
  department: SelectedDepartment | null
  room: SelectedRoom | null
}

const STORAGE_KEY = "clinic-workspace-selection"

const getDefaultState = (): WorkspaceState => ({
  department: null,
  room: null,
})

const readStoredState = (): WorkspaceState => {
  if (typeof window === "undefined") {
    return getDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultState()

    const parsed = JSON.parse(raw) as Partial<WorkspaceState>

    return {
      department: parsed.department ?? null,
      room: parsed.room ?? null,
    }
  } catch (error) {
    console.warn("Unable to read workspace selection", error)
    return getDefaultState()
  }
}

const writeStoredState = (state: WorkspaceState): void => {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn("Unable to persist workspace selection", error)
  }
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const state = ref<WorkspaceState>(readStoredState())

  const department = computed(() => state.value.department)
  const room = computed(() => state.value.room)

  const updateState = (next: WorkspaceState) => {
    state.value = next
    writeStoredState(next)
  }

  const setDepartment = (value: SelectedDepartment | null) => {
    const roomSelection = value && state.value.room?.departmentId === value.id ? state.value.room : null

    updateState({
      department: value,
      room: roomSelection,
    })
  }

  const setRoom = (value: SelectedRoom | null) => {
    if (!value) {
      updateState({
        department: state.value.department,
        room: null,
      })
      return
    }

    updateState({
      department: {
        id: value.departmentId,
        name: value.departmentName,
      },
      room: value,
    })
  }

  const clear = () => {
    updateState(getDefaultState())
  }

  return {
    department,
    room,
    setDepartment,
    setRoom,
    clear,
  }
})
