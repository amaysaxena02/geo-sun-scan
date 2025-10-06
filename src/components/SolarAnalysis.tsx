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
    setStatus("Geocoding postcode...");
    setAnalysisData(null);

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`;
      
      setStatus("Fetching location data...");
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postcode })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      setStatus("Analyzing obstacles and weather...");
      const data: AnalysisData = await response.json();
      
      setAnalysisData(data);
      updateMap(data);
      setStatus(`Analysis complete for ${postcode}`);
      toast.success("Location analyzed successfully!");
      setLoading(false);

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Error: ${errorMessage}`);
      toast.error(`Failed to analyze location: ${errorMessage}`);
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
