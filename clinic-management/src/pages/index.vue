<script setup lang="ts">
definePage({
  alias: ['/'],
  meta: {
    requiresAuth: true,
  }
})

</script>

<template>
  <div>
    <h1>Home View</h1>
    <RouterLink :to="{ name: '/login/' }">Go to login</RouterLink>
  </div>
</template>

