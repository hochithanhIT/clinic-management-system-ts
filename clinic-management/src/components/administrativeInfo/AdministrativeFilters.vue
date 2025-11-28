<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { CalendarIcon, SearchIcon } from 'lucide-vue-next'
import type { AcceptableValue } from 'reka-ui'
import { ref, toRefs } from 'vue'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BaseCombobox from '@/components/ComboBox.vue'
import type {
  ComboboxOption,
  MedicalRecordStatusFilterValue,
  MedicalRecordStatusOption,
} from '../patientIntake/types'

const props = defineProps<{
  patientCode: string
  patientName: string
  status: MedicalRecordStatusFilterValue
  roomId: number | null
  statusOptions: MedicalRecordStatusOption[]
  roomOptions: ComboboxOption[]
  loadingRooms: boolean
  recordsPageSize: number
  pageSizeOptions: number[]
  isLoading: boolean
  fromDate: DateValue | undefined
  toDate: DateValue | undefined
  fromLabel: string
  toLabel: string
  hasFromDate: boolean
  hasToDate: boolean
}>()

const {
  patientCode,
  patientName,
  status,
  roomId,
  statusOptions,
  roomOptions,
  loadingRooms,
  recordsPageSize,
  pageSizeOptions,
  isLoading,
  fromDate,
  toDate,
  fromLabel,
  toLabel,
  hasFromDate,
  hasToDate,
} = toRefs(props)

const emit = defineEmits<{
  (e: 'update:patientCode', value: string): void
  (e: 'update:patientName', value: string): void
  (e: 'update:status', value: MedicalRecordStatusFilterValue): void
  (e: 'update:roomId', value: number | null): void
  (e: 'update:from', value: DateValue | undefined): void
  (e: 'update:to', value: DateValue | undefined): void
  (e: 'update:pageSize', value: AcceptableValue): void
  (e: 'search'): void
  (e: 'reset'): void
}>()

const recordsFromPopoverOpen = ref(false)
const recordsToPopoverOpen = ref(false)

const handlePageSizeChange = (value: AcceptableValue) => {
  emit('update:pageSize', value)
}
</script>

<template>
  <div
    class="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
  >
    <Field>
      <FieldLabel for="filter-patient-code">Patient Code</FieldLabel>
      <Input
        id="filter-patient-code"
        :model-value="patientCode"
        :disabled="isLoading"
        autocomplete="off"
        placeholder="Enter patient code"
        @update:model-value="emit('update:patientCode', $event as string)"
      />
    </Field>

    <Field>
      <FieldLabel for="filter-patient-name">Patient Name</FieldLabel>
      <Input
        id="filter-patient-name"
        :model-value="patientName"
        :disabled="isLoading"
        autocomplete="off"
        placeholder="Enter patient name"
        @update:model-value="emit('update:patientName', $event as string)"
      />
    </Field>

    <Field>
      <FieldLabel>Status</FieldLabel>
      <Select
        :model-value="status"
        @update:model-value="emit('update:status', $event as MedicalRecordStatusFilterValue)"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>

    <Field>
      <FieldLabel>Clinic Room</FieldLabel>
      <BaseCombobox
        :model-value="roomId"
        :options="roomOptions"
        placeholder="Select clinic room"
        search-placeholder="Search clinic room..."
        :loading="loadingRooms"
        :allow-clear="true"
        @update:model-value="emit('update:roomId', $event as number | null)"
      />
    </Field>

    <Field>
      <FieldLabel>From Date</FieldLabel>
      <Popover v-model:open="recordsFromPopoverOpen">
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
            :model-value="fromDate"
            :max-value="toDate"
            layout="month-and-year"
            initial-focus
            @update:model-value="emit('update:from', $event as DateValue | undefined)"
          />
        </PopoverContent>
      </Popover>
    </Field>

    <Field>
      <FieldLabel>To Date</FieldLabel>
      <Popover v-model:open="recordsToPopoverOpen">
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
            :model-value="toDate"
            :min-value="fromDate"
            layout="month-and-year"
            initial-focus
            @update:model-value="emit('update:to', $event as DateValue | undefined)"
          />
        </PopoverContent>
      </Popover>
    </Field>

    <Field>
      <FieldLabel>Records per page</FieldLabel>
      <Select :model-value="String(recordsPageSize)" @update:model-value="handlePageSizeChange">
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
      <Button type="button" class="flex items-center" :disabled="isLoading" @click="emit('search')">
        <SearchIcon class="mr-2 h-4 w-4" />
        Search
      </Button>
      <Button type="button" variant="outline" :disabled="isLoading" @click="emit('reset')">
        Reset
      </Button>
    </div>
  </div>
</template>
