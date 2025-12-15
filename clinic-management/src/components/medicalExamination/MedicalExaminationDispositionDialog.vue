<script setup lang="ts">
import type { CalendarDate, DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
import { computed, ref, watch } from 'vue'
import { CalendarIcon, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { AcceptableValue } from 'reka-ui'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import type { PatientSummary } from '@/services/patient'
import type { MedicalExaminationDetail } from '@/services/medicalExamination'

interface DispositionOrderRow {
  id: number
  label: string
}

interface DispositionServiceGroup {
  category: string
  label: string
  orders: DispositionOrderRow[]
}

interface DispositionDiagnosisRow {
  key: string
  code: string | null
  name: string
  isPrimary: boolean
}

const DISPOSITION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Khám xong cho về', label: 'Discharge after examination' },
  { value: 'Cấp toa cho về', label: 'Provide prescription and discharge' },
  { value: 'Hẹn khám', label: 'Schedule follow-up appointment' },
]

const props = defineProps<{
  open: boolean
  saving: boolean
  selectedRecord: MedicalRecordSummary | null
  patientDetail: PatientSummary | null
  examinationDetail: MedicalExaminationDetail | null
  serviceGroups: DispositionServiceGroup[]
  defaultEndTime: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: { endTime: string; treatmentMethod: string; disposition: string }]
}>()

const timeZone = getLocalTimeZone()
const endDatePopoverOpen = ref(false)
const endDateValue = ref<CalendarDate | undefined>(undefined)
const endTimeValue = ref('')
const disposition = ref<string | null>(null)
const treatmentMethod = ref('')

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const endDateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

const endDateLabel = computed(() => {
  const value = endDateValue.value
  if (!value || typeof value.toDate !== 'function') {
    return 'Select date'
  }

  const date = value.toDate(timeZone)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Select date'
  }

  return endDateFormatter.format(date)
})

const endDateValueForCalendar = computed<DateValue | undefined>(() => {
  return endDateValue.value as unknown as DateValue | undefined
})

const hasEndDateSelected = computed(() => Boolean(endDateValue.value))

const hasServices = computed(() => props.serviceGroups.some((group) => group.orders.length > 0))

const patientName = computed(() => props.selectedRecord?.patient.fullName ?? '—')
const patientCode = computed(() => props.selectedRecord?.patient.code ?? '—')
const patientPhone = computed(
  () => props.patientDetail?.phone ?? props.selectedRecord?.patient.phone ?? '—',
)

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return dateFormatter.format(parsed)
}

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return dateTimeFormatter.format(parsed)
}

const patientBirthDate = computed(() => {
  const birthDate =
    props.patientDetail?.birthDate ?? props.selectedRecord?.patient.birthDate ?? null
  return formatDate(birthDate)
})

const examStartTime = computed(() => formatDateTime(props.selectedRecord?.enteredAt))
const examEndTime = computed(() => formatDateTime(props.selectedRecord?.completedAt))

const initialDiagnosis = computed(() => props.examinationDetail?.initialDiagnosis?.trim() || '—')
const currentTreatmentMethod = computed(
  () => props.examinationDetail?.treatmentMethod?.trim() || '—',
)
const currentDisposition = computed(() => props.examinationDetail?.disposition?.trim() || '—')

const diagnosisRows = computed<DispositionDiagnosisRow[]>(() => {
  const source = props.examinationDetail?.diagnoses ?? []
  if (!source.length) {
    return []
  }

  return source.map((diagnosis, index) => {
    const code = diagnosis.disease?.code?.trim() || null
    const name = diagnosis.disease?.name?.trim() || 'Unknown disease'
    return {
      key: `${diagnosis.diseaseId}-${index}`,
      code,
      name,
      isPrimary: Boolean(diagnosis.isPrimary),
    }
  })
})

const hasDiagnoses = computed(() => diagnosisRows.value.length > 0)

const formatVitalNumber = (
  value: number | null | undefined,
  suffix: string,
  fractionDigits = 0,
): string => {
  if (value === null || value === undefined) {
    return '—'
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return '—'
  }

  const formatted = fractionDigits > 0 ? numeric.toFixed(fractionDigits) : String(numeric)
  return `${formatted} ${suffix}`.trim()
}

const pulseLabel = computed(() => formatVitalNumber(props.examinationDetail?.pulse, 'bpm'))
const temperatureLabel = computed(() =>
  formatVitalNumber(props.examinationDetail?.temperature, '°C', 1),
)
const respiratoryRateLabel = computed(() =>
  formatVitalNumber(props.examinationDetail?.respiratoryRate, 'breaths/min'),
)
const weightLabel = computed(() => formatVitalNumber(props.examinationDetail?.weight, 'kg', 1))
const heightLabel = computed(() => formatVitalNumber(props.examinationDetail?.height, 'cm', 1))
const bmiLabel = computed(() => formatVitalNumber(props.examinationDetail?.bmi, '', 1))

const bloodPressureLabel = computed(() => {
  const systolic = props.examinationDetail?.systolicBloodPressure
  const diastolic = props.examinationDetail?.diastolicBloodPressure

  if (systolic === null && diastolic === null) {
    return '—'
  }

  if (systolic !== null && diastolic !== null) {
    return `${systolic}/${diastolic} mmHg`
  }

  if (systolic !== null) {
    return `${systolic} mmHg`
  }

  if (diastolic !== null) {
    return `${diastolic} mmHg`
  }

  return '—'
})

const formatDateTimeLocal = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const parseTimeValue = (value: string): { hours: number; minutes: number } | null => {
  if (!value) {
    return null
  }

  const [hoursRaw, minutesRaw] = value.split(':')
  if (hoursRaw === undefined || minutesRaw === undefined) {
    return null
  }

  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return { hours, minutes }
}

const resolveEndDateTime = (): Date | null => {
  const value = endDateValue.value
  const time = parseTimeValue(endTimeValue.value)

  if (!value || !time || typeof value.toDate !== 'function') {
    return null
  }

  const date = value.toDate(timeZone)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null
  }

  const result = new Date(date)
  result.setHours(time.hours, time.minutes, 0, 0)
  return result
}

const setEndDateTimeFromDate = (value: Date | null) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    endDateValue.value = undefined
    endTimeValue.value = ''
    return
  }

  const iso = formatDateTimeLocal(value)
  const [datePart, timePart] = iso.split('T')

  try {
    endDateValue.value = datePart ? (parseDate(datePart) as CalendarDate) : undefined
  } catch {
    endDateValue.value = undefined
  }

  endTimeValue.value = timePart ?? ''
}

const setEndDateTimeFromString = (value: string | null | undefined) => {
  if (!value) {
    setEndDateTimeFromDate(null)
    return
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    setEndDateTimeFromDate(null)
    return
  }

  setEndDateTimeFromDate(parsed)
}

const handleEndDateUpdate = (value: DateValue | undefined) => {
  if (value && typeof value.toDate === 'function') {
    endDateValue.value = value as CalendarDate
  } else {
    endDateValue.value = undefined
  }

  endDatePopoverOpen.value = false
}

const syncFormState = () => {
  const defaultTime = props.defaultEndTime ?? formatDateTimeLocal(new Date())
  setEndDateTimeFromString(defaultTime)
  endDatePopoverOpen.value = false
  treatmentMethod.value = props.examinationDetail?.treatmentMethod ?? ''
  disposition.value = props.examinationDetail?.disposition ?? null
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncFormState()
    }
  },
)

watch(
  () => props.defaultEndTime,
  (value) => {
    if (!props.open) {
      return
    }

    if (value) {
      setEndDateTimeFromString(value)
    } else {
      setEndDateTimeFromDate(null)
    }
  },
)

watch(
  () => props.examinationDetail,
  (detail) => {
    if (!props.open) {
      return
    }

    treatmentMethod.value = detail?.treatmentMethod ?? ''
    disposition.value = detail?.disposition ?? null
  },
  { deep: true },
)

const handleClose = () => {
  emit('update:open', false)
}

const handleDispositionChange = (value: AcceptableValue) => {
  if (value === null || value === undefined) {
    disposition.value = null
    return
  }

  disposition.value = String(value)
}

const handleSave = () => {
  if (!props.examinationDetail) {
    toast.error('Save examination details before finalizing disposition.')
    return
  }

  if (!endDateValue.value) {
    toast.error('Please select an examination end date.')
    return
  }

  if (!endTimeValue.value) {
    toast.error('Please enter an examination end time.')
    return
  }

  const resolved = resolveEndDateTime()
  if (!resolved) {
    toast.error('Invalid examination end time.')
    return
  }

  if (!disposition.value) {
    toast.error('Please choose a disposition option.')
    return
  }

  const trimmedTreatment = treatmentMethod.value.trim()
  if (!trimmedTreatment.length) {
    toast.error('Please provide a treatment method.')
    return
  }

  treatmentMethod.value = trimmedTreatment

  const payloadEndTime = formatDateTimeLocal(resolved)

  emit('save', {
    endTime: payloadEndTime,
    treatmentMethod: trimmedTreatment,
    disposition: disposition.value,
  })
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-5xl sm:max-w-5xl lg:max-w-6xl">
      <DialogHeader>
        <DialogTitle>Finalize Disposition</DialogTitle>
        <DialogDescription>
          Review patient details, confirm assigned services, and record the disposition information.
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        <section class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Patient Information
          </h3>
          <div class="grid gap-4 rounded-md border p-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Patient Name
              </p>
              <p class="text-sm font-semibold text-foreground">{{ patientName }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Medical Record Code
              </p>
              <p class="text-sm text-foreground">{{ patientCode }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Birth Date
              </p>
              <p class="text-sm text-foreground">{{ patientBirthDate }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Phone Number
              </p>
              <p class="text-sm text-foreground">{{ patientPhone }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Exam Started
              </p>
              <p class="text-sm text-foreground">{{ examStartTime }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last Completed
              </p>
              <p class="text-sm text-foreground">{{ examEndTime }}</p>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Examination Overview
          </h3>
          <div
            v-if="examinationDetail"
            class="grid gap-4 rounded-md border p-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div class="md:col-span-2">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Initial Diagnosis
              </p>
              <p class="text-sm text-foreground">{{ initialDiagnosis }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current Treatment Method
              </p>
              <p class="text-sm text-foreground">{{ currentTreatmentMethod }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current Disposition
              </p>
              <p class="text-sm text-foreground">{{ currentDisposition }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pulse</p>
              <p class="text-sm text-foreground">{{ pulseLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Temperature
              </p>
              <p class="text-sm text-foreground">{{ temperatureLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Respiratory Rate
              </p>
              <p class="text-sm text-foreground">{{ respiratoryRateLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Weight
              </p>
              <p class="text-sm text-foreground">{{ weightLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Height
              </p>
              <p class="text-sm text-foreground">{{ heightLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">BMI</p>
              <p class="text-sm text-foreground">{{ bmiLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Blood Pressure
              </p>
              <p class="text-sm text-foreground">{{ bloodPressureLabel }}</p>
            </div>
          </div>
          <div v-else class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Examination details are not available. Save examination information before finalizing
            the disposition.
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Diagnosed Diseases
          </h3>
          <div
            v-if="!hasDiagnoses"
            class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            No diagnosed diseases have been recorded for this examination.
          </div>
          <ul v-else class="space-y-2 rounded-md border p-4 text-sm text-foreground">
            <li
              v-for="diagnosis in diagnosisRows"
              :key="diagnosis.key"
              class="flex flex-wrap items-baseline justify-between gap-2"
            >
              <span class="font-medium">
                <template v-if="diagnosis.code"> {{ diagnosis.code }} — </template>
                {{ diagnosis.name }}
              </span>
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {{ diagnosis.isPrimary ? 'Primary' : 'Secondary' }}
              </span>
            </li>
          </ul>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Assigned Services
          </h3>
          <div
            v-if="!hasServices"
            class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            No services have been assigned to this medical record.
          </div>
          <div v-else class="space-y-4">
            <div v-for="group in serviceGroups" :key="group.category" class="space-y-2">
              <template v-if="group.orders.length">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {{ group.label }}
                </h4>
                <ul class="space-y-2 rounded-md border p-3 text-sm">
                  <li v-for="order in group.orders" :key="order.id" class="text-foreground">
                    {{ order.label }}
                  </li>
                </ul>
              </template>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel for="disposition-end-time">
                End Time <span aria-hidden="true" class="text-destructive">*</span>
              </FieldLabel>
              <div class="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                <Popover v-model:open="endDatePopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      id="disposition-end-date"
                      type="button"
                      variant="outline"
                      class="w-full justify-start text-left font-normal"
                      aria-required="true"
                      :disabled="saving"
                    >
                      <CalendarIcon class="mr-2 h-4 w-4" />
                      <span :class="!hasEndDateSelected ? 'text-muted-foreground' : ''">
                        {{ endDateLabel }}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <Calendar
                      :model-value="endDateValueForCalendar"
                      layout="month-and-year"
                      initial-focus
                      @update:model-value="handleEndDateUpdate"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  id="disposition-end-time"
                  v-model="endTimeValue"
                  type="time"
                  step="60"
                  class="w-full"
                  required
                  aria-required="true"
                  :disabled="saving"
                  placeholder="HH:MM"
                  aria-label="Disposition end time"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel for="disposition-select">
                Disposition <span aria-hidden="true" class="text-destructive">*</span>
              </FieldLabel>
              <Select
                id="disposition-select"
                :model-value="disposition"
                :disabled="saving"
                aria-required="true"
                @update:model-value="handleDispositionChange"
              >
                <SelectTrigger class="hover:text-primary-foreground">
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in DISPOSITION_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel for="disposition-treatment">
              Treatment Method <span aria-hidden="true" class="text-destructive">*</span>
            </FieldLabel>
            <Textarea
              id="disposition-treatment"
              v-model="treatmentMethod"
              :disabled="saving"
              rows="4"
              placeholder="Enter the treatment method or follow-up instructions"
              required
              aria-required="true"
            />
          </Field>
        </section>
      </div>

      <DialogFooter class="gap-2">
        <Button type="button" variant="outline" :disabled="saving" @click="handleClose">
          Cancel
        </Button>
        <Button type="button" :disabled="saving" @click="handleSave">
          <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
          <span>{{ saving ? 'Saving…' : 'Save Disposition' }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
