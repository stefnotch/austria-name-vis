import { feature as topojsonFeature } from "topojson-client";

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

export type NameFilterOptions = {
  yearMin?: number;
  yearMax?: number;
  district?: IsoCode;
  maxPerYear?: number;
  maxTotal?: number;
  minDistricts?: number;
  maxDistricts?: number;
};
