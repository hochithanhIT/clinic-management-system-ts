<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
    loadingMore?: boolean
    hasMore?: boolean
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
    loadingMore: false,
    hasMore: false,
    align: 'start',
    allowClear: false,
    listMaxHeight: '12rem',
    listMaxWidth: '20rem',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: OptionValue | null): void
  (event: 'search', value: string): void
  (event: 'loadMore'): void
  (event: 'open-change', value: boolean): void
}>()

const open = ref(false)
const searchTerm = ref('')
const listRef = ref<HTMLElement | null>(null)
const loadMoreTriggered = ref(false)

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

const handleSearchInput = (value: string) => {
  searchTerm.value = value
  emit('search', value)
  loadMoreTriggered.value = false
}

const handleLoadMoreClick = () => {
  if (props.loadingMore) {
    return
  }
  emit('loadMore')
}

const handleScroll = () => {
  if (!props.hasMore || props.loadingMore || !listRef.value) {
    return
  }

  const { scrollTop, clientHeight, scrollHeight } = listRef.value
  const isNearBottom = scrollTop + clientHeight >= scrollHeight - 24

  if (isNearBottom && !loadMoreTriggered.value) {
    loadMoreTriggered.value = true
    emit('loadMore')
  }
}

watch(open, (value) => {
  emit('open-change', value)
  if (!value) {
    searchTerm.value = ''
    loadMoreTriggered.value = false
  }
})

watch(
  () => props.loadingMore,
  (loading) => {
    if (!loading) {
      loadMoreTriggered.value = false
    }
  },
)
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
        <CommandInput
          :placeholder="props.searchPlaceholder"
          @update:modelValue="handleSearchInput"
        />
        <CommandList
          ref="listRef"
          class="overflow-y-auto"
          :style="{ maxHeight: props.listMaxHeight }"
          @scroll.passive="handleScroll"
        >
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
        <div
          v-if="props.hasMore"
          class="border-t bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground"
        >
          <span v-if="props.loadingMore">Loading more…</span>
          <button
            v-else
            type="button"
            class="text-primary hover:underline"
            @click.stop="handleLoadMoreClick"
          >
            Load more
          </button>
        </div>
      </Command>
    </PopoverContent>
  </Popover>
</template>
