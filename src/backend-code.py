import pandas as pd
import json

preloaded_names_df = None

def load_names_data():
    global preloaded_names_df
    # We use Javascript to ensure the file exists
    with open('/data.csv', 'r', encoding="utf-8") as names_file:
        df = pd.read_csv(names_file, sep=';')
        df = df.rename(columns={
            'C-JAHR-0': 'Year',
            'C-WOHNBEZIRK-0': 'District',
            'C-GESCHLECHT-0': 'Gender',
            'F-VORNAME_NORMALISIERT': 'Name',
            'F-ANZAHL_LGEB': 'Count',
        })
        preloaded_names_df = df
    print(df.head())

load_names_data()

def filter_years(df, years):
    if years is None:
        return df
    year_min = years["year_min"]
    year_max = years["year_max"]
    if year_min is not None:
        df = df[df['Year'] >= year_min]
    if year_max is not None:
        df = df[df['Year'] <= year_max]
    return df

def filter_maxes(df, maxes):
    if maxes is None:
        return df
    maxtotal = maxes["maxtotal"]
    maxperyear = maxes["maxperyear"]
    if maxtotal is None and maxperyear is None:
        return df
    yearly_name_counts = df.groupby(['Year', 'Name', 'Gender'], as_index=False)['Count'].sum()
    
    valid_yearly_counts = yearly_name_counts
    if maxperyear is not None:
        valid_yearly_counts = yearly_name_counts[yearly_name_counts['Count'] <= maxperyear]
    
    cumulative_name_counts = valid_yearly_counts.groupby(['Name', 'Gender'], as_index=False)['Count'].sum()
    cumulative_name_counts = cumulative_name_counts.rename(columns={'Count': 'TotalCount'})

    filtered_names = cumulative_name_counts
    if maxtotal is not None:
        filtered_names = filtered_names[cumulative_name_counts['TotalCount'] <= maxtotal]
    
    final_filtered_names = valid_yearly_counts.merge(filtered_names, on='Name')
    
    final_df = df[df['Name'].isin(final_filtered_names['Name'])]
    
    return final_df

def filter_district_counts(df, district_counts):
    if district_counts is None:
        return df
    minDistricts = district_counts["minDistricts"]
    maxDistricts = district_counts["maxDistricts"]
    if minDistricts is None and maxDistricts is None:
        return df

    name_district_counts = df.groupby(['Name', 'Gender'], as_index=False).agg({
        'District': 'nunique'
    })[['Name', 'Gender', 'District']].rename(columns={'District': 'DistrictCount'})

    if minDistricts is not None:
        name_district_counts = name_district_counts[name_district_counts['DistrictCount'] >= minDistricts]
    if maxDistricts is not None:
        name_district_counts = name_district_counts[name_district_counts['DistrictCount'] <= maxDistricts]
    
    return df.merge(name_district_counts, on=['Name', 'Gender'])

def filter_district(df, district):
    if district is None:
        return df
    return df[df['District'] == district]

def filter_name(df, name):
    if name is None:
        return df
    name = name.lower()
    return df[df['Name'].str.lower() == name]

# For the table
# returns names based on parameters, if no parameters are given, all names are returned
def name_count(years = None, district = None, maxes = None, district_counts = None):
    filtered_df = preloaded_names_df
    # This particular order is important
    # Filter years first, then count the districts, then filter the districts
    # And only after that apply the "maxes" filter (aka only filter top X names in this district!)
    filtered_df = filter_years(filtered_df, years)

    name_austria_counts = filtered_df.groupby(['Name', 'Gender'], as_index=False).agg({
        'Count': 'sum'
    })[['Name', 'Gender', 'Count']]

    filtered_df = filter_district_counts(filtered_df, district_counts)
    filtered_df = filter_district(filtered_df, district)
    filtered_df = filter_maxes(filtered_df, maxes)

    filtered_df = filtered_df.groupby(['Name', 'Gender'], as_index=False).agg({
        'Count': 'sum',
        'DistrictCount': 'max'
    })
    filtered_df = filtered_df.merge(name_austria_counts, how='left', on=['Name', 'Gender'], suffixes=('', '_total'))

    print(filtered_df)
    # Only return the top 8 names
    filtered_df = filtered_df.sort_values(by='Count', ascending=False)
    filtered_df = filtered_df.head(8)

    names_list = filtered_df.to_dict(orient='records')
    return names_list

# For the line chart
# Returns how many times per year the name was given
def name_year_count(name, years = None, district = None):
    filtered_df = preloaded_names_df
    filtered_df = filter_years(filtered_df, years)
    filtered_df = filter_district(filtered_df, district)
    filtered_df = filter_name(filtered_df, name)

    # Group by 'Year' and sum the 'Number' column
    yearly_counts = filtered_df.groupby('Year')['Count'].sum().to_dict()
    return {'name': name, 'yearly_counts': yearly_counts}

# For the scatterplot
def name_region_rarity(years = None, district = None, maxes = None, district_counts = None):
    filtered_df = preloaded_names_df
    filtered_df = filter_years(filtered_df, years)

    # Calculate the rarity of each name in each district on mostly unfiltered data
    name_district_counts = filter_district(filtered_df, district).groupby(['Name', 'Gender'], as_index=False).agg({
        'Count': 'sum'
    })[['Name', 'Gender', 'Count']]
    name_austria_counts = filtered_df.groupby(['Name', 'Gender'], as_index=False).agg({
        'Count': 'sum'
    })[['Name', 'Gender', 'Count']]
    
    # Filter the names down
    filtered_df = filter_district_counts(filtered_df, district_counts)
    filtered_df = filter_district(filtered_df, district)
    filtered_df = filter_maxes(filtered_df, maxes)

    # Join the datasets
    filtered_df = (filtered_df
        .merge(name_district_counts, how='left', on=['Name', 'Gender'], suffixes=('', '_district'))
        .merge(name_austria_counts, how='left', on=['Name', 'Gender'], suffixes=('', '_total')))

    # Pick the relevant columns
    filtered_df = filtered_df[['Name', 'Gender', 'Count_district', 'Count_total']]

    return filtered_df.to_dict(orient='records')

# For the map
# Returns how many times the given name was given in each district
def name_district_count(name, years):
    filtered_df = preloaded_names_df

    filtered_df = filter_years(filtered_df, years)
    filtered_df = filter_name(filtered_df, name)

    # Group by 'District' and sum the 'Number' column
    district_counts = filtered_df.groupby('District')['Count'].sum().to_dict()
    max_count = max(district_counts.values(), default=0)
    return {'name': name, 'district_counts': district_counts, 'max_count': max_count}

def call_fn(fn_name, args_as_json):
    args = json.loads(args_as_json)
    result = globals()[fn_name](*args)
    return json.dumps(result)