<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import ComboBox from '@/components/ComboBox.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/services/http'
import { getDiseases, type DiseaseSummary } from '@/services/disease'
import type { PaginationMeta } from '@/services/types'
import { getPatient, type PatientSummary } from '@/services/patient'
import type { MedicalRecordSummary } from '@/services/medicalRecord'
import {
  getMedicalExaminationByMedicalRecord,
  type MedicalExaminationDetail,
} from '@/services/medicalExamination'

interface DiseaseOption {
  id: number
  code: string
  name: string
}

interface ExaminationFormState {
  generalAssessment: string
  systemAssessment: string
  pulse: string
  temperature: string
  bloodPressure: string
  heartRate: string
  weight: string
  height: string
  bmi: string
  primaryDiseaseId: number | null
  initialDiagnosis: string
  reasonForAdmission: string
  medicalHistory: string
  personalHistory: string
  familyHistory: string
}

type ValidationFieldKey =
  | 'height'
  | 'weight'
  | 'initialDiagnosis'
  | 'primaryDiseaseId'
  | 'medicalHistory'
  | 'reasonForAdmission'

export interface MedicalExaminationDialogSavePayload {
  medicalRecordId: number
  examinationId: number | null
  form: ExaminationFormState
  secondaryDiseaseIds: number[]
}

const props = defineProps<{
  open: boolean
  selectedRecord: MedicalRecordSummary | null
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  save: [MedicalExaminationDialogSavePayload]
}>()

const examinationActiveTab = ref<'clinical' | 'anamnesis'>('clinical')

const diseaseOptions = ref<DiseaseOption[]>([])
const diseasePagination = ref<PaginationMeta | null>(null)
const diseaseSearchTerm = ref('')
const diseasesLoading = ref(false)
const diseasesLoadingMore = ref(false)
const diseaseCache = reactive<Record<number, DiseaseOption>>({})

const secondaryDiseaseIds = ref<number[]>([])
const secondaryDiseaseSelection = ref<string | number | null>(null)

const patientDetail = ref<PatientSummary | null>(null)
const patientDetailLoading = ref(false)
const currentExaminationId = ref<number | null>(null)
const examinationLoading = ref(false)
const examinationLoadToken = ref(0)
const validationErrors = reactive<Partial<Record<ValidationFieldKey, string>>>({})

const requiredFieldConfig: Array<{
  key: ValidationFieldKey
  label: string
  tab: 'clinical' | 'anamnesis'
  elementId: string
  validator?: (value: unknown) => boolean
}> = [
  {
    key: 'height',
    label: 'Height',
    tab: 'clinical',
    elementId: 'clinical-height',
    validator: (value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) && numeric > 0
    },
  },
  {
    key: 'weight',
    label: 'Weight',
    tab: 'clinical',
    elementId: 'clinical-weight',
    validator: (value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) && numeric > 0
    },
  },
  {
    key: 'initialDiagnosis',
    label: 'Initial diagnosis',
    tab: 'clinical',
    elementId: 'clinical-initial-diagnosis',
  },
  {
    key: 'primaryDiseaseId',
    label: 'Primary disease',
    tab: 'clinical',
    elementId: 'clinical-primary-disease',
    validator: (value) => typeof value === 'number' && !Number.isNaN(value),
  },
  {
    key: 'medicalHistory',
    label: 'Medical history',
    tab: 'anamnesis',
    elementId: 'anamnesis-history',
  },
  {
    key: 'reasonForAdmission',
    label: 'Reason for admission',
    tab: 'anamnesis',
    elementId: 'anamnesis-reason',
  },
]

const examinationForm = reactive<ExaminationFormState>({
  generalAssessment: '',
  systemAssessment: '',
  pulse: '',
  temperature: '',
  bloodPressure: '',
  heartRate: '',
  weight: '',
  height: '',
  bmi: '',
  primaryDiseaseId: null,
  initialDiagnosis: '',
  reasonForAdmission: '',
  medicalHistory: '',
  personalHistory: '',
  familyHistory: '',
})

const selectedRecord = computed(() => props.selectedRecord)

const diseaseComboboxOptions = computed(() => {
  return diseaseOptions.value.map((option) => ({
    value: option.id,
    label: `${option.code} · ${option.name}`,
  }))
})

const diseasesHasMore = computed(() => {
  const pagination = diseasePagination.value
  if (!pagination || pagination.totalPages === 0) {
    return false
  }

  return pagination.page < pagination.totalPages
})

const secondaryDiseaseTags = computed(() => {
  return secondaryDiseaseIds.value.map((id) => {
    const option = diseaseCache[id] ?? diseaseOptions.value.find((candidate) => candidate.id === id)
    if (option) {
      return option
    }

    return {
      id,
      code: String(id),
      name: 'Loading details...',
    }
  })
})

const selectedPatientCode = computed(() => {
  return selectedRecord.value?.patient.code ?? '—'
})

const selectedPatientName = computed(() => {
  return selectedRecord.value?.patient.fullName ?? '—'
})

const selectedPatientBirthDate = computed(() => {
  const value = selectedRecord.value?.patient.birthDate ?? null
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB')
})

const selectedPatientGenderLabel = computed(() => {
  const genderValue = selectedRecord.value?.patient.gender
  if (genderValue === 1) {
    return 'Male'
  }

  if (genderValue === 0) {
    return 'Female'
  }

  return '—'
})

const selectedPatientOccupation = computed(() => {
  return patientDetail.value?.occupation?.name ?? '—'
})

const selectedPatientAddress = computed(() => {
  const wardName = selectedRecord.value?.patient.ward?.name ?? ''
  const cityName = selectedRecord.value?.patient.city?.name ?? ''
  const parts = [wardName, cityName].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
})

const selectedExamStartTime = computed(() => {
  const value = selectedRecord.value?.enteredAt ?? null
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
})

const resetForm = () => {
  examinationForm.generalAssessment = ''
  examinationForm.systemAssessment = ''
  examinationForm.pulse = ''
  examinationForm.temperature = ''
  examinationForm.bloodPressure = ''
  examinationForm.heartRate = ''
  examinationForm.weight = ''
  examinationForm.height = ''
  examinationForm.bmi = ''
  examinationForm.primaryDiseaseId = null
  examinationForm.initialDiagnosis = ''
  examinationForm.reasonForAdmission = ''
  examinationForm.medicalHistory = ''
  examinationForm.personalHistory = ''
  examinationForm.familyHistory = ''
  secondaryDiseaseIds.value = []
  secondaryDiseaseSelection.value = null
  examinationActiveTab.value = 'clinical'
  clearValidationErrors()
  currentExaminationId.value = null
}

const clearValidationErrors = () => {
  for (const key of Object.keys(validationErrors) as ValidationFieldKey[]) {
    delete validationErrors[key]
  }
}

const computeBmi = () => {
  const weightValue = Number(examinationForm.weight)
  const heightValue = Number(examinationForm.height)

  if (
    !Number.isFinite(weightValue) ||
    !Number.isFinite(heightValue) ||
    weightValue <= 0 ||
    heightValue <= 0
  ) {
    examinationForm.bmi = ''
    return
  }

  const heightInMeters = heightValue / 100

  if (heightInMeters <= 0) {
    examinationForm.bmi = ''
    return
  }

  const bmiValue = weightValue / (heightInMeters * heightInMeters)
  examinationForm.bmi = Number.isFinite(bmiValue) ? bmiValue.toFixed(1) : ''
}

const ensureDiseasesLoaded = async () => {
  if (diseaseOptions.value.length) {
    return
  }

  await loadDiseasesList({ page: 1, search: diseaseSearchTerm.value })
}

const loadDiseasesList = async (
  options: { page?: number; search?: string; append?: boolean } = {},
) => {
  const page = options.page ?? 1
  const search = options.search ?? diseaseSearchTerm.value
  const append = options.append ?? false

  if (append) {
    if (diseasesLoadingMore.value) {
      return
    }
    diseasesLoadingMore.value = true
  } else {
    diseasesLoading.value = true
  }

  try {
    const { diseases, pagination } = await getDiseases({
      page,
      limit: 20,
      search,
    })

    const mapped: DiseaseOption[] = diseases.map((disease: DiseaseSummary) => ({
      id: disease.id,
      code: disease.code,
      name: disease.name,
    }))

    for (const option of mapped) {
      diseaseCache[option.id] = option
    }

    diseasePagination.value = pagination

    if (append) {
      const existing = new Map(diseaseOptions.value.map((option) => [option.id, option]))
      for (const option of mapped) {
        existing.set(option.id, option)
      }
      diseaseOptions.value = Array.from(existing.values())
    } else {
      diseaseOptions.value = mapped
    }
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Unable to load disease list. Please try again.'
    toast.error(message)
  } finally {
    if (append) {
      diseasesLoadingMore.value = false
    } else {
      diseasesLoading.value = false
    }
  }
}

const handleDiseaseSearch = async (value: string) => {
  diseaseSearchTerm.value = value
  await loadDiseasesList({ page: 1, search: value })
}

const handleDiseaseLoadMore = async () => {
  const pagination = diseasePagination.value
  if (!pagination || !diseasesHasMore.value) {
    return
  }

  const nextPage = pagination.page + 1

  if (pagination.totalPages !== 0 && nextPage > pagination.totalPages) {
    return
  }

  await loadDiseasesList({ page: nextPage, search: diseaseSearchTerm.value, append: true })
}

const handleDiseaseOpenChange = async (open: boolean) => {
  if (open) {
    await ensureDiseasesLoaded()
  }
}

const handleAddSecondaryDisease = (id: number) => {
  if (secondaryDiseaseIds.value.includes(id)) {
    return
  }

  const option = diseaseCache[id] ?? diseaseOptions.value.find((item) => item.id === id)
  if (!option) {
    return
  }

  diseaseCache[option.id] = option
  secondaryDiseaseIds.value = [...secondaryDiseaseIds.value, option.id]
  void handleDiseaseSearch('')
}

const handleSecondaryDiseaseSelect = (value: string | number | null) => {
  if (value === null) {
    return
  }

  const numericValue = typeof value === 'string' ? Number(value) : value

  if (typeof numericValue !== 'number' || Number.isNaN(numericValue)) {
    secondaryDiseaseSelection.value = null
    return
  }

  handleAddSecondaryDisease(numericValue)
  secondaryDiseaseSelection.value = null
}

const loadSelectedPatientDetail = async () => {
  const record = selectedRecord.value

  if (!record) {
    patientDetail.value = null
    return
  }

  patientDetailLoading.value = true

  try {
    patientDetail.value = await getPatient(record.patient.id)
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load patient details. Please try again.'
    toast.error(message)
    patientDetail.value = null
  } finally {
    patientDetailLoading.value = false
  }
}

const applyExaminationToForm = (examination: MedicalExaminationDetail) => {
  currentExaminationId.value = examination.id

  examinationForm.generalAssessment = examination.generalAssessment ?? ''
  examinationForm.systemAssessment = examination.systemAssessment ?? ''
  examinationForm.pulse = examination.pulse !== null ? String(examination.pulse) : ''
  examinationForm.temperature =
    examination.temperature !== null ? String(examination.temperature) : ''
  examinationForm.heartRate =
    examination.respiratoryRate !== null ? String(examination.respiratoryRate) : ''
  examinationForm.weight = examination.weight !== null ? String(examination.weight) : ''
  examinationForm.height = examination.height !== null ? String(examination.height) : ''
  examinationForm.bmi = examination.bmi !== null ? examination.bmi.toFixed(1) : ''
  const hasBothPressureValues =
    examination.systolicBloodPressure !== null && examination.diastolicBloodPressure !== null
  examinationForm.bloodPressure = hasBothPressureValues
    ? `${examination.systolicBloodPressure}/${examination.diastolicBloodPressure}`
    : ''
  examinationForm.initialDiagnosis = examination.initialDiagnosis ?? ''
  examinationForm.medicalHistory = examination.diseaseProgression ?? ''
  examinationForm.personalHistory = examination.personalHistory ?? ''
  examinationForm.familyHistory = examination.familyHistory ?? ''

  const primaryDiagnosis = examination.diagnoses.find((diagnosis) => diagnosis.isPrimary)
  examinationForm.primaryDiseaseId = primaryDiagnosis?.diseaseId ?? null

  const secondaryDiagnoses = examination.diagnoses
    .filter((diagnosis) => !diagnosis.isPrimary)
    .map((diagnosis) => diagnosis.diseaseId)

  secondaryDiseaseIds.value = secondaryDiagnoses
  secondaryDiseaseSelection.value = null

  for (const diagnosis of examination.diagnoses) {
    if (diagnosis.disease) {
      const option = {
        id: diagnosis.disease.id,
        code: diagnosis.disease.code,
        name: diagnosis.disease.name,
      }
      diseaseCache[diagnosis.diseaseId] = option
      if (!diseaseOptions.value.some((candidate) => candidate.id === option.id)) {
        diseaseOptions.value = [...diseaseOptions.value, option]
      }
    }
  }
}

const loadSelectedMedicalExamination = async () => {
  const record = selectedRecord.value

  if (!record) {
    currentExaminationId.value = null
    return
  }

  const requestId = ++examinationLoadToken.value
  examinationLoading.value = true

  try {
    const examination = await getMedicalExaminationByMedicalRecord(record.id)

    if (requestId !== examinationLoadToken.value) {
      return
    }

    if (!examination) {
      currentExaminationId.value = null
      return
    }

    applyExaminationToForm(examination)
  } catch (error) {
    if (requestId !== examinationLoadToken.value) {
      return
    }

    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load examination details. Please try again.'
    toast.error(message)
    currentExaminationId.value = null
  } finally {
    if (requestId === examinationLoadToken.value) {
      examinationLoading.value = false
    }
  }
}

const handleDialogOpenChange = (value: boolean) => {
  emit('update:open', value)
}

const syncReasonForAdmission = () => {
  const record = selectedRecord.value
  examinationForm.reasonForAdmission = record?.reason ?? ''
}

const handleSave = () => {
  const record = selectedRecord.value

  if (!record) {
    toast.error('No patient selected. Please choose a patient before saving.')
    return
  }

  if (examinationLoading.value) {
    toast.error('Examination details are still loading. Please wait and try again.')
    return
  }

  let firstInvalidField: (typeof requiredFieldConfig)[number] | null = null

  for (const config of requiredFieldConfig) {
    const candidateValue = examinationForm[config.key as keyof ExaminationFormState]
    const isValid = config.validator
      ? config.validator(candidateValue)
      : typeof candidateValue === 'string'
        ? candidateValue.trim().length > 0
        : Boolean(candidateValue)

    if (!isValid) {
      validationErrors[config.key] = `${config.label} is required.`
      if (!firstInvalidField) {
        firstInvalidField = config
      }
    } else if (validationErrors[config.key]) {
      delete validationErrors[config.key]
    }
  }

  if (firstInvalidField) {
    examinationActiveTab.value = firstInvalidField.tab
    void nextTick(() => {
      const target = document.getElementById(firstInvalidField!.elementId)
      if (target instanceof HTMLElement) {
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: false })
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
    toast.error('Please complete all required fields before saving.')
    return
  }

  const payload: MedicalExaminationDialogSavePayload = {
    medicalRecordId: record.id,
    examinationId: currentExaminationId.value,
    form: { ...examinationForm },
    secondaryDiseaseIds: [...secondaryDiseaseIds.value],
  }

  emit('save', payload)
}

watch(() => [examinationForm.weight, examinationForm.height], computeBmi, { immediate: true })

watch(
  () => props.open,
  (open) => {
    if (open) {
      examinationActiveTab.value = 'clinical'
      clearValidationErrors()
      syncReasonForAdmission()
      void ensureDiseasesLoaded()
      void loadSelectedPatientDetail()
      void loadSelectedMedicalExamination()
    } else {
      ++examinationLoadToken.value
      examinationLoading.value = false
      resetForm()
      patientDetail.value = null
    }
  },
)

watch(
  () => props.selectedRecord?.id,
  () => {
    if (props.open) {
      resetForm()
      syncReasonForAdmission()
      patientDetail.value = null
      void ensureDiseasesLoaded()
      void loadSelectedPatientDetail()
      void loadSelectedMedicalExamination()
    } else {
      currentExaminationId.value = null
    }
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="handleDialogOpenChange">
    <DialogContent class="max-h-[90vh] flex! flex-col! overflow-hidden sm:max-w-5xl">
      <DialogHeader class="space-y-2">
        <DialogTitle>Examination &amp; Medical History</DialogTitle>
        <DialogDescription>
          Update clinical examination and medical history information for the selected patient.
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 space-y-6 overflow-y-auto pl-3 pr-2 sm:pl-6 sm:pr-4">
        <section class="space-y-4">
          <div>
            <h3 class="text-lg font-semibold">Patient Information</h3>
            <p class="text-sm text-muted-foreground">
              Information is pulled from the currently selected medical record.
            </p>
          </div>

          <div class="grid gap-4 rounded-md border p-4 md:grid-cols-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Patient ID
              </p>
              <p class="text-sm font-semibold text-foreground">{{ selectedPatientCode }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full Name
              </p>
              <p class="text-sm font-semibold text-foreground">{{ selectedPatientName }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Birth Date
              </p>
              <p class="text-sm text-foreground">{{ selectedPatientBirthDate }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gender
              </p>
              <p class="text-sm text-foreground">{{ selectedPatientGenderLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Occupation
              </p>
              <p class="text-sm text-foreground">{{ selectedPatientOccupation }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Address
              </p>
              <p class="text-sm text-foreground">{{ selectedPatientAddress }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Exam start
              </p>
              <p class="text-sm text-foreground">{{ selectedExamStartTime }}</p>
            </div>
          </div>

          <p v-if="patientDetailLoading" class="text-sm text-muted-foreground">
            Loading patient details...
          </p>
          <p v-if="examinationLoading" class="text-sm text-muted-foreground">
            Loading examination details...
          </p>
        </section>

        <Tabs v-model="examinationActiveTab" class="space-y-4">
          <TabsList class="grid w-full grid-cols-2 gap-2">
            <TabsTrigger value="clinical">Clinical Exam</TabsTrigger>
            <TabsTrigger value="anamnesis">Anamnesis</TabsTrigger>
          </TabsList>

          <TabsContent value="clinical" class="space-y-6">
            <FieldGroup class="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel for="clinical-general">General Examination</FieldLabel>
                <Textarea
                  id="clinical-general"
                  v-model="examinationForm.generalAssessment"
                  rows="4"
                  placeholder="Enter general examination findings"
                />
              </Field>
              <Field>
                <FieldLabel for="clinical-system">System Examination</FieldLabel>
                <Textarea
                  id="clinical-system"
                  v-model="examinationForm.systemAssessment"
                  rows="4"
                  placeholder="Enter system examination findings"
                />
              </Field>
            </FieldGroup>

            <FieldGroup class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field>
                <FieldLabel for="clinical-pulse">Pulse (beats/min)</FieldLabel>
                <Input
                  id="clinical-pulse"
                  v-model="examinationForm.pulse"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter pulse"
                />
              </Field>
              <Field>
                <FieldLabel for="clinical-temp">Temperature (°C)</FieldLabel>
                <Input
                  id="clinical-temp"
                  v-model="examinationForm.temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Enter temperature"
                />
              </Field>
              <Field>
                <FieldLabel for="clinical-blood-pressure">Blood Pressure (mmHg)</FieldLabel>
                <Input
                  id="clinical-blood-pressure"
                  v-model="examinationForm.bloodPressure"
                  type="text"
                  placeholder="Enter blood pressure"
                />
              </Field>
              <Field>
                <FieldLabel for="clinical-heart-rate">Heart Rate (beats/min)</FieldLabel>
                <Input
                  id="clinical-heart-rate"
                  v-model="examinationForm.heartRate"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter heart rate"
                />
              </Field>
              <Field>
                <FieldLabel for="clinical-weight">
                  Weight (kg) <span aria-hidden="true" class="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="clinical-weight"
                  v-model="examinationForm.weight"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Enter weight"
                />
                <p v-if="validationErrors.weight" class="text-sm text-destructive">
                  {{ validationErrors.weight }}
                </p>
              </Field>
              <Field>
                <FieldLabel for="clinical-height">
                  Height (cm) <span aria-hidden="true" class="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="clinical-height"
                  v-model="examinationForm.height"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Enter height"
                />
                <p v-if="validationErrors.height" class="text-sm text-destructive">
                  {{ validationErrors.height }}
                </p>
              </Field>
              <Field>
                <FieldLabel for="clinical-bmi">BMI</FieldLabel>
                <Input id="clinical-bmi" :model-value="examinationForm.bmi" readonly disabled />
              </Field>
            </FieldGroup>

            <Field>
              <FieldLabel for="clinical-initial-diagnosis">
                Initial Diagnosis <span aria-hidden="true" class="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="clinical-initial-diagnosis"
                v-model="examinationForm.initialDiagnosis"
                rows="4"
                placeholder="Enter the initial diagnosis"
              />
              <p v-if="validationErrors.initialDiagnosis" class="text-sm text-destructive">
                {{ validationErrors.initialDiagnosis }}
              </p>
            </Field>

            <div class="space-y-6">
              <Field>
                <FieldLabel for="clinical-primary-disease">
                  Primary Disease <span aria-hidden="true" class="text-destructive">*</span>
                </FieldLabel>
                <ComboBox
                  v-model="examinationForm.primaryDiseaseId"
                  :options="diseaseComboboxOptions"
                  id="clinical-primary-disease"
                  placeholder="Select a primary disease"
                  search-placeholder="Search diseases..."
                  :loading="diseasesLoading"
                  :loading-more="diseasesLoadingMore"
                  :has-more="diseasesHasMore"
                  @search="handleDiseaseSearch"
                  @load-more="handleDiseaseLoadMore"
                  @open-change="handleDiseaseOpenChange"
                />
                <p v-if="validationErrors.primaryDiseaseId" class="text-sm text-destructive">
                  {{ validationErrors.primaryDiseaseId }}
                </p>
              </Field>

              <FieldGroup class="grid gap-4 md:grid-cols-2">
                <Field class="flex flex-col gap-2">
                  <FieldLabel for="clinical-secondary-disease">Secondary Diseases</FieldLabel>
                  <ComboBox
                    :model-value="secondaryDiseaseSelection"
                    :options="diseaseComboboxOptions"
                    id="clinical-secondary-disease"
                    placeholder="Select secondary diseases"
                    search-placeholder="Search diseases..."
                    :loading="diseasesLoading"
                    :loading-more="diseasesLoadingMore"
                    :has-more="diseasesHasMore"
                    @update:model-value="handleSecondaryDiseaseSelect"
                    @search="handleDiseaseSearch"
                    @load-more="handleDiseaseLoadMore"
                    @open-change="handleDiseaseOpenChange"
                  />
                  <p class="mt-1 text-xs text-muted-foreground">
                    Select each disease to add it to the list on the right.
                  </p>
                </Field>

                <Field class="flex flex-col gap-2">
                  <FieldLabel>Selected Secondary Diseases</FieldLabel>
                  <TagsInput
                    v-model="secondaryDiseaseIds"
                    class="w-full p-2"
                    aria-label="Selected secondary diseases list"
                  >
                    <template v-if="secondaryDiseaseTags.length">
                      <TagsInputItem
                        v-for="tag in secondaryDiseaseTags"
                        :key="`secondary-disease-${tag.id}`"
                        :value="tag.id"
                        class="bg-primary/10 text-primary h-auto items-start py-1"
                      >
                        <TagsInputItemText
                          class="flex flex-wrap items-baseline gap-2 font-medium text-primary"
                        >
                          <span class="whitespace-nowrap">{{ tag.code }}</span>
                          <span class="text-muted-foreground whitespace-normal"
                            >- {{ tag.name }}</span
                          >
                        </TagsInputItemText>
                        <TagsInputItemDelete
                          class="text-muted-foreground transition hover:text-destructive"
                        />
                      </TagsInputItem>
                    </template>
                    <TagsInputInput aria-hidden="true" class="hidden" disabled />
                  </TagsInput>
                  <p v-if="!secondaryDiseaseTags.length" class="mt-1 text-xs text-muted-foreground">
                    No secondary diseases selected.
                  </p>
                  <p v-else class="mt-1 text-xs text-muted-foreground">
                    Selected {{ secondaryDiseaseTags.length }} secondary diseases.
                  </p>
                </Field>
              </FieldGroup>
            </div>
          </TabsContent>

          <TabsContent value="anamnesis" class="space-y-6">
            <Field>
              <FieldLabel for="anamnesis-reason">
                Reason for Admission <span aria-hidden="true" class="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="anamnesis-reason"
                v-model="examinationForm.reasonForAdmission"
                rows="3"
                placeholder="Describe the reason for admission"
              />
              <p v-if="validationErrors.reasonForAdmission" class="text-sm text-destructive">
                {{ validationErrors.reasonForAdmission }}
              </p>
            </Field>

            <Field>
              <FieldLabel for="anamnesis-history">
                Medical History <span aria-hidden="true" class="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="anamnesis-history"
                v-model="examinationForm.medicalHistory"
                rows="4"
                placeholder="Summarize the medical history"
              />
              <p v-if="validationErrors.medicalHistory" class="text-sm text-destructive">
                {{ validationErrors.medicalHistory }}
              </p>
            </Field>

            <FieldGroup class="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel for="anamnesis-personal-history">Personal History</FieldLabel>
                <Textarea
                  id="anamnesis-personal-history"
                  v-model="examinationForm.personalHistory"
                  rows="4"
                  placeholder="Document relevant personal history"
                />
              </Field>
              <Field>
                <FieldLabel for="anamnesis-family-history">Family History</FieldLabel>
                <Textarea
                  id="anamnesis-family-history"
                  v-model="examinationForm.familyHistory"
                  rows="4"
                  placeholder="Document relevant family history"
                />
              </Field>
            </FieldGroup>
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter class="gap-2 sm:gap-3">
        <Button type="button" :disabled="saving || examinationLoading" @click="handleSave">
          <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
          Save
        </Button>
        <DialogClose as-child>
          <Button type="button" variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
