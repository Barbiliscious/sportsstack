import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, MapPin, Calendar, AlertCircle, Save, User, Hash } from "lucide-react";
import type { PlayerProfile, EmergencyContact } from "@/lib/mockData";

interface PersonalDetailsSectionProps {
  profile: PlayerProfile;
  isEditing: boolean;
  formData: {
    name: string;
    phone: string;
    suburb: string;
    dateOfBirth: string;
    gender: string;
    hockeyVicNumber: string;
    emergencyContact: EmergencyContact;
  };
  onFormChange: (data: Partial<PersonalDetailsSectionProps["formData"]>) => void;
  onEditToggle: () => void;
}

export const PersonalDetailsSection = ({
  profile,
  isEditing,
  formData,
  onFormChange,
  onEditToggle,
}: PersonalDetailsSectionProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Personal Details</CardTitle>
        <Button
          variant={isEditing ? "default" : "outline"}
          size="sm"
          onClick={onEditToggle}
        >
          {isEditing ? (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          ) : (
            "Edit"
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          {isEditing ? (
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
            />
          ) : (
            <p className="text-foreground py-2">{formData.name}</p>
          )}
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label>Email</Label>
          <div className="flex items-center gap-2 py-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <p className="text-foreground">{profile.email}</p>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          {isEditing ? (
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => onFormChange({ phone: e.target.value })}
              placeholder="0400 000 000"
            />
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">{formData.phone || "Not set"}</p>
            </div>
          )}
        </div>

        {/* Suburb/Address */}
        <div className="space-y-2">
          <Label htmlFor="suburb">Suburb/Address</Label>
          {isEditing ? (
            <Textarea
              id="suburb"
              value={formData.suburb}
              onChange={(e) => onFormChange({ suburb: e.target.value })}
              placeholder="Enter your full address"
              rows={3}
            />
          ) : (
            <div className="flex items-center gap-2 py-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">{formData.suburb || "Not set"}</p>
            </div>
          )}
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth</Label>
          {isEditing ? (
            <Input
              id="dob"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => onFormChange({ dateOfBirth: e.target.value })}
            />
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">
                {formData.dateOfBirth
                  ? new Date(formData.dateOfBirth).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Not set"}
              </p>
            </div>
          )}
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label>Gender</Label>
          {isEditing ? (
            <Select
              value={formData.gender}
              onValueChange={(v) => onFormChange({ gender: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">{formData.gender || "Not set"}</p>
            </div>
          )}
        </div>

        {/* Hockey Victoria Number */}
        <div className="space-y-2">
          <Label htmlFor="hv-number">Hockey Victoria Number</Label>
          {isEditing ? (
            <Input
              id="hv-number"
              value={formData.hockeyVicNumber}
              onChange={(e) => onFormChange({ hockeyVicNumber: e.target.value })}
              placeholder="e.g. HV12345"
            />
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">{formData.hockeyVicNumber || "Not set"}</p>
            </div>
          )}
        </div>

        {/* Emergency Contact */}
        <div className="space-y-3 pt-2">
          <Label className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Emergency Contact
          </Label>
          {isEditing ? (
            <div className="space-y-3 pl-6">
              <div className="space-y-1">
                <Label htmlFor="ec-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="ec-name"
                  value={formData.emergencyContact.name}
                  onChange={(e) =>
                    onFormChange({
                      emergencyContact: { ...formData.emergencyContact, name: e.target.value },
                    })
                  }
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-phone" className="text-xs text-muted-foreground">
                  Phone
                </Label>
                <Input
                  id="ec-phone"
                  value={formData.emergencyContact.phone}
                  onChange={(e) =>
                    onFormChange({
                      emergencyContact: { ...formData.emergencyContact, phone: e.target.value },
                    })
                  }
                  placeholder="Contact phone"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-relationship" className="text-xs text-muted-foreground">
                  Relationship
                </Label>
                <Input
                  id="ec-relationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) =>
                    onFormChange({
                      emergencyContact: {
                        ...formData.emergencyContact,
                        relationship: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Spouse, Parent"
                />
              </div>
            </div>
          ) : (
            <div className="pl-6 space-y-1">
              <p className="text-foreground font-medium">
                {formData.emergencyContact.name || "Not set"}
              </p>
              {formData.emergencyContact.phone && (
                <p className="text-sm text-muted-foreground">
                  {formData.emergencyContact.phone} • {formData.emergencyContact.relationship}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
