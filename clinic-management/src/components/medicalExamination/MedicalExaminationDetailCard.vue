<script setup lang="ts">
import type { MedicalRecordSummary } from '@/services/medicalRecord'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const props = defineProps<{
  record: MedicalRecordSummary | null
  doctorDisplay: string
  patientBirthDate: string
  patientAddress: string
  patientPhone: string
  examTimeRange: string
}>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Patient Details</CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="props.record" class="space-y-4">
        <div>
          <p class="text-sm font-medium text-muted-foreground">Attending physician</p>
          <p class="mt-1 text-sm">{{ props.doctorDisplay }}</p>
        </div>
        <div>
          <p class="text-sm font-medium text-muted-foreground">Patient name</p>
          <p class="mt-1 text-sm font-semibold">
            {{ props.record.patient.fullName }}
          </p>
        </div>
        <div>
          <p class="text-sm font-medium text-muted-foreground">Date of birth</p>
          <p class="mt-1 text-sm">{{ props.patientBirthDate }}</p>
        </div>
        <div>
          <p class="text-sm font-medium text-muted-foreground">Address</p>
          <p class="mt-1 text-sm">{{ props.patientAddress }}</p>
        </div>
        <div>
          <p class="text-sm font-medium text-muted-foreground">Phone number</p>
          <p class="mt-1 text-sm">{{ props.patientPhone }}</p>
        </div>
        <div>
          <p class="text-sm font-medium text-muted-foreground">Visit timeframe</p>
          <p class="mt-1 text-sm">{{ props.examTimeRange }}</p>
        </div>
      </div>
      <div v-else class="py-12 text-center text-sm text-muted-foreground">
        Select a patient to view detailed information.
      </div>
    </CardContent>
  </Card>
</template>
