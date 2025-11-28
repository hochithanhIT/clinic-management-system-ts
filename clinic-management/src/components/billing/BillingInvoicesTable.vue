<script setup lang="ts">
import { toRefs } from 'vue'

import type { BillingInvoice } from './types'
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
  invoices: BillingInvoice[]
  isLoading: boolean
  pagination: PaginationMeta | null
  currentPage: number
  summary: string
  hasSelection: boolean
}>()

const { invoices, isLoading, pagination, currentPage, summary, hasSelection } = toRefs(props)

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'row-dblclick', invoice: BillingInvoice): void
}>()

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
})

const formatAmount = (value: number): string => {
  return currencyFormatter.format(value)
}

const formatPaidAt = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateFormatter.format(date)
}

const getCollectorDisplay = (invoice: BillingInvoice): string => {
  if (!invoice.collectorName && !invoice.collectorCode) {
    return '—'
  }

  if (invoice.collectorName && invoice.collectorCode) {
    return `${invoice.collectorName} (${invoice.collectorCode})`
  }

  return invoice.collectorName || invoice.collectorCode || '—'
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-36">Invoice Code</TableHead>
            <TableHead class="w-36 text-right">Amount</TableHead>
            <TableHead class="w-40">Payment Date</TableHead>
            <TableHead class="min-w-48">Collector</TableHead>
            <TableHead class="w-28">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="!hasSelection">
            <TableEmpty :colspan="5">Select a medical record to view invoices.</TableEmpty>
          </template>
          <template v-else-if="isLoading">
            <TableEmpty :colspan="5">Loading invoices...</TableEmpty>
          </template>
          <template v-else-if="invoices.length === 0">
            <TableEmpty :colspan="5">No invoices for this medical record.</TableEmpty>
          </template>
          <template v-else>
            <TableRow
              v-for="invoice in invoices"
              :key="invoice.id"
              class="cursor-pointer"
              @dblclick="emit('row-dblclick', invoice)"
            >
              <TableCell class="font-medium">
                <span>{{ invoice.code }}</span>
              </TableCell>
              <TableCell class="text-right">
                <span>{{ formatAmount(invoice.amount) }}</span>
              </TableCell>
              <TableCell>
                <span>{{ formatPaidAt(invoice.paidAt) }}</span>
              </TableCell>
              <TableCell>
                <span>{{ getCollectorDisplay(invoice) }}</span>
              </TableCell>
              <TableCell>
                <span v-if="invoice.isCancelled">Cancelled</span>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <Pagination
      v-if="hasSelection && pagination && pagination.total > 0"
      :page="currentPage"
      :items-per-page="pagination.limit"
      :total="pagination.total"
      @update:page="emit('page-change', $event)"
    >
      <PaginationContent v-slot="{ items }">
        <PaginationPrevious />
        <template
          v-for="(item, index) in items"
          :key="item.type === 'page' ? `invoice-page-${item.value}` : `invoice-ellipsis-${index}`"
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

    <p v-if="summary" class="text-sm text-muted-foreground">
      {{ summary }}
    </p>
  </div>
</template>
