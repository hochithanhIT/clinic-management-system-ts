<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { CalendarIcon, AlertCircle } from 'lucide-vue-next'
import { ref, toRefs } from 'vue'
import { useVModel } from '@vueuse/core'

import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Field, FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Calendar } from '../ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import BaseCombobox from '../ComboBox.vue'
import type { ComboboxOption, GenderValue, PatientFormState } from './types'

const props = defineProps<{
  form: PatientFormState
  formErrors: string[]
  birthDate: DateValue | undefined
  maxBirthDate?: DateValue
  hasBirthDate: boolean
  birthDateLabel: string
  ageDisplay: string
  genderOptions: Array<{ value: GenderValue; label: string }>
  occupationOptions: ComboboxOption[]
  cityOptions: ComboboxOption[]
  wardOptions: ComboboxOption[]
  roomOptions: ComboboxOption[]
  loadingOccupations: boolean
  loadingMoreOccupations: boolean
  occupationHasMore: boolean
  loadingCities: boolean
  loadingWards: boolean
  loadingRooms: boolean
  isSubmitting: boolean
  saveDisabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:form', value: PatientFormState): void
  (e: 'update:birthDate', value: DateValue | undefined): void
  (e: 'occupation-search', value: string): void
  (e: 'occupation-load-more'): void
  (e: 'occupation-open-change', value: boolean): void
  (e: 'new-entry'): void
  (e: 'save'): void
}>()

const form = useVModel(props, 'form', emit)

const {
  formErrors,
  birthDate,
  hasBirthDate,
  birthDateLabel,
  ageDisplay,
  genderOptions,
  occupationOptions,
  cityOptions,
  wardOptions,
  roomOptions,
  loadingOccupations,
  loadingMoreOccupations,
  occupationHasMore,
  loadingCities,
  loadingWards,
  loadingRooms,
  isSubmitting,
  saveDisabled,
  maxBirthDate,
} = toRefs(props)

const birthDatePopoverOpen = ref(false)

const handleBirthDateUpdate = (value: DateValue | undefined) => {
  emit('update:birthDate', value)
  birthDatePopoverOpen.value = false
}
</script>
<template>
  <section>
    <Alert v-if="formErrors.length" variant="destructive" class="mb-6">
      <AlertCircle class="mr-2 h-5 w-5" />
      <AlertTitle>Failed to save patient</AlertTitle>
      <AlertDescription>
        <ul class="list-disc space-y-1 pl-5">
          <li v-for="message in formErrors" :key="message">
            {{ message }}
          </li>
        </ul>
      </AlertDescription>
    </Alert>

    <form class="grid gap-6">
      <FieldGroup class="grid gap-6 md:grid-cols-2">
        <Field>
          <FieldLabel for="patient-code">Patient ID</FieldLabel>
          <Input id="patient-code" :model-value="form.code ?? 'Patient ID'" disabled />
        </Field>

        <Field>
          <FieldLabel for="patient-name">
            Full Name <span class="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="patient-name"
            v-model="form.fullName"
            type="text"
            autocomplete="name"
            placeholder="Enter patient full name"
          />
        </Field>

        <Field>
          <FieldLabel> Birth Date <span class="text-destructive">*</span> </FieldLabel>
          <Popover v-model:open="birthDatePopoverOpen">
            <PopoverTrigger as-child>
              <Button
                id="patient-birthdate"
                variant="outline"
                class="w-full justify-start text-left font-normal"
              >
                <CalendarIcon class="mr-2 h-4 w-4" />
                <span :class="!hasBirthDate ? 'text-muted-foreground' : ''">
                  {{ birthDateLabel }}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar
                :model-value="birthDate"
                :max-value="maxBirthDate"
                layout="month-and-year"
                initial-focus
                @update:model-value="handleBirthDateUpdate"
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel for="patient-age">Age</FieldLabel>
          <Input id="patient-age" :model-value="ageDisplay" readonly disabled />
        </Field>

        <Field>
          <FieldLabel> Gender <span class="text-destructive">*</span> </FieldLabel>
          <Select v-model="form.gender">
            <SelectTrigger id="patient-gender" class="w-full">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in genderOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel> Occupation <span class="text-destructive">*</span> </FieldLabel>
          <BaseCombobox
            v-model="form.occupationId"
            :options="occupationOptions"
            id="patient-occupation"
            placeholder="Select occupation"
            search-placeholder="Search occupation..."
            :loading="loadingOccupations"
            :loading-more="loadingMoreOccupations"
            :has-more="occupationHasMore"
            @search="emit('occupation-search', $event)"
            @load-more="emit('occupation-load-more')"
            @open-change="emit('occupation-open-change', $event)"
          />
        </Field>

        <Field>
          <FieldLabel> City/Province <span class="text-destructive">*</span> </FieldLabel>
          <BaseCombobox
            v-model="form.cityId"
            :options="cityOptions"
            id="patient-city"
            placeholder="Select city/province"
            search-placeholder="Search city/province..."
            :loading="loadingCities"
          />
        </Field>

        <Field>
          <FieldLabel> Ward/Commune <span class="text-destructive">*</span> </FieldLabel>
          <BaseCombobox
            v-model="form.wardId"
            :options="wardOptions"
            id="patient-ward"
            placeholder="Select ward/commune"
            search-placeholder="Search ward/commune..."
            :loading="loadingWards"
            :disabled="!form.cityId || loadingCities"
          />
        </Field>

        <Field>
          <FieldLabel for="patient-phone">Phone Number</FieldLabel>
          <Input
            id="patient-phone"
            v-model="form.phone"
            type="tel"
            autocomplete="tel"
            placeholder="Enter contact phone number"
          />
        </Field>

        <Field>
          <FieldLabel for="relative-name">Relative Name</FieldLabel>
          <Input
            id="relative-name"
            v-model="form.relativeName"
            type="text"
            placeholder="Enter relative name"
          />
        </Field>

        <Field>
          <FieldLabel for="relative-phone">Relative Phone Number</FieldLabel>
          <Input
            id="relative-phone"
            v-model="form.relativePhone"
            type="tel"
            autocomplete="tel"
            placeholder="Enter relative phone number"
          />
        </Field>

        <Field class="md:col-span-2">
          <FieldLabel for="reason">
            Admission Reason <span class="text-destructive">*</span>
          </FieldLabel>
          <Textarea
            id="reason"
            v-model="form.reason"
            placeholder="Enter admission reason"
            rows="3"
          />
        </Field>

        <Field>
          <FieldLabel>Clinic Room</FieldLabel>
          <BaseCombobox
            v-model="form.roomId"
            :options="roomOptions"
            placeholder="Select clinic room"
            search-placeholder="Search clinic room..."
            :loading="loadingRooms"
          />
        </Field>
      </FieldGroup>

      <div class="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          class="cursor-pointer hover:text-primary-foreground"
          :disabled="isSubmitting"
          @click="emit('new-entry')"
        >
          New Entry
        </Button>
        <Button
          type="button"
          class="cursor-pointer"
          :disabled="isSubmitting || saveDisabled"
          @click="emit('save')"
        >
          Save
        </Button>
      </div>
    </form>
  </section>
</template>
