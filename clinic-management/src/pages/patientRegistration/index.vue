<script setup lang="ts">
definePage({
  alias: '/patient-registration/',
  meta: {
    requiresAuth: true,
  },
})

import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import BaseCombobox from '@/components/RoomConfigurationComboBox.vue'

import { getOccupations } from '@/services/occupation'
import { getCities, getProvinces } from '@/services/location'
import { getRooms } from '@/services/room'

type ComboboxOption = {
  value: number
  label: string
}

interface PatientFormState {
  code: string | null
  fullName: string
  gender: string | undefined
  occupationId: number | null
  cityId: number | null
  wardId: number | null
  phone: string
  relativeName: string
  relativePhone: string
  reason: string
  roomId: number | null
}

const activeTab = ref('intake')

const timeZone = getLocalTimeZone()
const maxBirthDate = today(timeZone)

const form = reactive<PatientFormState>({
  code: null,
  fullName: '',
  gender: undefined,
  occupationId: null,
  cityId: null,
  wardId: null,
  phone: '',
  relativeName: '',
  relativePhone: '',
  reason: '',
  roomId: null,
})

const birthDateRaw = ref<unknown>(undefined)

const birthDateModel = computed<DateValue | undefined>({
  get: () => birthDateRaw.value as DateValue | undefined,
  set: (value: DateValue | undefined) => {
    birthDateRaw.value = value
  },
})

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const occupationOptions = ref<ComboboxOption[]>([])
const cityOptions = ref<ComboboxOption[]>([])
const wardOptions = ref<ComboboxOption[]>([])
const roomOptions = ref<ComboboxOption[]>([])

const loadingOccupations = ref(false)
const loadingCities = ref(false)
const loadingWards = ref(false)
const loadingRooms = ref(false)

const hasBirthDate = computed(() => Boolean(birthDateRaw.value))

const birthDateLabel = computed(() => {
  const value = birthDateRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return 'Select birth date'
  }

  const date = value.toDate(timeZone)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
})

const ageDisplay = computed(() => {
  const value = birthDateRaw.value as DateValue | undefined
  if (!value || typeof value.toDate !== 'function') {
    return ''
  }

  const birthDate = value.toDate(timeZone)
  const now = new Date()

  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  const dayDiff = now.getDate() - birthDate.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }

  return age >= 0 ? String(age) : ''
})

const handleLoadError = (message: string) => {
  toast.error(message)
}

const FETCH_LIMIT = 100

const loadOccupations = async () => {
  loadingOccupations.value = true
  try {
    const { occupations } = await getOccupations({ limit: FETCH_LIMIT })
    occupationOptions.value = occupations.map((occupation) => ({
      value: occupation.id,
      label: occupation.name,
    }))
  } catch (error) {
    handleLoadError('Unable to load occupations.')
    console.error(error)
  } finally {
    loadingOccupations.value = false
  }
}

const loadCities = async () => {
  loadingCities.value = true
  try {
    const { cities } = await getCities({ limit: FETCH_LIMIT })
    cityOptions.value = cities.map((city) => ({
      value: city.id,
      label: city.name,
    }))
  } catch (error) {
    handleLoadError('Unable to load cities.')
    console.error(error)
  } finally {
    loadingCities.value = false
  }
}

const loadWards = async (cityId: number) => {
  loadingWards.value = true
  try {
    const { provinces } = await getProvinces({ cityId, limit: FETCH_LIMIT })
    wardOptions.value = provinces.map((province) => ({
      value: province.id,
      label: province.name,
    }))
  } catch (error) {
    handleLoadError('Unable to load wards.')
    console.error(error)
  } finally {
    loadingWards.value = false
  }
}

const loadRooms = async () => {
  loadingRooms.value = true
  try {
    const { rooms } = await getRooms({ limit: FETCH_LIMIT })
    roomOptions.value = rooms.map((room) => ({
      value: room.id,
      label: `${room.name} · ${room.departmentName}`,
    }))
  } catch (error) {
    handleLoadError('Unable to load clinic rooms.')
    console.error(error)
  } finally {
    loadingRooms.value = false
  }
}

watch(
  () => form.cityId,
  (cityId) => {
    form.wardId = null
    wardOptions.value = []

    if (cityId) {
      void loadWards(cityId)
    }
  },
)

onMounted(() => {
  void loadOccupations()
  void loadCities()
  void loadRooms()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <Card>
        <CardHeader class="space-y-2">
          <CardTitle>Patient Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs v-model="activeTab" class="w-full">
            <TabsList class="grid w-full grid-cols-2 gap-2">
              <TabsTrigger value="intake" class="w-full">Intake</TabsTrigger>
              <TabsTrigger value="history" class="w-full">Other Info</TabsTrigger>
            </TabsList>

            <TabsContent value="intake" class="mt-6">
              <form class="grid gap-6">
                <FieldGroup class="grid gap-6 md:grid-cols-2">
                  <Field>
                    <FieldLabel for="patient-code">Patient ID</FieldLabel>
                    <Input
                      id="patient-code"
                      :model-value="form.code ?? 'Patient ID'"
                      disabled
                    />
                  </Field>

                  <Field>
                    <FieldLabel for="patient-name">Full Name</FieldLabel>
                    <Input
                      id="patient-name"
                      v-model="form.fullName"
                      type="text"
                      autocomplete="name"
                      placeholder="Enter patient full name"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Birth Date</FieldLabel>
                    <Popover>
                      <PopoverTrigger as-child>
                        <Button
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
                          v-model="birthDateModel"
                          :max-value="maxBirthDate"
                          initial-focus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>

                  <Field>
                    <FieldLabel for="patient-age">Age</FieldLabel>
                    <Input id="patient-age" :model-value="ageDisplay" readonly disabled />
                  </Field>

                  <Field>
                    <FieldLabel>Gender</FieldLabel>
                    <Select v-model="form.gender">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="option in genderOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Occupation</FieldLabel>
                    <BaseCombobox
                      v-model="form.occupationId"
                      :options="occupationOptions"
                      placeholder="Select occupation"
                      search-placeholder="Search occupation..."
                      :loading="loadingOccupations"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>City/Province</FieldLabel>
                    <BaseCombobox
                      v-model="form.cityId"
                      :options="cityOptions"
                      placeholder="Select city/province"
                      search-placeholder="Search city/province..."
                      :loading="loadingCities"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Ward/Commune</FieldLabel>
                    <BaseCombobox
                      v-model="form.wardId"
                      :options="wardOptions"
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
                    <FieldLabel for="reason">Admission Reason</FieldLabel>
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
                    >New Entry</Button
                  >
                  <Button type="button" class="cursor-pointer">Save</Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="history" class="mt-6">
              <div
                class="flex min-h-32 items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground"
              >
                Content will be added later.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
