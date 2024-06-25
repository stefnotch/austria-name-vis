<script setup lang="ts">
import {
  NSpace,
  NSlider,
  NInputNumber,
  NSelect,
  NH2,
  NH3,
  NButton,
  NInput,
} from "naive-ui";
import { computed, ref, watchEffect } from "vue";
import AustriaMap from "./components/AustriaMap.vue";
import YearlyPlot from "./components/YearlyPlot.vue";
import ScatterPlot from "./components/ScatterPlot.vue";
import NameTable from "./components/NameTable.vue";
import { YEAR_RANGE, type IsoCode, type MapData } from "./backend";
import { useDebounceFn } from "@vueuse/core";
import type {
  Backend,
  NameDistributionInDistricts,
  RareName,
  YearlyNameDistribution,
} from "./backend-duckdb";

const props = defineProps<{
  mapData: MapData;
  backend: Backend;
}>();

const selectedName = ref<string | null>(null);
const yearsInput = ref<[number, number]>([YEAR_RANGE[0], YEAR_RANGE[1]]);
const years = computed(
  () => [Math.min(...yearsInput.value), Math.max(...yearsInput.value)] as const
);
const district = ref<IsoCode | null>(null);

const maxTotalOccurences = ref<number>(1000);
const maxOccurrences = ref<number>(10);
const minDistricts = ref<number>(1);
const maxDistricts = ref<number>(100);

const inputName = ref<string | null>(null);

const districtNames = computed(() => {
  return new Map(
    props.mapData.features.map((d) => [d.properties.iso, d.properties.name])
  );
});
const districtName = computed(() => {
  if (district.value === null) {
    return "Österreich";
  } else {
    return districtNames.value.get(district.value) ?? "Österreich";
  }
});

const districtOptions = computed(() => {
  const values = props.mapData.features.map((d) => ({
    label: d.properties.name,
    value: d.properties.iso,
  }));
  values.sort((a, b) => a.label.localeCompare(b.label));
  values.unshift({ label: "Ganz Österreich", value: null as any });
  return values;
});

const nameDistributionInDistricts = ref<NameDistributionInDistricts | null>(
  null
);
const slowFetchNameDistributionInDistricts = useDebounceFn(
  (
    ...args: Parameters<typeof props.backend.fetchNameDistributionInDistricts>
  ) => props.backend.fetchNameDistributionInDistricts(...args),
  500
);
watchEffect(() => {
  if (selectedName.value) {
    slowFetchNameDistributionInDistricts(
      selectedName.value,
      years.value[0],
      years.value[1]
    ).then((data) => {
      nameDistributionInDistricts.value = data ?? null;
    });
  } else {
    nameDistributionInDistricts.value = null;
  }
});

const yearlyNameDistribution = ref<YearlyNameDistribution | null>(null);
const slowFetchYearlyNameDistribution = useDebounceFn(
  (...args: Parameters<typeof props.backend.fetchYearlyNameDistribution>) =>
    props.backend.fetchYearlyNameDistribution(...args),
  500
);
watchEffect(() => {
  if (selectedName.value) {
    slowFetchYearlyNameDistribution(selectedName.value, {
      yearMin: years.value[0],
      yearMax: years.value[1],
      district: district.value ?? undefined,
    }).then((data) => {
      yearlyNameDistribution.value = data;
    });
  } else {
    yearlyNameDistribution.value = null;
  }
});
const reducedYearlyNameDistribution = computed(() => {
  if (
    yearlyNameDistribution.value === undefined ||
    yearlyNameDistribution.value === null
  ) {
    return null;
  }
  const minYear = years.value[0];
  const maxYear = years.value[1];
  return {
    name: yearlyNameDistribution.value.name,
    yearly_counts: Object.fromEntries(
      Object.entries(yearlyNameDistribution.value.yearly_counts).filter(
        ([year, _]) => {
          const y = +year;
          return minYear <= y && y <= maxYear;
        }
      )
    ),
  };
});

const rarestNames = ref<RareName[] | null>(null);
const slowFetchRarestNames = useDebounceFn(
  (...args: Parameters<typeof props.backend.fetchRarestNames>) =>
    props.backend.fetchRarestNames(...args),
  500
);
watchEffect(() => {
  slowFetchRarestNames({
    yearMin: years.value[0],
    yearMax: years.value[1],
    maxPerYear: maxOccurrences.value,
    maxTotal: maxTotalOccurences.value,
    minDistricts: minDistricts.value,
    maxDistricts: maxDistricts.value,
    district: district.value ?? undefined,
  }).then((data) => {
    rarestNames.value = data ?? null;
  });
});

const nameRegionRarity = computed<RareName[] | null>(() => {
  if (district.value === null) {
    return null;
  }
  return rarestNames.value;
});

const pointsNameRegionRarity = computed(() => {
  if (nameRegionRarity.value === null) {
    return null;
  }
  return nameRegionRarity.value.map((entry) => ({
    x: entry.Count_total,
    y: entry.Count,
    value: `${entry.Name}`,
  }));
});
const xAxisNameRegionRarity = computed(() => {
  if (nameRegionRarity.value === null) {
    return [0, 1] as const;
  }
  const max = Math.max(
    ...nameRegionRarity.value.map((entry) => entry.Count_total)
  );
  return [0, max] as const;
});
const yAxisNameRegionRarity = computed(() => {
  if (nameRegionRarity.value === null) {
    return [0, 1] as const;
  }
  const max = Math.max(...nameRegionRarity.value.map((entry) => entry.Count));
  return [0, max] as const;
});

const selectName = () => {
  if (inputName.value !== null) {
    if (inputName.value.trim() !== "") {
      selectedName.value = inputName.value.trim();
      inputName.value = "";
    }
  }
};
</script>

<template>
  <div>
    <p>
      Von [@marcistoth](https://github.com/marcistoth) und
      [@stefnotch](https://github.com/stefnotch/)
    </p>
    <main class="grid grid-cols-3">
      <div class="p-2">
        <n-h2>Name</n-h2>
        Ausgewählter Name: {{ selectedName }}
        <n-button
          v-if="selectedName"
          @click="selectedName = null"
          round
          size="tiny"
          >x</n-button
        >
        <div v-if="!selectedName">
          <n-input
            type="text"
            v-model:value="inputName"
            size="small"
            placeholder="Name eingeben"
          />
          <n-button @click="selectName" size="small">Name auswählen</n-button>
        </div>
        <NameTable
          v-if="rarestNames !== null"
          :selectedName="selectedName"
          @update:selectedName="selectedName = $event"
          :years="years"
          :districtName="districtName"
          :rarestNames="rarestNames"
        />
        <div class="rareness-controls">
          <n-h2>Seltenheit von Namen</n-h2>
          <div>
            <label for="maxTotalOccurences">Maximale Gesamtanzahl:</label>
            <n-input-number
              v-model:value="maxTotalOccurences"
              size="small"
              id="maxTotalOccurences"
              :min="0"
            />
          </div>
          <div>
            <label for="maxOccurrences">Maximale Anzahl pro Jahr:</label>
            <n-input-number
              v-model:value="maxOccurrences"
              size="small"
              id="maxOccurrences"
              :min="0"
            />
          </div>
          <div>
            <label for="minDistricts">Mindestanzahl an Bezirken:</label>
            <n-input-number
              v-model:value="minDistricts"
              size="small"
              id="minDistricts"
              :min="0"
            />
          </div>
          <div>
            <label for="maxDistricts">Maximale Anzahl an Bezirken:</label>
            <n-input-number
              v-model:value="maxDistricts"
              size="small"
              id="maxDistricts"
              :min="0"
            />
          </div>
        </div>
      </div>
      <div class="border-x border-gray-700 p-2">
        <n-h2>Bezirke</n-h2>
        <div>
          Ausgewählter Bezirk:
          <n-select
            v-model:value="district"
            filterable
            placeholder="Ganz Österreich"
            clearable
            :options="districtOptions"
          />
        </div>
        <AustriaMap
          :mapData="props.mapData"
          :width="500"
          :height="210"
          :district="district"
          :name="selectedName"
          :districtNames="districtNames"
          @update:district="district = $event"
          :nameDistribution="nameDistributionInDistricts"
        />
        <n-h3>Regionale Seltenheit von Namen </n-h3>
        <ScatterPlot
          v-if="
            pointsNameRegionRarity !== null &&
            xAxisNameRegionRarity !== null &&
            yAxisNameRegionRarity !== null
          "
          :width="400"
          :height="400"
          :points="pointsNameRegionRarity"
          :highlightedPoints="selectedName ? [selectedName] : []"
          :xAxis="xAxisNameRegionRarity"
          :xLabel="`Gesamtanzahl in Österreich`"
          :yAxis="yAxisNameRegionRarity"
          :yLabel="`Anzahl in ${districtName}`"
        />
        <div v-else>Kein Bezirk ausgewählt</div>
      </div>
      <div class="p-2">
        <n-h2>Jahre</n-h2>
        <div>
          <n-space vertical>
            <n-slider
              v-model:value="yearsInput"
              range
              :step="1"
              :min="YEAR_RANGE[0]"
              :max="YEAR_RANGE[1]"
            />
            <n-space>
              <n-input-number
                :value="years[0]"
                size="small"
                @update:value="
                  (v) => {
                    const index = years[0] <= years[1] ? 0 : 1;
                    yearsInput[index] = v ?? YEAR_RANGE[0];
                  }
                "
              />
              <n-input-number
                :value="years[1]"
                size="small"
                @update:value="
                  (v) => {
                    const index = years[0] <= years[1] ? 1 : 0;
                    yearsInput[index] = v ?? YEAR_RANGE[1];
                  }
                "
              />
            </n-space>
          </n-space>
        </div>

        <n-h3>
          Häufigkeit von '{{ selectedName }}' von {{ years[0] }} bis
          {{ years[1] }} in {{ districtName }}
        </n-h3>
        <div v-if="reducedYearlyNameDistribution !== null">
          <YearlyPlot
            v-if="reducedYearlyNameDistribution !== null"
            :width="600"
            :height="400"
            :yearlyDistribution="reducedYearlyNameDistribution"
            :years="years"
          ></YearlyPlot>
        </div>
        <div v-else>Kein Name ausgewählt</div>
      </div>
    </main>
  </div>
</template>

<style scoped>
#map-container {
  display: flex;
  justify-content: center;
}

#map {
  height: 500px;
  width: 100%;
  max-width: 100%;
}
</style>
