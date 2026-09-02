

use std::sync::Arc;
use tokio::sync::RwLock;
use dashmap::DashMap;
use carui_common::geo::{lat_lon_to_tile};

use crate::db::Database;
use crate::matching::RTreeIndex;
use crate::osm::OverpassClient;

pub struct OsmManager {
    client: OverpassClient,
    tile_ttl_days: u32,
    
    
    active_requests: DashMap<String, u64>,
}

impl OsmManager {
    pub fn new(overpass_url: String, tile_ttl_days: u32) -> Self {
        Self {
            client: OverpassClient::new(overpass_url),
            tile_ttl_days,
            active_requests: DashMap::new(),
        }
    }

    
    pub async fn check_and_fetch(
        &self,
        lat: f64,
        lon: f64,
        db: &Arc<Database>,
        rtree: &RwLock<RTreeIndex>,
    ) {
        
        let zoom = 12;
        let (x, y) = lat_lon_to_tile(lat, lon, zoom);
        let tile_key = format!("osm_{}_{}_{}", zoom, x, y);

        
        if self.active_requests.contains_key(&tile_key) {
            tracing::debug!("Tile {} is already being fetched, skipping", tile_key);
            return;
        }

        
        if db.is_tile_cached(&tile_key) {
            return;
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.active_requests.insert(tile_key.clone(), now);

        tracing::info!("Cache miss for tile {}. Starting download...", tile_key);

        let result = self.do_fetch(lat, lon, &tile_key, db, rtree).await;

        
        self.active_requests.remove(&tile_key);

        if let Err(e) = result {
            tracing::error!("Failed to fetch tile {}: {}", tile_key, e);
        }
    }

    async fn do_fetch(
        &self,
        lat: f64,
        lon: f64,
        tile_key: &str,
        db: &Arc<Database>,
        rtree: &RwLock<RTreeIndex>,
    ) -> anyhow::Result<()> {
        
        let (segments, cameras) = self.client.fetch_data(lat, lon, 4000).await?;
        let cam_length = cameras.len();

        if segments.is_empty() && cameras.is_empty() {
            db.mark_tile_cached(tile_key, self.tile_ttl_days)?;
            return Ok(());
        }

        
        let saved_segments = if !segments.is_empty() {
            db.save_segments_batch(&segments, tile_key)?
        } else {
            Vec::new()
        };

        if !cameras.is_empty() {
            db.save_cameras_batch(&cameras, tile_key)?;
        }

        
        {
            let mut rtree_guard = rtree.write().await;

            
            for seg in saved_segments {
                rtree_guard.insert_segment(seg);
            }

            
            for cam in cameras {
                rtree_guard.insert_camera(cam);
            }
        }

        db.mark_tile_cached(tile_key, self.tile_ttl_days)?;
        tracing::info!(
            "Cached tile {}: {} roads, {} cameras", 
            tile_key, segments.len(), cam_length
        );

        Ok(())
    }
}