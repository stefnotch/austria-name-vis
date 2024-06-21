<script setup lang="ts">
const props = defineProps<{
  x: number;
  y: number;
}>();
</script>

<template>
  <div
    class="absolute top-0 left-0 border border-gray-800 bg-white p-1 rounded-md shadow-md"
    :style="{
      userSelect: 'none',
      left: props.x + 5 + 'px',
      top: props.y + 5 + 'px',
    }"
  >
    <slot></slot>
  </div>
</template>
