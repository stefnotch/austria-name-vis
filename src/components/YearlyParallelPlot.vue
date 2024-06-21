<script setup lang="ts">
import { NH3 } from "naive-ui";
import RenderD3 from "./RenderD3.vue";
import { type YearlyNameDistribution } from "@/backend";
import * as d3 from "d3";
import { watchEffect } from "vue";

const props = defineProps<{
  width: number;
  height: number;
  yearlyDistributions: YearlyNameDistribution[];
  years: readonly [number, number];
  districtName: string;
}>();

const svgElement = d3.create("svg");

type YearCount = {
  year: number;
  count: number;
};

watchEffect(() => {
  svgElement.selectAll("*").remove();
  // Extract the yearly counts and convert to an array of objects with 'year' and 'count'
  const yearlyCounts: YearCount[][] = props.yearlyDistributions.map((v) =>
    Object.entries(v.yearly_counts).map(([year, count]) => ({
      year: +year,
      count: +count,
    }))
  );
  const maxCount = Math.max(
    ...yearlyCounts.map((yearlyCounts) =>
      Math.max(...yearlyCounts.map((d) => d.count))
    )
  );

  // Set the dimensions and margins of the graph
  const margin = { top: 40, right: 30, bottom: 50, left: 60 },
    width = props.width - margin.left - margin.right,
    height = props.height - margin.top - margin.bottom;

  // Append the svg object to the body of the page
  const svg = svgElement
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis
  const x = d3.scaleLinear().domain(props.years).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  // Add Y axis
  const y = d3.scaleLinear().domain([0, maxCount]).range([height, 0]);
  svg.append("g").call(d3.axisLeft(y));

  // Add the lines
  for (const yearlyCount of yearlyCounts) {
    svg
      .append("path")
      .datum(yearlyCount)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1)
      .attr(
        "d",
        d3.line<YearCount>(
          (d) => x(d.year),
          (d) => y(d.count)
        )
      );
  }
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
</script>
<template>
  <n-h3>
    Häufigkeit von seltenen Namen von {{ props.years[0] }} bis
    {{ props.years[1] }} in {{ districtName }}
  </n-h3>
  <RenderD3 :node="svgElement.node()!" :width="width" :height="height" />
</template>
