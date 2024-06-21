<script setup lang="ts">
import { NH3 } from "naive-ui";
import ChartTooltip from "./ChartTooltip.vue";
import RenderD3 from "./RenderD3.vue";
import { YEAR_RANGE, type YearlyNameDistribution } from "@/backend";
import * as d3 from "d3";
import { ref, watchEffect } from "vue";

const props = defineProps<{
  width: number;
  height: number;
  yearlyDistribution: YearlyNameDistribution;
  years: readonly [number, number];
}>();

const svgElement = d3.create("svg");

const tooltipInfo = ref<{
  x: number;
  y: number;
  year: number;
  count: number;
} | null>(null);

function extent<T>(
  arr: T[],
  key: (d: T) => number,
  defaultValue: readonly [number, number]
): [number, number] {
  const result = d3.extent(arr, key);
  return [result[0] ?? defaultValue[0], result[1] ?? defaultValue[1]];
}

type YearCount = {
  year: number;
  count: number;
};

watchEffect(() => {
  svgElement.selectAll("*").remove();
  // Extract the yearly counts and convert to an array of objects with 'year' and 'count'
  const yearlyCounts: YearCount[] = Object.entries(
    props.yearlyDistribution.yearly_counts
  ).map(([year, count]) => ({
    year: +year,
    count: +count,
  }));

  // Set the dimensions and margins of the graph
  const margin = { top: 40, right: 30, bottom: 50, left: 60 },
    width = props.width - margin.left - margin.right,
    height = props.height - margin.top - margin.bottom;

  // Append the svg object to the body of the page
  const svg = svgElement
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis
  const x = d3
    .scaleLinear()
    .domain(extent(yearlyCounts, (d) => d.year, YEAR_RANGE))
    .range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  // Add Y axis
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(yearlyCounts, (d) => d.count) ?? 1])
    .range([height, 0]);
  svg.append("g").call(d3.axisLeft(y));

  // Add the line
  svg
    .append("path")
    .datum(yearlyCounts)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr(
      "d",
      d3.line<YearCount>(
        (d) => x(d.year),
        (d) => y(d.count)
      )
    );

  svg
    .selectAll("dot")
    .data(yearlyCounts)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.count))
    .attr("r", 5)
    .attr("fill", "steelblue")
    .on("mouseover", function (event, d) {
      tooltipInfo.value = {
        x: event.pageX,
        y: event.pageY,
        year: d.year,
        count: d.count,
      };
    })
    .on("mouseout", function (event, d) {
      tooltipInfo.value = null;
    });
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
</script>
<template>
  <RenderD3 :node="svgElement.node()!" :width="width" :height="height" />
  <ChartTooltip
    v-if="tooltipInfo !== null"
    :x="tooltipInfo.x"
    :y="tooltipInfo.y"
  >
    Jahr: {{ tooltipInfo.year }}<br />
    Anzahl: {{ tooltipInfo.count }}
  </ChartTooltip>
</template>
