<script setup lang="ts">
import AppMain from "./AppMain.vue";
import { shallowRef } from "vue";
import TopBar from "./components/TopBar.vue";
import { loadMapData, type MapData } from "./backend";
import { Backend } from "./backend-duckdb";

const mapData = shallowRef<MapData | null>(null);
loadMapData().then((data) => {
  mapData.value = data;
});
const backend = shallowRef<Backend | null>(null);
Backend.create().then((v) => {
  backend.value = v;
});
</script>

<template>
  <TopBar />
  <AppMain
    v-if="mapData !== null && backend !== null"
    :mapData="mapData"
    :backend="backend"
  />
  <div v-else>Loading...</div>
</template>
