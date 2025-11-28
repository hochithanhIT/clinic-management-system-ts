<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { CalendarIcon, SearchIcon } from 'lucide-vue-next'
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
import type { AcceptableValue } from 'reka-ui'

import type { PaymentStatusFilterValue } from './types'

const props = defineProps<{
  medicalRecordCode: string
  patientCode: string
  paymentStatus: PaymentStatusFilterValue
  isLoading: boolean
  fromDate: DateValue | undefined
  toDate: DateValue | undefined
  fromLabel: string
  toLabel: string
  hasFromDate: boolean
  hasToDate: boolean
  recordsPageSize: number
  pageSizeOptions: number[]
}>()

const {
  medicalRecordCode,
  patientCode,
  paymentStatus,
  isLoading,
  fromDate,
  toDate,
  fromLabel,
  toLabel,
  hasFromDate,
  hasToDate,
  recordsPageSize,
  pageSizeOptions,
} = toRefs(props)

const emit = defineEmits<{
  (e: 'update:medicalRecordCode', value: string): void
  (e: 'update:patientCode', value: string): void
  (e: 'update:paymentStatus', value: PaymentStatusFilterValue): void
  (e: 'update:from', value: DateValue | undefined): void
  (e: 'update:to', value: DateValue | undefined): void
  (e: 'update:pageSize', value: AcceptableValue): void
  (e: 'search'): void
  (e: 'reset'): void
}>()

const fromPopoverOpen = ref(false)
const toPopoverOpen = ref(false)

const statusOptions: Array<{ value: PaymentStatusFilterValue; label: string }> = [
  { value: 'all', label: 'All payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
]

const handlePageSizeChange = (value: AcceptableValue) => {
  emit('update:pageSize', value)
}
</script>

<template>
  <div
    class="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
  >
    <Field>
      <FieldLabel for="filter-medical-record-code">Medical record code</FieldLabel>
      <Input
        id="filter-medical-record-code"
        :model-value="medicalRecordCode"
        :disabled="isLoading"
        autocomplete="off"
        placeholder="Enter code"
        @update:model-value="emit('update:medicalRecordCode', $event as string)"
      />
    </Field>

    <Field>
      <FieldLabel for="filter-patient-code">Patient code</FieldLabel>
      <Input
        id="filter-patient-code"
        :model-value="patientCode"
        :disabled="isLoading"
        autocomplete="off"
        placeholder="Enter code"
        @update:model-value="emit('update:patientCode', $event as string)"
      />
    </Field>

    <Field>
      <FieldLabel>From date</FieldLabel>
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
      <FieldLabel>To date</FieldLabel>
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
      <FieldLabel>Payment status</FieldLabel>
      <Select
        :model-value="paymentStatus"
        @update:model-value="emit('update:paymentStatus', $event as PaymentStatusFilterValue)"
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
