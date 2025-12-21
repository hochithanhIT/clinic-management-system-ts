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
  getAccountantRevenueReport,
  getDoctorSummary,
  getNurseReceptionReport,
  type AccountantRevenueReport,
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
const accountantLoading = ref(false)
const loading = computed(() => nurseLoading.value || doctorLoading.value || accountantLoading.value)
const errorMessage = ref<string | null>(null)
const nurseReport = ref<NurseReceptionReport | null>(null)
const doctorSummary = ref<DoctorSummary | null>(null)
const accountantReport = ref<AccountantRevenueReport | null>(null)

const hasRequestedNurseReport = ref(false)
const hasRequestedDoctorSummary = ref(false)
const hasRequestedAccountantReport = ref(false)

const resolvedRole = computed(() => resolveRoleKey(authStore.user?.role?.name))
const isNurse = computed(() => resolvedRole.value === 'nurse')

const isDoctor = computed(() => resolvedRole.value === 'doctor')
const isAccountant = computed(() => resolvedRole.value === 'accountant')

const reportDescription = computed(() => {
  if (isAccountant.value) {
    return 'Revenue analytics for billing staff.'
  }

  if (isDoctor.value) {
    return 'Summary of patient examinations for the medical team.'
  }

  if (isNurse.value) {
    return 'Overview of patient intake activity for the nursing department.'
  }

  return 'Role-specific reports overview.'
})

const admissionsByStaff = computed(() => nurseReport.value?.admissionsByStaff ?? [])

const granularityOptions = [
  { value: 'day', label: 'Daily', summary: 'Trend for the last 7 days' },
  { value: 'week', label: 'Weekly', summary: 'Trend for the last 8 weeks' },
  { value: 'month', label: 'Monthly', summary: 'Trend for the last 12 months' },
  { value: 'year', label: 'Yearly', summary: 'Trend for the last 5 years' },
] as const

type Granularity = (typeof granularityOptions)[number]['value']

const selectedGranularity = ref<Granularity>('day')

const revenuePeriodOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const

type RevenuePeriod = (typeof revenuePeriodOptions)[number]['value']

const selectedRevenuePeriod = ref<RevenuePeriod>('daily')

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

const revenueChartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const formatCurrencyValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return currencyFormatter.format(0)
  }

  return currencyFormatter.format(value)
}

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

const accountantTimelineSeries = computed(() => {
  const timeline = accountantReport.value?.timeline ?? []
  return [...timeline]
    .map((point) => ({
      date: new Date(point.date),
      totalRevenue: point.totalRevenue,
      invoiceCount: point.invoiceCount,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
})

type RevenueChartDatum = {
  index: number
  timestamp: number
  label: string
  revenue: number
  invoiceCount: number
  date: Date
}

const revenueDateFormatters = {
  daily: new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' }),
  monthly: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }),
  yearly: new Intl.DateTimeFormat('en-US', { year: 'numeric' }),
} as const

const formatRevenueLabel = (date: Date, period: RevenuePeriod) => {
  return revenueDateFormatters[period].format(date)
}

const revenueChartData = computed<RevenueChartDatum[]>(() =>
  accountantTimelineSeries.value.map((point, index) => ({
    index,
    timestamp: point.date.getTime(),
    label: formatRevenueLabel(point.date, selectedRevenuePeriod.value),
    revenue: point.totalRevenue,
    invoiceCount: point.invoiceCount,
    date: point.date,
  })),
)

const revenueMax = computed(() =>
  revenueChartData.value.reduce((max, item) => Math.max(max, item.revenue), 0),
)

const revenueYTicks = computed(() => {
  const maxValue = revenueMax.value
  if (maxValue <= 0) {
    return [0]
  }

  const maxTickCount = 6
  const rawStep = maxValue / (maxTickCount - 1)
  const exponent = Math.floor(Math.log10(Math.max(rawStep, 1)))
  const fraction = rawStep / 10 ** exponent

  let niceFraction: number
  if (fraction <= 1) {
    niceFraction = 1
  } else if (fraction <= 2) {
    niceFraction = 2
  } else if (fraction <= 5) {
    niceFraction = 5
  } else {
    niceFraction = 10
  }

  const step = Math.max(1, niceFraction * 10 ** exponent)
  const ticks: number[] = []

  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(Math.round(value))
  }

  const lastTick = ticks[ticks.length - 1] ?? 0
  if (lastTick < maxValue) {
    ticks.push(lastTick + step)
  }

  return ticks
})

const revenueChartEmpty = computed(() => revenueChartData.value.length === 0)

const formatRevenueAxisTick = (value: number) => {
  const items = revenueChartData.value
  if (!items.length) {
    return ''
  }

  const index = Math.min(items.length - 1, Math.max(0, Math.round(value)))
  return items[index]?.label ?? ''
}

const formatRevenueYAxisTick = (value: number) => formatCurrencyValue(value)

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

const revenueChartSvgDefs = `
  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="var(--color-revenue)" stop-opacity="0.35" />
    <stop offset="100%" stop-color="var(--color-revenue)" stop-opacity="0" />
  </linearGradient>
`

const revenueCrosshairTemplate = componentToString(revenueChartConfig, ChartTooltipContent, {
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

const accountantTotalRevenue = computed(() => accountantReport.value?.totalRevenue ?? 0)
const accountantTotalInvoices = computed(() => accountantReport.value?.totalInvoices ?? 0)
const accountantBreakdown = computed(() => accountantReport.value?.breakdown ?? [])

const rangeDateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const accountantRangeDisplay = computed(() => {
  const range = accountantReport.value?.range
  if (!range) {
    return ''
  }

  const start = new Date(range.start)
  const end = new Date(range.end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }

  return `${rangeDateFormatter.format(start)} – ${rangeDateFormatter.format(end)}`
})

const activeGranularity = computed(() => {
  const match = granularityOptions.find((option) => option.value === selectedGranularity.value)
  return match ?? granularityOptions[0]!
})

const activeRevenuePeriod = computed(() => {
  const match = revenuePeriodOptions.find((option) => option.value === selectedRevenuePeriod.value)
  return match ?? revenuePeriodOptions[0]!
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

const loadAccountantReport = async (options?: { period?: RevenuePeriod }) => {
  if (accountantLoading.value) {
    return
  }

  accountantLoading.value = true
  errorMessage.value = null

  try {
    const period = options?.period ?? selectedRevenuePeriod.value
    accountantReport.value = await getAccountantRevenueReport({ period })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof ApiError
        ? error.message
        : 'Unable to load the accountant revenue report. Please try again.'
    errorMessage.value = message
    toast.error(message)
  } finally {
    accountantLoading.value = false
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

  if (isAccountant.value) {
    tasks.push(loadAccountantReport({ period: selectedRevenuePeriod.value }))
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

watch(
  isAccountant,
  (value) => {
    if (value && !hasRequestedAccountantReport.value) {
      hasRequestedAccountantReport.value = true
      void loadAccountantReport({ period: selectedRevenuePeriod.value })
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

  if (isAccountant.value && !hasRequestedAccountantReport.value) {
    hasRequestedAccountantReport.value = true
    void loadAccountantReport({ period: selectedRevenuePeriod.value })
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

watch(selectedRevenuePeriod, (period, previous) => {
  if (previous === undefined || period === previous) {
    return
  }

  if (isAccountant.value) {
    hasRequestedAccountantReport.value = true
    void loadAccountantReport({ period })
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
              {{ reportDescription }}
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
            v-if="!isNurse && !isDoctor && !isAccountant"
            class="rounded-lg border border-dashed border-primary/30 p-6 text-center"
          >
            <p class="text-sm text-muted-foreground">
              The report for the current role is not configured. Please switch to another role or
              contact an administrator.
            </p>
          </div>

          <div v-else-if="isAccountant" class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <Card class="border border-primary/10">
                <CardContent class="pt-6">
                  <p class="text-sm text-muted-foreground">Total revenue</p>
                  <p class="mt-2 text-3xl font-semibold">
                    {{ formatCurrencyValue(accountantTotalRevenue) }}
                  </p>
                  <p v-if="accountantRangeDisplay" class="mt-1 text-xs text-muted-foreground">
                    Range: {{ accountantRangeDisplay }}
                  </p>
                </CardContent>
              </Card>
              <Card class="border border-primary/10">
                <CardContent class="pt-6">
                  <p class="text-sm text-muted-foreground">Invoices</p>
                  <p class="mt-2 text-3xl font-semibold">
                    {{ formatInteger(accountantTotalInvoices) }}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader class="gap-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Revenue trend</CardTitle>
                    <p class="text-sm text-muted-foreground">
                      Revenue grouped by {{ activeRevenuePeriod.label.toLowerCase() }} periods.
                    </p>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button
                      v-for="option in revenuePeriodOptions"
                      :key="option.value"
                      type="button"
                      size="sm"
                      class="px-3"
                      :variant="option.value === selectedRevenuePeriod ? 'default' : 'ghost'"
                      :aria-pressed="option.value === selectedRevenuePeriod"
                      @click="selectedRevenuePeriod = option.value"
                    >
                      {{ option.label }}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  v-if="accountantLoading"
                  class="flex h-[320px] items-center justify-center text-sm text-muted-foreground"
                >
                  <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                  Loading data…
                </div>
                <ChartContainer
                  v-else-if="!revenueChartEmpty"
                  class="h-[320px]"
                  :config="revenueChartConfig"
                >
                  <VisXYContainer
                    :data="revenueChartData"
                    :svg-defs="revenueChartSvgDefs"
                    :margin="{ top: 24, right: 16, bottom: 56, left: 72 }"
                  >
                    <VisArea
                      :x="(d: RevenueChartDatum) => d.index"
                      :y="[(d: RevenueChartDatum) => 0, (d: RevenueChartDatum) => d.revenue]"
                      :color="() => 'url(#fillRevenue)'"
                      :opacity="1"
                    />
                    <VisLine
                      :x="(d: RevenueChartDatum) => d.index"
                      :y="[(d: RevenueChartDatum) => d.revenue]"
                      :color="() => 'var(--color-revenue)'"
                      :line-width="2"
                    />
                    <VisAxis
                      type="x"
                      :x="(d: RevenueChartDatum) => d.index"
                      :tick-line="false"
                      :domain-line="false"
                      :grid-line="false"
                      :num-ticks="revenueChartData.length"
                      :tick-format="formatRevenueAxisTick"
                    />
                    <VisAxis
                      type="y"
                      :tick-line="false"
                      :domain-line="false"
                      :grid-line="true"
                      :tick-values="revenueYTicks"
                      :tick-format="formatRevenueYAxisTick"
                    />
                    <ChartTooltip :template="revenueCrosshairTemplate" />
                    <ChartCrosshair
                      v-if="revenueCrosshairTemplate"
                      :template="revenueCrosshairTemplate"
                      :color="() => 'var(--color-revenue)'"
                    />
                  </VisXYContainer>
                </ChartContainer>
                <div
                  v-else
                  class="flex h-[320px] items-center justify-center rounded-md border border-dashed"
                >
                  <p class="text-sm text-muted-foreground">
                    No revenue data for the selected period.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by accountant</CardTitle>
                <p class="text-sm text-muted-foreground">
                  Summary of collected payments per billing staff member.
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-56">Accountant</TableHead>
                      <TableHead class="w-32">Employee Code</TableHead>
                      <TableHead class="w-40 text-right">Revenue</TableHead>
                      <TableHead class="w-32 text-right">Invoices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="accountantLoading">
                      <TableCell colspan="4">
                        <div
                          class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                        >
                          <Loader2 class="h-4 w-4 animate-spin" />
                          Loading data…
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow v-else-if="accountantBreakdown.length === 0">
                      <TableCell colspan="4" class="text-center text-sm text-muted-foreground">
                        No revenue recorded for the selected period.
                      </TableCell>
                    </TableRow>
                    <TableRow v-for="item in accountantBreakdown" :key="item.employeeId">
                      <TableCell class="font-medium">
                        {{ item.employeeName }}
                      </TableCell>
                      <TableCell>{{ item.employeeCode }}</TableCell>
                      <TableCell class="text-right">
                        {{ formatCurrencyValue(item.totalRevenue) }}
                      </TableCell>
                      <TableCell class="text-right">
                        {{ formatInteger(item.invoiceCount) }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
