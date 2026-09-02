

use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use crate::db::{RoadSegment, Camera};

pub struct OverpassClient {
    http: Client,
    url: String,
}


struct RawRoad {
    osm_id: i64,
    tags: HashMap<String, String>,
    highway_type: String,
    name: Option<String>,
    polyline: Vec<(f64, f64)>,
}

impl OverpassClient {
    pub fn new(url: String) -> Self {
        Self {
            http: Client::new(),
            url,
        }
    }

    
    pub async fn fetch_data(&self, lat: f64, lon: f64, radius: i32) -> anyhow::Result<(Vec<RoadSegment>, Vec<Camera>)> {
        
        let query = format!(
            r#"[out:json][timeout:20];
            (
              way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street)$"](around:{0}, {1}, {2});
              node["highway"="speed_camera"](around:{0}, {1}, {2});
            );
            out geom tags;"#,
            radius, lat, lon
        );

        let params = [("data", query)];
        let resp: Value = self.http
            .get(&self.url)
            .query(&params)
            .send()
            .await?
            .json()
            .await?;

        let elements = resp.get("elements")
            .and_then(|e| e.as_array())
            .ok_or_else(|| anyhow::anyhow!("Invalid Overpass response: missing elements"))?;

        
        let mut raw_roads = Vec::new();
        let mut cameras = Vec::new();

        for el in elements {
            let el_type = el.get("type").and_then(|v| v.as_str()).unwrap_or("");

            if el_type == "way" {
                if let (Some(id), Some(geometry)) = (
                    el.get("id").and_then(|v| v.as_i64()),
                    el.get("geometry").and_then(|v| v.as_array()),
                ) {
                    let tags: HashMap<String, String> = el.get("tags")
                        .and_then(|t| t.as_object())
                        .map(|obj| {
                            obj.iter()
                                .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    let polyline: Vec<(f64, f64)> = geometry.iter()
                        .filter_map(|p| {
                            let lat = p.get("lat")?.as_f64()?;
                            let lon = p.get("lon")?.as_f64()?;
                            Some((lat, lon))
                        })
                        .collect();

                    if polyline.len() < 2 { continue; }

                    let highway_type = tags.get("highway").cloned().unwrap_or_else(|| "unknown".into());
                    let name = tags.get("name").cloned();

                    raw_roads.push(RawRoad {
                        osm_id: id,
                        tags,
                        highway_type,
                        name,
                        polyline,
                    });
                }
            } else if el_type == "node" {
                if let (Some(id), Some(lat), Some(lon)) = (
                    el.get("id").and_then(|v| v.as_i64()),
                    el.get("lat").and_then(|v| v.as_f64()),
                    el.get("lon").and_then(|v| v.as_f64()),
                ) {
                    let tags = el.get("tags").and_then(|t| t.as_object());
                    let maxspeed = tags
                        .and_then(|t| t.get("maxspeed"))
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<i32>().ok());

                    cameras.push(Camera {
                        osm_id: id,
                        lat,
                        lon,
                        maxspeed,
                    });
                }
            }
        }

        
        
        let urban_road_count = raw_roads.iter()
            .filter(|r| matches!(r.highway_type.as_str(), "residential" | "living_street"))
            .count();
        let has_urban_context = urban_road_count >= 3;

        
        let segments = raw_roads.into_iter()
            .map(|raw| {
                let maxspeed = self.resolve_maxspeed(&raw.tags, &raw.highway_type, has_urban_context);
                RoadSegment {
                    id: 0,
                    osm_id: raw.osm_id,
                    maxspeed,
                    highway_type: raw.highway_type,
                    name: raw.name,
                    polyline: raw.polyline,
                }
            })
            .collect();

        Ok((segments, cameras))
    }

    
    fn resolve_maxspeed(&self, tags: &HashMap<String, String>, highway: &str, urban_context: bool) -> i32 {
        
        if tags.get("junction") == Some(&"roundabout".to_string()) {
            if highway != "motorway" && highway != "trunk" { return 60; }
        }

        
        if let Some(val) = tags.get("maxspeed") {
            if let Ok(speed) = val.parse::<i32>() { return speed; }
            if val == "RU:urban" { return 60; }
            if val == "RU:rural" { return 90; }
            if val == "RU:motorway" { return 110; }
        }

        
        for key in ["zone:maxspeed", "source:maxspeed"] {
            if let Some(val) = tags.get(key) {
                if val == "RU:urban" { return 60; }
                if val == "RU:rural" { return 90; }
            }
        }

        
        if highway == "living_street" {
            return 20;
        }

        
        let urban = self.is_urban(tags) || urban_context;

        match highway {
            "motorway" | "motorway_link" => 110,
            "trunk" | "trunk_link" => {
                
                
                if urban && self.is_urban(tags) { 60 } else { 90 }
            },
            "primary" | "primary_link" => {
                if urban { 60 } else { 90 }
            },
            "secondary" | "secondary_link" | "tertiary" | "tertiary_link" => {
                if urban { 60 } else { 90 }
            },
            "residential" => 60,
            "unclassified" => {
                
                if urban { 60 } else { 90 }
            },
            _ => 60,
        }
    }

    
    fn is_urban(&self, tags: &HashMap<String, String>) -> bool {
        
        if tags.get("lit") == Some(&"yes".to_string()) { return true; }

        
        if let Some(s) = tags.get("sidewalk") {
            if s == "both" || s == "left" || s == "right" || s == "yes" { return true; }
        }

        
        if tags.contains_key("lanes:psv") { return true; }

        
        if tags.contains_key("cycleway") || tags.contains_key("cycleway:right") || tags.contains_key("cycleway:left") {
            return true;
        }

        
        if tags.get("railway:embedded") == Some(&"yes".to_string()) { return true; }
        if let Some(v) = tags.get("embedded_rails") {
            if v == "yes" || v == "tram" { return true; }
        }

        false
    }
}
