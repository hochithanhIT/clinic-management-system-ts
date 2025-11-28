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
            <TableHead class="w-36">Mã hóa đơn</TableHead>
            <TableHead class="w-36 text-right">Số tiền</TableHead>
            <TableHead class="w-40">Ngày thanh toán</TableHead>
            <TableHead class="min-w-48">Người thu</TableHead>
            <TableHead class="w-28">Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="!hasSelection">
            <TableEmpty :colspan="5">Chọn một bệnh án để xem hóa đơn.</TableEmpty>
          </template>
          <template v-else-if="isLoading">
            <TableEmpty :colspan="5">Đang tải danh sách hóa đơn...</TableEmpty>
          </template>
          <template v-else-if="invoices.length === 0">
            <TableEmpty :colspan="5">Không có hóa đơn nào cho bệnh án này.</TableEmpty>
          </template>
          <template v-else>
            <TableRow v-for="invoice in invoices" :key="invoice.id">
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
                <span v-if="invoice.isCancelled">Đã hủy</span>
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
