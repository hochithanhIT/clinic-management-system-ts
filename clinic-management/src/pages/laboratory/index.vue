<script setup lang="ts">
import { CalendarIcon, Loader2, SearchIcon } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Field, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
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
import { Textarea } from '@/components/ui/textarea'

import { PAGE_SIZE_OPTIONS, useLaboratoryPage } from './useLaboratoryPage'

const {
  filters,
  fromDatePopoverOpen,
  toDatePopoverOpen,
  fromCalendarBinding,
  toCalendarBinding,
  fromDateLabel,
  toDateLabel,
  statusOptions,
  pageSizeModel,
  ordersLoading,
  ordersError,
  orders,
  ordersTotalItems,
  selectedOrderId,
  selectedOrder,
  selectedOrderDetails,
  selectedOrderStatusLabel,
  resultsLoading,
  resultsError,
  resultDrafts,
  resultDetailDialogOpen,
  resultDetailDialogTarget,
  resultDetailForm,
  resultDetailSaving,
  shouldShowCancelReceive,
  isCancelReceiveDisabled,
  isReceiveDisabled,
  shouldShowDeliverResults,
  isDeliverResultsDisabled,
  shouldShowCancelResults,
  isCancelResultsDisabled,
  hasSavedResultsForSelectedOrder,
  isSelectedOrderCompleted,
  areAllResultsCompletedForSelectedOrder,
  performerName,
  formatDate,
  formatDateTime,
  getServiceOrderStatusClass,
  getServiceOrderStatusLabel,
  updateResultDraftPartial,
  handleFromDateSelect,
  handleToDateSelect,
  handleSearch,
  handleResetFilters,
  handlePageChange,
  handleSelectOrder,
  handleResultDetailDoubleClick,
  handleResultDetailSave,
  handleResultDetailCancel,
  handleReceive,
  handleCancelReceive,
  handleDeliverResults,
  handleCancelResults,
} = useLaboratoryPage()
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="space-y-6 mx-auto max-w-7xl px-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Service Order Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <Field>
              <FieldLabel for="filter-from">From date</FieldLabel>
              <Popover v-model:open="fromDatePopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    id="filter-from"
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span :class="!filters.from ? 'text-muted-foreground' : ''">
                      {{ fromDateLabel }}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="fromCalendarBinding"
                    :max-value="toCalendarBinding"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="handleFromDateSelect"
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel for="filter-to">To date</FieldLabel>
              <Popover v-model:open="toDatePopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    id="filter-to"
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span :class="!filters.to ? 'text-muted-foreground' : ''">
                      {{ toDateLabel }}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar
                    :model-value="toCalendarBinding"
                    :min-value="fromCalendarBinding"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="handleToDateSelect"
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel>Status</FieldLabel>
              <RadioGroup v-model="filters.status" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <div
                  v-for="option in statusOptions"
                  :key="option.value"
                  class="flex items-center gap-2"
                >
                  <RadioGroupItem :id="`status-${option.value}`" :value="option.value" />
                  <Label :for="`status-${option.value}`" class="font-normal">
                    {{ option.label }}
                  </Label>
                </div>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel for="filter-page-size">Records per page</FieldLabel>
              <NativeSelect id="filter-page-size" v-model="pageSizeModel" class="w-full">
                <option v-for="option in PAGE_SIZE_OPTIONS" :key="option" :value="option">
                  {{ option }}
                </option>
              </NativeSelect>
            </Field>

            <div
              class="flex flex-wrap items-center justify-end gap-3 self-end sm:col-span-2 lg:col-span-2 xl:col-span-1"
            >
              <Button type="button" class="flex items-center" @click="handleSearch">
                <SearchIcon class="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button type="button" variant="outline" @click="handleResetFilters">Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
          <CardTitle class="text-base">Service Orders</CardTitle>
          <div v-if="selectedOrderStatusLabel" class="text-sm">
            <span class="text-muted-foreground mr-2">Selected status:</span>
            <span :class="selectedOrderStatusLabel.class">{{
              selectedOrderStatusLabel.label
            }}</span>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-if="ordersLoading"
            class="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading service orders…
          </div>
          <p v-else-if="ordersError" class="text-sm text-destructive">{{ ordersError }}</p>
          <p v-else-if="!orders.length" class="text-sm text-muted-foreground">
            No service orders match the current filters.
          </p>

          <div v-else class="space-y-4">
            <div class="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Order Code</TableHead>
                    <TableHead>Patient Code</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Birth Date</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Ordered At</TableHead>
                    <TableHead>Ordered By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="order in orders"
                    :key="order.id"
                    :class="[
                      'cursor-pointer hover:bg-muted/40',
                      selectedOrderId === order.id ? 'bg-muted/60' : '',
                    ]"
                    @click="handleSelectOrder(order.id)"
                  >
                    <TableCell>
                      <span :class="getServiceOrderStatusClass(order.status)">
                        {{ getServiceOrderStatusLabel(order.status) }}
                      </span>
                    </TableCell>
                    <TableCell class="font-medium">{{ order.code }}</TableCell>
                    <TableCell>{{ order.patientCode }}</TableCell>
                    <TableCell>{{ order.patientName }}</TableCell>
                    <TableCell>{{ formatDate(order.patientBirthDate) }}</TableCell>
                    <TableCell>{{ order.patientDepartment }}</TableCell>
                    <TableCell>{{ order.patientRoom }}</TableCell>
                    <TableCell>{{ formatDateTime(order.orderedAt) }}</TableCell>
                    <TableCell>{{ order.orderedBy }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Pagination
              :page="filters.page"
              :items-per-page="filters.limit"
              :total="ordersTotalItems"
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
                    :is-active="item.value === filters.page"
                  >
                    {{ item.value }}
                  </PaginationItem>
                  <PaginationEllipsis v-else />
                </template>
                <PaginationNext />
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Order Results</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-if="resultsLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading order results…
          </div>
          <p v-else-if="resultsError" class="text-sm text-destructive">{{ resultsError }}</p>
          <p v-else-if="!selectedOrder" class="text-sm text-muted-foreground">
            Select a service order above to view and enter results.
          </p>
          <p v-else-if="!selectedOrderDetails.length" class="text-sm text-muted-foreground">
            This service order does not contain any laboratory services.
          </p>
          <div v-else class="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Code</TableHead>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="detail in selectedOrderDetails"
                  :key="detail.id"
                  @dblclick="handleResultDetailDoubleClick(detail, $event)"
                >
                  <TableCell class="font-medium">{{ detail.serviceCode }}</TableCell>
                  <TableCell>{{ detail.serviceName }}</TableCell>
                  <TableCell class="w-60">
                    <Input
                      type="text"
                      :model-value="resultDrafts[detail.id]?.description ?? ''"
                      placeholder="Enter result"
                      :disabled="isSelectedOrderCompleted"
                      :title="
                        isSelectedOrderCompleted
                          ? 'Results are read-only once the service order is completed.'
                          : undefined
                      "
                      @update:model-value="
                        (value) =>
                          updateResultDraftPartial(detail.id, { description: String(value) })
                      "
                    />
                  </TableCell>
                  <TableCell>{{ detail.referenceValue ?? '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end gap-3">
        <Button
          v-if="shouldShowCancelResults"
          type="button"
          variant="outline"
          :disabled="isCancelResultsDisabled"
          @click="handleCancelResults"
        >
          Cancel Results
        </Button>
        <Button
          v-if="shouldShowDeliverResults"
          type="button"
          :disabled="isDeliverResultsDisabled"
          :title="
            !areAllResultsCompletedForSelectedOrder
              ? 'All services must have saved results before delivering.'
              : undefined
          "
          @click="handleDeliverResults"
        >
          Deliver Results
        </Button>
        <Button
          v-if="shouldShowCancelReceive"
          type="button"
          variant="outline"
          :disabled="isCancelReceiveDisabled"
          :title="
            hasSavedResultsForSelectedOrder
              ? 'Results already exist and this order cannot be reverted.'
              : undefined
          "
          @click="handleCancelReceive"
        >
          Cancel Receive
        </Button>
        <Button type="button" :disabled="isReceiveDisabled" @click="handleReceive">
          Receive
        </Button>
      </div>
    </div>
  </section>

  <Dialog :open="resultDetailDialogOpen" @update:open="(value) => (resultDetailDialogOpen = value)">
    <DialogContent class="max-w-5xl sm:max-w-5xl lg:max-w-6xl">
      <DialogHeader>
        <DialogTitle>Result Details</DialogTitle>
        <DialogDescription v-if="resultDetailDialogTarget">
          {{ resultDetailDialogTarget.serviceCode }} · {{ resultDetailDialogTarget.serviceName }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-5">
        <Field>
          <FieldLabel for="result-detail-description">Description</FieldLabel>
          <Textarea
            id="result-detail-description"
            v-model="resultDetailForm.description"
            rows="8"
            placeholder="Enter description"
            :disabled="resultDetailSaving || isSelectedOrderCompleted"
          />
        </Field>

        <Field>
          <FieldLabel>Performed By</FieldLabel>
          <Input :value="performerName || '—'" disabled />
        </Field>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field>
            <FieldLabel for="result-detail-received-at">Received At</FieldLabel>
            <DateTimePicker
              id="result-detail-received-at"
              v-model="resultDetailForm.receivedAt"
              placeholder="Select received time"
              :disabled="resultDetailSaving || isSelectedOrderCompleted"
            />
          </Field>

          <Field>
            <FieldLabel for="result-detail-performed-at">Performed At</FieldLabel>
            <DateTimePicker
              id="result-detail-performed-at"
              v-model="resultDetailForm.performedAt"
              placeholder="Select performed time"
              :disabled="resultDetailSaving || isSelectedOrderCompleted"
            />
          </Field>

          <Field>
            <FieldLabel for="result-detail-delivered-at">Delivered At</FieldLabel>
            <DateTimePicker
              id="result-detail-delivered-at"
              v-model="resultDetailForm.deliveredAt"
              placeholder="Select delivered time"
              :disabled="resultDetailSaving || isSelectedOrderCompleted"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel for="result-detail-conclusion">Conclusion</FieldLabel>
          <Input
            id="result-detail-conclusion"
            v-model="resultDetailForm.conclusion"
            type="text"
            placeholder="Enter conclusion"
            :disabled="resultDetailSaving || isSelectedOrderCompleted"
          />
        </Field>

        <Field>
          <FieldLabel for="result-detail-note">Note</FieldLabel>
          <Textarea
            id="result-detail-note"
            v-model="resultDetailForm.note"
            rows="4"
            placeholder="Enter note"
            :disabled="resultDetailSaving || isSelectedOrderCompleted"
          />
        </Field>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          :disabled="resultDetailSaving"
          @click="handleResultDetailCancel"
        >
          Cancel
        </Button>
        <Button
          type="button"
          :disabled="resultDetailSaving || isSelectedOrderCompleted"
          :title="
            isSelectedOrderCompleted
              ? 'Results are read-only once the service order is completed.'
              : undefined
          "
          @click="handleResultDetailSave"
        >
          <Loader2 v-if="resultDetailSaving" class="mr-2 h-4 w-4 animate-spin" />
          <span>Save</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
