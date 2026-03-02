import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useApp } from "@/app/contexts/app-context";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Type,
  ArrowRight,
  Clock,
  Building2,
} from "lucide-react";

// NYU Locations organized by area
const nyuLocations = [
  { value: "washington-square", label: "Washington Square Campus", area: "Greenwich Village" },
  { value: "kimmel-center", label: "Kimmel Center", area: "Greenwich Village" },
  { value: "bobst-library", label: "Bobst Library", area: "Greenwich Village" },
  { value: "stern-school", label: "Stern School of Business", area: "Greenwich Village" },
  { value: "tisch-school", label: "Tisch School of the Arts", area: "Greenwich Village" },
  { value: "tandon-school", label: "Tandon School of Engineering", area: "Downtown Brooklyn" },
  { value: "brooklyn-campus", label: "Brooklyn Campus", area: "Downtown Brooklyn" },
];

// Manhattan neighborhoods
const manhattanAreas = [
  { value: "greenwich-village", label: "Greenwich Village" },
  { value: "east-village", label: "East Village" },
  { value: "soho", label: "SoHo" },
  { value: "lower-east-side", label: "Lower East Side" },
  { value: "chinatown", label: "Chinatown" },
  { value: "tribeca", label: "Tribeca" },
  { value: "chelsea", label: "Chelsea" },
  { value: "midtown", label: "Midtown" },
  { value: "upper-east-side", label: "Upper East Side" },
  { value: "upper-west-side", label: "Upper West Side" },
  { value: "harlem", label: "Harlem" },
];

// Brooklyn neighborhoods
const brooklynAreas = [
  { value: "downtown-brooklyn", label: "Downtown Brooklyn" },
  { value: "dumbo", label: "DUMBO" },
  { value: "williamsburg", label: "Williamsburg" },
  { value: "park-slope", label: "Park Slope" },
  { value: "brooklyn-heights", label: "Brooklyn Heights" },
  { value: "bushwick", label: "Bushwick" },
  { value: "prospect-heights", label: "Prospect Heights" },
];

// Queens neighborhoods
const queensAreas = [
  { value: "astoria", label: "Astoria" },
  { value: "long-island-city", label: "Long Island City" },
  { value: "flushing", label: "Flushing" },
  { value: "jackson-heights", label: "Jackson Heights" },
  { value: "forest-hills", label: "Forest Hills" },
];

// Bronx neighborhoods
const bronxAreas = [
  { value: "fordham", label: "Fordham" },
  { value: "arthur-avenue", label: "Arthur Avenue" },
  { value: "yankee-stadium", label: "Yankee Stadium Area" },
];

export function PlanEventPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const {
    groups,
    createSwipeEvent,
    setCurrentGroup,
    setCurrentSwipeEvent,
  } = useApp();

  const group = groups.find((g) => g.id === groupId);

  // Form State
  const [eventName, setEventName] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0],
  ); // Default to today
  const [time, setTime] = useState("19:00"); // Default to 7 PM
  const [locationType, setLocationType] = useState<"nyu" | "neighborhood">("nyu");
  const [nyuLocation, setNyuLocation] = useState("washington-square");
  const [borough, setBorough] = useState("manhattan");
  const [neighborhood, setNeighborhood] = useState("greenwich-village");

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Group not found</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build location string
    let locationString = "";
    if (locationType === "nyu") {
      const selectedNYU = nyuLocations.find(l => l.value === nyuLocation);
      locationString = selectedNYU?.label || "";
    } else {
      const selectedNeighborhood = 
        borough === "manhattan" ? manhattanAreas.find(a => a.value === neighborhood) :
        borough === "brooklyn" ? brooklynAreas.find(a => a.value === neighborhood) :
        borough === "queens" ? queensAreas.find(a => a.value === neighborhood) :
        bronxAreas.find(a => a.value === neighborhood);
      locationString = selectedNeighborhood?.label || "";
    }

    const finalName = eventName || `Dining Plan - ${locationString}`;
    const newEvent = createSwipeEvent(group.id, finalName);

    setCurrentGroup(group);
    setCurrentSwipeEvent(newEvent);
    navigate(`/swipe/${newEvent.id}`);
  };

  // Get appropriate neighborhood options based on selected borough
  const getNeighborhoodOptions = () => {
    switch (borough) {
      case "manhattan":
        return manhattanAreas;
      case "brooklyn":
        return brooklynAreas;
      case "queens":
        return queensAreas;
      case "bronx":
        return bronxAreas;
      default:
        return manhattanAreas;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/group/${group.id}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Plan Reservation
            </h1>
            <p className="text-sm text-muted-foreground">
              For {group.name}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 text-white rounded-t-xl pb-6">
            <CardTitle className="text-xl">Session Details</CardTitle>
            <CardDescription className="text-purple-50 pt-1">
              Set the details for your group dining session
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Event Name Input */}
              <div className="space-y-2">
                <Label htmlFor="event-name" className="text-base flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-600" />
                  Plan Name
                </Label>
                <Input
                  id="event-name"
                  type="text"
                  placeholder="e.g. Friday Night Dinner"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Date and Time Row */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Date Input */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                {/* Time Input */}
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    Time
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              </div>

              {/* Location Type Toggle */}
              <div className="space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  Location Preference
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={locationType === "nyu" ? "default" : "outline"}
                    className={locationType === "nyu" ? "bg-purple-600 hover:bg-purple-700" : ""}
                    onClick={() => setLocationType("nyu")}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    NYU Campus
                  </Button>
                  <Button
                    type="button"
                    variant={locationType === "neighborhood" ? "default" : "outline"}
                    className={locationType === "neighborhood" ? "bg-purple-600 hover:bg-purple-700" : ""}
                    onClick={() => setLocationType("neighborhood")}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Neighborhood
                  </Button>
                </div>
              </div>

              {/* NYU Location Select */}
              {locationType === "nyu" && (
                <div className="space-y-2">
                  <Label htmlFor="nyu-location" className="text-sm">
                    Select NYU Location
                  </Label>
                  <Select value={nyuLocation} onValueChange={setNyuLocation}>
                    <SelectTrigger id="nyu-location" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nyuLocations.map((loc) => (
                        <SelectItem key={loc.value} value={loc.value}>
                          <div className="flex flex-col">
                            <span>{loc.label}</span>
                            <span className="text-xs text-muted-foreground">{loc.area}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Neighborhood Select */}
              {locationType === "neighborhood" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="borough" className="text-sm">
                      Borough
                    </Label>
                    <Select value={borough} onValueChange={(val) => {
                      setBorough(val);
                      // Reset neighborhood when borough changes
                      if (val === "manhattan") setNeighborhood("greenwich-village");
                      else if (val === "brooklyn") setNeighborhood("downtown-brooklyn");
                      else if (val === "queens") setNeighborhood("astoria");
                      else if (val === "bronx") setNeighborhood("fordham");
                    }}>
                      <SelectTrigger id="borough" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manhattan">Manhattan</SelectItem>
                        <SelectItem value="brooklyn">Brooklyn</SelectItem>
                        <SelectItem value="queens">Queens</SelectItem>
                        <SelectItem value="bronx">Bronx</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neighborhood" className="text-sm">
                      Neighborhood
                    </Label>
                    <Select value={neighborhood} onValueChange={setNeighborhood}>
                      <SelectTrigger id="neighborhood" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getNeighborhoodOptions().map((area) => (
                          <SelectItem key={area.value} value={area.value}>
                            {area.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/group/${group.id}`)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  Start Swiping
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}