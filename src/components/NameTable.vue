<script setup lang="ts">
import type { RareName } from "@/backend-duckdb";
import { NTable, NButton } from "naive-ui";
import { computed } from "vue";

const props = defineProps<{
  selectedName: string | null;
  years: readonly [number, number];
  districtName: string;
  rarestNames: RareName[];
}>();

const topRarestNames = computed(() => {
  return props.rarestNames.slice(0, 8);
});

const emits = defineEmits<{
  "update:selectedName": [name: string];
}>();
</script>
<template>
  <NTable size="small">
    <thead>
      <tr>
        <th rowspan="2">Name</th>
        <th colspan="2">
          Häufigkeit {{ props.years[0] }} - {{ props.years[1] }}
        </th>
        <th rowspan="2"># Bezirke</th>
      </tr>
      <tr>
        <th>{{ props.districtName }}</th>
        <th>Österreich</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(entry, index) in topRarestNames ?? []" :key="index">
        <td>
          <n-button
            @click="emits('update:selectedName', entry.Name)"
            :disabled="entry.Name === props.selectedName"
            size="small"
          >
            {{ entry.Name }}
          </n-button>
        </td>
        <td>{{ entry.Count }}</td>
        <td>{{ entry.Count_total }}</td>
        <td>{{ entry.DistrictCount }}</td>
      </tr>
      <tr class="shadow-bottom">
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </tbody>
  </NTable>
</template>
<style scoped>
tr.shadow-bottom td {
  box-shadow: rgba(0, 0, 0, 0.75) 0px -14px 14px -14px inset;
}
</style>
