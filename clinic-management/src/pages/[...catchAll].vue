<script setup lang="ts">
definePage({
  alias: '/PageNotFound/',
  meta: {
    requiresAuth: false,
    hideNavbar: true,
  },
})
</script>

<template>
  <section class="flex min-h-svh flex-col bg-primary">
    <div class="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center text-primary-foreground">
      <p class="text-sm uppercase tracking-[0.3em] text-primary-foreground/80">Error 404</p>
      <h1 class="mt-4 text-4xl font-bold sm:text-6xl">Oops! Page not found</h1>
      <p class="mt-4 max-w-xl text-base text-primary-foreground/80">
        The page you are looking for may have been moved, deleted, or never existed. Please check the URL or return to the dashboard.
      </p>

      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <router-link
          to="/"
          class="inline-flex items-center justify-center rounded-md bg-primary-foreground px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary-foreground/90"
        >
          Go to dashboard
        </router-link>
      </div>
    </div>

    <div class="relative h-40 w-full bg-primary-foreground/10">
      <div class="absolute inset-0 mx-auto flex max-w-5xl items-center justify-between px-6">
        <span class="h-24 w-24 rounded-full border border-primary-foreground/40" />
        <span class="h-12 w-12 rounded-full border border-primary-foreground/20" />
        <span class="h-32 w-32 rounded-full border border-primary-foreground/30" />
      </div>
    </div>
  </section>
</template>
