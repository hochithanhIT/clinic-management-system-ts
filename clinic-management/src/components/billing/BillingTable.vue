<script setup lang="ts">
import { toRefs } from 'vue'

import type { BillingRecord } from './types'

import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { PaginationMeta } from '@/services/types'

const props = defineProps<{
  records: BillingRecord[]
  isLoading: boolean
  pagination: PaginationMeta | null
  currentPage: number
  recordsSummary: string
  selectedRecordId: number | null
}>()

const { records, isLoading, pagination, currentPage, recordsSummary, selectedRecordId } =
  toRefs(props)

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'select', recordId: number): void
}>()

const getPaymentStatusLabel = (status: BillingRecord['paymentStatus']): string => {
  return status === 'paid' ? 'Paid' : 'Unpaid'
}

const getPaymentStatusClass = (status: BillingRecord['paymentStatus']): string => {
  return status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
}

const formatAddress = (record: BillingRecord): string => {
  const ward = record.wardName?.trim()
  const city = record.cityName?.trim()

  if (ward && city) {
    return `${ward} - ${city}`
  }

  if (ward) {
    return ward
  }

  if (city) {
    return city
  }

  return '—'
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-40">Medical Record</TableHead>
            <TableHead class="min-w-56">Patient Name</TableHead>
            <TableHead class="min-w-56">Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="isLoading">
            <TableEmpty :colspan="4">Loading billing records...</TableEmpty>
          </template>
          <template v-else-if="records.length === 0">
            <TableEmpty :colspan="4">No billing records found for the selected filters.</TableEmpty>
          </template>
          <template v-else>
            <TableRow
              v-for="record in records"
              :key="record.id"
              class="cursor-pointer transition-colors"
              :class="
                record.id === selectedRecordId
                  ? 'bg-muted/60 hover:bg-muted/60'
                  : 'hover:bg-muted/50'
              "
              :aria-selected="record.id === selectedRecordId"
              @click="emit('select', record.id)"
            >
              <TableCell class="font-medium">
                <div class="flex flex-col">
                  <span>{{ record.medicalRecordCode }}</span>
                  <span
                    class="inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-medium"
                    :class="getPaymentStatusClass(record.paymentStatus)"
                  >
                    {{ getPaymentStatusLabel(record.paymentStatus) }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col gap-1">
                  <span class="font-medium">{{ record.patientName }}</span>
                  <span class="text-xs text-muted-foreground"> ID: {{ record.patientCode }} </span>
                </div>
              </TableCell>
              <TableCell>
                <span>{{ formatAddress(record) }}</span>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <Pagination
      v-if="pagination && pagination.total > 0"
      :page="currentPage"
      :items-per-page="pagination.limit"
      :total="pagination.total"
      @update:page="emit('page-change', $event)"
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
            :is-active="item.value === currentPage"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis v-else />
        </template>
        <PaginationNext />
      </PaginationContent>
    </Pagination>

    <p v-if="recordsSummary" class="text-sm text-muted-foreground">
      {{ recordsSummary }}
    </p>
  </div>
</template>
