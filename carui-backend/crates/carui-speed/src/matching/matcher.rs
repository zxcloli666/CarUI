





use std::collections::HashSet;
use carui_common::geo::{
    angle_diff, point_to_polyline_distance, point_to_segment_distance,
    haversine_m, bearing as geo_bearing, destination_point,
};
use carui_common::{SpeedInfo, SpeedChange};

use crate::db::RoadSegment;
use crate::matching::RTreeIndex;



fn highway_class(hw_type: &str) -> i32 {
    match hw_type {
        "motorway" | "motorway_link" => 6,
        "trunk" | "trunk_link" => 5,
        "primary" | "primary_link" => 4,
        "secondary" | "secondary_link" => 3,
        "tertiary" | "tertiary_link" => 2,
        "residential" | "unclassified" => 1,
        "living_street" => 0,
        _ => 1,
    }
}


fn is_link_road(hw_type: &str) -> bool {
    hw_type.ends_with("_link")
}



struct MatchContext {
    prev_osm_id: Option<i64>,
    prev_name: Option<String>,
    prev_speed: Option<i32>,
    prev_class: Option<i32>,
    prev_hw_type: Option<String>,
}



struct FutureInfo {
    limit: i32,
    distance: i32,
}





pub struct MapMatcher {
    last_osm_id: Option<i64>,
    last_valid_speed: Option<i32>,
    last_name: Option<String>,
    last_hw_type: Option<String>,
}

impl MapMatcher {
    pub fn new() -> Self {
        Self {
            last_osm_id: None,
            last_valid_speed: None,
            last_name: None,
            last_hw_type: None,
        }
    }

    pub fn match_position(
        &mut self,
        lat: f64,
        lon: f64,
        bearing: f32,
        rtree: &RTreeIndex,
    ) -> SpeedInfo {
        
        let prev_class = self.last_hw_type.as_deref().map(highway_class);
        let ctx = MatchContext {
            prev_osm_id: self.last_osm_id,
            prev_name: self.last_name.clone(),
            prev_speed: self.last_valid_speed,
            prev_class,
            prev_hw_type: self.last_hw_type.clone(),
        };

        let candidates = rtree.query_segments(lat, lon, 0.0004);
        let best_match = Self::find_best_segment(&ctx, candidates, lat, lon, bearing);

        let Some((current_seg, _)) = best_match else {
            return SpeedInfo { limit: 60, gps_source: String::new(), next_change: None };
        };

        self.last_osm_id = Some(current_seg.osm_id);
        self.last_name = current_seg.name.clone();
        self.last_hw_type = Some(current_seg.highway_type.clone());

        
        let current_limit = Self::resolve_speed(&current_seg, lat, lon, rtree);

        
        let future = self.scan_future(
            &current_seg, lat, lon, bearing, current_limit, rtree,
        );

        
        let prev_speed = self.last_valid_speed.unwrap_or(current_limit);
        let mut final_limit = current_limit;

        
        if let Some(ref fut) = future {
            if fut.distance < 200 && fut.limit < final_limit {
                final_limit = fut.limit;
            }
        }

        
        if current_limit > prev_speed {
            if let Some(ref fut) = future {
                if fut.limit < current_limit && fut.distance < 400 {
                    final_limit = prev_speed.min(fut.limit);
                }
            }
        }

        self.last_valid_speed = Some(final_limit);

        let next_change = future.and_then(|fut| {
            if fut.limit != final_limit {
                Some(SpeedChange {
                    distance_m: fut.distance,
                    current_limit: final_limit,
                    new_limit: fut.limit,
                })
            } else {
                None
            }
        });

        SpeedInfo {
            limit: final_limit,
            gps_source: String::new(),
            next_change,
        }
    }

    
    
    

    fn scan_future(
        &self,
        current_seg: &RoadSegment,
        lat: f64,
        lon: f64,
        bearing: f32,
        base_limit: i32,
        rtree: &RTreeIndex,
    ) -> Option<FutureInfo> {
        let max_dist = 2000.0;

        
        let road_brg = Self::road_bearing_near(&current_seg.polyline, lat, lon);
        let forward = angle_diff(bearing as f64, road_brg) < 90.0;

        
        let mut total_dist = Self::remaining_distance(&current_seg.polyline, lat, lon, forward);

        let mut visited = HashSet::new();
        visited.insert(current_seg.id);

        let mut prev_seg = current_seg.clone();
        let mut prev_forward = forward;

        let base_class = highway_class(&current_seg.highway_type);

        
        let mut changed_dist = 0.0;
        let mut first_change: Option<(i32, i32)> = None; 

        
        let mut junction_failed = false;
        for _ in 0..30 {
            if total_dist > max_dist { break; }

            
            let (exit_lat, exit_lon, exit_bearing) = match Self::exit_point_and_bearing(
                &prev_seg.polyline, prev_forward,
            ) {
                Some(v) => v,
                None => { junction_failed = true; break; }
            };

            
            let candidates = rtree.query_segments(exit_lat, exit_lon, 0.00035);
            let next = Self::find_junction_continuation(
                candidates, exit_lat, exit_lon, exit_bearing,
                &prev_seg, &visited, base_class,
            );

            match next {
                Some((next_seg, next_forward)) => {
                    
                    let seg_speed = Self::segment_road_speed(&next_seg);
                    let seg_class = highway_class(&next_seg.highway_type);
                    let seg_len = Self::polyline_length(&next_seg.polyline);
                    let class_drop = base_class - seg_class;

                    
                    
                    
                    if base_class >= 4 && seg_class <= 1 {
                        
                        junction_failed = true;
                        break;
                    }

                    
                    
                    if class_drop >= 3 && !is_link_road(&next_seg.highway_type) {
                        junction_failed = true;
                        break;
                    }

                    if seg_speed != base_limit {
                        changed_dist += seg_len;
                        if first_change.is_none() {
                            first_change = Some((total_dist as i32, seg_speed));
                        }

                        
                        
                        
                        
                        let threshold = if class_drop >= 3 {
                            600.0
                        } else if class_drop >= 2 {
                            400.0
                        } else {
                            150.0
                        };

                        if changed_dist >= threshold {
                            let (d, l) = first_change.unwrap();
                            return Some(FutureInfo { limit: l, distance: d });
                        }
                    } else {
                        changed_dist = 0.0;
                        first_change = None;
                    }

                    total_dist += seg_len;
                    visited.insert(next_seg.id);
                    prev_seg = next_seg;
                    prev_forward = next_forward;
                }
                None => {
                    junction_failed = true;
                    break;
                }
            }
        }

        
        
        if junction_failed || total_dist < max_dist {
            let (fb_lat, fb_lon, fb_bearing) = if junction_failed {
                
                Self::exit_point_and_bearing(&prev_seg.polyline, prev_forward)
                    .unwrap_or((lat, lon, bearing as f64))
            } else {
                Self::exit_point_and_bearing(&prev_seg.polyline, prev_forward)
                    .unwrap_or((lat, lon, bearing as f64))
            };

            let remaining = (max_dist - total_dist).min(1200.0);
            if remaining > 100.0 {
                let proj_result = self.projection_fallback(
                    fb_lat, fb_lon, fb_bearing as f32,
                    &prev_seg, base_limit, base_class, remaining, total_dist, rtree,
                );

                
                
                if proj_result.is_some() {
                    return proj_result;
                }

                
                
                if let Some((d, l)) = first_change {
                    
                    if changed_dist >= 100.0 {
                        return Some(FutureInfo { limit: l, distance: d });
                    }
                }
            }
        }

        None
    }

    
    
    
    fn find_junction_continuation(
        candidates: Vec<RoadSegment>,
        exit_lat: f64,
        exit_lon: f64,
        exit_bearing: f64,
        prev_seg: &RoadSegment,
        visited: &HashSet<i64>,
        base_class: i32,
    ) -> Option<(RoadSegment, bool)> {
        let prev_class = highway_class(&prev_seg.highway_type);
        let prev_name = prev_seg.name.as_deref();
        let prev_is_main = !is_link_road(&prev_seg.highway_type);

        candidates
            .into_iter()
            .filter_map(|seg| {
                if visited.contains(&seg.id) { return None; }
                if seg.polyline.len() < 2 { return None; }

                
                let first = seg.polyline[0];
                let last = *seg.polyline.last()?;
                let d_start = haversine_m(exit_lat, exit_lon, first.0, first.1);
                let d_end = haversine_m(exit_lat, exit_lon, last.0, last.1);

                
                if d_start > 40.0 && d_end > 40.0 { return None; }

                let forward = d_start < d_end;

                
                let entry_bearing = if forward {
                    geo_bearing(
                        seg.polyline[0].0, seg.polyline[0].1,
                        seg.polyline[1].0, seg.polyline[1].1,
                    )
                } else {
                    let l = seg.polyline.len();
                    let raw = geo_bearing(
                        seg.polyline[l - 2].0, seg.polyline[l - 2].1,
                        seg.polyline[l - 1].0, seg.polyline[l - 1].1,
                    );
                    (raw + 180.0) % 360.0
                };

                let angle = angle_diff(exit_bearing, entry_bearing);
                if angle > 90.0 { return None; }

                

                
                let mut score = 100.0 - angle;

                let seg_class = highway_class(&seg.highway_type);
                let class_diff = (prev_class - seg_class).abs();
                let seg_is_link = is_link_road(&seg.highway_type);

                
                
                if class_diff == 0 {
                    score += 60.0;
                    
                    if prev_is_main && !seg_is_link {
                        score += 20.0;
                    }
                } else if class_diff == 1 {
                    score += 25.0;
                } else if class_diff >= 2 {
                    
                    score -= (class_diff as f64 - 1.0) * 15.0;
                }

                
                
                if prev_is_main && seg_is_link && prev_class > seg_class {
                    score -= 30.0;
                }

                
                
                if base_class >= 5 && seg_class <= 2 {
                    score -= 40.0;
                }

                
                if let (Some(a), Some(b)) = (prev_name, seg.name.as_deref()) {
                    if a == b {
                        score += 50.0;
                    }
                }

                
                if prev_seg.osm_id == seg.osm_id {
                    score += 80.0;
                }

                
                score += seg_class as f64 * 5.0;

                Some((seg, forward, score))
            })
            .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap())
            .map(|(seg, fwd, _)| (seg, fwd))
    }

    
    
    fn projection_fallback(
        &self,
        start_lat: f64,
        start_lon: f64,
        bearing: f32,
        last_seg: &RoadSegment,
        base_limit: i32,
        base_class: i32,
        max_remaining: f64,
        distance_offset: f64,
        rtree: &RTreeIndex,
    ) -> Option<FutureInfo> {
        let step = 100.0;
        let steps = (max_remaining / step) as usize;

        let mut lat = start_lat;
        let mut lon = start_lon;
        let mut brg = bearing;
        let mut route_osm_id: Option<i64> = Some(last_seg.osm_id);
        let mut route_name: Option<String> = last_seg.name.clone();

        let mut changed_dist = 0.0;
        let mut first_change: Option<(i32, i32)> = None;

        for i in 1..=steps {
            let (nlat, nlon) = destination_point(lat, lon, brg, step / 1000.0);
            lat = nlat;
            lon = nlon;
            let dist = distance_offset + step * i as f64;

            let ctx = MatchContext {
                prev_osm_id: route_osm_id,
                prev_name: route_name.clone(),
                prev_speed: Some(base_limit),
                prev_class: Some(base_class),
                prev_hw_type: last_seg.highway_type.clone().into(),
            };

            let candidates = rtree.query_segments(lat, lon, 0.0004);
            let best = Self::find_best_segment(&ctx, candidates, lat, lon, brg);

            if let Some((seg, _)) = best {
                
                let speed = Self::segment_road_speed(&seg);
                let seg_class = highway_class(&seg.highway_type);
                let class_drop = base_class - seg_class;

                
                if base_class >= 4 && seg_class <= 1 {
                    
                    
                    continue;
                }

                if class_drop >= 3 && !is_link_road(&seg.highway_type) {
                    
                    continue;
                }

                
                let is_plausible = route_osm_id == Some(seg.osm_id)
                    || (route_name.is_some() && route_name == seg.name)
                    || class_drop <= 1;

                if is_plausible {
                    let rbrg = Self::road_bearing_near(&seg.polyline, lat, lon);
                    if angle_diff(brg as f64, rbrg) < 90.0 {
                        brg = rbrg as f32;
                    } else {
                        brg = ((rbrg + 180.0) % 360.0) as f32;
                    }
                }

                route_osm_id = Some(seg.osm_id);
                route_name = seg.name.clone();

                if speed != base_limit {
                    changed_dist += step;
                    if first_change.is_none() {
                        first_change = Some((dist as i32, speed));
                    }

                    
                    let threshold = if class_drop >= 3 {
                        600.0
                    } else if class_drop >= 2 {
                        400.0
                    } else {
                        150.0
                    };

                    if changed_dist >= threshold {
                        let (d, l) = first_change.unwrap();
                        return Some(FutureInfo { limit: l, distance: d });
                    }
                } else {
                    changed_dist = 0.0;
                    first_change = None;
                }
            } else {
                route_osm_id = None;
                route_name = None;
                changed_dist = 0.0;
                first_change = None;
            }
        }

        None
    }

    
    
    

    
    
    fn find_best_segment(
        ctx: &MatchContext,
        candidates: Vec<RoadSegment>,
        lat: f64,
        lon: f64,
        bearing: f32,
    ) -> Option<(RoadSegment, f64)> {
        candidates
            .into_iter()
            .filter_map(|seg| {
                if seg.polyline.len() < 2 { return None; }

                let dist = point_to_polyline_distance(lat, lon, &seg.polyline);
                if dist > 40.0 { return None; }

                let az = Self::road_bearing_near(&seg.polyline, lat, lon);
                let diff = angle_diff(bearing as f64, az);
                let rev_diff = angle_diff(bearing as f64, (az + 180.0) % 360.0);
                let best_angle = diff.min(rev_diff);
                if best_angle > 45.0 { return None; }

                let mut score = -dist * 5.0;
                score -= best_angle;

                let seg_class = highway_class(&seg.highway_type);
                let seg_is_link = is_link_road(&seg.highway_type);

                
                if let Some(prev_id) = ctx.prev_osm_id {
                    if prev_id == seg.osm_id {
                        score += 70.0;
                    }
                }

                
                if let (Some(ref pn), Some(ref sn)) = (&ctx.prev_name, &seg.name) {
                    if pn == sn {
                        score += 30.0;
                    }
                }

                
                
                score += seg_class as f64 * 8.0;

                
                if let Some(prev_class) = ctx.prev_class {
                    let class_diff = (prev_class - seg_class).abs();
                    if class_diff == 0 {
                        score += 20.0;
                    } else if class_diff >= 2 {
                        score -= class_diff as f64 * 8.0;
                    }

                    
                    if let Some(ref prev_hw) = ctx.prev_hw_type {
                        let prev_is_main = !is_link_road(prev_hw);
                        if prev_is_main && seg_is_link && prev_class > seg_class {
                            score -= 20.0;
                        }
                    }
                }

                
                if let Some(prev_speed) = ctx.prev_speed {
                    let seg_speed = if seg.maxspeed <= 0 { 60 } else { seg.maxspeed };
                    let speed_diff = (prev_speed - seg_speed).abs();
                    score += (20.0 - speed_diff as f64 / 3.0).max(0.0);
                }

                Some((seg, score))
            })
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
    }

    
    
    

    
    
    fn resolve_speed(segment: &RoadSegment, lat: f64, lon: f64, rtree: &RTreeIndex) -> i32 {
        let road = if segment.maxspeed <= 0 { 60 } else { segment.maxspeed };

        
        let radius_deg = 30.0 / 111_139.0;
        let cameras = rtree.query_cameras(lat, lon, radius_deg);

        let cam = cameras
            .iter()
            .filter_map(|c| {
                let cam_speed = c.maxspeed?; 
                
                let d = haversine_m(lat, lon, c.lat, c.lon);
                if d <= 30.0 {
                    Some(cam_speed)
                } else {
                    None
                }
            })
            .min();

        match cam {
            Some(c) => road.min(c),
            None => road,
        }
    }

    
    
    fn segment_road_speed(seg: &RoadSegment) -> i32 {
        if seg.maxspeed <= 0 { 60 } else { seg.maxspeed }
    }

    
    
    

    fn road_bearing_near(poly: &[(f64, f64)], lat: f64, lon: f64) -> f64 {
        if poly.len() < 2 { return 0.0; }
        let mut min_dist = f64::MAX;
        let mut best_idx = 0;
        for i in 0..poly.len() - 1 {
            let d = point_to_segment_distance(
                lat, lon, poly[i].0, poly[i].1, poly[i + 1].0, poly[i + 1].1,
            );
            if d < min_dist {
                min_dist = d;
                best_idx = i;
            }
        }
        geo_bearing(
            poly[best_idx].0, poly[best_idx].1,
            poly[best_idx + 1].0, poly[best_idx + 1].1,
        )
    }

    fn polyline_length(poly: &[(f64, f64)]) -> f64 {
        poly.windows(2)
            .map(|w| haversine_m(w[0].0, w[0].1, w[1].0, w[1].1))
            .sum()
    }

    fn remaining_distance(poly: &[(f64, f64)], lat: f64, lon: f64, forward: bool) -> f64 {
        let mut min_d = f64::MAX;
        let mut idx = 0;
        for (i, p) in poly.iter().enumerate() {
            let d = haversine_m(lat, lon, p.0, p.1);
            if d < min_d { min_d = d; idx = i; }
        }

        let total = Self::polyline_length(poly);
        let mut dist_from_start = 0.0;
        for i in 0..idx {
            if i + 1 < poly.len() {
                dist_from_start += haversine_m(
                    poly[i].0, poly[i].1, poly[i + 1].0, poly[i + 1].1,
                );
            }
        }

        if forward {
            (total - dist_from_start).max(0.0)
        } else {
            dist_from_start
        }
    }

    fn exit_point_and_bearing(poly: &[(f64, f64)], forward: bool) -> Option<(f64, f64, f64)> {
        if poly.len() < 2 { return None; }
        let l = poly.len();

        if forward {
            let (lat, lon) = poly[l - 1];
            let brg = geo_bearing(poly[l - 2].0, poly[l - 2].1, lat, lon);
            Some((lat, lon, brg))
        } else {
            let (lat, lon) = poly[0];
            let brg = (geo_bearing(poly[0].0, poly[0].1, poly[1].0, poly[1].1) + 180.0) % 360.0;
            Some((lat, lon, brg))
        }
    }
}