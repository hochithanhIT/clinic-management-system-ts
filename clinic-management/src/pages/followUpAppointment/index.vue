<script setup lang="ts">
definePage({
  alias: '/follow-up-appointment/',
  meta: {
    requiresAuth: true,
  },
})

import type { CalendarDate } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'
import type { DateValue } from 'reka-ui'
import { CalendarIcon, SearchIcon } from 'lucide-vue-next'
import type { AcceptableValue } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import ComboBox from '@/components/ComboBox.vue'
import { normalizeText } from '@/lib/utils'
import { getAppointments, type AppointmentSummary } from '@/services/appointment'
import { getRooms } from '@/services/room'
import type { RoomSummary } from '@/services/room'
import type { PaginationMeta } from '@/services/types'
import { useWorkspaceStore } from '@/stores/workspace'

type ComboboxOption = {
  value: number
  label: string
}

type AppliedFilters = {
  patientCode: string
  patientName: string
  roomId: number | null
  from: Date | null
  to: Date | null
}

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

const normalizeForSearch = (value: string | null | undefined): string => {
  return normalizeText(value ?? '')
}

const resolveDateValue = (value: CalendarDate | undefined): Date | null => {
  if (!value || typeof value.toDate !== 'function') {
    return null
  }

  return value.toDate(timeZone)
}

const timeZone = getLocalTimeZone()
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const workspaceStore = useWorkspaceStore()
const { room: storedRoom } = storeToRefs(workspaceStore)

const todayValue = today(timeZone)
const baseDate = todayValue.toDate(timeZone)

const filters = reactive({
  patientCode: '',
  patientName: '',
  roomId: null as number | null,
})

const fromDateModel = shallowRef<CalendarDate | undefined>(todayValue)
const toDateModel = shallowRef<CalendarDate | undefined>(todayValue)

const appliedFilters = ref<AppliedFilters>({
  patientCode: '',
  patientName: '',
  roomId: filters.roomId,
  from: startOfDay(baseDate),
  to: endOfDay(baseDate),
})

const appointments = ref<AppointmentSummary[]>([])
const appointmentsLoading = ref(false)
const appointmentsPagination = ref<PaginationMeta | null>(null)
const appointmentsPage = ref(1)
const appointmentsPageSize = ref(20)
const appointmentsPageSizeOptions = [10, 20, 30, 50]

const roomOptions = ref<ComboboxOption[]>([])
const loadingRooms = ref(false)

const filterErrors = ref<string[]>([])
const fromPopoverOpen = ref(false)
const toPopoverOpen = ref(false)

const fromLabel = computed(() => {
  const value = fromDateModel.value
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  return dateFormatter.format(value.toDate(timeZone))
})

const toLabel = computed(() => {
  const value = toDateModel.value
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  return dateFormatter.format(value.toDate(timeZone))
})

const hasFromDate = computed(() => Boolean(fromDateModel.value))
const hasToDate = computed(() => Boolean(toDateModel.value))

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateTimeFormatter.format(date)
}

const filteredAppointments = computed(() => {
  const codeFilter = normalizeForSearch(appliedFilters.value.patientCode)
  const nameFilter = normalizeForSearch(appliedFilters.value.patientName)

  return appointments.value.filter((appointment) => {
    const patientCode = normalizeForSearch(appointment.patient?.code)
    const patientName = normalizeForSearch(appointment.patient?.fullName)

    if (codeFilter && !patientCode.includes(codeFilter)) {
      return false
    }

    if (nameFilter && !patientName.includes(nameFilter)) {
      return false
    }

    return true
  })
})

const appointmentsSummary = computed(() => {
  const pagination = appointmentsPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No follow-up appointments found.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const filteredCount = filteredAppointments.value.length

  return `Showing ${filteredCount} of ${pagination.total} appointments (appointments ${start}-${end}).`
})

const ensureRoomOption = (rooms: RoomSummary[]): ComboboxOption[] => {
  const options = rooms.map((room) => ({
    value: room.id,
    label: `${room.name} · ${room.departmentName ?? 'No department'}`,
  }))

  if (storedRoom.value) {
    const exists = options.some((option) => option.value === storedRoom.value?.id)
    if (!exists) {
      options.push({ value: storedRoom.value.id, label: storedRoom.value.name })
    }
  }

  return options
}

const ensureOptionRetained = (options: ComboboxOption[], value: number | null): number | null => {
  if (value === null) {
    return null
  }

  const exists = options.some((option) => option.value === value)
  return exists ? value : null
}

const clearFilterErrors = () => {
  filterErrors.value = []
}

const setFilterError = (message: string) => {
  filterErrors.value = [message]
}

const loadRooms = async () => {
  loadingRooms.value = true
  try {
    const options: ComboboxOption[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const { rooms, pagination } = await getRooms({ page, limit: 100 })
      options.push(...ensureRoomOption(rooms))
      totalPages = Math.max(1, pagination.totalPages)
      page += 1
    }

    const uniqueOptions = options.filter(
      (option, index, array) => array.findIndex((item) => item.value === option.value) === index,
    )

    roomOptions.value = uniqueOptions
    filters.roomId = ensureOptionRetained(uniqueOptions, filters.roomId)
  } catch (error) {
    console.error(error)
    toast.error('Unable to load clinic rooms for appointments.')
  } finally {
    loadingRooms.value = false
  }
}

const loadAppointments = async () => {
  appointmentsLoading.value = true
  try {
    const { appointments: list, pagination } = await getAppointments({
      page: appointmentsPage.value,
      limit: appointmentsPageSize.value,
      roomId: appliedFilters.value.roomId ?? undefined,
      from: appliedFilters.value.from ?? undefined,
      to: appliedFilters.value.to ?? undefined,
    })

    appointments.value = list
    appointmentsPagination.value = pagination
    appointmentsPage.value = pagination.page
    appointmentsPageSize.value = pagination.limit
  } catch (error) {
    appointments.value = []
    appointmentsPagination.value = null
    console.error(error)
    toast.error('Unable to load follow-up appointments.')
  } finally {
    appointmentsLoading.value = false
  }
}

const toSingleDateValue = (
  value: DateValue | DateValue[] | undefined,
): CalendarDate | undefined => {
  if (!value) {
    return undefined
  }

  const result = Array.isArray(value) ? value[0] : value
  return result as CalendarDate
}

const handleFromDateUpdate = (value: DateValue | DateValue[] | undefined) => {
  fromDateModel.value = toSingleDateValue(value)
  fromPopoverOpen.value = false
}

const handleToDateUpdate = (value: DateValue | DateValue[] | undefined) => {
  toDateModel.value = toSingleDateValue(value)
  toPopoverOpen.value = false
}

const handleSearch = async () => {
  clearFilterErrors()

  const fromDate = resolveDateValue(fromDateModel.value)
  const toDate = resolveDateValue(toDateModel.value)

  if (fromDate && toDate && fromDate > toDate) {
    setFilterError('Start date cannot be after end date.')
    return
  }

  appliedFilters.value = {
    patientCode: filters.patientCode.trim(),
    patientName: filters.patientName.trim(),
    roomId: filters.roomId,
    from: fromDate ? startOfDay(fromDate) : null,
    to: toDate ? endOfDay(toDate) : null,
  }

  appointmentsPage.value = 1
  await loadAppointments()
}

const handleReset = async () => {
  clearFilterErrors()

  filters.patientCode = ''
  filters.patientName = ''
  filters.roomId = null

  const todayFrom = today(timeZone)
  const todayTo = today(timeZone)
  const base = todayFrom.toDate(timeZone)

  fromDateModel.value = todayFrom
  toDateModel.value = todayTo

  appliedFilters.value = {
    patientCode: '',
    patientName: '',
    roomId: filters.roomId,
    from: startOfDay(base),
    to: endOfDay(base),
  }

  appointmentsPage.value = 1
  await loadAppointments()
}

const handlePageChange = async (page: number) => {
  if (appointmentsLoading.value || page === appointmentsPage.value) {
    return
  }

  appointmentsPage.value = page
  await loadAppointments()
}

const handlePageSizeChange = async (value: AcceptableValue) => {
  if (value === null || typeof value === 'boolean') {
    return
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed === appointmentsPageSize.value) {
    return
  }

  appointmentsPageSize.value = parsed
  appointmentsPage.value = 1
  await loadAppointments()
}

const initialLoad = async () => {
  await loadRooms()
  await loadAppointments()
}

onMounted(() => {
  void initialLoad()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <Card>
        <CardHeader>
          <CardTitle>Follow-up Appointments</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <Alert v-if="filterErrors.length" variant="destructive">
            <AlertTitle>Unable to apply filters</AlertTitle>
            <AlertDescription>
              <ul class="list-disc space-y-1 pl-5">
                <li v-for="message in filterErrors" :key="`appointments-error-${message}`">
                  {{ message }}
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <div
            class="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          >
            <Field>
              <FieldLabel for="follow-up-filter-code">Patient Code</FieldLabel>
              <Input
                id="follow-up-filter-code"
                v-model="filters.patientCode"
                :disabled="appointmentsLoading"
                autocomplete="off"
                placeholder="Enter patient code"
              />
            </Field>

            <Field>
              <FieldLabel for="follow-up-filter-name">Patient Name</FieldLabel>
              <Input
                id="follow-up-filter-name"
                v-model="filters.patientName"
                :disabled="appointmentsLoading"
                autocomplete="off"
                placeholder="Enter patient name"
              />
            </Field>

            <Field>
              <FieldLabel>Clinic Room</FieldLabel>
              <ComboBox
                v-model="filters.roomId"
                :options="roomOptions"
                placeholder="Select clinic room"
                search-placeholder="Search clinic room..."
                empty-message="No clinic rooms found."
                :loading="loadingRooms"
                :allow-clear="true"
                :disabled="appointmentsLoading"
              />
            </Field>

            <Field>
              <FieldLabel>From Date</FieldLabel>
              <Popover v-model:open="fromPopoverOpen">
                <PopoverTrigger as-child class="hover:text-primary-foreground">
                  <Button
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                    :disabled="appointmentsLoading"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span :class="!hasFromDate ? 'text-muted-foreground' : ''">{{
                      fromLabel
                    }}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="fromDateModel"
                    :max-value="toDateModel"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="handleFromDateUpdate"
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel>To Date</FieldLabel>
              <Popover v-model:open="toPopoverOpen">
                <PopoverTrigger as-child class="hover:text-primary-foreground">
                  <Button
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                    :disabled="appointmentsLoading"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span :class="!hasToDate ? 'text-muted-foreground' : ''">{{ toLabel }}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="toDateModel"
                    :min-value="fromDateModel"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="handleToDateUpdate"
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel>Appointments per page</FieldLabel>
              <Select
                :model-value="String(appointmentsPageSize)"
                @update:model-value="handlePageSizeChange"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Select page size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in appointmentsPageSizeOptions"
                    :key="option"
                    :value="String(option)"
                  >
                    {{ option }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div class="flex flex-wrap items-end gap-3">
              <Button
                type="button"
                class="flex items-center"
                :disabled="appointmentsLoading"
                @click="handleSearch"
              >
                <SearchIcon class="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                :disabled="appointmentsLoading"
                @click="handleReset"
              >
                Reset
              </Button>
            </div>
          </div>

          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-32">Appointment</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead class="w-48">Scheduled For</TableHead>
                  <TableHead class="w-48">Clinic Room</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead class="w-64">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="appointmentsLoading">
                  <TableEmpty :colspan="6">Loading follow-up appointments...</TableEmpty>
                </template>
                <template v-else-if="filteredAppointments.length === 0">
                  <TableEmpty :colspan="6">
                    No follow-up appointments found for the selected filters.
                  </TableEmpty>
                </template>
                <template v-else>
                  <TableRow v-for="appointment in filteredAppointments" :key="appointment.id">
                    <TableCell class="font-medium">{{ appointment.id }}</TableCell>
                    <TableCell>
                      <div class="flex flex-col gap-1">
                        <span class="font-medium">{{ appointment.patient?.fullName ?? '—' }}</span>
                        <span class="text-xs text-muted-foreground">
                          ID: {{ appointment.patient?.code ?? '—' }}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{{ formatDateTime(appointment.scheduledAt) }}</TableCell>
                    <TableCell>
                      <div class="flex flex-col text-sm">
                        <span class="font-medium">{{ appointment.room?.name ?? '—' }}</span>
                        <span
                          v-if="appointment.room?.departmentName"
                          class="text-xs text-muted-foreground"
                        >
                          {{ appointment.room.departmentName }}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span class="text-sm">{{ appointment.reason || '—' }}</span>
                    </TableCell>
                    <TableCell>
                      <span class="text-sm">{{ appointment.notes ?? '—' }}</span>
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <Pagination
            v-if="appointmentsPagination && appointmentsPagination.total > 0"
            :page="appointmentsPage"
            :items-per-page="appointmentsPagination.limit"
            :total="appointmentsPagination.total"
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
                  :is-active="item.value === appointmentsPage"
                >
                  {{ item.value }}
                </PaginationItem>
                <PaginationEllipsis v-else />
              </template>
              <PaginationNext />
            </PaginationContent>
          </Pagination>

          <p v-if="appointmentsSummary" class="text-sm text-muted-foreground">
            {{ appointmentsSummary }}
          </p>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
