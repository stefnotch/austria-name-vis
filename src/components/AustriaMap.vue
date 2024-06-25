<script setup lang="ts">
import RenderD3 from "./RenderD3.vue";
import ChartTooltip from "./ChartTooltip.vue";
import type { IsoCode, MapData } from "@/backend";
import * as d3 from "d3";
import { ref, watchEffect } from "vue";
import type { NameDistributionInDistricts } from "@/backend-duckdb";

const props = defineProps<{
  mapData: MapData;
  width: number;
  height: number;
  district: IsoCode | null;
  name: string | null;
  nameDistribution: NameDistributionInDistricts | null;
  districtNames: Map<IsoCode, string>;
}>();

const emit = defineEmits<{
  "update:district": [district: IsoCode | null];
}>();

const svg = d3.create("svg");

const tooltipInfo = ref<{
  x: number;
  y: number;
  value: string;
} | null>(null);

// Render map
watchEffect(() => {
  // clear the svg
  svg.selectAll("*").remove();

  const projection = d3
    .geoEquirectangular()
    .fitSize([props.width, props.height], props.mapData);
  const path = d3.geoPath().projection(projection);

  svg
    .selectAll("path")
    .data(props.mapData.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke-width", getDistrictStrokeWidth)
    .attr("fill", (d) => "steelblue")
    .attr("stroke", "#000")
    .attr("data-name", (d) => d.properties.name)
    .attr("data-iso", (d) => d.properties.iso)
    .on("mouseover", function (event, d) {
      if (d.properties.iso !== props.district) {
        d3.select(this).attr("stroke-width", 1.5);
      }
      if (props.nameDistribution === null) {
        return;
      }
      const districtName =
        props.districtNames.get(d.properties.iso) ?? "Österreich";
      const nameCount =
        props.nameDistribution.district_counts[d.properties.iso] || 0;
      const name = props.name ?? "-";

      tooltipInfo.value = {
        x: event.pageX,
        y: event.pageY,
        value: `${nameCount}x ${name} in ${districtName}`,
      };
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("stroke-width", getDistrictStrokeWidth(d));
      tooltipInfo.value = null;
    })
    .on("click", function (event, d) {
      event.stopPropagation();
      emit("update:district", d.properties.iso as IsoCode);
    });

  svg.on("click", () => {
    emit("update:district", null);
  });
  updateNameDistribution();
});

function getDistrictStrokeWidth(d: any) {
  return d.properties.iso === props.district ? 2 : 0.5;
}

// Select current district
watchEffect(() => {
  svg.selectAll("path").attr("stroke-width", getDistrictStrokeWidth);
});

// Highlight according to name frequency
watchEffect(() => {
  updateNameDistribution();
});

function updateNameDistribution() {
  const data = props.nameDistribution;
  if (data === null) {
    svg.selectAll("path").attr("fill", "steelblue");
  } else {
    const maxCount = data.max_count;
    svg.selectAll("path").attr("fill", (d: any) => {
      let intensity = (data.district_counts[d.properties.iso] ?? 0) / maxCount;
      return d3.interpolateBlues(0.8 * intensity);
    });
  }
}
</script>
<template>
  <RenderD3 :node="svg.node()!" :width="width" :height="height" />
  <ChartTooltip
    v-if="tooltipInfo !== null"
    :x="tooltipInfo.x"
    :y="tooltipInfo.y"
    >{{ tooltipInfo.value }}</ChartTooltip
  >
</template>
