<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { CalendarIcon, AlertCircle } from 'lucide-vue-next'
import { toRefs } from 'vue'
import { useVModel } from '@vueuse/core'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BaseCombobox from '@/components/ComboBox.vue'
import type { AdministrativePatientFormState, ComboboxOption, GenderValue } from './types'

const props = defineProps<{
  form: AdministrativePatientFormState
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
  loadingOccupations: boolean
  loadingMoreOccupations: boolean
  occupationHasMore: boolean
  loadingCities: boolean
  loadingWards: boolean
  isSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:form', value: AdministrativePatientFormState): void
  (e: 'update:birthDate', value: DateValue | undefined): void
  (e: 'occupation-search', value: string): void
  (e: 'occupation-load-more'): void
  (e: 'occupation-open-change', value: boolean): void
  (e: 'cancel'): void
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
  loadingOccupations,
  loadingMoreOccupations,
  occupationHasMore,
  loadingCities,
  loadingWards,
  isSubmitting,
  maxBirthDate,
} = toRefs(props)

const handleBirthDateUpdate = (value: DateValue | undefined) => {
  emit('update:birthDate', value)
}
</script>

<template>
  <section>
    <Alert v-if="formErrors.length" variant="destructive" class="mb-6">
      <AlertCircle class="mr-2 h-5 w-5" />
      <AlertTitle>Unable to save information</AlertTitle>
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
          <FieldLabel for="admin-patient-code">Patient Code</FieldLabel>
          <Input id="admin-patient-code" :model-value="form.code ?? 'Patient ID'" disabled />
        </Field>

        <Field>
          <FieldLabel for="admin-patient-name">
            Full Name <span class="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="admin-patient-name"
            v-model="form.fullName"
            type="text"
            autocomplete="name"
            placeholder="Enter patient full name"
          />
        </Field>

        <Field>
          <FieldLabel> Date of Birth <span class="text-destructive">*</span> </FieldLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                id="admin-patient-birthdate"
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
          <FieldLabel for="admin-patient-age">Age</FieldLabel>
          <Input id="admin-patient-age" :model-value="ageDisplay" readonly disabled />
        </Field>

        <Field>
          <FieldLabel> Gender <span class="text-destructive">*</span> </FieldLabel>
          <Select v-model="form.gender">
            <SelectTrigger id="admin-patient-gender" class="w-full">
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
            id="admin-patient-occupation"
            placeholder="Select occupation"
            search-placeholder="Search occupations..."
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
            id="admin-patient-city"
            placeholder="Select city/province"
            search-placeholder="Search cities/provinces..."
            :loading="loadingCities"
          />
        </Field>

        <Field>
          <FieldLabel> Ward <span class="text-destructive">*</span> </FieldLabel>
          <BaseCombobox
            v-model="form.wardId"
            :options="wardOptions"
            id="admin-patient-ward"
            placeholder="Select ward"
            search-placeholder="Search wards..."
            :loading="loadingWards"
            :disabled="!form.cityId || loadingCities"
          />
        </Field>

        <Field>
          <FieldLabel for="admin-patient-phone">Phone Number</FieldLabel>
          <Input
            id="admin-patient-phone"
            v-model="form.phone"
            type="tel"
            autocomplete="tel"
            placeholder="Enter contact phone number"
          />
        </Field>

        <Field>
          <FieldLabel for="admin-relative-name">Emergency Contact</FieldLabel>
          <Input
            id="admin-relative-name"
            v-model="form.relativeName"
            type="text"
            placeholder="Enter emergency contact name"
          />
        </Field>

        <Field>
          <FieldLabel for="admin-relative-phone">Emergency Contact Phone</FieldLabel>
          <Input
            id="admin-relative-phone"
            v-model="form.relativePhone"
            type="tel"
            autocomplete="tel"
            placeholder="Enter emergency contact phone number"
          />
        </Field>
      </FieldGroup>

      <div class="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          class="hover:text-primary-foreground"
          :disabled="isSubmitting"
          @click="emit('cancel')"
        >
          Cancel
        </Button>
        <Button type="button" :disabled="isSubmitting" @click="emit('save')">
          {{ isSubmitting ? 'Saving...' : 'Save information' }}
        </Button>
      </div>
    </form>
  </section>
</template>
