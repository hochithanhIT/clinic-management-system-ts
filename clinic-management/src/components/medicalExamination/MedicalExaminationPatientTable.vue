<script setup lang="ts">
import { computed } from 'vue'
import type { MedicalRecordSummary } from '@/services/medicalRecord'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const props = defineProps<{
  records: MedicalRecordSummary[]
  totalCount: number
  filteredCount: number
  loading: boolean
  selectedRecordId: number | null
  page: number
  pageSize: number
  getStatusLabel: (value: number) => string
  getStatusClass: (value: number) => string
  formatBirthYear: (value: string | null | undefined) => string
  getDispositionLabel: (record: MedicalRecordSummary) => string
  formatDateTime: (value: string | null | undefined) => string
}>()

const emit = defineEmits<{
  (e: 'select', record: MedicalRecordSummary): void
  (e: 'page-change', page: number): void
}>()

const handleSelect = (record: MedicalRecordSummary) => {
  emit('select', record)
}

const handlePageChange = (page: number) => {
  emit('page-change', page)
}

const showPagination = computed(() => props.filteredCount > props.pageSize)

const paginationSummary = computed(() => {
  if (!props.filteredCount || props.records.length === 0) {
    return ''
  }

  const start = (props.page - 1) * props.pageSize + 1
  const end = Math.min(start + props.records.length - 1, props.filteredCount)
  return `Showing ${start}-${end} of ${props.filteredCount} patients.`
})
</script>

<template>
  <Card class="overflow-hidden">
    <CardHeader>
      <CardTitle>Patient List</CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-32">Status</TableHead>
            <TableHead class="w-32">Medical Record</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead class="w-28">Birth Year</TableHead>
            <TableHead class="w-32">Disposition</TableHead>
            <TableHead class="w-48">Visit Start</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="props.loading" :colspan="6"> Loading patients... </TableEmpty>
          <TableEmpty v-else-if="!props.records.length" :colspan="6">
            {{
              props.totalCount ? 'No patients match the current filters.' : 'No patients available.'
            }}
          </TableEmpty>
          <template v-else>
            <TableRow
              v-for="record in props.records"
              :key="record.id"
              :class="[
                'cursor-pointer transition-colors',
                record.id === props.selectedRecordId ? 'bg-primary/10' : 'hover:bg-muted/50',
              ]"
              :aria-selected="record.id === props.selectedRecordId"
              @click="handleSelect(record)"
            >
              <TableCell>
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                    props.getStatusClass(record.status),
                  ]"
                >
                  {{ props.getStatusLabel(record.status) }}
                </span>
              </TableCell>
              <TableCell class="font-medium">{{ record.code || '—' }}</TableCell>
              <TableCell>{{ record.patient.fullName }}</TableCell>
              <TableCell>{{ props.formatBirthYear(record.patient.birthDate) }}</TableCell>
              <TableCell>{{ props.getDispositionLabel(record) }}</TableCell>
              <TableCell>{{ props.formatDateTime(record.enteredAt) }}</TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </CardContent>
    <CardContent v-if="showPagination || paginationSummary" class="border-t px-6 py-4 space-y-3">
      <Pagination
        v-if="showPagination"
        :page="props.page"
        :items-per-page="props.pageSize"
        :total="props.filteredCount"
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
              :is-active="item.value === props.page"
            >
              {{ item.value }}
            </PaginationItem>
            <PaginationEllipsis v-else />
          </template>
          <PaginationNext />
        </PaginationContent>
      </Pagination>

      <p v-if="paginationSummary" class="text-sm text-muted-foreground">
        {{ paginationSummary }}
      </p>
    </CardContent>
  </Card>
</template>
