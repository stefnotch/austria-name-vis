import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import type { IsoCode } from "./backend";

const DataFilePath = import.meta.env.BASE_URL + "OGDEXT_VORNAMEN_1.parquet";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};
(Symbol as any).asyncDispose ??= Symbol.for("Symbol.asyncDispose");

export type YearlyNameDistribution = {
  name: string;
  yearly_counts: {
    [year: number]: number;
  };
};

export type NameDistributionInDistricts = {
  name: string;
  max_count: number;
  district_counts: {
    [iso: number]: number;
  };
};

export type RareName = {
  Name: string;
  Gender: number;
  Count: number;
  Count_total: number;
  DistrictCount: number;
};

export type NameFilterOptions = {
  yearMin?: number;
  yearMax?: number;
  district?: IsoCode;
  maxPerYear?: number;
  maxTotal?: number;
  minDistricts?: number;
  maxDistricts?: number;
};

export class Backend {
  private constructor(
    private _db: duckdb.AsyncDuckDB,
    private _vor: SqlTable<{
      year: "u32";
      district: "u16";
      gender: "u8";
      name: "str";
      c: "u64";
    }>
  ) {}

  static async create() {
    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    // Instantiate the asynchronus version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    await db.registerFileURL(
      "OGDEXT_VORNAMEN_1.parquet",
      DataFilePath,
      duckdb.DuckDBDataProtocol.HTTP,
      false
    );

    const backend = new Backend(
      db,
      new SqlTable("vor", {
        year: "u32",
        district: "u16",
        gender: "u8",
        name: "str",
        c: "u64",
      })
    );
    await using c = await backend.connect();
    await c.query(`create table vor as (
      select 
        "C-JAHR-0"::INT as year, 
        "C-WOHNBEZIRK-0"::INT2 as district, 
        "C-GESCHLECHT-0"::INT1 as gender, 
        "F-VORNAME_NORMALISIERT" as name, 
        "F-ANZAHL_LGEB"::INT8 as c 
      from 'OGDEXT_VORNAMEN_1.parquet')
  `);

    return backend;
  }

  private async connect() {
    const v = (await this._db.connect()) as duckdb.AsyncDuckDBConnection & {
      [Symbol.asyncDispose]: any;
    };
    v[Symbol.asyncDispose] = () => v.close();
    return v;
  }

  /**
   * For the line chart.
   */
  async fetchYearlyNameDistribution(
    name: string,
    opts: NameFilterOptions
  ): Promise<YearlyNameDistribution> {
    const table = await query(this._vor, {
      name,
      yearMin: opts.yearMin ?? null,
      yearMax: opts.yearMax ?? null,
      district: opts.district ?? null,
    })
      .where((v) => `lower(name) = lower(${v.args.name})`)
      .where((v) => `(${v.args.yearMin} is null or ${v.args.yearMin} <= year)`)
      .where((v) => `(${v.args.yearMax} is null or year <= ${v.args.yearMax})`)
      .where(
        (v) => `(${v.args.district} is null or district = ${v.args.district})`
      )
      .groupBy(["year"])
      .select(["year", "sum(c)::INT8 as count"], () => this.connect());
    const rows = table.toArray().map((row) => [row.year, fromLong(row.count)]);
    const yearly_counts = Object.fromEntries(rows);
    return { name, yearly_counts };
  }

  /**
   * For the map
   */
  async fetchNameDistributionInDistricts(
    name: string,
    yearMin: number,
    yearMax: number
  ): Promise<NameDistributionInDistricts> {
    const table = await query(this._vor, {
      name,
      yearMin,
      yearMax,
    })
      .where((v) => `lower(name) = lower(${v.args.name})`)
      .where((v) => `(${v.args.yearMin} is null or ${v.args.yearMin} <= year)`)
      .where((v) => `(${v.args.yearMax} is null or year <= ${v.args.yearMax})`)
      .groupBy(["district"])
      .select(["district", "sum(c)::INT8 as count"], () => this.connect());
    const rows = table
      .toArray()
      .map((row) => [row.district, fromLong(row.count)]);

    const max_count = Math.max(Math.max(...rows.map(([, count]) => count)), 0);
    const district_counts = Object.fromEntries(rows);
    return { name, district_counts, max_count };
  }

  /**
   * For the table and the scatterplot.
   * The scatterplot will use the same data, and will only be displayed if a district is selected.
   */
  async fetchRarestNames(opts: NameFilterOptions): Promise<RareName[]> {
    await using c = await this.connect();

    const filtered_df = `
    select
      *
    from vor
    where 
      ($2 is null or $2 <= year)
      and ($3 is null or year <= $3)
    `;

    const filtered_df_names = `
    select
      name, gender
    from (${filtered_df})
    group by name, gender
    `;

    const district_counts = `
    select
      name, gender, count(distinct district)::INT4 as NumberOfDistricts
    from (${filtered_df})
    group by name, gender
    having
      ($6 is null or $6 <= NumberOfDistricts)
      and ($7 is null or NumberOfDistricts <= $7)
    `;

    const name_counts_in_austria = `
    select
      name, gender, sum(c)::INT8 as NameCountInAustria
    from (${filtered_df})
    group by name, gender
    `;

    const name_counts_in_district = `
    select
      name, gender, sum(c)::INT8 as NameCountInDistrict
    from (${filtered_df})
    where
      ($1 is null or district = $1)
    group by name, gender
    `;

    const name_counts_in_district_years = `
    select
      name, gender, year, sum(c)::INT8 as NameCountInDistrictPerYear
    from (${filtered_df})
    where
      ($1 is null or district = $1)
    group by name, gender, year
    `;

    const name_best_year = `
    select 
      name, gender, max(NameCountInDistrictPerYear)::INT8 as BestYear 
    from (${name_counts_in_district_years}) 
    group by name, gender
      `;

    const names_query = `
    select
      vor.name, vor.gender, 
      (select NameCountInDistrict from (${name_counts_in_district}) as ncd where ncd.name = vor.name and ncd.gender = vor.gender) as NameCountInDistrict,
      (select NameCountInAustria from (${name_counts_in_austria}) as nca where nca.name = vor.name and nca.gender = vor.gender) as NameCountInAustria,
      dc.NumberOfDistricts,
    from (${filtered_df_names}) as vor
    inner join (${district_counts}) as dc on vor.name = dc.name and vor.gender = dc.gender
    where 
      ($4 is null or (select BestYear from (${name_best_year}) as nby where nby.name = vor.name and nby.gender = vor.gender) <= $4)
      and ($5 is null or NameCountInDistrict <= $5)
    order by NameCountInDistrict desc, NameCountInAustria desc, vor.name asc
    ${opts.district !== undefined ? "" : "limit 8"}
    `;
    // If we have a district, we'll show everything in the scatterplot

    const stmt = await c.prepare(names_query);
    const table = await stmt.query(
      opts.district,
      opts.yearMin,
      opts.yearMax,
      opts.maxPerYear,
      opts.maxTotal,
      opts.minDistricts,
      opts.maxDistricts
    );
    await stmt.close();

    const rows = table.toArray().map((row) => ({
      Name: row.name,
      Gender: row.gender,
      Count: fromLong(row.NameCountInDistrict),
      Count_total: fromLong(row.NameCountInAustria),
      DistrictCount: row.NumberOfDistricts,
    }));

    return rows;
  }
}

function fromLong(value: bigint) {
  if (value > Number.MAX_SAFE_INTEGER) {
    console.warn("Value too large", value);
  }
  // Unsafe, but we know the values are small
  return Number(value);
}

type SqlValue =
  | {
      readonly type: "u8";
      readonly value: number;
    }
  | {
      readonly type: "u16";
      readonly value: number;
    }
  | {
      readonly type: "u32";
      readonly value: number;
    }
  | {
      readonly type: "u64";
      readonly value: bigint;
    }
  | {
      readonly type: "f32";
      readonly value: number;
    }
  | {
      readonly type: "f64";
      readonly value: number;
    }
  | {
      readonly type: "str";
      readonly value: string;
    };

type SqlType = SqlValue["type"];

type ToSqlValue = string | number | bigint | null;

class SqlTable<Columns extends Readonly<Record<string, SqlType>>> {
  constructor(
    public name: string,
    public columns: Columns
  ) {}
}

class SqlFromQuery<
  Table extends SqlTable<any>,
  Arguments extends Record<string, ToSqlValue>,
> {
  _filters: string[] = [];
  _argumentIndices: Record<keyof Arguments, string>;
  _argumentOrder: (keyof Arguments)[] = [];
  constructor(
    public table: Table,
    public args: Arguments
  ) {
    this._argumentOrder = Object.keys(args) as (keyof Arguments)[];
    this._argumentIndices = Object.fromEntries(
      this._argumentOrder.map((k, i) => [k, "$" + (i + 1)])
    ) as Record<keyof Arguments, string>;
  }

  where(filter: (builder: SqlWhereBuilder<Table, Arguments>) => string) {
    this._filters.push(filter(new SqlWhereBuilder(this)));
    return this;
  }

  groupBy(columns: (keyof Table["columns"])[]) {
    return new SqlGroupedQuery(this, columns);
  }

  async select(
    values: string[],
    connect: () => Promise<
      duckdb.AsyncDuckDBConnection & {
        [Symbol.asyncDispose]: any;
      }
    >
  ) {
    return new SqlGroupedQuery(this, []).select(values, connect);
  }
}

class SqlGroupedQuery<
  Table extends SqlTable<any>,
  Arguments extends Record<string, ToSqlValue>,
  GroupBy extends (keyof Table["columns"])[],
> {
  constructor(
    public _query: SqlFromQuery<Table, Arguments>,
    public _groupBy: GroupBy
  ) {}

  toSqlString(values: string[]): string {
    let writer = new IndentedWriter()
      .write("select")
      .setIndent(2)
      .write(values.join(", "))
      .setIndent(0)
      .write("from")
      .setIndent(2)
      .write(this._query.table.name)
      .setIndent(0)
      .write("where")
      .setIndent(2)
      .write(this._query._filters.map((v) => "(" + v + ")").join(" and "));
    if (this._groupBy.length > 0) {
      writer.setIndent(0).write("group by");
    }
    writer.setIndent(2).write(this._groupBy.join(", "));
    return writer.toString();
  }

  async select(
    values: string[],
    connect: () => Promise<
      duckdb.AsyncDuckDBConnection & {
        [Symbol.asyncDispose]: any;
      }
    >
  ) {
    const sql = this.toSqlString(values);
    await using c = await connect();
    const stmt = await c.prepare(sql);
    const table = await stmt.query(
      ...this._query._argumentOrder.map((k) => this._query.args[k])
    );
    await stmt.close();
    return table;
  }
}

function query<
  Table extends SqlTable<any>,
  Arguments extends Record<string, ToSqlValue>,
>(table: Table, args: Arguments) {
  return new SqlFromQuery<Table, Arguments>(table, args);
}

class SqlWhereBuilder<
  Table extends SqlTable<any>,
  Arguments extends Record<string, ToSqlValue>,
> {
  constructor(public _query: SqlFromQuery<Table, Arguments>) {}
  get args() {
    return this._query._argumentIndices;
  }
}

class IndentedWriter {
  private lines: {
    indent: number;
    text: string;
  }[] = [];
  public indent: number = 0;
  constructor() {}
  setIndent(indent: number): IndentedWriter {
    this.indent = indent;
    return this;
  }
  write(lines: string[] | string): IndentedWriter {
    if (typeof lines === "string") {
      lines = [lines];
    }
    this.lines.push(...lines.map((text) => ({ indent: this.indent, text })));
    return this;
  }
  toString() {
    return this.lines
      .map((line) => " ".repeat(line.indent) + line.text)
      .join("\n");
  }
}
