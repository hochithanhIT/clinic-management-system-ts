<script setup lang="ts">
definePage({
  alias: '/reports/',
  meta: {
    requiresAuth: true,
  },
})

import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, RefreshCw } from 'lucide-vue-next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/services/http'
import {
  getDoctorSummary,
  getNurseReceptionReport,
  type DoctorSummary,
  type NurseReceptionReport,
} from '@/services/report'
import { useAuthStore } from '@/stores/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VisArea, VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { resolveRoleKey } from '@/lib/roles'

const authStore = useAuthStore()

const nurseLoading = ref(false)
const doctorLoading = ref(false)
const loading = computed(() => nurseLoading.value || doctorLoading.value)
const errorMessage = ref<string | null>(null)
const nurseReport = ref<NurseReceptionReport | null>(null)
const doctorSummary = ref<DoctorSummary | null>(null)

const hasRequestedNurseReport = ref(false)
const hasRequestedDoctorSummary = ref(false)

const resolvedRole = computed(() => resolveRoleKey(authStore.user?.role?.name))
const isNurse = computed(() => resolvedRole.value === 'nurse')

const isDoctor = computed(() => resolvedRole.value === 'doctor')

const admissionsByStaff = computed(() => nurseReport.value?.admissionsByStaff ?? [])

const granularityOptions = [
  { value: 'day', label: 'Daily', summary: 'Trend for the last 7 days' },
  { value: 'week', label: 'Weekly', summary: 'Trend for the last 8 weeks' },
  { value: 'month', label: 'Monthly', summary: 'Trend for the last 12 months' },
  { value: 'year', label: 'Yearly', summary: 'Trend for the last 5 years' },
] as const

type Granularity = (typeof granularityOptions)[number]['value']

const selectedGranularity = ref<Granularity>('day')

const detailRangeOptions = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
] as const

type DetailRange = (typeof detailRangeOptions)[number]['value']

const selectedDetailRange = ref<DetailRange>('day')
const selectedDoctorRange = ref<DetailRange>('day')

const chartConfig = {
  admissions: {
    label: 'Patients',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig

const timelineSeries = computed(() => {
  const timeline = nurseReport.value?.timeline[selectedGranularity.value] ?? []
  return [...timeline]
    .map((point) => ({
      date: new Date(point.date),
      total: point.totalAdmissions,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
})

type TimelineChartDatum = {
  index: number
  timestamp: number
  label: string
  admissions: number
  date: Date
}

const dateFormatters = {
  day: new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' }),
  week: new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }),
  month: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }),
  year: new Intl.DateTimeFormat('en-US', { year: 'numeric' }),
} as const

const formatTimelineLabel = (date: Date, unit: Granularity) => {
  if (unit === 'week') {
    return `Week of ${dateFormatters.week.format(date)}`
  }
  return dateFormatters[unit].format(date)
}

const chartData = computed<TimelineChartDatum[]>(() =>
  timelineSeries.value.map((point, index) => ({
    index,
    timestamp: point.date.getTime(),
    label: formatTimelineLabel(point.date, selectedGranularity.value),
    admissions: point.total,
    date: point.date,
  })),
)

const totalAdmissions = computed(() => nurseReport.value?.totalAdmissions ?? 0)
const primaryMetricLabel = computed(() =>
  isDoctor.value ? 'Patients examined' : 'Total patients admitted',
)
const primaryMetricValue = computed(() =>
  isDoctor.value ? doctorPatients.value : totalAdmissions.value,
)

const maxAdmissions = computed(() =>
  chartData.value.reduce((max, item) => Math.max(max, item.admissions), 0),
)

const yTicks = computed(() => {
  const maxValue = Math.max(0, Math.ceil(maxAdmissions.value))
  const maxTickCount = 6

  if (maxValue <= 0) {
    return [0, 1]
  }

  const step = Math.max(1, Math.ceil(maxValue / (maxTickCount - 1)))
  const tickCount = Math.max(2, Math.floor(maxValue / step) + 1)
  const ticks = Array.from({ length: tickCount }, (_, index) => index * step)

  const lastTick = ticks[ticks.length - 1] ?? 0
  if (lastTick < maxValue) {
    ticks.push(lastTick + step)
  }

  return ticks
})

const chartSvgDefs = `
  <linearGradient id="fillAdmissions" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="var(--color-admissions)" stop-opacity="0.35" />
    <stop offset="100%" stop-color="var(--color-admissions)" stop-opacity="0" />
  </linearGradient>
`

const crosshairTemplate = componentToString(chartConfig, ChartTooltipContent, {
  labelKey: 'label',
})

const chartEmpty = computed(() => chartData.value.length === 0)

const formatAxisTick = (value: number) => {
  const items = chartData.value
  if (!items.length) {
    return ''
  }
  const index = Math.min(items.length - 1, Math.max(0, Math.round(value)))
  return items[index]?.label ?? ''
}

const formatYAxisTick = (value: number) => formatInteger(value)

const activeGranularity = computed(() => {
  const match = granularityOptions.find((option) => option.value === selectedGranularity.value)
  return match ?? granularityOptions[0]!
})

const loadNurseReport = async (options?: { detailRange?: DetailRange }) => {
  if (nurseLoading.value) {
    return
  }

  nurseLoading.value = true
  errorMessage.value = null

  try {
    const range = options?.detailRange ?? selectedDetailRange.value
    nurseReport.value = await getNurseReceptionReport({ detailRange: range })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load the nurse report. Please try again.'
    errorMessage.value = message
    toast.error(message)
  } finally {
    nurseLoading.value = false
  }
}

const doctorPatients = computed(() => doctorSummary.value?.totalPatients ?? 0)
const doctorPatientsList = computed(() => doctorSummary.value?.patients ?? [])

const loadDoctorSummary = async (options?: { range?: DetailRange }) => {
  if (doctorLoading.value) {
    return
  }

  doctorLoading.value = true
  errorMessage.value = null

  try {
    const range = options?.range ?? selectedDoctorRange.value
    doctorSummary.value = await getDoctorSummary({ range })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load the doctor summary. Please try again.'
    errorMessage.value = message
    toast.error(message)
  } finally {
    doctorLoading.value = false
  }
}

const reloadReports = async () => {
  const tasks: Array<Promise<void>> = []

  if (isNurse.value) {
    tasks.push(loadNurseReport({ detailRange: selectedDetailRange.value }))
  }

  if (isDoctor.value) {
    tasks.push(loadDoctorSummary({ range: selectedDoctorRange.value }))
  }

  await Promise.all(tasks)
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

watch(
  isNurse,
  (value) => {
    if (value && !hasRequestedNurseReport.value) {
      hasRequestedNurseReport.value = true
      void loadNurseReport({ detailRange: selectedDetailRange.value })
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (isNurse.value && !hasRequestedNurseReport.value) {
    hasRequestedNurseReport.value = true
    void loadNurseReport({ detailRange: selectedDetailRange.value })
  }

  if (isDoctor.value && !hasRequestedDoctorSummary.value) {
    hasRequestedDoctorSummary.value = true
    void loadDoctorSummary({ range: selectedDoctorRange.value })
  }
})

watch(selectedDetailRange, (range, previous) => {
  if (previous === undefined || range === previous) {
    return
  }

  if (isNurse.value) {
    hasRequestedNurseReport.value = true
    void loadNurseReport({ detailRange: range })
  }
})

watch(
  isDoctor,
  (value) => {
    if (value && !hasRequestedDoctorSummary.value) {
      hasRequestedDoctorSummary.value = true
      void loadDoctorSummary({ range: selectedDoctorRange.value })
    }
  },
  { immediate: true },
)

watch(selectedDoctorRange, (range, previous) => {
  if (previous === undefined || range === previous) {
    return
  }

  if (isDoctor.value) {
    hasRequestedDoctorSummary.value = true
    void loadDoctorSummary({ range })
  }
})

const formatInteger = (value: number) => value.toLocaleString('en-US')
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="mx-auto max-w-6xl px-4">
      <Card>
        <CardHeader class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Report</CardTitle>
            <p class="mt-1 text-sm text-muted-foreground">
              Overview of patient intake activity for the nursing department.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
            <Button type="button" variant="outline" :disabled="loading" @click="reloadReports">
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              <RefreshCw v-else class="mr-2 h-4 w-4" />
              Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            v-if="!isNurse && !isDoctor"
            class="rounded-lg border border-dashed border-primary/30 p-6 text-center"
          >
            <p class="text-sm text-muted-foreground">
              The report for the current role is not configured. Please switch to another role or
              contact an administrator.
            </p>
          </div>

          <div v-else>
            <Tabs default-value="stats" class="mt-4">
              <TabsList class="w-full justify-start">
                <TabsTrigger value="stats">Statistics</TabsTrigger>
                <TabsTrigger v-if="isNurse" value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="stats" class="mt-6 space-y-6">
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card class="border border-primary/10">
                    <CardContent class="pt-6">
                      <p class="text-sm text-muted-foreground">{{ primaryMetricLabel }}</p>
                      <p class="mt-2 text-3xl font-semibold">
                        {{ formatInteger(primaryMetricValue) }}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card v-if="isNurse">
                  <CardHeader class="gap-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>Patient intake trend</CardTitle>
                        <p class="text-sm text-muted-foreground">
                          {{ activeGranularity.summary }}
                        </p>
                      </div>
                      <div class="flex items-center gap-1">
                        <Button
                          v-for="option in granularityOptions"
                          :key="option.value"
                          type="button"
                          size="sm"
                          class="px-3"
                          :variant="option.value === selectedGranularity ? 'default' : 'ghost'"
                          :aria-pressed="option.value === selectedGranularity"
                          @click="selectedGranularity = option.value"
                        >
                          {{ option.label }}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      v-if="loading"
                      class="flex h-[280px] items-center justify-center text-sm text-muted-foreground"
                    >
                      <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                      Loading data…
                    </div>
                    <div
                      v-else-if="chartEmpty"
                      class="flex h-[280px] items-center justify-center text-sm text-muted-foreground"
                    >
                      No intake data for the selected period.
                    </div>
                    <ChartContainer v-else :config="chartConfig" class="h-80 w-full">
                      <VisXYContainer
                        :data="chartData"
                        :svg-defs="chartSvgDefs"
                        :margin="{ top: 24, right: 16, bottom: 56, left: 56 }"
                      >
                        <VisArea
                          :x="(d: TimelineChartDatum) => d.index"
                          :y="[
                            (d: TimelineChartDatum) => 0,
                            (d: TimelineChartDatum) => d.admissions,
                          ]"
                          :color="() => 'url(#fillAdmissions)'"
                          :opacity="1"
                        />
                        <VisLine
                          :x="(d: TimelineChartDatum) => d.index"
                          :y="[(d: TimelineChartDatum) => d.admissions]"
                          :color="() => 'var(--color-admissions)'"
                          :line-width="2"
                        />
                        <VisAxis
                          type="x"
                          :x="(d: TimelineChartDatum) => d.index"
                          :tick-line="false"
                          :domain-line="false"
                          :grid-line="false"
                          :num-ticks="chartData.length"
                          :tick-format="formatAxisTick"
                        />
                        <VisAxis
                          type="y"
                          :tick-line="false"
                          :domain-line="false"
                          :grid-line="true"
                          :tick-values="yTicks"
                          :tick-format="formatYAxisTick"
                        />
                        <ChartTooltip />
                        <ChartCrosshair
                          v-if="crosshairTemplate"
                          :template="crosshairTemplate"
                          :color="() => 'var(--color-admissions)'"
                        />
                      </VisXYContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
                <Card v-else-if="isDoctor">
                  <CardHeader class="gap-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle>Examined patients</CardTitle>
                      <div class="flex items-center gap-1">
                        <Button
                          v-for="option in detailRangeOptions"
                          :key="option.value"
                          type="button"
                          size="sm"
                          class="px-3"
                          :variant="option.value === selectedDoctorRange ? 'default' : 'ghost'"
                          :aria-pressed="option.value === selectedDoctorRange"
                          :disabled="doctorLoading"
                          @click="selectedDoctorRange = option.value"
                        >
                          {{ option.label }}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div class="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="w-36">Patient code</TableHead>
                            <TableHead>Patient name</TableHead>
                            <TableHead class="w-48">Examined at</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow v-if="doctorLoading">
                            <TableCell colspan="3">
                              <div
                                class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                              >
                                <Loader2 class="h-4 w-4 animate-spin" />
                                Loading data…
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow v-else-if="doctorPatientsList.length === 0">
                            <TableCell colspan="3">
                              <div class="py-6 text-center text-sm text-muted-foreground">
                                No examination records available.
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow
                            v-else
                            v-for="patient in doctorPatientsList"
                            :key="patient.visitId"
                          >
                            <TableCell class="font-mono text-sm">{{
                              patient.patientCode
                            }}</TableCell>
                            <TableCell>{{ patient.patientName }}</TableCell>
                            <TableCell>{{ formatDateTime(patient.examinedAt) }}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent v-if="isNurse" value="details" class="mt-6">
                <Card>
                  <CardHeader class="gap-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle>Nurse roster</CardTitle>
                      <div class="flex items-center gap-1">
                        <Button
                          v-for="option in detailRangeOptions"
                          :key="option.value"
                          type="button"
                          size="sm"
                          class="px-3"
                          :variant="option.value === selectedDetailRange ? 'default' : 'ghost'"
                          :aria-pressed="option.value === selectedDetailRange"
                          :disabled="loading"
                          @click="selectedDetailRange = option.value"
                        >
                          {{ option.label }}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div class="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="w-36">Staff code</TableHead>
                            <TableHead>Nurse name</TableHead>
                            <TableHead class="w-36 text-right">Patients</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow v-if="loading">
                            <TableCell colspan="3">
                              <div
                                class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                              >
                                <Loader2 class="h-4 w-4 animate-spin" />
                                Loading data…
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow v-else-if="admissionsByStaff.length === 0">
                            <TableCell colspan="3">
                              <div class="py-6 text-center text-sm text-muted-foreground">
                                No intake data available.
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow v-else v-for="staff in admissionsByStaff" :key="staff.staffId">
                            <TableCell class="font-mono text-sm">{{ staff.staffCode }}</TableCell>
                            <TableCell>{{ staff.staffName }}</TableCell>
                            <TableCell class="text-right font-semibold">
                              {{ formatInteger(staff.totalAdmissions) }}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
