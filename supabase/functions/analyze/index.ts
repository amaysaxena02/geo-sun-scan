import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postcode } = await req.json();
    console.log('Analyzing postcode:', postcode);

    if (!postcode) {
      return new Response(
        JSON.stringify({ error: 'Postcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Geocode the postcode using Nominatim
    console.log('Step 1: Geocoding postcode...');
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)}, UK&polygon_geojson=1&limit=1`;
    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SolarSiteAnalysis/1.0'
      }
    });

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim API error: ${nominatimResponse.status}`);
    }

    const nominatimData = await nominatimResponse.json();
    
    if (!nominatimData || nominatimData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Postcode not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const location = nominatimData[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);
    const boundingBox = location.boundingbox; // [south, north, west, east]

    console.log('Location found:', { lat, lon, boundingBox });

    // Step 2: Get obstacles from Overpass API
    console.log('Step 2: Fetching obstacles...');
    const overpassQuery = `
      [out:json];
      (
        node["building"](${boundingBox[0]},${boundingBox[2]},${boundingBox[1]},${boundingBox[3]});
        way["building"](${boundingBox[0]},${boundingBox[2]},${boundingBox[1]},${boundingBox[3]});
        node["natural"="tree"](${boundingBox[0]},${boundingBox[2]},${boundingBox[1]},${boundingBox[3]});
        node["power"="pole"](${boundingBox[0]},${boundingBox[2]},${boundingBox[1]},${boundingBox[3]});
      );
      out center;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassResponse = await fetch(overpassUrl, {
      method: 'POST',
      body: overpassQuery,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!overpassResponse.ok) {
      console.error('Overpass API error:', overpassResponse.status);
      throw new Error(`Overpass API error: ${overpassResponse.status}`);
    }

    const overpassData = await overpassResponse.json();
    console.log('Overpass elements found:', overpassData.elements?.length || 0);

    // Process obstacles
    const buildings: Array<{ lat: number; lon: number }> = [];
    const trees: Array<{ lat: number; lon: number }> = [];
    const poles: Array<{ lat: number; lon: number }> = [];

    overpassData.elements?.forEach((element: any) => {
      const elementLat = element.lat || element.center?.lat;
      const elementLon = element.lon || element.center?.lon;

      if (!elementLat || !elementLon) return;

      if (element.tags?.building) {
        buildings.push({ lat: elementLat, lon: elementLon });
      } else if (element.tags?.natural === 'tree') {
        trees.push({ lat: elementLat, lon: elementLon });
      } else if (element.tags?.power === 'pole') {
        poles.push({ lat: elementLat, lon: elementLon });
      }
    });

    console.log('Obstacles processed:', { buildings: buildings.length, trees: trees.length, poles: poles.length });

    // Step 3: Get 5-year climate data from Open-Meteo
    console.log('Step 3: Fetching climate data...');
    const currentDate = new Date();
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);

    const startDate = fiveYearsAgo.toISOString().split('T')[0];
    const endDate = currentDate.toISOString().split('T')[0];

    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,precipitation_sum,sunshine_duration&timezone=auto`;
    
    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      console.error('Open-Meteo API error:', weatherResponse.status);
      throw new Error(`Open-Meteo API error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    console.log('Weather data received');

    // Process weather data into monthly averages
    const monthlyData: { [key: string]: { temp: number[], precip: number[], sun: number[] } } = {};
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    weatherData.daily?.time?.forEach((date: string, index: number) => {
      const monthIndex = new Date(date).getMonth();
      const monthName = monthNames[monthIndex];

      if (!monthlyData[monthName]) {
        monthlyData[monthName] = { temp: [], precip: [], sun: [] };
      }

      const temp = weatherData.daily.temperature_2m_mean[index];
      const precip = weatherData.daily.precipitation_sum[index];
      const sun = weatherData.daily.sunshine_duration[index];

      if (temp !== null) monthlyData[monthName].temp.push(temp);
      if (precip !== null) monthlyData[monthName].precip.push(precip);
      if (sun !== null) monthlyData[monthName].sun.push(sun / 3600); // Convert seconds to hours
    });

    // Calculate averages
    const weather = monthNames.map(month => {
      const data = monthlyData[month] || { temp: [], precip: [], sun: [] };
      return {
        month,
        temperature_2m_mean: data.temp.length > 0 
          ? data.temp.reduce((a, b) => a + b, 0) / data.temp.length 
          : 0,
        precipitation_sum: data.precip.length > 0 
          ? data.precip.reduce((a, b) => a + b, 0) / data.precip.length 
          : 0,
        sunshine_duration: data.sun.length > 0 
          ? data.sun.reduce((a, b) => a + b, 0) / data.sun.length 
          : 0,
      };
    });

    console.log('Weather data processed');

    // Prepare response
    const response = {
      boundary: location.geojson || {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [parseFloat(boundingBox[2]), parseFloat(boundingBox[0])],
            [parseFloat(boundingBox[3]), parseFloat(boundingBox[0])],
            [parseFloat(boundingBox[3]), parseFloat(boundingBox[1])],
            [parseFloat(boundingBox[2]), parseFloat(boundingBox[1])],
            [parseFloat(boundingBox[2]), parseFloat(boundingBox[0])]
          ]]
        }
      },
      obstacles: {
        buildings: buildings.slice(0, 100), // Limit to 100 markers each for performance
        trees: trees.slice(0, 100),
        poles: poles.slice(0, 100)
      },
      weather
    };

    console.log('Analysis complete');

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
