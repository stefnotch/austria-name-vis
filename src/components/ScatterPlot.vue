<script setup lang="ts">
import { NH3 } from "naive-ui";
import ChartTooltip from "./ChartTooltip.vue";
import RenderD3 from "./RenderD3.vue";
import * as d3 from "d3";
import { computed, ref, watchEffect } from "vue";

const props = defineProps<{
  width: number;
  height: number;
  points: { x: number; y: number; value: string }[];
  highlightedPoints: string[];
  xAxis: readonly [number, number];
  xLabel: string;
  yAxis: readonly [number, number];
  yLabel: string;
}>();

const highlightedPointsSet = computed(() => new Set(props.highlightedPoints));

const svgElement = d3.create("svg");

const tooltipInfo = ref<{
  x: number;
  y: number;
  value: string;
} | null>(null);

watchEffect(() => {
  svgElement.selectAll("*").remove();

  const margin = { top: 40, right: 30, bottom: 50, left: 60 },
    width = props.width - margin.left - margin.right,
    height = props.height - margin.top - margin.bottom;
  const svg = svgElement
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  let xScale = d3.scaleLinear().domain(props.xAxis).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  let yScale = d3.scaleLinear().domain(props.yAxis).range([height, 0]);
  svg.append("g").call(d3.axisLeft(yScale));
  // add the x-axis label
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height + margin.top)
    .text(props.xLabel);

  // add the y-axis label
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -30)
    .text(props.yLabel);

  // add the scatter plot points
  let circles = svg
    .append("g")
    .selectAll("circle")
    .data(props.points)
    .enter()
    .append("circle")
    .attr("cx", function (d) {
      return xScale(d.x);
    })
    .attr("cy", function (d) {
      return yScale(d.y);
    })
    .attr("r", 3)
    .attr("fill", getFill)
    .attr("stroke-width", 2)
    .attr("opacity", 0.7);

  circles
    .on("mouseover", function (event, d) {
      // highlight the hovered circle
      d3.select(this).attr("fill", "orange").attr("opacity", 1);

      tooltipInfo.value = { x: event.pageX, y: event.pageY, value: d.value };
    })
    .on("mouseout", function (event, d) {
      // reset circle style on mouseout
      d3.select(this).attr("fill", getFill(d)).attr("opacity", 0.7);
    });

  function getFill(d: { value: string }) {
    return highlightedPointsSet.value.has(d.value) ? "red" : "blue";
  }
});
</script>
<template>
  <RenderD3 :node="svgElement.node()!" :width="width" :height="height" />
  <ChartTooltip
    v-if="tooltipInfo !== null"
    :x="tooltipInfo.x"
    :y="tooltipInfo.y"
  >
    {{ tooltipInfo.value }}
  </ChartTooltip>
</template>
