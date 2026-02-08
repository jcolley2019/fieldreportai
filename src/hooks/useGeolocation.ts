import { useState, useCallback } from 'react';

interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  locationName?: string;
}

interface UseGeolocationReturn {
  getCurrentPosition: () => Promise<GeolocationData | null>;
  isLoading: boolean;
  error: string | null;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback(async (): Promise<GeolocationData | null> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // Cache for 1 minute
        });
      });

      const data: GeolocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp)
      };

      // Try to get location name via reverse geocoding (optional)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.latitude}&lon=${data.longitude}&zoom=18`
        );
        if (response.ok) {
          const geocodeData = await response.json();
          if (geocodeData.display_name) {
            // Get a shorter location name
            const parts = geocodeData.display_name.split(',');
            data.locationName = parts.slice(0, 3).join(',').trim();
          }
        }
      } catch (geocodeError) {
        // Silently fail - location name is optional
        console.warn('Reverse geocoding failed:', geocodeError);
      }

      setIsLoading(false);
      return data;
    } catch (err: any) {
      let errorMessage = 'Failed to get location';
      if (err.code === 1) {
        errorMessage = 'Location permission denied';
      } else if (err.code === 2) {
        errorMessage = 'Location unavailable';
      } else if (err.code === 3) {
        errorMessage = 'Location request timed out';
      }
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { getCurrentPosition, isLoading, error };
};
