import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Building2, Trees, Zap, MapPin } from "lucide-react";
import { toast } from "sonner";

interface AnalysisData {
  boundary: any;
  obstacles: {
    buildings: Array<{ lat: number; lon: number }>;
    trees: Array<{ lat: number; lon: number }>;
    poles: Array<{ lat: number; lon: number }>;
  };
  weather: Array<{
    month: string;
    temperature_2m_mean: number;
    precipitation_sum: number;
    sunshine_duration: number;
  }>;
}

const SolarAnalysis = () => {
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Enter a UK postcode to begin analysis.");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const boundaryRef = useRef<any>(null);

  // Load Leaflet from CDN
  useEffect(() => {
    // Check if Leaflet is already loaded
    if (!(window as any).L) {
      // Add CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      // Add JS
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    const initMap = () => {
      if (mapRef.current && (window as any).L && !mapInstanceRef.current) {
        const L = (window as any).L;
        
        // Initialize map centered on UK
        const map = L.map(mapRef.current).setView([51.5074, -0.1278], 6);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Add ResizeObserver to handle map sizing issues
        const resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });

        if (mapRef.current) {
          resizeObserver.observe(mapRef.current);
        }

        // Cleanup
        return () => {
          resizeObserver.disconnect();
        };
      }
    };

    // Wait for Leaflet to load
    const checkLeaflet = setInterval(() => {
      if ((window as any).L) {
        clearInterval(checkLeaflet);
        initMap();
      }
    }, 100);

    return () => clearInterval(checkLeaflet);
  }, []);

  // Clear previous map data
  const clearMapData = () => {
    if (mapInstanceRef.current && (window as any).L) {
      // Remove markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Remove boundary
      if (boundaryRef.current) {
        boundaryRef.current.remove();
        boundaryRef.current = null;
      }
    }
  };

  // Update map with new data
  const updateMap = (data: AnalysisData) => {
    if (!mapInstanceRef.current || !(window as any).L) return;

    const L = (window as any).L;
    clearMapData();

    // Add boundary
    if (data.boundary) {
      boundaryRef.current = L.geoJSON(data.boundary, {
        style: {
          color: "#3b82f6",
          weight: 3,
          fillOpacity: 0.1,
        },
      }).addTo(mapInstanceRef.current);

      // Fit map to boundary
      mapInstanceRef.current.fitBounds(boundaryRef.current.getBounds());
    }

    // Create custom icons
    const createIcon = (color: string, iconHtml: string) => {
      return L.divIcon({
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${iconHtml}</div>`,
        className: "",
        iconSize: [24, 24],
      });
    };

    const buildingIcon = createIcon("#ef4444", "🏢");
    const treeIcon = createIcon("#22c55e", "🌳");
    const poleIcon = createIcon("#f59e0b", "⚡");

    // Add building markers
    data.obstacles.buildings.forEach(({ lat, lon }) => {
      const marker = L.marker([lat, lon], { icon: buildingIcon }).addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    // Add tree markers
    data.obstacles.trees.forEach(({ lat, lon }) => {
      const marker = L.marker([lat, lon], { icon: treeIcon }).addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    // Add pole markers
    data.obstacles.poles.forEach(({ lat, lon }) => {
      const marker = L.marker([lat, lon], { icon: poleIcon }).addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });
  };

  const handleAnalyze = async () => {
    if (!postcode.trim()) {
      toast.error("Please enter a UK postcode");
      return;
    }

    setLoading(true);
    setStatus("Analyzing location...");
    setAnalysisData(null);

    try {
      // TODO: Replace with actual API call to Lovable Cloud function
      // const response = await fetch(`/api/analyze?postcode=${encodeURIComponent(postcode)}`);
      
      // For now, show a message that backend needs to be set up
      setStatus("Backend integration required. Enable Lovable Cloud to connect external APIs.");
      toast.info("Enable Lovable Cloud to analyze real locations!");
      
      // Demo data for visualization
      const demoData: AnalysisData = {
        boundary: {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-0.1278, 51.5074],
              [-0.1178, 51.5074],
              [-0.1178, 51.5174],
              [-0.1278, 51.5174],
              [-0.1278, 51.5074]
            ]]
          }
        },
        obstacles: {
          buildings: [
            { lat: 51.5094, lon: -0.1238 },
            { lat: 51.5104, lon: -0.1248 },
            { lat: 51.5084, lon: -0.1228 }
          ],
          trees: [
            { lat: 51.5089, lon: -0.1258 },
            { lat: 51.5099, lon: -0.1268 }
          ],
          poles: [
            { lat: 51.5079, lon: -0.1218 }
          ]
        },
        weather: [
          { month: "January", temperature_2m_mean: 5.2, precipitation_sum: 55.3, sunshine_duration: 61.5 },
          { month: "February", temperature_2m_mean: 5.8, precipitation_sum: 42.6, sunshine_duration: 78.2 },
          { month: "March", temperature_2m_mean: 8.1, precipitation_sum: 45.1, sunshine_duration: 112.4 },
          { month: "April", temperature_2m_mean: 10.9, precipitation_sum: 43.8, sunshine_duration: 165.3 },
          { month: "May", temperature_2m_mean: 14.2, precipitation_sum: 51.2, sunshine_duration: 198.7 },
          { month: "June", temperature_2m_mean: 17.1, precipitation_sum: 50.8, sunshine_duration: 204.5 },
          { month: "July", temperature_2m_mean: 19.4, precipitation_sum: 44.5, sunshine_duration: 213.8 },
          { month: "August", temperature_2m_mean: 19.0, precipitation_sum: 49.5, sunshine_duration: 198.2 },
          { month: "September", temperature_2m_mean: 16.3, precipitation_sum: 49.1, sunshine_duration: 149.6 },
          { month: "October", temperature_2m_mean: 12.6, precipitation_sum: 68.5, sunshine_duration: 107.8 },
          { month: "November", temperature_2m_mean: 8.4, precipitation_sum: 64.4, sunshine_duration: 66.9 },
          { month: "December", temperature_2m_mean: 6.0, precipitation_sum: 55.2, sunshine_duration: 51.2 }
        ]
      };

      setTimeout(() => {
        setAnalysisData(demoData);
        updateMap(demoData);
        setStatus("Analysis complete (demo data)");
        setLoading(false);
      }, 1500);

    } catch (error) {
      setStatus("Error analyzing location");
      toast.error("Failed to analyze location");
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-[400px] bg-sidebar-bg border-r border-map-border overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Solar Site Analysis
            </h1>
            <p className="text-muted-foreground">
              AI-Powered Obstacle & Weather Assessment
            </p>
          </div>

          {/* Input Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Enter UK Postcode
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., SW1A 0AA"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={loading}
                className="px-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning
                  </>
                ) : (
                  "Scan Area"
                )}
              </Button>
            </div>
          </div>

          {/* Status Section */}
          <Card className="p-4 bg-status-bg border-border">
            <h2 className="text-lg font-semibold mb-2 text-foreground">Status</h2>
            <p className="text-sm text-muted-foreground">{status}</p>
          </Card>

          {/* Results Section */}
          {analysisData && (
            <div className="space-y-4">
              {/* Obstacles Summary */}
              <Card className="p-4">
                <h2 className="text-lg font-semibold mb-3 text-foreground">
                  Obstacles Detected
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-foreground">Buildings</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {analysisData.obstacles.buildings.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trees className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-foreground">Trees</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {analysisData.obstacles.trees.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-foreground">Utility Poles</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {analysisData.obstacles.poles.length}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Climate Data */}
              <Card className="p-4">
                <h2 className="text-lg font-semibold mb-3 text-foreground">
                  5-Year Climate Average
                </h2>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2 font-medium text-foreground">Month</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Temp (°C)</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Rain (mm)</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Sun (hrs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisData.weather.map((month, idx) => (
                        <tr key={idx} className="border-b border-border last:border-0">
                          <td className="py-2 px-2 text-foreground">{month.month}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {month.temperature_2m_mean.toFixed(1)}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {month.precipitation_sum.toFixed(1)}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {month.sunshine_duration.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Right Map Area */}
      <div className="flex-1 relative">
        <div
          ref={mapRef}
          className="absolute inset-0 w-full h-full bg-muted"
          style={{ zIndex: 0 }}
        />
        {!analysisData && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-card/90 backdrop-blur-sm p-6 rounded-lg shadow-lg text-center">
              <MapPin className="h-12 w-12 mx-auto mb-3 text-primary" />
              <p className="text-muted-foreground">
                Enter a postcode to view the map
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolarAnalysis;
