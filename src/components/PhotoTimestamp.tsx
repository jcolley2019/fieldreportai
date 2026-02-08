import { MapPin, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/dateFormat';

interface PhotoTimestampProps {
  latitude?: number;
  longitude?: number;
  capturedAt?: Date | string;
  locationName?: string;
  variant?: 'overlay' | 'inline';
  className?: string;
}

export const PhotoTimestamp = ({
  latitude,
  longitude,
  capturedAt,
  locationName,
  variant = 'overlay',
  className = ''
}: PhotoTimestampProps) => {
  const hasLocation = latitude !== undefined && longitude !== undefined;
  const hasTimestamp = capturedAt !== undefined;

  if (!hasLocation && !hasTimestamp) {
    return null;
  }

  const formattedDate = hasTimestamp 
    ? formatDateTime(capturedAt)
    : null;

  const formatCoordinates = (lat: number, lon: number) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(5)}°${latDir}, ${Math.abs(lon).toFixed(5)}°${lonDir}`;
  };

  if (variant === 'overlay') {
    return (
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 text-white text-xs ${className}`}>
        {hasTimestamp && formattedDate && (
          <div className="flex items-center gap-1 mb-0.5">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{formattedDate}</span>
          </div>
        )}
        {hasLocation && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {locationName || formatCoordinates(latitude!, longitude!)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Inline variant for reports
  return (
    <div className={`text-xs text-muted-foreground space-y-0.5 ${className}`}>
      {hasTimestamp && formattedDate && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>{formattedDate}</span>
        </div>
      )}
      {hasLocation && (
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span>
            {locationName || formatCoordinates(latitude!, longitude!)}
          </span>
        </div>
      )}
    </div>
  );
};
