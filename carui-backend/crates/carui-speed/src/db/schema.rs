

use std::time::Duration;
use parking_lot::Mutex;
use rusqlite::{params, Connection};

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Clone, Debug)]
pub struct RoadSegment {
    pub id: i64,            
    pub osm_id: i64,        
    pub maxspeed: i32,      
    pub highway_type: String, 
    pub name: Option<String>,
    pub polyline: Vec<(f64, f64)>,
}

#[derive(Clone, Debug)]
pub struct Camera {
    pub osm_id: i64,
    pub lat: f64,
    pub lon: f64,
    pub maxspeed: Option<i32>,
}

impl RoadSegment {
    pub fn bounding_box(&self) -> (f64, f64, f64, f64) {
        let mut min_lat = f64::MAX;
        let mut max_lat = f64::MIN;
        let mut min_lon = f64::MAX;
        let mut max_lon = f64::MIN;

        for &(lat, lon) in &self.polyline {
            min_lat = min_lat.min(lat);
            max_lat = max_lat.max(lat);
            min_lon = min_lon.min(lon);
            max_lon = max_lon.max(lon);
        }

        (min_lat, max_lat, min_lon, max_lon)
    }
}

impl Database {
    pub fn open(path: &str) -> anyhow::Result<Self> {
        if let Some(parent) = std::path::Path::new(path).parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;

        
        conn.busy_timeout(Duration::from_secs(5))?;

        
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn migrate(&self) -> anyhow::Result<()> {
        let conn = self.conn.lock();
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS osm_segments (
                id INTEGER PRIMARY KEY,
                osm_id INTEGER UNIQUE NOT NULL, -- Добавили UNIQUE
                maxspeed INTEGER NOT NULL,
                highway_type TEXT NOT NULL,
                name TEXT,
                tile_key TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_osm_tile ON osm_segments(tile_key);

            -- Точки храним отдельно, чтобы не мучаться с BLOB парсингом в SQL
            CREATE TABLE IF NOT EXISTS segment_points (
                segment_id INTEGER NOT NULL,
                point_index INTEGER NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                PRIMARY KEY (segment_id, point_index),
                FOREIGN KEY(segment_id) REFERENCES osm_segments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS osm_cameras (
                osm_id INTEGER PRIMARY KEY,
                maxspeed INTEGER,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                tile_key TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cam_tile ON osm_cameras(tile_key);

            CREATE TABLE IF NOT EXISTS tile_cache (
                tile_key TEXT PRIMARY KEY,
                loaded_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
        "#,
        )?;
        Ok(())
    }

    pub fn is_tile_cached(&self, tile_key: &str) -> bool {
        let conn = self.conn.lock();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        conn.query_row(
            "SELECT 1 FROM tile_cache WHERE tile_key = ? AND expires_at > ?",
            params![tile_key, now],
            |_| Ok(()),
        )
            .is_ok()
    }

    pub fn mark_tile_cached(&self, tile_key: &str, ttl_days: u32) -> anyhow::Result<()> {
        let conn = self.conn.lock();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let expires = now + (ttl_days as i64) * 24 * 60 * 60;

        conn.execute(
            "INSERT OR REPLACE INTO tile_cache (tile_key, loaded_at, expires_at) VALUES (?, ?, ?)",
            params![tile_key, now, expires],
        )?;
        Ok(())
    }

    pub fn save_cameras_batch(&self, cameras: &[Camera], tile_key: &str) -> anyhow::Result<()> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO osm_cameras (osm_id, maxspeed, lat, lon, tile_key) VALUES (?, ?, ?, ?, ?)"
            )?;
            for cam in cameras {
                stmt.execute(params![cam.osm_id, cam.maxspeed, cam.lat, cam.lon, tile_key])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn load_all_cameras(&self) -> anyhow::Result<Vec<Camera>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare("SELECT osm_id, maxspeed, lat, lon FROM osm_cameras")?;
        let rows = stmt.query_map([], |row| {
            Ok(Camera {
                osm_id: row.get(0)?,
                maxspeed: row.get(1)?,
                lat: row.get(2)?,
                lon: row.get(3)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(rows)
    }

    
    pub fn save_segments_batch(&self, segments: &[RoadSegment], tile_key: &str) -> anyhow::Result<Vec<RoadSegment>> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        let mut saved_segments = Vec::new();

        {
            
            let mut seg_stmt = tx.prepare(
                "INSERT OR REPLACE INTO osm_segments (osm_id, maxspeed, highway_type, name, tile_key, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
            )?;
            let mut pts_stmt = tx.prepare(
                "INSERT INTO segment_points (segment_id, point_index, lat, lon) VALUES (?, ?, ?, ?)"
            )?;

            for seg in segments {
                
                seg_stmt.execute(params![
                    seg.osm_id,
                    seg.maxspeed,
                    seg.highway_type,
                    seg.name,
                    tile_key,
                    now
                ])?;

                let db_id = tx.last_insert_rowid();

                
                tx.execute("DELETE FROM segment_points WHERE segment_id = ?", [db_id])?;

                
                for (i, &(lat, lon)) in seg.polyline.iter().enumerate() {
                    pts_stmt.execute(params![db_id, i as i32, lat, lon])?;
                }

                let mut saved = seg.clone();
                saved.id = db_id;
                saved_segments.push(saved);
            }
        }

        tx.commit()?;
        Ok(saved_segments)
    }

    pub fn save_segment(&self, seg: &RoadSegment, tile_key: &str) -> anyhow::Result<i64> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        
        tx.execute(
            r#"
            INSERT INTO osm_segments
            (osm_id, maxspeed, highway_type, name, tile_key, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
            params![
                seg.osm_id,
                seg.maxspeed,
                seg.highway_type,
                seg.name,
                tile_key,
                now
            ],
        )?;

        let id = tx.last_insert_rowid();

        
        
        {
            let mut stmt = tx.prepare("INSERT INTO segment_points (segment_id, point_index, lat, lon) VALUES (?, ?, ?, ?)")?;
            for (i, &(lat, lon)) in seg.polyline.iter().enumerate() {
                stmt.execute(params![id, i as i32, lat, lon])?;
            }
        }

        tx.commit()?;
        Ok(id)
    }

    pub fn load_all_segments(&self) -> anyhow::Result<Vec<RoadSegment>> {
        let conn = self.conn.lock();

        let mut stmt = conn.prepare(
            r#"
            SELECT id, osm_id, maxspeed, highway_type, name
            FROM osm_segments
        "#,
        )?;

        let rows: Vec<_> = stmt
            .query_map([], |row| {
                Ok(RoadSegment {
                    id: row.get(0)?,
                    osm_id: row.get(1)?,
                    maxspeed: row.get(2)?,
                    highway_type: row.get(3)?,
                    name: row.get(4)?,
                    polyline: Vec::new(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        
        
        
        let mut result = Vec::with_capacity(rows.len());
        for mut seg in rows {
            let mut pts = conn
                .prepare("SELECT lat, lon FROM segment_points WHERE segment_id = ? ORDER BY point_index")?;
            seg.polyline = pts
                .query_map([seg.id], |row| Ok((row.get::<_, f64>(0)?, row.get::<_, f64>(1)?)))?
                .filter_map(|r| r.ok())
                .collect();

            if !seg.polyline.is_empty() {
                result.push(seg);
            }
        }

        Ok(result)
    }
}
