

use rstar::{RTree, RTreeObject, AABB};
use crate::db::{Database, RoadSegment, Camera};

#[derive(Clone)]
struct SegmentEnvelope {
    segment: RoadSegment,
    envelope: AABB<[f64; 2]>,
}

impl RTreeObject for SegmentEnvelope {
    type Envelope = AABB<[f64; 2]>;
    fn envelope(&self) -> Self::Envelope {
        self.envelope
    }
}

#[derive(Clone)]
pub struct CameraEnvelope {
    pub camera: Camera,
}

impl RTreeObject for CameraEnvelope {
    type Envelope = AABB<[f64; 2]>;
    fn envelope(&self) -> Self::Envelope {
        
        AABB::from_point([self.camera.lat, self.camera.lon])
    }
}

pub struct RTreeIndex {
    segment_tree: RTree<SegmentEnvelope>,
    camera_tree: RTree<CameraEnvelope>,
}

impl RTreeIndex {
    pub fn new() -> Self {
        Self {
            segment_tree: RTree::new(),
            camera_tree: RTree::new(),
        }
    }

    
    pub fn load_from_db(db: &Database) -> anyhow::Result<Self> {
        
        let segments = db.load_all_segments()?;
        let segment_envelopes: Vec<_> = segments
            .into_iter()
            .filter(|seg| !seg.polyline.is_empty())
            .map(|seg| {
                let (min_lat, max_lat, min_lon, max_lon) = seg.bounding_box();
                SegmentEnvelope {
                    segment: seg,
                    envelope: AABB::from_corners([min_lat, min_lon], [max_lat, max_lon]),
                }
            })
            .collect();

        
        let cameras = db.load_all_cameras()?;
        let camera_envelopes: Vec<_> = cameras
            .into_iter()
            .map(|cam| CameraEnvelope { camera: cam })
            .collect();

        tracing::info!(
            "R-Tree loaded: {} segments, {} cameras",
            segment_envelopes.len(),
            camera_envelopes.len()
        );

        Ok(Self {
            segment_tree: RTree::bulk_load(segment_envelopes),
            camera_tree: RTree::bulk_load(camera_envelopes),
        })
    }

    
    pub fn query_segments(&self, lat: f64, lon: f64, radius: f64) -> Vec<RoadSegment> {
        let env = AABB::from_corners(
            [lat - radius, lon - radius],
            [lat + radius, lon + radius]
        );
        self.segment_tree
            .locate_in_envelope_intersecting(&env)
            .map(|e| e.segment.clone())
            .collect()
    }

    
    pub fn query_cameras(&self, lat: f64, lon: f64, radius: f64) -> Vec<Camera> {
        let env = AABB::from_corners(
            [lat - radius, lon - radius],
            [lat + radius, lon + radius]
        );
        self.camera_tree
            .locate_in_envelope_intersecting(&env)
            .map(|e| e.camera.clone())
            .collect()
    }

    
    pub fn insert_segment(&mut self, segment: RoadSegment) {
        if segment.polyline.is_empty() { return; }
        let (min_lat, max_lat, min_lon, max_lon) = segment.bounding_box();
        self.segment_tree.insert(SegmentEnvelope {
            segment,
            envelope: AABB::from_corners([min_lat, min_lon], [max_lat, max_lon]),
        });
    }

    
    pub fn insert_camera(&mut self, camera: Camera) {
        self.camera_tree.insert(CameraEnvelope { camera });
    }

    pub fn segments_count(&self) -> usize {
        self.segment_tree.size()
    }

    pub fn cameras_count(&self) -> usize {
        self.camera_tree.size()
    }
}

impl Default for RTreeIndex {
    fn default() -> Self {
        Self::new()
    }
}