<script setup lang="ts">
import AppMain from "./AppMain.vue";
import { ref } from "vue";
import TopBar from "./components/TopBar.vue";
import { loadMapData, type MapData } from "./backend";

const mapData = ref<MapData | null>(null);
loadMapData().then((data) => {
  mapData.value = data;
});
</script>

<template>
  <TopBar />
  <AppMain v-if="mapData !== null" :mapData="mapData" />
  <div v-else>Loading...</div>
</template>
