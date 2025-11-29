<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import { CalendarIcon, SearchIcon } from 'lucide-vue-next'
import type { AcceptableValue } from 'reka-ui'
import { computed, ref, toRefs } from 'vue'

import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  code: string
  name: string
  from: string
  to: string
  loading: boolean
  recordsPageSize: number
  pageSizeOptions: number[]
}>()

const { code, name, from, to, loading, recordsPageSize, pageSizeOptions } = toRefs(props)

const emit = defineEmits<{
  (e: 'update:code', value: string): void
  (e: 'update:name', value: string): void
  (e: 'update:from', value: string): void
  (e: 'update:to', value: string): void
  (e: 'update:pageSize', value: AcceptableValue): void
  (e: 'search'): void
  (e: 'reset'): void
}>()

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

const fromPopoverOpen = ref(false)
const toPopoverOpen = ref(false)

const fromDateValue = computed<DateValue | undefined>(() => {
  if (!from.value) {
    return undefined
  }

  try {
    return parseDate(from.value)
  } catch {
    return undefined
  }
})

const toDateValue = computed<DateValue | undefined>(() => {
  if (!to.value) {
    return undefined
  }

  try {
    return parseDate(to.value)
  } catch {
    return undefined
  }
})

const hasFromDate = computed(() => Boolean(from.value))
const hasToDate = computed(() => Boolean(to.value))

const fromLabel = computed(() => {
  if (!from.value) {
    return 'Select start date'
  }

  const date = new Date(`${from.value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return 'Select start date'
  }

  return dateFormatter.format(date)
})

const toLabel = computed(() => {
  if (!to.value) {
    return 'Select end date'
  }

  const date = new Date(`${to.value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return 'Select end date'
  }

  return dateFormatter.format(date)
})

const handleSearch = () => {
  emit('search')
}

const handleReset = () => {
  emit('reset')
}

const handleFromUpdate = (value: DateValue | undefined) => {
  emit('update:from', value ? value.toString() : '')
}

const handleToUpdate = (value: DateValue | undefined) => {
  emit('update:to', value ? value.toString() : '')
}

const handlePageSizeChange = (value: AcceptableValue) => {
  emit('update:pageSize', value)
}
</script>

<template>
  <div
    class="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
  >
    <Field>
      <FieldLabel for="medical-exam-filter-code">Medical Record Code</FieldLabel>
      <Input
        id="medical-exam-filter-code"
        :model-value="code"
        :disabled="loading"
        autocomplete="off"
        placeholder="Enter medical record code"
        @update:model-value="emit('update:code', $event as string)"
      />
    </Field>

    <Field>
      <FieldLabel for="medical-exam-filter-name">Patient Name</FieldLabel>
      <Input
        id="medical-exam-filter-name"
        :model-value="name"
        :disabled="loading"
        autocomplete="off"
        placeholder="Enter patient name"
        @update:model-value="emit('update:name', $event as string)"
      />
    </Field>

    <Field>
      <FieldLabel>From Date</FieldLabel>
      <Popover v-model:open="fromPopoverOpen">
        <PopoverTrigger as-child class="hover:text-primary-foreground">
          <Button variant="outline" class="w-full justify-start text-left font-normal">
            <CalendarIcon class="mr-2 h-4 w-4" />
            <span :class="!hasFromDate ? 'text-muted-foreground' : ''">
              {{ fromLabel }}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <Calendar
            :model-value="fromDateValue"
            :max-value="toDateValue"
            layout="month-and-year"
            initial-focus
            @update:model-value="handleFromUpdate"
          />
        </PopoverContent>
      </Popover>
    </Field>

    <Field>
      <FieldLabel>To Date</FieldLabel>
      <Popover v-model:open="toPopoverOpen">
        <PopoverTrigger as-child class="hover:text-primary-foreground">
          <Button variant="outline" class="w-full justify-start text-left font-normal">
            <CalendarIcon class="mr-2 h-4 w-4" />
            <span :class="!hasToDate ? 'text-muted-foreground' : ''">
              {{ toLabel }}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <Calendar
            :model-value="toDateValue"
            :min-value="fromDateValue"
            layout="month-and-year"
            initial-focus
            @update:model-value="handleToUpdate"
          />
        </PopoverContent>
      </Popover>
    </Field>

    <Field>
      <FieldLabel>Records per page</FieldLabel>
      <Select
        :model-value="String(recordsPageSize)"
        :disabled="loading"
        @update:model-value="handlePageSizeChange"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Select page size" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in pageSizeOptions" :key="option" :value="String(option)">
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>

    <div class="flex flex-wrap items-end gap-3">
      <Button type="button" class="flex items-center" :disabled="loading" @click="handleSearch">
        <SearchIcon class="mr-2 h-4 w-4" />
        Search
      </Button>
      <Button type="button" variant="outline" :disabled="loading" @click="handleReset">
        Reset
      </Button>
    </div>
  </div>
</template>
