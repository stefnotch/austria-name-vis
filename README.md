# austria-name-vis

[Live site](https://stefnotch.github.io/austria-name-vis/)

### DuckDB SQL Editing

https://www.quackdb.com/ and add the CSV file as a data source, and then run

```sql
create table vor as (select "C-JAHR-0" as year, "C-WOHNBEZIRK-0" as district, "C-GESCHLECHT-0" as gender, "F-VORNAME_NORMALISIERT" as name, "F-ANZAHL_LGEB" as c from 'OGDEXT_VORNAMEN_1.csv');
```

### Install Dependencies

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run start
```



## Attribution

- https://data.statistik.gv.at/web/meta.jsp?dataset=OGDEXT_VORNAMEN_1 for the dataset
- https://wahlen.strategieanalysen.at/geojson/ and https://github.com/ginseng666/GeoJSON-TopoJSON-Austria and https://www.data.gv.at/katalog/dataset/2ee6b8bf-6292-413c-bb8b-bd22dbb2ad4b for the map data

