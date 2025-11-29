<script setup lang="ts">
definePage({
  alias: '/medical-examination/',
  meta: {
    requiresAuth: true,
  },
})

import { computed, reactive, ref, watch } from 'vue'
import type { AcceptableValue } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MedicalExaminationDetailCard from '@/components/medicalExamination/MedicalExaminationDetailCard.vue'
import MedicalExaminationFilters from '@/components/medicalExamination/MedicalExaminationFilters.vue'
import MedicalExaminationPatientTable from '@/components/medicalExamination/MedicalExaminationPatientTable.vue'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import { getMedicalRecords, updateMedicalRecord } from '@/services/medicalRecord'
import { ApiError } from '@/services/http'
import { useWorkspaceStore } from '@/stores/workspace'

const activeTab = ref('patients')

const workspaceStore = useWorkspaceStore()
const { department: selectedDepartment, room: selectedRoom } = storeToRefs(workspaceStore)

const records = ref<MedicalRecordSummary[]>([])
const recordsLoading = ref(false)
const recordsError = ref<string | null>(null)
const selectedRecordId = ref<number | null>(null)
const startExamLoading = ref(false)
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const pageSize = ref<PageSizeOption>(PAGE_SIZE_OPTIONS[0])
const pageSizeOptions = [...PAGE_SIZE_OPTIONS]
const currentPage = ref(1)

const isPageSizeOption = (value: number): value is PageSizeOption => {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption)
}

const hasWorkspaceSelection = computed(() =>
  Boolean(selectedRoom.value || selectedDepartment.value),
)

const statusLabelMap: Record<number, string> = {
  0: 'Waiting',
  1: 'In Progress',
  2: 'Completed',
}

const statusClassMap: Record<number, string> = {
  0: 'bg-amber-100 text-amber-800',
  1: 'bg-sky-100 text-sky-800',
  2: 'bg-emerald-100 text-emerald-800',
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const getStatusLabel = (value: number): string => {
  return statusLabelMap[value] ?? 'Unknown'
}

const getStatusClass = (value: number): string => {
  return statusClassMap[value] ?? 'bg-muted text-muted-foreground'
}

const formatBirthYear = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return String(date.getFullYear())
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateFormatter.format(date)
}

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return dateTimeFormatter.format(date)
}

const formatExamTimeRange = (record: MedicalRecordSummary | null): string => {
  if (!record) {
    return '—'
  }

  const start = formatDateTime(record.enteredAt)
  if (start === '—') {
    return '—'
  }

  const end = record.completedAt ? formatDateTime(record.completedAt) : 'In Progress'
  return `${start} - ${end}`
}

const getDispositionLabel = (record: MedicalRecordSummary): string => {
  return record.completedAt ? 'Updated' : 'Not updated'
}

const formatInputDate = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultFromDate = (): string => {
  return formatInputDate(new Date())
}

const parseDateInput = (value: string): Date | null => {
  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function startOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(23, 59, 59, 999)
  return result
}

interface AppliedFiltersState {
  from: Date | null
  to: Date | null
  code: string
  name: string
}

const filters = reactive({
  from: getDefaultFromDate(),
  to: getDefaultFromDate(),
  code: '',
  name: '',
})

const appliedFilters = ref<AppliedFiltersState>({
  from: startOfDay(new Date()),
  to: endOfDay(new Date()),
  code: '',
  name: '',
})

const filteredRecords = computed(() => {
  const codeTerm = appliedFilters.value.code.trim().toLowerCase()
  const nameTerm = appliedFilters.value.name.trim().toLowerCase()
  const { from, to } = appliedFilters.value

  return records.value.filter((record) => {
    const enteredAt = new Date(record.enteredAt)

    if (from && !Number.isNaN(enteredAt.getTime()) && enteredAt < from) {
      return false
    }

    if (to && !Number.isNaN(enteredAt.getTime()) && enteredAt > to) {
      return false
    }

    if (codeTerm && !(record.code ?? '').toLowerCase().includes(codeTerm)) {
      return false
    }

    if (nameTerm && !(record.patient.fullName ?? '').toLowerCase().includes(nameTerm)) {
      return false
    }

    return true
  })
})

const totalFilteredRecords = computed(() => filteredRecords.value.length)

const paginatedRecords = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  return filteredRecords.value.slice(startIndex, startIndex + pageSize.value)
})

const selectedRecord = computed(() => {
  if (selectedRecordId.value === null) {
    return null
  }

  return filteredRecords.value.find((record) => record.id === selectedRecordId.value) ?? null
})

const startExamDisabled = computed(() => {
  if (startExamLoading.value) {
    return true
  }

  if (!selectedRecord.value) {
    return true
  }

  return selectedRecord.value.status !== 0
})

const secondaryActionsDisabled = computed(() => {
  if (!selectedRecord.value) {
    return true
  }

  return selectedRecord.value.status === 0
})

const selectedDoctorDisplay = computed(() => {
  const doctor = selectedRecord.value?.doctor
  if (!doctor) {
    return 'Not assigned'
  }

  const department = doctor.department?.name
  return department ? `${doctor.name} · ${department}` : doctor.name
})

const selectedPatientAddress = computed(() => {
  const wardName = selectedRecord.value?.patient.ward?.name ?? ''
  const cityName = selectedRecord.value?.patient.city?.name ?? ''
  const parts = [wardName, cityName].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
})

const selectedPatientBirthDate = computed(() => {
  return formatDate(selectedRecord.value?.patient.birthDate)
})

const selectedPatientPhone = computed(() => {
  return selectedRecord.value?.patient.phone ?? '—'
})

const selectedExamTimeRange = computed(() => {
  return formatExamTimeRange(selectedRecord.value)
})

let fetchToken = 0

const loadRecords = async () => {
  if (!hasWorkspaceSelection.value) {
    records.value = []
    recordsError.value = null
    return
  }

  const departmentId = selectedRoom.value?.departmentId ?? selectedDepartment.value?.id ?? null
  const roomId = selectedRoom.value?.id ?? null
  const requestId = ++fetchToken

  recordsLoading.value = true
  recordsError.value = null

  try {
    const baseParams = {
      page: 1,
      limit: 100,
      enteredFrom: appliedFilters.value.from ?? undefined,
      enteredTo: appliedFilters.value.to ?? undefined,
      roomId: roomId ?? undefined,
    } as const

    let medicalRecords: MedicalRecordSummary[] = []

    if (!roomId && departmentId) {
      const primary = await getMedicalRecords({
        ...baseParams,
        departmentId,
      })
      medicalRecords = primary.medicalRecords

      if (!medicalRecords.length) {
        const fallback = await getMedicalRecords({
          ...baseParams,
          departmentId: undefined,
        })
        medicalRecords = fallback.medicalRecords
      }
    } else {
      const response = await getMedicalRecords({
        ...baseParams,
        departmentId: departmentId ?? undefined,
      })
      medicalRecords = response.medicalRecords
    }

    if (requestId !== fetchToken) {
      return
    }

    let workspaceFiltered = medicalRecords

    if (roomId) {
      workspaceFiltered = medicalRecords.filter((record) => record.clinicRoom?.id === roomId)
    } else if (departmentId) {
      workspaceFiltered = medicalRecords.filter((record) => {
        const doctorDepartmentId = record.doctor?.department?.id ?? null
        const roomDepartmentId = record.clinicRoom?.department?.id ?? null
        return doctorDepartmentId === departmentId || roomDepartmentId === departmentId
      })
    }

    records.value = workspaceFiltered

    if (
      selectedRecordId.value !== null &&
      !workspaceFiltered.some((record) => record.id === selectedRecordId.value)
    ) {
      selectedRecordId.value = null
    }
  } catch (error) {
    if (requestId !== fetchToken) {
      return
    }

    const message =
      error instanceof ApiError ? error.message : 'Unable to load patients. Please try again.'
    records.value = []
    recordsError.value = message
    toast.error(message)
  } finally {
    if (requestId === fetchToken) {
      recordsLoading.value = false
    }
  }
}

const handleRowSelect = (record: MedicalRecordSummary) => {
  selectedRecordId.value = record.id
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handlePageSizeChange = (value: AcceptableValue) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !isPageSizeOption(parsed)) {
    return
  }

  pageSize.value = parsed
  currentPage.value = 1
}

const handleStartExamination = async () => {
  if (!selectedRecord.value || selectedRecord.value.status !== 0) {
    return
  }

  startExamLoading.value = true

  try {
    const updated = await updateMedicalRecord(selectedRecord.value.id, {
      trangThai: 1,
    })

    records.value = records.value.map((record) => {
      return record.id === updated.id ? updated : record
    })

    selectedRecordId.value = updated.id
    toast.success('Patient marked as In Progress.')
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to update patient status. Please try again.'
    toast.error(message)
  } finally {
    startExamLoading.value = false
  }
}

const applyFilters = async () => {
  const fromDateRaw = parseDateInput(filters.from)
  const toDateRaw = parseDateInput(filters.to)

  if (fromDateRaw && toDateRaw && fromDateRaw > toDateRaw) {
    toast.error('The start date must be before or equal to the end date.')
    return
  }

  appliedFilters.value = {
    from: fromDateRaw ? startOfDay(fromDateRaw) : null,
    to: toDateRaw ? endOfDay(toDateRaw) : null,
    code: filters.code.trim(),
    name: filters.name.trim(),
  }

  selectedRecordId.value = null
  currentPage.value = 1

  await loadRecords()
}

const handleApplyFilters = async () => {
  await applyFilters()
}

const handleResetFilters = async () => {
  filters.from = getDefaultFromDate()
  filters.to = getDefaultFromDate()
  filters.code = ''
  filters.name = ''
  await applyFilters()
}

watch(
  () => [selectedDepartment.value?.id ?? null, selectedRoom.value?.id ?? null],
  () => {
    selectedRecordId.value = null
    currentPage.value = 1
    void loadRecords()
  },
  { immediate: true },
)

watch(
  () => [totalFilteredRecords.value, pageSize.value] as const,
  ([count]) => {
    if (count === 0) {
      currentPage.value = 1
      return
    }

    const totalPages = Math.max(1, Math.ceil(count / pageSize.value))
    if (currentPage.value > totalPages) {
      currentPage.value = totalPages
    }
  },
)

watch(filteredRecords, (list) => {
  if (
    selectedRecordId.value !== null &&
    !list.some((record) => record.id === selectedRecordId.value)
  ) {
    selectedRecordId.value = null
  }
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <div class="flex flex-wrap gap-3">
        <Button :disabled="startExamDisabled" @click="handleStartExamination">
          <Loader2 v-if="startExamLoading" class="mr-2 h-4 w-4 animate-spin" />
          Start
        </Button>
        <Button variant="outline" :disabled="secondaryActionsDisabled">Examination</Button>
        <Button variant="outline" :disabled="secondaryActionsDisabled">Services</Button>
        <Button variant="outline" :disabled="secondaryActionsDisabled">Disposition</Button>
      </div>

      <Tabs v-model="activeTab" class="mt-6 w-full">
        <TabsList class="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="patients">Patient List</TabsTrigger>
          <TabsTrigger value="medical-record">Medical Record</TabsTrigger>
          <TabsTrigger value="lab">Laboratory</TabsTrigger>
          <TabsTrigger value="imaging">Imaging</TabsTrigger>
          <TabsTrigger value="procedure">Procedures</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" class="mt-6 space-y-4">
          <Alert v-if="!hasWorkspaceSelection">
            <AlertCircle class="mr-2 h-5 w-5" />
            <AlertTitle>Workspace not configured</AlertTitle>
            <AlertDescription>
              Please select a department and clinic room to view the patient queue.
            </AlertDescription>
          </Alert>

          <Alert v-else-if="recordsError" variant="destructive">
            <AlertCircle class="mr-2 h-5 w-5" />
            <AlertTitle>Unable to load data</AlertTitle>
            <AlertDescription>
              {{ recordsError }}
            </AlertDescription>
          </Alert>

          <div v-else class="space-y-4">
            <MedicalExaminationFilters
              v-model:code="filters.code"
              v-model:name="filters.name"
              v-model:from="filters.from"
              v-model:to="filters.to"
              :loading="recordsLoading"
              :records-page-size="pageSize"
              :page-size-options="pageSizeOptions"
              @update:page-size="handlePageSizeChange"
              @search="handleApplyFilters"
              @reset="handleResetFilters"
            />

            <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <MedicalExaminationPatientTable
                :records="paginatedRecords"
                :total-count="records.length"
                :filtered-count="totalFilteredRecords"
                :loading="recordsLoading"
                :selected-record-id="selectedRecordId"
                :page="currentPage"
                :page-size="pageSize"
                :get-status-label="getStatusLabel"
                :get-status-class="getStatusClass"
                :format-birth-year="formatBirthYear"
                :get-disposition-label="getDispositionLabel"
                :format-date-time="formatDateTime"
                @select="handleRowSelect"
                @page-change="handlePageChange"
              />

              <MedicalExaminationDetailCard
                :record="selectedRecord"
                :doctor-display="selectedDoctorDisplay"
                :patient-birth-date="selectedPatientBirthDate"
                :patient-address="selectedPatientAddress"
                :patient-phone="selectedPatientPhone"
                :exam-time-range="selectedExamTimeRange"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="medical-record" class="mt-6">
          <Card>
            <CardContent class="py-12 text-center text-sm text-muted-foreground">
              Content will be added later.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lab" class="mt-6">
          <Card>
            <CardContent class="py-12 text-center text-sm text-muted-foreground">
              Content will be added later.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imaging" class="mt-6">
          <Card>
            <CardContent class="py-12 text-center text-sm text-muted-foreground">
              Content will be added later.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procedure" class="mt-6">
          <Card>
            <CardContent class="py-12 text-center text-sm text-muted-foreground">
              Content will be added later.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </section>
</template>
