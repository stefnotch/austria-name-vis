import { feature as topojsonFeature } from "topojson-client";
import BackendWorker from "./backend-worker.ts?worker";
import type { WorkerMessage, WorkerResponse } from "./backend-worker";

const backendWorker = new BackendWorker();
let messageId = 0;
function callFn<Return>(fn: string, args: any[]): Promise<Return> {
  return new Promise((resolve, reject) => {
    const newId = messageId;
    messageId += 1;
    const messageListener = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id === newId) {
        backendWorker.removeEventListener("message", messageListener);
        resolve(e.data.result);
      }
    };
    backendWorker.addEventListener("message", messageListener);
    backendWorker.postMessage({
      id: newId,
      fn,
      args,
    } as WorkerMessage);
  });
}

export type IsoCode = number & { __isoCode: true };

export const YEAR_RANGE = [1984, 2022] as const;

export type MapData = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  {
    iso: IsoCode;
    name: string;
  }
>;

export async function loadMapData() {
  const mapData = await fetch(
    import.meta.env.BASE_URL + "bezirke_95_topo.json"
  ).then((v) => v.json());
  const geoJsonData = topojsonFeature(
    mapData,
    mapData.objects.bezirke
  ) as any as MapData;
  geoJsonData.features.forEach((v) => {
    v.properties.iso = +v.properties.iso as IsoCode;
  });
  geoJsonData.features = geoJsonData.features.filter(
    (v) => v.properties.iso !== 900
  ); // Filter out Vienna
  return geoJsonData;
}

export type NameDistributionInDistricts = {
  name: string;
  year: number;
  max_count: number;
  district_counts: {
    [iso: number]: number;
  };
};
export function fetchNameDistributionInDistricts(
  name: string,
  yearMin: number,
  yearMax: number
) {
  return callFn<NameDistributionInDistricts>("name_district_count", [
    name,
    { year_min: yearMin, year_max: yearMax },
  ]);
}

export type YearlyNameDistribution = {
  name: string;
  yearly_counts: {
    [year: number]: number;
  };
};
export async function fetchYearlyNameDistribution(
  name: string,
  opts: NameFilterOptions
) {
  return callFn<YearlyNameDistribution>("name_year_count", [
    name,
    { year_min: opts.yearMin, year_max: opts.yearMax },
    opts.district,
  ]);
}

export type NameFilterOptions = {
  yearMin?: number;
  yearMax?: number;
  district?: IsoCode;
  maxPerYear?: number;
  maxTotal?: number;
  minDistricts?: number;
  maxDistricts?: number;
};
function toPythonParams(opts: NameFilterOptions) {
  return [
    { year_min: opts.yearMin, year_max: opts.yearMax },
    opts.district,
    { maxperyear: opts.maxPerYear, maxtotal: opts.maxTotal },
    { minDistricts: opts.minDistricts, maxDistricts: opts.maxDistricts },
  ];
}

export type RarestNames = {
  Name: string;
  Gender: number;
  Count: number;
  Count_total: number;
  DistrictCount: number;
}[];
export async function fetchRarestNames(opts: NameFilterOptions) {
  // def name_count(years = None, district = None, maxes = None, district_counts = None):
  return callFn<RarestNames>("name_count", toPythonParams(opts));
}

export type NameRegionRarity = {
  Name: string;
  Gender: number;
  Count_district: number;
  Count_total: number;
};
export async function fetchNameRegionRarity(opts: NameFilterOptions) {
  return callFn<NameRegionRarity[]>("name_region_rarity", toPythonParams(opts));
}
