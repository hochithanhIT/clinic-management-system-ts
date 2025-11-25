<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { LoginPayload } from '@/services/auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

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

const handleSubmit = (event: Event) => {
  event.preventDefault()
  emit('submit')
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card class="overflow-hidden p-0">
      <CardContent class="grid p-0 md:grid-cols-2">
        <form class="flex flex-col gap-6 p-6 md:p-8" @submit="handleSubmit">
          <FieldGroup class="gap-6">
            <div class="flex flex-col items-center gap-2 text-center">
              <h1 class="text-2xl font-bold">CTU CLINIC</h1>
              <p class="text-muted-foreground text-balance">Login to your CTU Clinic account</p>
            </div>

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
              <FieldError :errors="[props.fieldErrors.tenDangNhap ?? undefined]" />
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
              <FieldError :errors="[props.fieldErrors.matKhau ?? undefined]" />
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
