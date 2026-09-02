









use std::io::Write;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::path::PathBuf;

use nix::pty::{openpty, OpenptyResult};
use nix::unistd;
use parking_lot::RwLock;
use tokio::sync::broadcast;

use carui_common::{GpsPosition, GpsSource, WsEvent};

#[derive(Clone, Debug)]
pub struct GpxPoint {
    pub lat: f64,
    pub lon: f64,
    pub elevation: Option<f64>,
    pub time: Option<i64>, 
}

#[derive(Clone, Debug, Default)]
pub struct GpsPlaybackState {
    pub route: Vec<GpxPoint>,
    pub current_index: usize,
    
    pub segment_progress: f64,
    pub playing: bool,
    
    pub speed_ms: f64,
    pub speed_multiplier: f32,
}


struct PtyPair {
    master: OwnedFd,
    slave_path: PathBuf,
}

pub struct MockGps {
    position: RwLock<GpsPosition>,
    playback: RwLock<GpsPlaybackState>,
    event_tx: broadcast::Sender<WsEvent>,
    pty: Option<PtyPair>,
    pty_path: RwLock<Option<PathBuf>>,
}

impl MockGps {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(256);

        
        let position = GpsPosition {
            lat: 55.7558,
            lon: 37.6173,
            bearing: 0.0,
            speed_ms: 0.0,
            timestamp: 0,
            source: GpsSource::UBlox, 
        };

        
        let pty = match create_pty() {
            Ok(p) => {
                tracing::info!("GPS PTY created at: {:?}", p.slave_path);
                Some(p)
            }
            Err(e) => {
                tracing::warn!("Failed to create GPS PTY: {} - NMEA output disabled", e);
                None
            }
        };

        let pty_path = RwLock::new(pty.as_ref().map(|p| p.slave_path.clone()));

        Self {
            position: RwLock::new(position),
            playback: RwLock::new(GpsPlaybackState {
                speed_multiplier: 1.0,
                speed_ms: 16.67, 
                ..Default::default()
            }),
            event_tx,
            pty,
            pty_path,
        }
    }

    
    pub fn get_pty_path(&self) -> Option<PathBuf> {
        self.pty_path.read().clone()
    }

    pub fn get_position(&self) -> GpsPosition {
        self.position.read().clone()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }

    pub fn set_position(&self, lat: f64, lon: f64, bearing: f32, speed_kmh: f32) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let pos = GpsPosition {
            lat,
            lon,
            bearing,
            speed_ms: speed_kmh / 3.6,
            timestamp: now,
            source: GpsSource::UBlox,
        };

        *self.position.write() = pos.clone();

        
        self.write_nmea(&pos);

        let event = WsEvent::new("gps", "position", &pos);
        let _ = self.event_tx.send(event);

        tracing::debug!("GPS position: {}, {} @ {}°", lat, lon, bearing);
    }

    
    fn write_nmea(&self, pos: &GpsPosition) {
        if let Some(ref pty) = self.pty {
            let gga = format_nmea_gga(pos);
            let rmc = format_nmea_rmc(pos);

            
            let mut master_file = unsafe {
                std::fs::File::from_raw_fd(pty.master.as_raw_fd())
            };

            let _ = writeln!(master_file, "{}", gga);
            let _ = writeln!(master_file, "{}", rmc);

            
            std::mem::forget(master_file);
        }
    }

    pub fn load_gpx(&self, gpx_content: &str) -> anyhow::Result<usize> {
        let gpx: gpx::Gpx = gpx::read(gpx_content.as_bytes())?;

        let mut points = Vec::new();

        
        for track in gpx.tracks {
            for segment in track.segments {
                for point in segment.points {
                    points.push(GpxPoint {
                        lat: point.point().y(),
                        lon: point.point().x(),
                        elevation: point.elevation,
                        time: point.time.map(|t| {
                            let odt: time::OffsetDateTime = t.into();
                            odt.unix_timestamp()
                        }),
                    });
                }
            }
        }

        
        for route in gpx.routes {
            for point in route.points {
                points.push(GpxPoint {
                    lat: point.point().y(),
                    lon: point.point().x(),
                    elevation: point.elevation,
                    time: point.time.map(|t| {
                        let odt: time::OffsetDateTime = t.into();
                        odt.unix_timestamp()
                    }),
                });
            }
        }

        
        for point in gpx.waypoints {
            points.push(GpxPoint {
                lat: point.point().y(),
                lon: point.point().x(),
                elevation: point.elevation,
                time: point.time.map(|t| {
                    let odt: time::OffsetDateTime = t.into();
                    odt.unix_timestamp()
                }),
            });
        }

        let count = points.len();

        {
            let mut playback = self.playback.write();
            playback.route = points;
            playback.current_index = 0;
            playback.segment_progress = 0.0;
            playback.playing = false;
        }

        tracing::info!("Loaded GPX with {} points", count);
        Ok(count)
    }

    pub fn start_playback(&self) {
        let mut playback = self.playback.write();
        if !playback.route.is_empty() {
            playback.playing = true;
            tracing::info!("Started GPX playback");
        }
    }

    pub fn pause_playback(&self) {
        let mut playback = self.playback.write();
        playback.playing = false;
        tracing::info!("Paused GPX playback");
    }

    pub fn reset_playback(&self) {
        let mut playback = self.playback.write();
        playback.current_index = 0;
        playback.segment_progress = 0.0;
        playback.playing = false;
        tracing::info!("Reset GPX playback");
    }

    pub fn set_speed_multiplier(&self, multiplier: f32) {
        let mut playback = self.playback.write();
        playback.speed_multiplier = multiplier.clamp(0.1, 100.0);
        tracing::info!("Speed multiplier: {}x", playback.speed_multiplier);
    }

    
    pub fn set_speed(&self, speed_ms: f64) {
        let mut playback = self.playback.write();
        playback.speed_ms = speed_ms.max(0.1); 
        tracing::info!("Movement speed: {} m/s ({} km/h)", speed_ms, speed_ms * 3.6);
    }

    pub fn get_playback_state(&self) -> GpsPlaybackState {
        self.playback.read().clone()
    }

    
    
    pub fn tick(&self, delta_seconds: f64) -> bool {
        let mut playback = self.playback.write();

        if !playback.playing || playback.route.len() < 2 {
            return false;
        }

        let mut idx = playback.current_index;
        let mut progress = playback.segment_progress;

        
        if idx >= playback.route.len() - 1 {
            idx = 0;
            progress = 0.0;
            playback.current_index = 0;
            playback.segment_progress = 0.0;
        }

        let from = &playback.route[idx];
        let to = &playback.route[idx + 1];

        
        let segment_distance = carui_common::geo::haversine_m(from.lat, from.lon, to.lat, to.lon);

        
        let effective_speed = playback.speed_ms * playback.speed_multiplier as f64;
        let distance_traveled = effective_speed * delta_seconds;

        
        let distance_remaining = segment_distance * (1.0 - progress);

        
        let (new_lat, new_lon, new_progress, new_idx) = if distance_traveled >= distance_remaining {
            
            let mut remaining_distance = distance_traveled - distance_remaining;
            let mut current_idx = idx + 1;

            
            while current_idx < playback.route.len() - 1 {
                let seg_from = &playback.route[current_idx];
                let seg_to = &playback.route[current_idx + 1];
                let seg_dist = carui_common::geo::haversine_m(
                    seg_from.lat, seg_from.lon, seg_to.lat, seg_to.lon
                );

                if remaining_distance < seg_dist {
                    
                    break;
                }

                remaining_distance -= seg_dist;
                current_idx += 1;
            }

            if current_idx >= playback.route.len() - 1 {
                
                let last = &playback.route[playback.route.len() - 1];
                (last.lat, last.lon, 0.0, 0)
            } else {
                let seg_from = &playback.route[current_idx];
                let seg_to = &playback.route[current_idx + 1];
                let seg_dist = carui_common::geo::haversine_m(
                    seg_from.lat, seg_from.lon, seg_to.lat, seg_to.lon
                );
                let new_prog = if seg_dist > 0.0 { remaining_distance / seg_dist } else { 0.0 };
                let lat = seg_from.lat + (seg_to.lat - seg_from.lat) * new_prog;
                let lon = seg_from.lon + (seg_to.lon - seg_from.lon) * new_prog;
                (lat, lon, new_prog, current_idx)
            }
        } else {
            
            let additional_progress = if segment_distance > 0.0 {
                distance_traveled / segment_distance
            } else {
                1.0 
            };
            let new_prog = progress + additional_progress;
            let lat = from.lat + (to.lat - from.lat) * new_prog;
            let lon = from.lon + (to.lon - from.lon) * new_prog;
            (lat, lon, new_prog, idx)
        };

        
        playback.current_index = new_idx;
        playback.segment_progress = new_progress;

        
        let bearing_idx = new_idx;
        let bearing = if bearing_idx + 1 < playback.route.len() {
            let current = &playback.route[bearing_idx];
            let next = &playback.route[bearing_idx + 1];
            carui_common::geo::bearing(current.lat, current.lon, next.lat, next.lon) as f32
        } else if playback.route.len() >= 2 {
            
            let prev = &playback.route[playback.route.len() - 2];
            let last = &playback.route[playback.route.len() - 1];
            carui_common::geo::bearing(prev.lat, prev.lon, last.lat, last.lon) as f32
        } else {
            0.0
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let pos = GpsPosition {
            lat: new_lat,
            lon: new_lon,
            bearing,
            speed_ms: (effective_speed) as f32,
            timestamp: now,
            source: GpsSource::UBlox,
        };

        drop(playback);
        *self.position.write() = pos.clone();

        
        self.write_nmea(&pos);

        let event = WsEvent::new("gps", "position", &pos);
        let _ = self.event_tx.send(event);

        true
    }

    
    pub async fn run_playback_loop(&self) {
        const TICK_INTERVAL_MS: u64 = 100; 

        loop {
            let state = self.playback.read().clone();

            if state.playing && state.route.len() >= 2 {
                let delta_seconds = TICK_INTERVAL_MS as f64 / 1000.0;
                self.tick(delta_seconds);
                tokio::time::sleep(tokio::time::Duration::from_millis(TICK_INTERVAL_MS)).await;
            } else {
                
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                let pos = self.position.read().clone();
                self.write_nmea(&pos);
            }
        }
    }
}

impl Default for MockGps {
    fn default() -> Self {
        Self::new()
    }
}


fn create_pty() -> anyhow::Result<PtyPair> {
    let OpenptyResult { master, slave } = openpty(None, None)?;

    
    let slave_path = unistd::ttyname(&slave)?;

    
    let symlink_path = PathBuf::from("/tmp/mock-gps");
    let _ = std::fs::remove_file(&symlink_path); 
    std::os::unix::fs::symlink(&slave_path, &symlink_path)?;

    tracing::info!("GPS PTY: {} -> {}", symlink_path.display(), slave_path.display());

    Ok(PtyPair {
        master,
        slave_path: symlink_path,
    })
}


fn format_nmea_gga(pos: &GpsPosition) -> String {
    let now = chrono::Utc::now();
    let time_str = now.format("%H%M%S.00").to_string();

    let (lat_str, lat_dir) = decimal_to_nmea_lat(pos.lat);
    let (lon_str, lon_dir) = decimal_to_nmea_lon(pos.lon);

    let sentence = format!(
        "GPGGA,{},{},{},{},{},1,08,1.0,0.0,M,0.0,M,,",
        time_str, lat_str, lat_dir, lon_str, lon_dir
    );

    format!("${}*{:02X}", sentence, nmea_checksum(&sentence))
}


fn format_nmea_rmc(pos: &GpsPosition) -> String {
    let now = chrono::Utc::now();
    let time_str = now.format("%H%M%S.00").to_string();
    let date_str = now.format("%d%m%y").to_string();

    let (lat_str, lat_dir) = decimal_to_nmea_lat(pos.lat);
    let (lon_str, lon_dir) = decimal_to_nmea_lon(pos.lon);

    
    let speed_knots = pos.speed_ms * 1.94384;

    let sentence = format!(
        "GPRMC,{},A,{},{},{},{},{:.1},{:.1},{},,,A",
        time_str,
        lat_str, lat_dir,
        lon_str, lon_dir,
        speed_knots,
        pos.bearing,
        date_str
    );

    format!("${}*{:02X}", sentence, nmea_checksum(&sentence))
}


fn decimal_to_nmea_lat(decimal: f64) -> (String, char) {
    let dir = if decimal >= 0.0 { 'N' } else { 'S' };
    let decimal = decimal.abs();
    let deg = decimal as u32;
    let min = (decimal - deg as f64) * 60.0;
    
    (format!("{:02}{:07.4}", deg, min), dir)
}


fn decimal_to_nmea_lon(decimal: f64) -> (String, char) {
    let dir = if decimal >= 0.0 { 'E' } else { 'W' };
    let decimal = decimal.abs();
    let deg = decimal as u32;
    let min = (decimal - deg as f64) * 60.0;
    
    (format!("{:03}{:07.4}", deg, min), dir)
}


fn nmea_checksum(sentence: &str) -> u8 {
    sentence.bytes().fold(0, |acc, b| acc ^ b)
}
