<script setup lang="ts">
import { ref, watchEffect } from "vue";

const props = defineProps<{
  node: SVGSVGElement;
  width: number;
  height: number;
}>();

const container = ref<HTMLElement | null>(null);
watchEffect(() => {
  if (container.value) {
    container.value.innerHTML = "";
    container.value.appendChild(props.node);
  }
});
watchEffect(() => {
  props.node.setAttribute("viewBox", `0 0 ${props.width} ${props.height}`);
  props.node.setAttribute("width", "100%");
});
</script>
<template>
  <div ref="container"></div>
</template>
