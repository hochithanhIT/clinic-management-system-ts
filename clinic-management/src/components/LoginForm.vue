<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import type { LoginPayload } from '@/services/auth'
import { AlertCircle } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const props = defineProps<{
  class?: HTMLAttributes['class']
  form: LoginPayload
  fieldErrors: Record<keyof LoginPayload, string | null>
  generalError: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'update:form', field: keyof LoginPayload, value: string): void
  (e: 'clearFieldError', field: keyof LoginPayload): void
}>()

const handleFocus = (field: keyof LoginPayload) => {
  emit('clearFieldError', field)
}

const handleModelUpdate = (field: keyof LoginPayload, value: string | number) => {
  emit('update:form', field, typeof value === 'string' ? value : String(value))
  emit('clearFieldError', field)
}

const fieldErrorMessages = computed(() =>
  Object.values(props.fieldErrors).filter((message): message is string => Boolean(message)),
)

const handleSubmit = (event: Event) => {
  event.preventDefault()
  emit('submit')
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card class="overflow-hidden p-0">
      <CardContent class="grid min-h-[500px] p-0 md:grid-cols-[1.2fr_1fr]">
        <form
          class="flex flex-col gap-6 p-8 md:p-10 justify-center items-center"
          @submit="handleSubmit"
        >
          <FieldGroup class="gap-6">
            <div class="flex flex-col items-center gap-2 text-center">
              <h1 class="text-4xl font-bold">CTU CLINIC</h1>
              <p class="text-muted-foreground text-balance">Login to your CTU Clinic account</p>
            </div>

            <Alert
              v-if="props.generalError || fieldErrorMessages.length"
              variant="destructive"
              class="w-full"
            >
              <AlertCircle class="h-5 w-5" aria-hidden="true" />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription class="space-y-2">
                <p v-if="props.generalError">{{ props.generalError }}</p>
                <ul v-if="fieldErrorMessages.length" class="list-disc space-y-1 pl-5">
                  <li v-for="message in fieldErrorMessages" :key="message">
                    {{ message }}
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            <Field :data-invalid="Boolean(props.fieldErrors.tenDangNhap)">
              <FieldLabel for="username"> Username </FieldLabel>
              <Input
                id="username"
                type="text"
                autocomplete="username"
                placeholder="Enter your username"
                :disabled="props.loading"
                :model-value="props.form.tenDangNhap"
                @focus="handleFocus('tenDangNhap')"
                @update:modelValue="handleModelUpdate('tenDangNhap', $event)"
              />
            </Field>

            <Field :data-invalid="Boolean(props.fieldErrors.matKhau)">
              <FieldLabel for="password"> Password </FieldLabel>
              <Input
                id="password"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                :disabled="props.loading"
                :model-value="props.form.matKhau"
                @focus="handleFocus('matKhau')"
                @update:modelValue="handleModelUpdate('matKhau', $event)"
              />
            </Field>

            <Field>
              <Button type="submit" class="w-full" :disabled="props.loading">
                <span
                  v-if="props.loading"
                  aria-hidden="true"
                  class="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                <span>{{ props.loading ? 'Signing in...' : 'Sign in' }}</span>
              </Button>
            </Field>
          </FieldGroup>
        </form>
        <div class="bg-muted relative hidden md:block">
          <img
            src="../assets/images/CTU_logo_singlecolor.png"
            alt="Image"
            class="absolute inset-0 h-full w-full object-contain dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
