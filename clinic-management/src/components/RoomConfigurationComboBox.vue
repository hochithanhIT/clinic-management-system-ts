<script setup lang="ts">
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type OptionValue = string | number

interface ComboOption {
  value: OptionValue
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: OptionValue | null
    options?: ComboOption[]
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    disabled?: boolean
    loading?: boolean
    align?: 'start' | 'center' | 'end'
    allowClear?: boolean
    id?: string
    listMaxHeight?: string
    listMaxWidth?: string
  }>(),
  {
    options: () => [],
    placeholder: 'Select option...',
    searchPlaceholder: 'Search...',
    emptyMessage: 'No results found.',
    disabled: false,
    loading: false,
    align: 'start',
    allowClear: false,
    listMaxHeight: '12rem',
    listMaxWidth: '20rem',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: OptionValue | null): void
}>()

const open = ref(false)

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? null,
)

const emptyLabel = computed(() => (props.loading ? 'Loading...' : props.emptyMessage))

const displayLabel = computed(() => selectedOption.value?.label ?? props.placeholder)

const handleSelect = (optionValue: OptionValue) => {
  const nextValue = props.allowClear && props.modelValue === optionValue ? null : optionValue
  emit('update:modelValue', nextValue)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="props.id"
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :disabled="props.disabled || props.loading"
        class="w-full justify-between hover:text-primary-foreground"
      >
        <span class="truncate text-left">
          {{ displayLabel }}
        </span>
        <ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :align="props.align"
      class="p-0"
      :style="{
        width: 'var(--radix-popover-trigger-width)',
        maxWidth: props.listMaxWidth,
      }"
    >
      <Command>
        <CommandInput :placeholder="props.searchPlaceholder" />
        <CommandList class="overflow-y-auto" :style="{ maxHeight: props.listMaxHeight }">
          <CommandEmpty>{{ emptyLabel }}</CommandEmpty>
          <CommandGroup v-if="props.options.length">
            <CommandItem
              v-for="option in props.options"
              :key="option.value"
              :value="String(option.value)"
              @select="() => handleSelect(option.value)"
            >
              <CheckIcon
                :class="
                  cn(
                    'mr-2 h-4 w-4',
                    props.modelValue === option.value ? 'opacity-100' : 'opacity-0',
                  )
                "
              />
              {{ option.label }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
