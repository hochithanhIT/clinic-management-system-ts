<script setup lang="ts">
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import type { PaginationMeta } from '@/services/types'

import { Button } from '@/components/ui/button'
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

defineProps<{
  filteredRecords: MedicalRecordSummary[]
  isLoading: boolean
  pagination: PaginationMeta | null
  currentPage: number
  actionDisabled: boolean
  recordsSummary: string
  formatDate: (value: string | null | undefined) => string
  formatDateTime: (value: string | null | undefined) => string
  getGenderLabel: (value: number) => string
  getStatusLabel: (value: number) => string
  getStatusClass: (value: number) => string
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'edit', record: MedicalRecordSummary): void
}>()
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-36">Medical Record</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead class="min-w-40">Details</TableHead>
            <TableHead class="w-40">Clinic Room</TableHead>
            <TableHead class="w-44">Receiver</TableHead>
            <TableHead class="w-48">Received At</TableHead>
            <TableHead class="w-36">Status</TableHead>
            <TableHead class="w-44">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="isLoading">
            <TableEmpty :colspan="8">Loading records...</TableEmpty>
          </template>
          <template v-else-if="filteredRecords.length === 0">
            <TableEmpty :colspan="8"> No patients found for the selected filters. </TableEmpty>
          </template>
          <template v-else>
            <TableRow v-for="record in filteredRecords" :key="record.id">
              <TableCell class="font-medium">
                <div class="flex flex-col">
                  <span>{{ record.code }}</span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col gap-1">
                  <span class="font-medium">{{ record.patient.fullName }}</span>
                  <span class="text-xs text-muted-foreground"> ID: {{ record.patient.code }} </span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col gap-1 text-sm">
                  <span>{{ getGenderLabel(record.patient.gender) }}</span>
                  <span>Birth: {{ formatDate(record.patient.birthDate) }}</span>
                  <span>Phone: {{ record.patient.phone ?? '—' }}</span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col text-sm">
                  <span class="font-medium">{{ record.clinicRoom?.name ?? '—' }}</span>
                  <span v-if="record.clinicRoom?.department" class="text-xs text-muted-foreground">
                    {{ record.clinicRoom.department?.name }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col text-sm">
                  <span>{{ record.receiver?.name ?? '—' }}</span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col text-sm">
                  <span>{{ formatDateTime(record.enteredAt) }}</span>
                  <span v-if="record.completedAt" class="text-xs text-muted-foreground">
                    Completed: {{ formatDateTime(record.completedAt) }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span
                  class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                  :class="getStatusClass(record.status)"
                >
                  {{ getStatusLabel(record.status) }}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="actionDisabled"
                  @click="emit('edit', record)"
                >
                  Edit info
                </Button>
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
