<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parseDate } from '@internationalized/date'
import type { DateValue } from 'reka-ui'
import { CalendarIcon } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateTimePickerProps {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  id?: string
}

const props = withDefaults(defineProps<DateTimePickerProps>(), {
  modelValue: '',
  placeholder: 'Select date and time',
  disabled: false,
  id: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const calendarValue = ref<DateValue | undefined>(undefined)
const timeValue = ref('')

const pad = (value: number) => value.toString().padStart(2, '0')

const normalizeTime = (value: string): string => {
  if (!value) {
    return ''
  }

  const [hours = '00', minutes = '00'] = value.split(':')
  const normalizedHours = hours.slice(0, 2).padStart(2, '0')
  const normalizedMinutes = minutes.slice(0, 2).padStart(2, '0')

  return `${normalizedHours}:${normalizedMinutes}`
}

const toCalendarValue = (value: string): DateValue | undefined => {
  if (!value) {
    return undefined
  }

  const [datePart] = value.split('T')
  if (!datePart) {
    return undefined
  }

  try {
    return parseDate(datePart) as unknown as DateValue
  } catch {
    return undefined
  }
}

const toTimeValue = (value: string): string => {
  if (!value) {
    return ''
  }

  const [, timePart] = value.split('T')
  if (!timePart) {
    return ''
  }

  return normalizeTime(timePart)
}

const emitValue = (date: DateValue | undefined, time: string) => {
  if (!date) {
    if (props.modelValue) {
      emit('update:modelValue', '')
    }
    return
  }

  const timeSegment = time || '00:00'
  const next = `${date.toString()}T${timeSegment}`

  if (next !== props.modelValue) {
    emit('update:modelValue', next)
  }
}

const updateFromModel = (value: string) => {
  calendarValue.value = toCalendarValue(value)
  timeValue.value = toTimeValue(value)
}

watch(
  () => props.modelValue,
  (value) => {
    updateFromModel(value)
  },
  { immediate: true },
)

const displayLabel = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }

  const date = new Date(props.modelValue)
  if (Number.isNaN(date.getTime())) {
    return props.placeholder
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
})

const coerceDateValue = (value: DateValue | DateValue[] | undefined): DateValue | undefined => {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value ?? undefined
}

const handleSelectDate = (value: DateValue | DateValue[] | undefined) => {
  if (props.disabled) {
    return
  }

  const nextValue = coerceDateValue(value)
  calendarValue.value = nextValue

  if (!timeValue.value && nextValue) {
    const now = new Date()
    const next = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    timeValue.value = next
    emitValue(nextValue, next)
    return
  }

  emitValue(nextValue, normalizeTime(timeValue.value))
}

const handleTimeInput = (value: string) => {
  if (props.disabled) {
    return
  }

  const normalized = normalizeTime(value)
  timeValue.value = normalized
  emitValue(calendarValue.value as DateValue | undefined, normalized)
}

const handleSetNow = () => {
  if (props.disabled) {
    return
  }

  const now = new Date()
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  const dateValue = parseDate(datePart) as unknown as DateValue

  calendarValue.value = dateValue
  timeValue.value = timePart

  emitValue(dateValue, timePart)
}

const handleClear = () => {
  calendarValue.value = undefined
  timeValue.value = ''

  if (props.modelValue) {
    emit('update:modelValue', '')
  }
}

const handleApply = () => {
  open.value = false
}

const calendarModelValue = computed<DateValue | DateValue[] | undefined>(() => {
  return (calendarValue.value ?? undefined) as DateValue | DateValue[] | undefined
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        type="button"
        variant="outline"
        class="w-full justify-start text-left font-normal"
        :disabled="props.disabled"
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        <span :class="!props.modelValue ? 'text-muted-foreground' : ''">{{ displayLabel }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        :model-value="calendarModelValue"
        initial-focus
        @update:model-value="handleSelectDate"
      />
      <div class="flex flex-col gap-3 border-t p-3">
        <Input
          type="time"
          :model-value="timeValue"
          :disabled="props.disabled"
          @update:model-value="(value) => handleTimeInput(value as string)"
        />
        <div class="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="props.disabled"
            @click="handleSetNow"
          >
            Now
          </Button>
          <div class="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="props.disabled"
              @click="handleClear"
            >
              Clear
            </Button>
            <Button type="button" size="sm" :disabled="props.disabled" @click="handleApply">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
