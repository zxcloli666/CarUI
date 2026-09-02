

use std::f64::consts::PI;

const EARTH_RADIUS_M: f64 = 6_371_000.0;
const EARTH_RADIUS_KM: f64 = 6_371.0;


pub fn haversine_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();

    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlon / 2.0).sin().powi(2);

    EARTH_RADIUS_M * 2.0 * a.sqrt().atan2((1.0 - a).sqrt())
}


pub fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    haversine_m(lat1, lon1, lat2, lon2) / 1000.0
}


pub fn bearing(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let lat1 = lat1.to_radians();
    let lat2 = lat2.to_radians();
    let dlon = (lon2 - lon1).to_radians();

    let x = dlon.sin() * lat2.cos();
    let y = lat1.cos() * lat2.sin() - lat1.sin() * lat2.cos() * dlon.cos();

    (x.atan2(y).to_degrees() + 360.0) % 360.0
}


pub fn destination_point(lat: f64, lon: f64, bearing_deg: f32, dist_km: f64) -> (f64, f64) {
    let d = dist_km / EARTH_RADIUS_KM;
    let brng = (bearing_deg as f64).to_radians();
    let lat1 = lat.to_radians();
    let lon1 = lon.to_radians();

    let lat2 = (lat1.sin() * d.cos() + lat1.cos() * d.sin() * brng.cos()).asin();
    let lon2 = lon1 + (brng.sin() * d.sin() * lat1.cos()).atan2(d.cos() - lat1.sin() * lat2.sin());

    (lat2.to_degrees(), lon2.to_degrees())
}


pub fn angle_diff(a: f64, b: f64) -> f64 {
    let d = (a - b).abs();
    if d > 180.0 {
        360.0 - d
    } else {
        d
    }
}


pub fn point_to_segment_distance(
    lat: f64,
    lon: f64,
    seg_lat1: f64,
    seg_lon1: f64,
    seg_lat2: f64,
    seg_lon2: f64,
) -> f64 {
    let (a, b) = (lat - seg_lat1, lon - seg_lon1);
    let (c, d) = (seg_lat2 - seg_lat1, seg_lon2 - seg_lon1);

    let dot = a * c + b * d;
    let len_sq = c * c + d * d;

    let t = if len_sq != 0.0 {
        (dot / len_sq).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let proj_lat = seg_lat1 + t * c;
    let proj_lon = seg_lon1 + t * d;

    haversine_m(lat, lon, proj_lat, proj_lon)
}


pub fn point_to_polyline_distance(lat: f64, lon: f64, polyline: &[(f64, f64)]) -> f64 {
    polyline
        .windows(2)
        .map(|w| point_to_segment_distance(lat, lon, w[0].0, w[0].1, w[1].0, w[1].1))
        .fold(f64::MAX, f64::min)
}


pub fn polyline_azimuth(polyline: &[(f64, f64)]) -> f64 {
    if polyline.len() < 2 {
        return 0.0;
    }
    let first = polyline.first().unwrap();
    let last = polyline.last().unwrap();
    bearing(first.0, first.1, last.0, last.1)
}


pub fn lat_lon_to_tile(lat: f64, lon: f64, level: i32) -> (i32, i32) {
    let size = 180.0 / (1 << level) as f64;
    let x = ((lon + 180.0) / size) as i32;
    let y = ((lat + 90.0) / size) as i32;
    (x, y)
}


pub fn tile_size_deg(level: i32) -> f64 {
    180.0 / (1 << level) as f64
}


pub fn bounding_box(points: &[(f64, f64)]) -> Option<(f64, f64, f64, f64)> {
    if points.is_empty() {
        return None;
    }

    let mut min_lat = f64::MAX;
    let mut max_lat = f64::MIN;
    let mut min_lon = f64::MAX;
    let mut max_lon = f64::MIN;

    for &(lat, lon) in points {
        min_lat = min_lat.min(lat);
        max_lat = max_lat.max(lat);
        min_lon = min_lon.min(lon);
        max_lon = max_lon.max(lon);
    }

    Some((min_lat, max_lat, min_lon, max_lon))
}


#[inline]
pub fn deg_to_rad(deg: f64) -> f64 {
    deg * PI / 180.0
}


#[inline]
pub fn rad_to_deg(rad: f64) -> f64 {
    rad * 180.0 / PI
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_haversine() {
        
        let dist = haversine_km(55.7558, 37.6173, 59.9343, 30.3351);
        assert!((dist - 634.0).abs() < 10.0);
    }

    #[test]
    fn test_bearing() {
        
        let b = bearing(0.0, 0.0, 1.0, 0.0);
        assert!((b - 0.0).abs() < 1.0);

        
        let b = bearing(0.0, 0.0, 0.0, 1.0);
        assert!((b - 90.0).abs() < 1.0);
    }

    #[test]
    fn test_angle_diff() {
        assert!((angle_diff(10.0, 350.0) - 20.0).abs() < 0.001);
        assert!((angle_diff(0.0, 180.0) - 180.0).abs() < 0.001);
    }
}
