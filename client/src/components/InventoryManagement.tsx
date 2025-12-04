import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Search, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Vehicle {
  id: number;
  dealershipId: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  odometer?: number;
  imageUrl?: string;
  type?: string;
  status?: string;
  vin?: string;
  stockNumber?: string;
  createdAt?: string;
}

interface Dealership {
  id: number;
  name: string;
  slug: string;
}

interface InventoryManagementProps {
  dealershipId?: number;
  showDealershipSelector?: boolean;
  dealerships?: Dealership[];
  onDealershipChange?: (dealershipId: number) => void;
}

export function InventoryManagement({ 
  dealershipId, 
  showDealershipSelector = false,
  dealerships = [],
  onDealershipChange
}: InventoryManagementProps) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDealership, setSelectedDealership] = useState<number | undefined>(dealershipId);

  const fetchVehicles = async (dealerId?: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
      };
      
      if (dealerId) {
        headers["X-Dealership-Id"] = dealerId.toString();
      }
      
      const response = await fetch("/api/vehicles", { headers });
      
      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : data.data || []);
      } else {
        throw new Error("Failed to fetch vehicles");
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles(selectedDealership);
  }, [selectedDealership]);

  const handleDealershipChange = (value: string) => {
    const dealerId = parseInt(value);
    setSelectedDealership(dealerId);
    onDealershipChange?.(dealerId);
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const searchLower = searchTerm.toLowerCase();
    return (
      vehicle.make?.toLowerCase().includes(searchLower) ||
      vehicle.model?.toLowerCase().includes(searchLower) ||
      vehicle.year?.toString().includes(searchTerm) ||
      vehicle.vin?.toLowerCase().includes(searchLower) ||
      vehicle.stockNumber?.toLowerCase().includes(searchLower)
    );
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatOdometer = (odometer?: number) => {
    if (!odometer) return "N/A";
    return `${odometer.toLocaleString()} km`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Inventory Management
            </CardTitle>
            <CardDescription>
              View and manage vehicle inventory ({filteredVehicles.length} vehicles)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchVehicles(selectedDealership)}
              disabled={isLoading}
              data-testid="button-refresh-inventory"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {showDealershipSelector && dealerships.length > 0 && (
            <Select
              value={selectedDealership?.toString() || ""}
              onValueChange={handleDealershipChange}
            >
              <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-dealership">
                <SelectValue placeholder="Select Dealership" />
              </SelectTrigger>
              <SelectContent>
                {dealerships.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by make, model, year, VIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-inventory"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No vehicles found</p>
            <p className="text-sm mt-2">
              {searchTerm ? "Try adjusting your search" : "Run a scrape to populate inventory"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Image</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Stock #</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.slice(0, 50).map((vehicle) => (
                  <TableRow key={vehicle.id} data-testid={`row-vehicle-${vehicle.id}`}>
                    <TableCell>
                      {vehicle.imageUrl ? (
                        <img
                          src={vehicle.imageUrl}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="w-20 h-14 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-14 bg-muted rounded flex items-center justify-center">
                          <Car className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                      {vehicle.trim && (
                        <div className="text-sm text-muted-foreground">{vehicle.trim}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {vehicle.stockNumber || "N/A"}
                      </code>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPrice(vehicle.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatOdometer(vehicle.odometer)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vehicle.type || "Used"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/vehicle/${vehicle.id}`}>
                        <Button variant="ghost" size="sm" data-testid={`button-view-vehicle-${vehicle.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredVehicles.length > 50 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Showing first 50 of {filteredVehicles.length} vehicles
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
