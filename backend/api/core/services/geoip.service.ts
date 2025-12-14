import geoip from 'geoip-lite';
import haversine from 'haversine';

export interface GeoLocation {
    country: string;
    city: string;
    latitude: number;
    longitude: number;
}

export class GeoIPService {
    static lookup(ip: string): GeoLocation | null {
        // geoip-lite works best with public IPs. Localhost or private IPs return null.
        const geo = geoip.lookup(ip);
        if (!geo) return null;
        
        return {
            country: geo.country,
            city: geo.city,
            latitude: geo.ll[0],
            longitude: geo.ll[1]
        };
    }

    /**
     * Calculate distance between two points in miles
     */
    static calculateDistance(start: {latitude: number, longitude: number}, end: {latitude: number, longitude: number}): number {
        return haversine(start, end, {unit: 'mile'});
    }

    /**
     * Calculate speed in mph between two points given a time difference
     */
    static calculateSpeed(distanceMiles: number, timeDiffHours: number): number {
        if (timeDiffHours <= 0) return distanceMiles > 0 ? Infinity : 0;
        return distanceMiles / timeDiffHours;
    }
}
