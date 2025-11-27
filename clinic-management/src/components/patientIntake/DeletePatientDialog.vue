<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

defineProps<{
  open: boolean
  patientDisplay: string
  isDeleting: boolean
  canConfirm: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete patient?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete
          <span v-if="patientDisplay" class="font-medium">"{{ patientDisplay }}"</span>
          <span v-else class="font-medium">this patient</span>
          ? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isDeleting" class="hover:text-primary-foreground">
          Cancel
        </AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="isDeleting || !canConfirm"
          @click="emit('confirm')"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete patient' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
