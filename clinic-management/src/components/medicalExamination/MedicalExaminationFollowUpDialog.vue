<script setup lang="ts">
import type { CalendarDate, DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { computed, ref, watch } from 'vue'
import { CalendarIcon, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import ComboBox from '@/components/ComboBox.vue'
import type { RoomSummary } from '@/services/room'
import type { FollowUpAppointmentDetails } from './types'

const props = defineProps<{
  open: boolean
  saving: boolean
  rooms: RoomSummary[]
  roomsLoading: boolean
  initialValue: FollowUpAppointmentDetails | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [value: FollowUpAppointmentDetails]
}>()

const timeZone = getLocalTimeZone()
const appointmentDatePopoverOpen = ref(false)
const appointmentId = ref<number | null>(null)
const appointmentDateValue = ref<CalendarDate | undefined>(undefined)
const appointmentReason = ref('')
const appointmentRoomId = ref<number | null>(null)
const appointmentNotes = ref('')
const roomOptions = computed(() =>
  props.rooms.map((room) => ({ value: room.id, label: room.name })),
)
const roomPlaceholder = computed(() =>
  props.roomsLoading
    ? 'Loading rooms...'
    : roomOptions.value.length
      ? 'Select room'
      : 'No rooms available',
)

const appointmentDateValueForCalendar = computed<DateValue | undefined>(() => {
  return appointmentDateValue.value as unknown as DateValue | undefined
})

const appointmentDateLabel = computed(() => {
  const value = appointmentDateValue.value
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  const date = value.toDate(timeZone)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Select date'
  }

  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
})

const formatDateTimeLocal = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const resolveAppointmentDate = (): Date | null => {
  const value = appointmentDateValue.value

  if (!value || typeof value.toDate !== 'function') {
    return null
  }

  const date = value.toDate(timeZone)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null
  }

  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

const setAppointmentFromDate = (value: Date | null) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    appointmentDateValue.value = undefined
    return
  }

  const iso = formatDateTimeLocal(value)
  const [datePart] = iso.split('T')

  try {
    appointmentDateValue.value = datePart ? (parseDate(datePart) as CalendarDate) : undefined
  } catch {
    appointmentDateValue.value = undefined
  }
}

const loadInitialState = () => {
  const initial = props.initialValue

  if (!initial) {
    appointmentId.value = null
    setAppointmentFromDate(null)
    appointmentReason.value = ''
    appointmentRoomId.value = null
    appointmentNotes.value = ''
    return
  }

  appointmentId.value = initial.id ?? null
  const parsed = new Date(initial.scheduledAt)
  setAppointmentFromDate(parsed)
  appointmentReason.value = initial.reason
  appointmentRoomId.value = initial.roomId
  appointmentNotes.value = initial.notes ?? ''
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      loadInitialState()
      appointmentDatePopoverOpen.value = false
    }
  },
)

watch(
  () => props.initialValue,
  (value) => {
    if (!props.open) {
      return
    }

    if (value) {
      loadInitialState()
    }
  },
  { deep: true },
)

const handleAppointmentDateUpdate = (value: DateValue | undefined) => {
  if (value && typeof value.toDate === 'function') {
    appointmentDateValue.value = value as CalendarDate
  } else {
    appointmentDateValue.value = undefined
  }

  appointmentDatePopoverOpen.value = false
}

const handleClose = () => {
  emit('update:open', false)
}

const handleSave = () => {
  const resolved = resolveAppointmentDate()
  if (!resolved) {
    toast.error('Please select an appointment date.')
    return
  }

  const trimmedReason = appointmentReason.value.trim()
  if (!trimmedReason.length) {
    toast.error('Please provide an appointment reason.')
    return
  }

  if (appointmentRoomId.value === null) {
    toast.error('Please choose a clinic room for the appointment.')
    return
  }

  const selectedRoom = props.rooms.find((room) => room.id === appointmentRoomId.value) ?? null
  const trimmedNotes = appointmentNotes.value.trim()

  const payload: FollowUpAppointmentDetails = {
    scheduledAt: resolved.toISOString(),
    reason: trimmedReason,
    roomId: appointmentRoomId.value,
    roomName: selectedRoom ? selectedRoom.name : null,
    notes: trimmedNotes.length ? trimmedNotes : null,
  }

  if (appointmentId.value !== null) {
    payload.id = appointmentId.value
  }

  emit('save', payload)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg z-60" overlay-class="z-[55]">
      <DialogHeader>
        <DialogTitle>Schedule Follow-up Appointment</DialogTitle>
        <DialogDescription>
          Provide the appointment details for the follow-up visit.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6">
        <Field>
          <FieldLabel for="follow-up-date">
            Appointment Date <span aria-hidden="true" class="text-destructive">*</span>
          </FieldLabel>
          <Popover v-model:open="appointmentDatePopoverOpen">
            <PopoverTrigger as-child>
              <Button
                id="follow-up-date"
                type="button"
                variant="outline"
                class="mt-1 w-full justify-start text-left font-normal"
                aria-required="true"
                :disabled="saving"
              >
                <CalendarIcon class="mr-2 h-4 w-4" />
                <span :class="!appointmentDateValue ? 'text-muted-foreground' : ''">
                  {{ appointmentDateLabel }}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0 z-70" align="start">
              <Calendar
                :model-value="appointmentDateValueForCalendar"
                layout="month-and-year"
                initial-focus
                @update:model-value="handleAppointmentDateUpdate"
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel for="follow-up-reason">
            Appointment Reason <span aria-hidden="true" class="text-destructive">*</span>
          </FieldLabel>
          <Textarea
            id="follow-up-reason"
            v-model="appointmentReason"
            rows="3"
            :disabled="saving"
            placeholder="State why the follow-up visit is required"
            required
            aria-required="true"
          />
        </Field>

        <Field>
          <FieldLabel for="follow-up-room">
            Clinic Room <span aria-hidden="true" class="text-destructive">*</span>
          </FieldLabel>
          <ComboBox
            id="follow-up-room"
            v-model="appointmentRoomId"
            :options="roomOptions"
            :placeholder="roomPlaceholder"
            :disabled="saving || roomsLoading"
            :loading="roomsLoading"
            :list-max-height="'16rem'"
          />
          <p v-if="!roomsLoading && rooms.length === 0" class="mt-1 text-xs text-muted-foreground">
            No clinic rooms available. Please create a room before scheduling the follow-up.
          </p>
        </Field>

        <Field>
          <FieldLabel for="follow-up-notes">Notes</FieldLabel>
          <Textarea
            id="follow-up-notes"
            v-model="appointmentNotes"
            rows="3"
            :disabled="saving"
            placeholder="Additional instructions or comments"
          />
        </Field>
      </div>

      <DialogFooter class="gap-2">
        <Button type="button" variant="outline" :disabled="saving" @click="handleClose">
          Cancel
        </Button>
        <Button type="button" :disabled="saving" @click="handleSave">
          <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
          <span>{{ saving ? 'Saving...' : 'Save Appointment' }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
